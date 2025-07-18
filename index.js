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
            
            window.addEventListener('resize', () => {
                adjustSvgSize(svgElement);
            });
            
            return svgElement;
        }
    } catch (error) {
        console.error('Error loading SVG:', error);
        return null;
    }
}

let serialPort = null;
let reader = null;

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
        await port.open({ baudRate: 9600 });
        
        reader = port.readable.getReader();
        readSerialData(reader);
        
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
            if (done) break;

            const text = new TextDecoder().decode(value);
            console.log('Received:', text);
            updateDeviceStatus(`Data: ${text}`);
        }
    } catch (error) {
        console.error('Read Error:', error);
        updateDeviceStatus('Read error');
    }
}

async function disconnectSerial() {
    if (reader) {
        await reader.cancel();
        reader = null;
    }
    if (serialPort) {
        await serialPort.close();
        serialPort = null;
    }
}

function updateDeviceStatus(message, isError = false) {
    const status = document.getElementById('device-status');
    status.textContent = message;
    status.style.color = isError ? 'red' : 'green';
}

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
        
        button.textContent = "Disconnect";
        status.textContent = `Connected to: ${port.getInfo().usbProductId || 'Serial Device'}`;
    } catch (error) {
        console.error('Connection Error:', error);
        status.textContent = `Error: ${error.message}`;
        status.style.color = 'red';
    } finally {
        button.disabled = false;
    }
}

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