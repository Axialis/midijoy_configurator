// Constants
const DEVICE_CONFIG = {
    baudRate: 115200
};

// SP404 MK2 CC Options for dropdown menus
const SP404_CC_OPTIONS = [
    { value: 0, name: 'CTRL1 (Effect Knob 1)' },
    { value: 1, name: 'CTRL2 (Effect Knob 2)' },
    { value: 2, name: 'CTRL3 (Effect Knob 3)' },
    { value: 3, name: 'Bus 1 Assign' },
    { value: 4, name: 'Bus 2 Assign' },
    { value: 5, name: 'Bus 3 Assign' },
    { value: 6, name: 'Bus 4 Assign' },
    { value: 7, name: 'MFX Select' },
    { value: 8, name: 'MFX On/Off' },
    { value: 9, name: 'MFX Param 1' },
    { value: 10, name: 'MFX Param 2' },
    { value: 11, name: 'MFX Param 3' },
    { value: 12, name: 'BPM Sync' },
    { value: 13, name: 'Gate Mode' },
    { value: 14, name: 'Loop Mode' },
    { value: 15, name: 'Reverse' },
    { value: 16, name: 'Roll' },
    { value: 17, name: 'Fixed Velocity' },
    { value: 18, name: 'Pad Mute' },
    { value: 19, name: 'Pattern Select' },
    { value: 20, name: 'Pattern Start' },
    { value: 21, name: 'Pattern Stop' },
    { value: 22, name: 'DJ Mode Enable' },
    { value: 23, name: 'Input Level' },
    { value: 24, name: 'Input FX Type' },
    { value: 25, name: 'Count In' },
    { value: 26, name: 'End Snap' },
    { value: 27, name: 'Looper Record' },
    { value: 28, name: 'Looper Overdub' },
    { value: 29, name: 'Looper Undo' },
    { value: 30, name: 'Looper Redo' },
    { value: 127, name: 'Disabled' }
];

const MsgType = {
    GAMEPAD_DATA: 0,          // Gamepad state data (axes, buttons)
    CURRENT_CONFIGURATION: 1, // Configuration data response
    ERROR_FIFO_READ: 2,
    ERROR_PACKING_FAILED: 3,
    ERROR_TRANSPORT_FAILED: 4,
    ERROR_INVALID_DATA: 5,
    ERROR_DEVICE_DISCONNECTED: 6,
    // Configuration protocol messages
    GET_CONFIGURATION: 7,
    SET_CONFIGURATION: 8,
    SAVE_CONFIGURATION: 9,
    RESET_CONFIGURATION: 10,
    CONFIGURATION_SAVED: 11,
    CONFIGURATION_ERROR: 12,
    // Firmware info messages
    GET_FIRMWARE_INFO: 13,
    FIRMWARE_INFO: 14
};

// HDLC Protocol constants
const HDLC = {
    FRAME_START: 0x7E,
    FRAME_END: 0x7F,
    ESCAPE_CHAR: 0x7D,
    XOR_VALUE: 0x20
};

// Gamepad Constants
const DPAD = {
    UP: 0x00,
    UP_RIGHT: 0x01,
    RIGHT: 0x02,
    DOWN_RIGHT: 0x03,
    DOWN: 0x04,
    DOWN_LEFT: 0x05,
    LEFT: 0x06,
    UP_LEFT: 0x07,
    NONE: 0x08
};

const BUTTONS = {
    X: 0x10,
    A: 0x20,
    B: 0x40,
    Y: 0x80,
    LB: 0x01,
    RB: 0x02,
    LT: 0x04,
    RT: 0x08,
    BACK: 0x10,
    START: 0x20,
    L3: 0x40,
    R3: 0x80
};


// Global variables
let serialPort = null;
let reader = null;
let serialBuffer = new Uint8Array(0);
let gamepadState = createGamepadState();

// Gamepad Functions
function createGamepadState() {
    return {
        axes: {
            lx: 0,
            ly: 0,
            rx: 0,
            ry: 0
        },
        dpad: {
            direction: null,
            raw: 0
        },
        buttons: {
            x: false,
            a: false,
            b: false,
            y: false,
            lb: false,
            rb: false,
            lt: false,
            rt: false,
            back: false,
            start: false,
            mode: false,
            l3: false,
            r3: false,
            dpadRaw: 0,
            buttonsRaw: 0
        }
    };
}

function updateGamepadState(state, data) {
    if (!data || data.length < 6) return state;

    state.axes.lx = data[0];
    state.axes.ly = data[1];
    state.axes.rx = data[2];
    state.axes.ry = data[3];

    const dpadBtns = data[4];
    state.dpad.raw = dpadBtns;

    const dpadVal = dpadBtns & 0x0F;
    switch (dpadVal) {
        case DPAD.UP: state.dpad.direction = 'up'; break;
        case DPAD.UP_RIGHT: state.dpad.direction = 'up-right'; break;
        case DPAD.RIGHT: state.dpad.direction = 'right'; break;
        case DPAD.DOWN_RIGHT: state.dpad.direction = 'down-right'; break;
        case DPAD.DOWN: state.dpad.direction = 'down'; break;
        case DPAD.DOWN_LEFT: state.dpad.direction = 'down-left'; break;
        case DPAD.LEFT: state.dpad.direction = 'left'; break;
        case DPAD.UP_LEFT: state.dpad.direction = 'up-left'; break;
        case DPAD.NONE: state.dpad.direction = 'none'; break;
        default: state.dpad.direction = null; break;
    }

    state.buttons.x = !!(dpadBtns & BUTTONS.X);
    state.buttons.a = !!(dpadBtns & BUTTONS.A);
    state.buttons.b = !!(dpadBtns & BUTTONS.B);
    state.buttons.y = !!(dpadBtns & BUTTONS.Y);

    const buttons = data[5];
    state.buttons.buttonsRaw = buttons;

    state.buttons.lb = !!(buttons & BUTTONS.LB);
    state.buttons.rb = !!(buttons & BUTTONS.RB);
    state.buttons.lt = !!(buttons & BUTTONS.LT);
    state.buttons.rt = !!(buttons & BUTTONS.RT);
    state.buttons.back = !!(buttons & BUTTONS.BACK);
    state.buttons.start = !!(buttons & BUTTONS.START);
    state.buttons.l3 = !!(buttons & BUTTONS.L3);
    state.buttons.r3 = !!(buttons & BUTTONS.R3);

    updateSVGColors(state);
    updateJoystickPositions(state);
    return state;
}

function updateJoystickPositions(state) {
    const lx = (state.axes.lx - 128) / 128;
    const ly = (state.axes.ly - 128) / 128;
    const rx = (state.axes.rx - 128) / 128;
    const ry = (state.axes.ry - 128) / 128;

    const l3Element = document.querySelector('.l3');
    const r3Element = document.querySelector('.r3');
    
    if (l3Element) {
        const l3Center = getCenter(l3Element);
        const leftIndicator = document.querySelector('#left-joystick-indicator');
        if (leftIndicator) {
            leftIndicator.setAttribute('cx', l3Center.x + lx * 60);
            leftIndicator.setAttribute('cy', l3Center.y + ly * 60);
        }
    }

    if (r3Element) {
        const r3Center = getCenter(r3Element);
        const rightIndicator = document.querySelector('#right-joystick-indicator');
        if (rightIndicator) {
            rightIndicator.setAttribute('cx', r3Center.x + rx * 60);
            rightIndicator.setAttribute('cy', r3Center.y + ry * 60);
        }
    }
}

function getCenter(element) {
    const bbox = element.getBBox();
    return {
        x: bbox.x + bbox.width / 2,
        y: bbox.y + bbox.height / 2
    };
}

function formatGamepadState(state) {
    if (!state) return "";

    let output = [];
    output.push(
        `LX:${state.axes.lx.toString().padStart(3)} ` +
        `LY:${state.axes.ly.toString().padStart(3)} ` +
        `RX:${state.axes.rx.toString().padStart(3)} ` +
        `RY:${state.axes.ry.toString().padStart(3)}`
    );

    const directionNames = {
        'up': 'UP',
        'up-right': 'UP-RIGHT',
        'right': 'RIGHT',
        'down-right': 'DOWN-RIGHT',
        'down': 'DOWN',
        'down-left': 'DOWN-LEFT',
        'left': 'LEFT',
        'up-left': 'UP-LEFT',
        'none': 'NONE',
        null: 'UNKNOWN'
    };

    output.push(`DPAD:${directionNames[state.dpad.direction]}`);

    const activeButtons = [];
    if (state.buttons.x) activeButtons.push('X');
    if (state.buttons.a) activeButtons.push('A');
    if (state.buttons.b) activeButtons.push('B');
    if (state.buttons.y) activeButtons.push('Y');
    if (state.buttons.lb) activeButtons.push('LB');
    if (state.buttons.rb) activeButtons.push('RB');
    if (state.buttons.lt) activeButtons.push('LT');
    if (state.buttons.rt) activeButtons.push('RT');
    if (state.buttons.back) activeButtons.push('BACK');
    if (state.buttons.start) activeButtons.push('START');
    if (state.buttons.l3) activeButtons.push('L3');
    if (state.buttons.r3) activeButtons.push('R3');

    output.push(`Btns:${activeButtons.join('') || 'NONE'}`);

    output.push(
        `RAW: ${state.dpad.raw.toString(16).padStart(2, '0')} ` +
        `${state.buttons.buttonsRaw.toString(16).padStart(2, '0')}`
    );

    return output.join(' | ');
}

// DOM and UI Functions
async function loadSVG(svgPath, targetContainerId) {
    try {
        const response = await fetch(svgPath);
        if (!response.ok) throw new Error('SVG load failed');

        const svgText = await response.text();
        const container = document.getElementById(targetContainerId);
        container.innerHTML = svgText;

        const svgElement = container.querySelector('svg');
        if (svgElement) {
            svgElement.setAttribute('preserveAspectRatio', 'xMidYMid meet');
            svgElement.style.maxHeight = '100%';
            svgElement.style.display = 'block';
            svgElement.style.margin = '0 auto';
            return svgElement;
        }
    } catch (error) {
        console.error('Error loading SVG:', error);
        return null;
    }
}

function updateDeviceStatus(message, isError = false) {
    const status = document.getElementById('device-status');
    status.textContent = message;
    status.style.color = isError ? 'black' : 'green';
}

function displayFrame(data) {
    const output = document.getElementById('output');
    if (!output || data.length === 0) return;

    const payload = data.slice(1);
    let hexArray = Array.from(payload).map(b => b.toString(16).padStart(2, '0'));

    const trimTrailingZeros = (arr) => {
        let lastNonZero = arr.length - 1;
        while (lastNonZero >= 0 && arr[lastNonZero] === '00') {
            lastNonZero--;
        }
        return arr.slice(0, lastNonZero + 1);
    };

    const trimmedHex = trimTrailingZeros(hexArray);
    const hexPayload = trimmedHex.join(' ');

    const messageText = `${hexPayload}`;

    const messageElement = document.createElement('div');
    messageElement.textContent = messageText;

    output.insertBefore(messageElement, output.firstChild);
    messageElement.style.backgroundColor = '#acff9bff';
    setTimeout(() => messageElement.style.backgroundColor = '', 100);

    const maxMessages = 20;
    if (output.children.length > maxMessages) {
        output.removeChild(output.lastChild);
    }

    output.scrollTop = 0;
    output.appendChild(messageElement);
    output.scrollTop = output.scrollHeight;
}

// Serial Communication Functions
async function findSerialDevices() {
    try {
        if (!('serial' in navigator)) {
            throw new Error('Web Serial API not supported in your browser');
        }

        const port = await navigator.serial.requestPort();
        return port;
    } catch (error) {
        console.error('Serial Error:', error);
        throw error;
    }
}

async function connectToSerial(port) {
    try {
        await port.open({ baudRate: DEVICE_CONFIG.baudRate });

        reader = port.readable.getReader();
        readSerialData(reader);

        port.addEventListener('disconnect', () => {
            handleDisconnection();
        });

        return port;
    } catch (error) {
        console.error('Connection Error:', error);
        throw error;
    }
}

async function readSerialData(reader) {
    try {
        while (true) {
            const { value, done } = await reader.read();
            if (done) {
                handleDisconnection();
                break;
            }

            const newData = new Uint8Array(value);
            const tempBuffer = new Uint8Array(serialBuffer.length + newData.length);
            tempBuffer.set(serialBuffer);
            tempBuffer.set(newData, serialBuffer.length);
            serialBuffer = tempBuffer;

            processBuffer();
        }
    } catch (error) {
        console.error('Read Error:', error);
        updateDeviceStatus('Read error', true);
        handleDisconnection();
    }
}

function processBuffer() {
    const startIndex = serialBuffer.indexOf(0x7E);
    if (startIndex === -1) {
        serialBuffer = new Uint8Array(0);
        return;
    }

    serialBuffer = serialBuffer.slice(startIndex);
    let endIndex = -1;
    let i = 1;
    while (i < serialBuffer.length) {
        if (serialBuffer[i] === 0x7D) { // ESCAPE_CHAR
            i += 2;
        } else if (serialBuffer[i] === 0x7F) {
            endIndex = i;
            break;
        } else {
            i++;
        }
    }

    if (endIndex === -1) return;

    const frame = serialBuffer.slice(1, endIndex);
    serialBuffer = serialBuffer.slice(endIndex + 1);

    const parsedData = parseFrame(frame);

    if (parsedData.length === 0) return;

    const msgType = parsedData[0];
    const payload = parsedData.slice(1);

    // Debug: log all incoming message types
    console.debug(`Msg type=${msgType}, payload len=${payload.length}`);

    switch (msgType) {
        case MsgType.GAMEPAD_DATA:
            // Gamepad data (axes, buttons)
            displayFrame(parsedData);
            updateGamepadState(gamepadState, payload);
            break;

        case MsgType.CURRENT_CONFIGURATION:
            // Configuration data received from device
            if (payload.length === 0) {
                // Empty payload = confirmation that config was applied
                console.log('Configuration applied confirmation');
                updateDeviceStatus('Configuration applied!', false);
            } else if (payload.length >= 93) {
                // Full configuration data
                console.log('Received configuration:', bytesToHex(payload));
                const receivedConfig = bytesToConfig(Array.from(payload));
                if (receivedConfig) {
                    currentConfig = receivedConfig;
                    loadConfigToUI(currentConfig);
                    updateDeviceStatus('Configuration loaded', false);
                } else {
                    updateDeviceStatus('Invalid config data', true);
                }
            } else {
                console.error('Config data too short:', payload.length);
                updateDeviceStatus('Invalid config data (too short)', true);
            }
            break;

        case MsgType.CONFIGURATION_SAVED:
            console.log('Configuration saved to flash!');
            updateDeviceStatus('Configuration saved!', false);
            break;

        case MsgType.CONFIGURATION_ERROR:
            console.error('Configuration error from device');
            updateDeviceStatus('Configuration error!', true);
            break;

        case MsgType.FIRMWARE_INFO:
            // Firmware info: version (3 bytes) + build date/time string
            if (payload.length >= 3) {
                const major = payload[0];
                const minor = payload[1];
                const patch = payload[2];
                const buildTimestamp = new TextDecoder().decode(payload.slice(3));
                const firmwareInfo = `v${major}.${minor}.${patch} (${buildTimestamp.trim()})`;
                console.log('Firmware:', firmwareInfo);
                updateFirmwareDisplay(firmwareInfo);
            }
            break;

        case MsgType.ERROR_FIFO_READ:
        case MsgType.ERROR_PACKING_FAILED:
        case MsgType.ERROR_TRANSPORT_FAILED:
        case MsgType.ERROR_INVALID_DATA:
        case MsgType.ERROR_DEVICE_DISCONNECTED:
            console.error('Device error:', msgType);
            displayFrame(parsedData);
            break;

        default:
            console.log('Unknown message type:', msgType, 'Data:', bytesToHex(payload));
            displayFrame(parsedData);
    }
}

function parseFrame(frame) {
    const result = [];
    let i = 0;
    while (i < frame.length) {
        if (frame[i] === 0x7D) { // ESCAPE_CHAR
            if (i + 1 >= frame.length) break;
            result.push(frame[i + 1] ^ 0x20); // XOR_VALUE = 0x20
            i += 2;
        } else {
            result.push(frame[i]);
            i++;
        }
    }
    return new Uint8Array(result);
}

async function disconnectSerial() {
    try {
        if (reader) {
            await reader.cancel().catch(e => console.error('Reader cancel error:', e));
            reader.releaseLock();
            reader = null;
        }
        if (serialPort) {
            await serialPort.close().catch(e => console.error('Port close error:', e));
            serialPort = null;
        }
    } catch (error) {
        console.error('Disconnection Error:', error);
        throw error;
    }
}

// Send data through serial with HDLC framing
async function sendSerialData(msgType, data = []) {
    if (!serialPort || !serialPort.writable) {
        console.error('Serial port not connected');
        return false;
    }

    try {
        // Build message: [type] + [data...]
        const message = [msgType, ...data];

        // Apply HDLC framing with byte stuffing
        const framedData = [];
        framedData.push(HDLC.FRAME_START);

        for (const byte of message) {
            if (byte === HDLC.FRAME_START || byte === HDLC.FRAME_END || byte === HDLC.ESCAPE_CHAR) {
                framedData.push(HDLC.ESCAPE_CHAR);
                framedData.push(byte ^ HDLC.XOR_VALUE);
            } else {
                framedData.push(byte);
            }
        }

        framedData.push(HDLC.FRAME_END);

        const writer = serialPort.writable.getWriter();
        await writer.write(new Uint8Array(framedData));
        writer.releaseLock();

        console.log('Sent:', bytesToHex(framedData));
        return true;
    } catch (error) {
        console.error('Send Error:', error);
        return false;
    }
}

// Request configuration from device
async function requestConfiguration() {
    return sendSerialData(MsgType.GET_CONFIGURATION);
}

// Save configuration to device flash
async function saveConfigurationToDevice() {
    return sendSerialData(MsgType.SAVE_CONFIGURATION);
}

// Reset configuration to defaults
async function resetConfigurationOnDevice() {
    return sendSerialData(MsgType.RESET_CONFIGURATION);
}

// Request firmware info from device
async function requestFirmwareInfo() {
    return sendSerialData(MsgType.GET_FIRMWARE_INFO);
}

// Update firmware display
function updateFirmwareDisplay(firmwareInfo) {
    const firmwareElement = document.getElementById('firmware-version');
    if (firmwareElement) {
        firmwareElement.textContent = firmwareInfo;
    }
}

function handleDisconnection() {
    const button = document.getElementById('connect-button');
    const status = document.getElementById('device-status');

    disconnectSerial().finally(() => {
        button.textContent = "Find Serial Device";
        status.textContent = "Disconnected (device lost)";
        status.style.color = 'black';
        serialPort = null;
        reader = null;
        updateConfigButtons(false);
    });
}

// Helper Functions
function trimTrailingZeros(hexArray) {
    let lastNonZeroIndex = hexArray.length - 1;
    while (lastNonZeroIndex >= 0 && hexArray[lastNonZeroIndex] === '00') {
        lastNonZeroIndex--;
    }

    return hexArray.slice(0, lastNonZeroIndex + 1);
}

function getEnumKeyByValue(enumObj, value) {
    return Object.keys(enumObj).find(key => enumObj[key] === value);
}

function bytesToHex(bytes) {
    return Array.from(bytes)
        .map(b => b.toString(16).padStart(2, '0'))
        .join(' ');
}

async function getDeviceName(port) {
    try {
        const info = port.getInfo();
        if (info.usbProductName) return info.usbProductName;
        if (info.usbVendorId && info.usbProductId) {
            return `Device (VID: 0x${info.usbVendorId.toString(16)}, PID: 0x${info.usbProductId.toString(16)})`;
        }
        return 'Serial Device';
    } catch (error) {
        console.error('Error getting device name:', error);
        return 'Serial Device';
    }
}

function updateSVGColors(state) {
    if (!state || !state.buttons) return;

    // Кнопка Y (желтый)
    const yElements = document.querySelectorAll('.st52');
    yElements.forEach(el => {
        el.style.fill = state.buttons.y ? '#fff388ff' : '#edbf00';
    });

    const aElements = document.querySelectorAll('.st82');
    aElements.forEach(el => {
        el.style.fill = state.buttons.a ? '#65ff6aff' : '#00aa04';
    });

    const bElements = document.querySelectorAll('.st178');
    bElements.forEach(el => {
        el.style.fill = state.buttons.b ? '#ff847cff' : '#bd0310ff';
    });

    const xElements = document.querySelectorAll('.st193');
    xElements.forEach(el => {
        el.style.fill = state.buttons.x ? '#73c0ffff' : '#156aff';
    });

    const lbElements = document.querySelectorAll('.lb');
    lbElements.forEach(el => {
        el.style.fill = state.buttons.lb ? '#bd0310ff' : '#c6c6c5';
    });

    const rbElements = document.querySelectorAll('.rb');
    rbElements.forEach(el => {
        el.style.fill = state.buttons.rb ? '#bd0310ff' : '#c6c6c5';
    });

    const backElements = document.querySelectorAll('.back');
    backElements.forEach(el => {
        el.style.fill = state.buttons.back ? '#bd0310ff' : '#6d6a6a';
    });

    const startElements = document.querySelectorAll('.start');
    startElements.forEach(el => {
        el.style.fill = state.buttons.start ? '#bd0310ff' : '#6d6a6a';
    });

    const modeElements = document.querySelectorAll('.mode');
    modeElements.forEach(el => {
        el.style.fill = state.buttons.mode ? '#bd0310ff' : '#6d6a6a';
    });

    const l3Elements = document.querySelectorAll('.l3');
    l3Elements.forEach(el => {
        el.style.fill = state.buttons.l3 ? '#bd0310ff' : '#6d6a6a';
    });

    const r3Elements = document.querySelectorAll('.r3');
    r3Elements.forEach(el => {
        el.style.fill = state.buttons.r3 ? '#bd0310ff' : '#6d6a6a';
    });

    updateDPadColors(state.dpad.direction);

}

function updateDPadColors(direction) {
    const directions = ['up', 'down', 'left', 'right'];

    directions.forEach(dir => {
        const elements = document.querySelectorAll(`.dpad-${dir}`);
        elements.forEach(el => {
            el.style.fill = '#717170';
        });
    });

    if (direction && direction !== 'none') {
        const activeDirections = [];

        if (direction.includes('up')) activeDirections.push('up');
        if (direction.includes('down')) activeDirections.push('down');
        if (direction.includes('left')) activeDirections.push('left');
        if (direction.includes('right')) activeDirections.push('right');

        activeDirections.forEach(dir => {
            const activeElements = document.querySelectorAll(`.dpad-${dir}`);
            activeElements.forEach(el => {
                el.style.fill = '#ffffff';
            });
        });
    }
}


// Event Handlers
async function handleConnectButton() {
    const button = document.getElementById('connect-button');
    const status = document.getElementById('device-status');

    try {
        if (serialPort) {
            await disconnectSerial();
            button.textContent = "Find Serial Device";
            status.textContent = "Disconnected";
            updateConfigButtons(false);
            return;
        }

        button.disabled = true;
        status.textContent = "Select serial device...";

        const port = await findSerialDevices();
        serialPort = await connectToSerial(port);

        const deviceName = await getDeviceName(port);
        button.textContent = "Disconnect";
        status.textContent = `Connected to: ${deviceName}`;
        updateConfigButtons(true);

        // Request firmware info on connection
        setTimeout(() => requestFirmwareInfo(), 100);
    } catch (error) {
        console.error('Connection Error:', error);
        status.textContent = `Error: ${error.message}`;
        status.style.color = 'black';
        button.textContent = "Find Serial Device";
        updateConfigButtons(false);
    } finally {
        button.disabled = false;
    }
}

function ensureJoystickIndicatorsExist() {
    const svgDoc = document.querySelector('svg');
    if (!svgDoc) return;

    const leftIndicatorExists = svgDoc.querySelector('#left-joystick-indicator');
    const rightIndicatorExists = svgDoc.querySelector('#right-joystick-indicator');

    if (!leftIndicatorExists) {
        const leftIndicator = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        leftIndicator.id = 'left-joystick-indicator';
        leftIndicator.setAttribute('class', 'joystick-indicator');
        leftIndicator.setAttribute('r', '10');
        leftIndicator.setAttribute('fill', 'rgba(255, 255, 255, 0.7)');
        svgDoc.appendChild(leftIndicator);
    }

    if (!rightIndicatorExists) {
        const rightIndicator = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        rightIndicator.id = 'right-joystick-indicator';
        rightIndicator.setAttribute('class', 'joystick-indicator');
        rightIndicator.setAttribute('r', '10');
        rightIndicator.setAttribute('fill', 'rgba(255, 255, 255, 0.7)');
        svgDoc.appendChild(rightIndicator);
    }
}

// Enable/disable config buttons based on connection state
function updateConfigButtons(enabled) {
    document.getElementById('read-config-button').disabled = !enabled;
    document.getElementById('save-config-button').disabled = !enabled;
    document.getElementById('reset-config-button').disabled = !enabled;
}

// Button mapping types (must match firmware BTN_MAP_* enum)
const BTN_MAP_TYPE = {
    NOTE: 0,
    CC_MOMENTARY: 1,
    CC_TOGGLE: 2,
    PAD: 3
};

// Configuration Panel Functions
let configPanelOpen = false;
let currentConfig = {
    midiChannel: 1,
    axes: {
        lx: { cc_id: 0, min: 0, max: 127, invert: false, deadzone: 10 },
        ly: { cc_id: 1, min: 0, max: 127, invert: false, deadzone: 10 },
        rx: { cc_id: 2, min: 0, max: 127, invert: false, deadzone: 10 },
        ry: { cc_id: 9, min: 0, max: 127, invert: false, deadzone: 10 }
    },
    buttons: {
        // Order: x, a, b, y, lb, rb, lt, rt, back, start, l3, r3
        x:     { type: BTN_MAP_TYPE.CC_MOMENTARY, toggle: false, cc_id: 8 },
        a:     { type: BTN_MAP_TYPE.CC_MOMENTARY, toggle: false, cc_id: 8 },
        b:     { type: BTN_MAP_TYPE.CC_MOMENTARY, toggle: false, cc_id: 8 },
        y:     { type: BTN_MAP_TYPE.CC_MOMENTARY, toggle: false, cc_id: 8 },
        lb:    { type: BTN_MAP_TYPE.CC_MOMENTARY, toggle: false, cc_id: 8 },
        rb:    { type: BTN_MAP_TYPE.CC_MOMENTARY, toggle: false, cc_id: 8 },
        lt:    { type: BTN_MAP_TYPE.CC_MOMENTARY, toggle: false, cc_id: 8 },
        rt:    { type: BTN_MAP_TYPE.CC_MOMENTARY, toggle: false, cc_id: 8 },
        back:  { type: BTN_MAP_TYPE.CC_MOMENTARY, toggle: false, cc_id: 8 },
        start: { type: BTN_MAP_TYPE.CC_MOMENTARY, toggle: false, cc_id: 8 },
        l3:    { type: BTN_MAP_TYPE.CC_MOMENTARY, toggle: false, cc_id: 8 },
        r3:    { type: BTN_MAP_TYPE.CC_MOMENTARY, toggle: false, cc_id: 8 }
    },
    dpad: {
        up:    { cc_id: 7, value_press: 127, value_release: 0 },
        down:  { cc_id: 7, value_press: 127, value_release: 0 },
        left:  { cc_id: 7, value_press: 127, value_release: 0 },
        right: { cc_id: 7, value_press: 127, value_release: 0 }
    }
};

function initConfigPanel() {
    // Populate all CC select dropdowns
    const selects = document.querySelectorAll('.midi-cc-select');
    selects.forEach(select => {
        SP404_CC_OPTIONS.forEach(option => {
            const opt = document.createElement('option');
            opt.value = option.value;
            opt.textContent = option.name;
            select.appendChild(opt);
        });
    });

    // Set default values
    loadConfigToUI(currentConfig);
}

function loadConfigToUI(config) {
    document.getElementById('midi-channel').value = config.midiChannel;

    // Helper to get CC ID from button
    // Note: UI only supports CC_MOMENTARY mode, so for PAD/NOTE types show "Disabled"
    const getButtonCcId = (btn) => {
        if (btn.type === BTN_MAP_TYPE.CC_MOMENTARY || btn.type === BTN_MAP_TYPE.CC_TOGGLE) {
            return btn.cc_id !== undefined ? btn.cc_id : 127;
        }
        // For PAD and NOTE types, show as "Disabled" since UI doesn't support them yet
        return 127;
    };

    // Buttons (CC ID from button config - only CC types are supported in UI)
    document.getElementById('config-btn-a').value = getButtonCcId(config.buttons.a);
    document.getElementById('config-btn-b').value = getButtonCcId(config.buttons.b);
    document.getElementById('config-btn-x').value = getButtonCcId(config.buttons.x);
    document.getElementById('config-btn-y').value = getButtonCcId(config.buttons.y);
    document.getElementById('config-btn-lb').value = getButtonCcId(config.buttons.lb);
    document.getElementById('config-btn-rb').value = getButtonCcId(config.buttons.rb);
    document.getElementById('config-btn-lt').value = getButtonCcId(config.buttons.lt);
    document.getElementById('config-btn-rt').value = getButtonCcId(config.buttons.rt);
    document.getElementById('config-btn-back').value = getButtonCcId(config.buttons.back);
    document.getElementById('config-btn-start').value = getButtonCcId(config.buttons.start);
    document.getElementById('config-btn-l3').value = getButtonCcId(config.buttons.l3);
    document.getElementById('config-btn-r3').value = getButtonCcId(config.buttons.r3);

    // D-Pad (CC ID)
    document.getElementById('config-dpad-up').value = config.dpad.up.cc_id;
    document.getElementById('config-dpad-down').value = config.dpad.down.cc_id;
    document.getElementById('config-dpad-left').value = config.dpad.left.cc_id;
    document.getElementById('config-dpad-right').value = config.dpad.right.cc_id;

    // Axes (CC ID)
    document.getElementById('config-axis-lx').value = config.axes.lx.cc_id;
    document.getElementById('config-axis-ly').value = config.axes.ly.cc_id;
    document.getElementById('config-axis-rx').value = config.axes.rx.cc_id;
    document.getElementById('config-axis-ry').value = config.axes.ry.cc_id;
}

function getConfigFromUI() {
    // Get values from UI and update currentConfig structure
    const config = JSON.parse(JSON.stringify(currentConfig)); // Deep copy

    config.midiChannel = parseInt(document.getElementById('midi-channel').value);

    // Helper to update button - sets type to CC_MOMENTARY and cc_id
    const updateButton = (btnName, elementId) => {
        const cc_id = parseInt(document.getElementById(elementId).value);
        config.buttons[btnName] = {
            type: BTN_MAP_TYPE.CC_MOMENTARY,
            toggle: false,
            cc_id: cc_id
        };
    };

    // Buttons - set type to CC_MOMENTARY and update CC ID
    updateButton('x', 'config-btn-x');
    updateButton('a', 'config-btn-a');
    updateButton('b', 'config-btn-b');
    updateButton('y', 'config-btn-y');
    updateButton('lb', 'config-btn-lb');
    updateButton('rb', 'config-btn-rb');
    updateButton('lt', 'config-btn-lt');
    updateButton('rt', 'config-btn-rt');
    updateButton('back', 'config-btn-back');
    updateButton('start', 'config-btn-start');
    updateButton('l3', 'config-btn-l3');
    updateButton('r3', 'config-btn-r3');

    // D-Pad
    config.dpad.up.cc_id = parseInt(document.getElementById('config-dpad-up').value);
    config.dpad.down.cc_id = parseInt(document.getElementById('config-dpad-down').value);
    config.dpad.left.cc_id = parseInt(document.getElementById('config-dpad-left').value);
    config.dpad.right.cc_id = parseInt(document.getElementById('config-dpad-right').value);

    // Axes
    config.axes.lx.cc_id = parseInt(document.getElementById('config-axis-lx').value);
    config.axes.ly.cc_id = parseInt(document.getElementById('config-axis-ly').value);
    config.axes.rx.cc_id = parseInt(document.getElementById('config-axis-rx').value);
    config.axes.ry.cc_id = parseInt(document.getElementById('config-axis-ry').value);

    return config;
}

function configToBytes(config) {
    // Pack configuration to match firmware format:
    // 1 byte: channel
    // 20 bytes: axes (4 × 5: cc_id, min, max, invert, deadzone)
    // 60 bytes: buttons (12 × 5: type, toggle, data[3])
    // 12 bytes: dpad (4 × 3: cc_id, value_press, value_release)
    // Total: 93 bytes minimum

    const bytes = [];

    // Channel (1 byte)
    bytes.push(config.midiChannel);

    // Axes (4 × 5 = 20 bytes) - order: lx, ly, rx, ry
    const axisOrder = ['lx', 'ly', 'rx', 'ry'];
    for (const axis of axisOrder) {
        const ax = config.axes[axis];
        bytes.push(ax.cc_id);
        bytes.push(ax.min);
        bytes.push(ax.max);
        bytes.push(ax.invert ? 1 : 0);
        bytes.push(ax.deadzone);
    }

    // Buttons (12 × 5 = 60 bytes) - order: x, a, b, y, lb, rb, lt, rt, back, start, l3, r3
    const buttonOrder = ['x', 'a', 'b', 'y', 'lb', 'rb', 'lt', 'rt', 'back', 'start', 'l3', 'r3'];
    for (const btn of buttonOrder) {
        const button = config.buttons[btn];
        bytes.push(button.type);      // type
        bytes.push(button.toggle ? 1 : 0); // toggle

        // Data bytes depend on type
        if (button.type === BTN_MAP_TYPE.NOTE) {
            bytes.push(button.note || 60);      // note
            bytes.push(button.velocity || 127); // velocity
            bytes.push(0);                      // padding
        } else if (button.type === BTN_MAP_TYPE.CC_MOMENTARY || button.type === BTN_MAP_TYPE.CC_TOGGLE) {
            bytes.push(button.cc_id);   // cc_id
            bytes.push(0);              // padding
            bytes.push(0);              // padding
        } else { // PAD
            bytes.push(button.bank || 0);       // bank
            bytes.push(button.pad || 0);        // pad
            bytes.push(button.velocity || 127); // velocity
        }
    }

    // D-Pad (4 × 3 = 12 bytes) - order: up, down, left, right
    const dpadOrder = ['up', 'down', 'left', 'right'];
    for (const dir of dpadOrder) {
        const dpad = config.dpad[dir];
        bytes.push(dpad.cc_id);
        bytes.push(dpad.value_press);
        bytes.push(dpad.value_release);
    }

    return bytes;
}

function bytesToConfig(bytes) {
    // Parse firmware format (minimum 93 bytes)
    if (bytes.length < 93) {
        console.error('Config data too short:', bytes.length, 'expected 93+');
        return null;
    }

    let offset = 0;

    const config = {
        midiChannel: bytes[offset++],
        axes: {},
        buttons: {},
        dpad: {}
    };

    // Axes (4 × 5 = 20 bytes)
    const axisOrder = ['lx', 'ly', 'rx', 'ry'];
    for (const axis of axisOrder) {
        config.axes[axis] = {
            cc_id: bytes[offset++],
            min: bytes[offset++],
            max: bytes[offset++],
            invert: bytes[offset++] !== 0,
            deadzone: bytes[offset++]
        };
    }

    // Buttons (12 × 5 = 60 bytes)
    const buttonOrder = ['x', 'a', 'b', 'y', 'lb', 'rb', 'lt', 'rt', 'back', 'start', 'l3', 'r3'];
    for (const btn of buttonOrder) {
        const type = bytes[offset++];
        const toggle = bytes[offset++] !== 0;
        const data1 = bytes[offset++];
        const data2 = bytes[offset++];
        const data3 = bytes[offset++];

        config.buttons[btn] = { type, toggle };

        if (type === BTN_MAP_TYPE.NOTE) {
            config.buttons[btn].note = data1;
            config.buttons[btn].velocity = data2;
        } else if (type === BTN_MAP_TYPE.CC_MOMENTARY || type === BTN_MAP_TYPE.CC_TOGGLE) {
            config.buttons[btn].cc_id = data1;
        } else { // PAD
            config.buttons[btn].bank = data1;
            config.buttons[btn].pad = data2;
            config.buttons[btn].velocity = data3;
        }
    }

    // D-Pad (4 × 3 = 12 bytes)
    const dpadOrder = ['up', 'down', 'left', 'right'];
    for (const dir of dpadOrder) {
        config.dpad[dir] = {
            cc_id: bytes[offset++],
            value_press: bytes[offset++],
            value_release: bytes[offset++]
        };
    }

    return config;
}

function toggleConfigPanel() {
    const panel = document.getElementById('config-panel');
    configPanelOpen = !configPanelOpen;
    if (configPanelOpen) {
        panel.classList.add('open');
    } else {
        panel.classList.remove('open');
    }
}

async function applyConfiguration() {
    const config = getConfigFromUI();
    currentConfig = config;

    const configBytes = configToBytes(config);
    console.log('Applying config:', config);
    console.log('Config bytes:', bytesToHex(configBytes));

    const success = await sendSerialData(MsgType.SET_CONFIGURATION, configBytes);
    if (success) {
        updateDeviceStatus('Configuration applied', false);
    } else {
        updateDeviceStatus('Failed to apply config', true);
    }
}

// Initialization
document.addEventListener('DOMContentLoaded', async () => {
    await loadSVG('assets/images/joy.svg', 'svg-container');
    ensureJoystickIndicatorsExist();

    // Initialize config panel
    initConfigPanel();

    // Config panel toggle
    document.getElementById('toggle-panel-btn').addEventListener('click', toggleConfigPanel);
    document.getElementById('close-panel-btn').addEventListener('click', toggleConfigPanel);

    // Apply config button
    document.getElementById('apply-config-btn').addEventListener('click', applyConfiguration);

    const connectButton = document.getElementById('connect-button');
    connectButton.addEventListener('click', handleConnectButton);

    // Config buttons
    document.getElementById('read-config-button').addEventListener('click', async () => {
        console.log('Requesting configuration...');
        updateDeviceStatus('Reading config...', false);
        await requestConfiguration();
    });

    document.getElementById('save-config-button').addEventListener('click', async () => {
        console.log('Saving configuration to flash...');
        updateDeviceStatus('Saving to flash...', false);
        await saveConfigurationToDevice();
    });

    document.getElementById('reset-config-button').addEventListener('click', async () => {
        if (confirm('Reset configuration to defaults?')) {
            console.log('Resetting configuration...');
            updateDeviceStatus('Resetting config...', false);
            await resetConfigurationOnDevice();
        }
    });

    if (!('serial' in navigator)) {
        document.getElementById('device-status').textContent =
            "Web Serial API not supported in this browser";
        connectButton.disabled = true;
    }
});