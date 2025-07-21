// Constants
const DEVICE_CONFIG = {
    baudRate: 115200
};

const MsgType = {
    UPDATE_CONFIGURATION: 0,
    CURRENT_CONFIGURATION: 1,
    ERROR_FIFO_READ: 2,
    ERROR_PACKING_FAILED: 3,
    ERROR_TRANSPORT_FAILED: 4,
    ERROR_INVALID_DATA: 5,
    ERROR_DEVICE_DISCONNECTED: 6
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
    return state;
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
    displayFrame(parsedData);

    updateGamepadState(gamepadState, parsedData.slice(1));
    console.log(gamepadState) // Print buttons state structure
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

function handleDisconnection() {
    const button = document.getElementById('connect-button');
    const status = document.getElementById('device-status');

    disconnectSerial().finally(() => {
        button.textContent = "Find Serial Device";
        status.textContent = "Disconnected (device lost)";
        status.style.color = 'black';
        serialPort = null;
        reader = null;
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
            return;
        }

        button.disabled = true;
        status.textContent = "Select serial device...";

        const port = await findSerialDevices();
        serialPort = await connectToSerial(port);

        const deviceName = await getDeviceName(port);
        button.textContent = "Disconnect";
        status.textContent = `Connected to: ${deviceName}`;
    } catch (error) {
        console.error('Connection Error:', error);
        status.textContent = `Error: ${error.message}`;
        status.style.color = 'black';
        button.textContent = "Find Serial Device";
    } finally {
        button.disabled = false;
    }
}

// Initialization
document.addEventListener('DOMContentLoaded', async () => {
    const svg = await loadSVG('assets/images/joy.svg', 'svg-container');

    const connectButton = document.getElementById('connect-button');
    connectButton.addEventListener('click', handleConnectButton);

    if (!('serial' in navigator)) {
        document.getElementById('device-status').textContent =
            "Web Serial API not supported in this browser";
        connectButton.disabled = true;
    }
});