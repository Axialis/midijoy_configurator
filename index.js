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

// Global variables
let serialPort = null;
let reader = null;
let serialBuffer = new Uint8Array(0);

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