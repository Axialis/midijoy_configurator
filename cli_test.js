/**
 * CLI tool for testing MidiJoy EEPROM read/write
 * Run with: node cli_test.js [COM_PORT]
 * Example: node cli_test.js COM3
 */

const { SerialPort } = require('serialport');

// Constants
const HDLC = {
    FRAME_START: 0x7E,
    FRAME_END: 0x7F,
    ESCAPE_CHAR: 0x7D,
    XOR_VALUE: 0x20
};

const MsgType = {
    GAMEPAD_DATA: 0,
    CURRENT_CONFIGURATION: 1,
    ERROR_FIFO_READ: 2,
    ERROR_PACKING_FAILED: 3,
    ERROR_TRANSPORT_FAILED: 4,
    ERROR_INVALID_DATA: 5,
    ERROR_DEVICE_DISCONNECTED: 6,
    GET_CONFIGURATION: 7,
    SET_CONFIGURATION: 8,
    SAVE_CONFIGURATION: 9,
    RESET_CONFIGURATION: 10,
    CONFIGURATION_SAVED: 11,
    CONFIGURATION_ERROR: 12
};

const BTN_MAP_TYPE = {
    NOTE: 0,
    CC_MOMENTARY: 1,
    CC_TOGGLE: 2,
    PAD: 3
};

// Serialization functions
function configToBytes(config) {
    const bytes = [];
    bytes.push(config.midiChannel);

    const axisOrder = ['lx', 'ly', 'rx', 'ry'];
    for (const axis of axisOrder) {
        const ax = config.axes[axis];
        bytes.push(ax.cc_id);
        bytes.push(ax.min);
        bytes.push(ax.max);
        bytes.push(ax.invert ? 1 : 0);
        bytes.push(ax.deadzone);
    }

    const buttonOrder = ['x', 'a', 'b', 'y', 'lb', 'rb', 'lt', 'rt', 'back', 'start', 'l3', 'r3'];
    for (const btn of buttonOrder) {
        const button = config.buttons[btn];
        bytes.push(button.type);
        bytes.push(button.toggle ? 1 : 0);

        if (button.type === BTN_MAP_TYPE.NOTE) {
            bytes.push(button.note || 60);
            bytes.push(button.velocity || 127);
            bytes.push(0);
        } else if (button.type === BTN_MAP_TYPE.CC_MOMENTARY || button.type === BTN_MAP_TYPE.CC_TOGGLE) {
            bytes.push(button.cc_id);
            bytes.push(0);
            bytes.push(0);
        } else {
            bytes.push(button.bank || 0);
            bytes.push(button.pad || 0);
            bytes.push(button.velocity || 127);
        }
    }

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
    if (bytes.length < 93) {
        return null;
    }

    let offset = 0;
    const config = {
        midiChannel: bytes[offset++],
        axes: {},
        buttons: {},
        dpad: {}
    };

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
        } else {
            config.buttons[btn].bank = data1;
            config.buttons[btn].pad = data2;
            config.buttons[btn].velocity = data3;
        }
    }

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

function bytesToHex(bytes) {
    return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join(' ');
}

// HDLC framing
function frameData(msgType, data = []) {
    const message = [msgType, ...data];
    const framedData = [HDLC.FRAME_START];

    for (const byte of message) {
        if (byte === HDLC.FRAME_START || byte === HDLC.FRAME_END || byte === HDLC.ESCAPE_CHAR) {
            framedData.push(HDLC.ESCAPE_CHAR);
            framedData.push(byte ^ HDLC.XOR_VALUE);
        } else {
            framedData.push(byte);
        }
    }

    framedData.push(HDLC.FRAME_END);
    return Buffer.from(framedData);
}

function parseFrame(frame) {
    const result = [];
    let i = 0;
    while (i < frame.length) {
        if (frame[i] === HDLC.ESCAPE_CHAR) {
            if (i + 1 >= frame.length) break;
            result.push(frame[i + 1] ^ HDLC.XOR_VALUE);
            i += 2;
        } else {
            result.push(frame[i]);
            i++;
        }
    }
    return result;
}

// Serial communication class
class MidiJoyDevice {
    constructor(portPath) {
        this.portPath = portPath;
        this.port = null;
        this.buffer = [];
        this.frameStarted = false;
        this.responseResolve = null;
        this.responseTimeout = null;
    }

    async connect() {
        return new Promise((resolve, reject) => {
            this.port = new SerialPort({
                path: this.portPath,
                baudRate: 115200
            });

            this.port.on('open', () => {
                console.log(`Connected to ${this.portPath}`);
                resolve();
            });

            this.port.on('error', (err) => {
                reject(err);
            });

            this.port.on('data', (data) => {
                this.processData(data);
            });
        });
    }

    processData(data) {
        for (const byte of data) {
            if (byte === HDLC.FRAME_START) {
                this.buffer = [];
                this.frameStarted = true;
            } else if (byte === HDLC.FRAME_END && this.frameStarted) {
                this.frameStarted = false;
                const frame = parseFrame(this.buffer);
                this.handleFrame(frame);
                this.buffer = [];
            } else if (this.frameStarted) {
                this.buffer.push(byte);
            }
        }
    }

    handleFrame(frame) {
        if (frame.length === 0) return;

        const msgType = frame[0];
        const payload = frame.slice(1);

        // Ignore gamepad data
        if (msgType === MsgType.GAMEPAD_DATA) {
            return;
        }

        if (this.responseResolve) {
            clearTimeout(this.responseTimeout);
            this.responseResolve({ msgType, payload });
            this.responseResolve = null;
        }
    }

    async sendAndWait(msgType, data = [], timeoutMs = 2000) {
        return new Promise((resolve, reject) => {
            this.responseTimeout = setTimeout(() => {
                this.responseResolve = null;
                reject(new Error('Response timeout'));
            }, timeoutMs);

            this.responseResolve = resolve;

            const frame = frameData(msgType, data);
            this.port.write(frame);
        });
    }

    async getConfiguration(retries = 3) {
        for (let i = 0; i < retries; i++) {
            const response = await this.sendAndWait(MsgType.GET_CONFIGURATION);
            if (response.msgType === MsgType.CURRENT_CONFIGURATION && response.payload.length >= 93) {
                return bytesToConfig(response.payload);
            }
            // Retry if we got gamepad data instead
            if (response.msgType === MsgType.CURRENT_CONFIGURATION && response.payload.length < 93) {
                await new Promise(resolve => setTimeout(resolve, 100));
                continue;
            }
        }
        throw new Error(`Failed to get configuration after ${retries} retries`);
    }

    async setConfiguration(config) {
        const bytes = configToBytes(config);
        const response = await this.sendAndWait(MsgType.SET_CONFIGURATION, bytes);
        if (response.msgType === MsgType.CURRENT_CONFIGURATION) {
            return true;
        }
        if (response.msgType === MsgType.CONFIGURATION_ERROR) {
            throw new Error('Device rejected configuration');
        }
        throw new Error(`Unexpected response: type=${response.msgType}`);
    }

    async saveToEEPROM() {
        const response = await this.sendAndWait(MsgType.SAVE_CONFIGURATION);
        if (response.msgType === MsgType.CONFIGURATION_SAVED) {
            return true;
        }
        if (response.msgType === MsgType.CONFIGURATION_ERROR) {
            throw new Error('Failed to save to EEPROM');
        }
        throw new Error(`Unexpected response: type=${response.msgType}`);
    }

    async resetToDefaults() {
        const response = await this.sendAndWait(MsgType.RESET_CONFIGURATION);
        if (response.msgType === MsgType.CURRENT_CONFIGURATION) {
            return bytesToConfig(response.payload);
        }
        throw new Error(`Unexpected response: type=${response.msgType}`);
    }

    close() {
        if (this.port && this.port.isOpen) {
            this.port.close();
        }
    }
}

// Helper to describe button
function describeButton(btn) {
    const typeNames = ['NOTE', 'CC_MOMENTARY', 'CC_TOGGLE', 'PAD'];
    const typeName = typeNames[btn.type] || `UNKNOWN(${btn.type})`;

    if (btn.type === BTN_MAP_TYPE.NOTE) {
        return `${typeName} note=${btn.note} vel=${btn.velocity}`;
    } else if (btn.type === BTN_MAP_TYPE.CC_MOMENTARY || btn.type === BTN_MAP_TYPE.CC_TOGGLE) {
        return `${typeName} cc=${btn.cc_id}`;
    } else {
        return `${typeName} bank=${btn.bank} pad=${btn.pad} vel=${btn.velocity}`;
    }
}

// Test functions
async function runEEPROMTest(device) {
    console.log('\n========================================');
    console.log('    MidiJoy EEPROM Read/Write Test');
    console.log('========================================\n');

    let testsPassed = 0;
    let testsFailed = 0;

    // Test 1: Read current configuration
    console.log('Test 1: Read current configuration');
    let originalConfig;
    try {
        originalConfig = await device.getConfiguration();
        console.log(`  ✓ Read config: channel=${originalConfig.midiChannel}`);
        console.log(`    Axes: LX=${originalConfig.axes.lx.cc_id}, LY=${originalConfig.axes.ly.cc_id}`);
        console.log(`    Button X: ${describeButton(originalConfig.buttons.x)}`);
        console.log(`    Button A: ${describeButton(originalConfig.buttons.a)}`);
        console.log(`    Button LB: ${describeButton(originalConfig.buttons.lb)}`);
        testsPassed++;
    } catch (err) {
        console.log(`  ✗ Failed to read config: ${err.message}`);
        testsFailed++;
        return { testsPassed, testsFailed };
    }

    // Test 2: Modify channel and buttons
    console.log('\nTest 2: Modify channel and buttons');
    const testChannel = originalConfig.midiChannel === 1 ? 5 : 1;
    const modifiedConfig = JSON.parse(JSON.stringify(originalConfig));
    modifiedConfig.midiChannel = testChannel;

    // Change button X from PAD to CC_MOMENTARY
    modifiedConfig.buttons.x = {
        type: BTN_MAP_TYPE.CC_MOMENTARY,
        toggle: false,
        cc_id: 15
    };

    // Change button A to NOTE
    modifiedConfig.buttons.a = {
        type: BTN_MAP_TYPE.NOTE,
        toggle: false,
        note: 72,
        velocity: 100
    };

    // Change button LB to CC_TOGGLE
    modifiedConfig.buttons.lb = {
        type: BTN_MAP_TYPE.CC_TOGGLE,
        toggle: true,
        cc_id: 20
    };

    try {
        await device.setConfiguration(modifiedConfig);
        console.log(`  ✓ Set config with channel=${testChannel}`);
        console.log(`    Button X: ${describeButton(modifiedConfig.buttons.x)}`);
        console.log(`    Button A: ${describeButton(modifiedConfig.buttons.a)}`);
        console.log(`    Button LB: ${describeButton(modifiedConfig.buttons.lb)}`);
        testsPassed++;
    } catch (err) {
        console.log(`  ✗ Failed to set config: ${err.message}`);
        testsFailed++;
    }

    // Test 3: Read back and verify all changes
    console.log('\nTest 3: Read back and verify modifications');
    try {
        const readBack = await device.getConfiguration();
        let allMatch = true;

        if (readBack.midiChannel !== testChannel) {
            console.log(`  ✗ Channel mismatch: expected ${testChannel}, got ${readBack.midiChannel}`);
            allMatch = false;
        } else {
            console.log(`  ✓ Channel = ${testChannel}`);
        }

        // Verify button X
        if (readBack.buttons.x.type !== BTN_MAP_TYPE.CC_MOMENTARY || readBack.buttons.x.cc_id !== 15) {
            console.log(`  ✗ Button X mismatch: ${describeButton(readBack.buttons.x)}`);
            allMatch = false;
        } else {
            console.log(`  ✓ Button X: ${describeButton(readBack.buttons.x)}`);
        }

        // Verify button A
        if (readBack.buttons.a.type !== BTN_MAP_TYPE.NOTE || readBack.buttons.a.note !== 72 || readBack.buttons.a.velocity !== 100) {
            console.log(`  ✗ Button A mismatch: ${describeButton(readBack.buttons.a)}`);
            allMatch = false;
        } else {
            console.log(`  ✓ Button A: ${describeButton(readBack.buttons.a)}`);
        }

        // Verify button LB
        if (readBack.buttons.lb.type !== BTN_MAP_TYPE.CC_TOGGLE || readBack.buttons.lb.cc_id !== 20 || !readBack.buttons.lb.toggle) {
            console.log(`  ✗ Button LB mismatch: ${describeButton(readBack.buttons.lb)}, toggle=${readBack.buttons.lb.toggle}`);
            allMatch = false;
        } else {
            console.log(`  ✓ Button LB: ${describeButton(readBack.buttons.lb)}, toggle=true`);
        }

        if (allMatch) {
            testsPassed++;
        } else {
            testsFailed++;
        }
    } catch (err) {
        console.log(`  ✗ Failed to read config: ${err.message}`);
        testsFailed++;
    }

    // Test 4: Save to EEPROM
    console.log('\nTest 4: Save to EEPROM');
    try {
        await device.saveToEEPROM();
        console.log('  ✓ Configuration saved to EEPROM');
        testsPassed++;
    } catch (err) {
        console.log(`  ✗ Failed to save: ${err.message}`);
        testsFailed++;
    }

    // Test 5: Reset to defaults (simulates power cycle)
    console.log('\nTest 5: Reset to defaults');
    try {
        const defaultConfig = await device.resetToDefaults();
        console.log(`  ✓ Reset to defaults: channel=${defaultConfig.midiChannel}`);
        console.log(`    Button X: ${describeButton(defaultConfig.buttons.x)}`);
        testsPassed++;
    } catch (err) {
        console.log(`  ✗ Failed to reset: ${err.message}`);
        testsFailed++;
    }

    // Test 6: Restore original configuration
    console.log('\nTest 6: Restore original configuration');
    try {
        await device.setConfiguration(originalConfig);
        await device.saveToEEPROM();
        console.log(`  ✓ Restored original config: channel=${originalConfig.midiChannel}`);
        console.log(`    Button X: ${describeButton(originalConfig.buttons.x)}`);
        console.log(`    Button A: ${describeButton(originalConfig.buttons.a)}`);
        console.log(`    Button LB: ${describeButton(originalConfig.buttons.lb)}`);
        testsPassed++;
    } catch (err) {
        console.log(`  ✗ Failed to restore: ${err.message}`);
        testsFailed++;
    }

    // Test 7: Final verification
    console.log('\nTest 7: Final verification');
    try {
        const finalConfig = await device.getConfiguration();
        let allMatch = true;

        if (finalConfig.midiChannel !== originalConfig.midiChannel) {
            console.log(`  ✗ Channel mismatch`);
            allMatch = false;
        }

        // Check button X restored
        if (finalConfig.buttons.x.type !== originalConfig.buttons.x.type) {
            console.log(`  ✗ Button X type mismatch`);
            allMatch = false;
        }

        // Check button A restored
        if (finalConfig.buttons.a.type !== originalConfig.buttons.a.type) {
            console.log(`  ✗ Button A type mismatch`);
            allMatch = false;
        }

        // Check button LB restored
        if (finalConfig.buttons.lb.type !== originalConfig.buttons.lb.type) {
            console.log(`  ✗ Button LB type mismatch`);
            allMatch = false;
        }

        if (allMatch) {
            console.log(`  ✓ Original configuration fully restored`);
            testsPassed++;
        } else {
            testsFailed++;
        }
    } catch (err) {
        console.log(`  ✗ Failed to verify: ${err.message}`);
        testsFailed++;
    }

    return { testsPassed, testsFailed };
}

async function listPorts() {
    const ports = await SerialPort.list();
    console.log('\nAvailable serial ports:');
    for (const port of ports) {
        const info = port.manufacturer ? ` (${port.manufacturer})` : '';
        console.log(`  ${port.path}${info}`);
    }
    return ports;
}

// Main
async function main() {
    const args = process.argv.slice(2);

    if (args.length === 0 || args[0] === '--list') {
        await listPorts();
        console.log('\nUsage: node cli_test.js <COM_PORT>');
        console.log('Example: node cli_test.js COM3');
        process.exit(0);
    }

    const portPath = args[0];
    const device = new MidiJoyDevice(portPath);

    try {
        await device.connect();

        // Wait a bit for device to be ready
        await new Promise(resolve => setTimeout(resolve, 500));

        const { testsPassed, testsFailed } = await runEEPROMTest(device);

        console.log('\n========================================');
        console.log(`Tests passed: ${testsPassed}`);
        console.log(`Tests failed: ${testsFailed}`);
        console.log('========================================\n');

        device.close();
        process.exit(testsFailed > 0 ? 1 : 0);
    } catch (err) {
        console.error(`Error: ${err.message}`);
        device.close();
        process.exit(1);
    }
}

main();
