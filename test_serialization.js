/**
 * Tests for configToBytes and bytesToConfig serialization functions
 * Run with: node test_serialization.js
 */

// Button mapping types (must match firmware BTN_MAP_* enum)
const BTN_MAP_TYPE = {
    NOTE: 0,
    CC_MOMENTARY: 1,
    CC_TOGGLE: 2,
    PAD: 3
};

// Copy of configToBytes from index.js
function configToBytes(config) {
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

// Copy of bytesToConfig from index.js
function bytesToConfig(bytes) {
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

function bytesToHex(bytes) {
    return Array.from(bytes)
        .map(b => b.toString(16).padStart(2, '0'))
        .join(' ');
}

// Test helpers
let testsPassed = 0;
let testsFailed = 0;

function assert(condition, message) {
    if (condition) {
        testsPassed++;
        console.log(`  ✓ ${message}`);
    } else {
        testsFailed++;
        console.log(`  ✗ ${message}`);
    }
}

function assertEqual(actual, expected, message) {
    if (actual === expected) {
        testsPassed++;
        console.log(`  ✓ ${message}`);
    } else {
        testsFailed++;
        console.log(`  ✗ ${message}: expected ${expected}, got ${actual}`);
    }
}

function assertDeepEqual(actual, expected, message) {
    const actualStr = JSON.stringify(actual);
    const expectedStr = JSON.stringify(expected);
    if (actualStr === expectedStr) {
        testsPassed++;
        console.log(`  ✓ ${message}`);
    } else {
        testsFailed++;
        console.log(`  ✗ ${message}:`);
        console.log(`    expected: ${expectedStr}`);
        console.log(`    got:      ${actualStr}`);
    }
}

// ============ TESTS ============

console.log('\n=== Test 1: Basic round-trip with CC_MOMENTARY buttons ===');
{
    const originalConfig = {
        midiChannel: 1,
        axes: {
            lx: { cc_id: 0, min: 0, max: 127, invert: false, deadzone: 5 },
            ly: { cc_id: 1, min: 0, max: 127, invert: true, deadzone: 5 },
            rx: { cc_id: 9, min: 0, max: 127, invert: false, deadzone: 5 },
            ry: { cc_id: 10, min: 0, max: 127, invert: true, deadzone: 5 }
        },
        buttons: {
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

    const bytes = configToBytes(originalConfig);
    assertEqual(bytes.length, 93, 'Serialized length is 93 bytes');

    const parsed = bytesToConfig(bytes);
    assertEqual(parsed.midiChannel, 1, 'MIDI channel preserved');
    assertEqual(parsed.axes.lx.cc_id, 0, 'LX CC ID preserved');
    assertEqual(parsed.axes.ly.invert, true, 'LY invert preserved');
    assertEqual(parsed.buttons.x.type, BTN_MAP_TYPE.CC_MOMENTARY, 'Button X type preserved');
    assertEqual(parsed.buttons.x.cc_id, 8, 'Button X CC ID preserved');
    assertEqual(parsed.dpad.up.cc_id, 7, 'D-Pad up CC ID preserved');
}

console.log('\n=== Test 2: Mixed button types (PAD, NOTE, CC) ===');
{
    const mixedConfig = {
        midiChannel: 2,
        axes: {
            lx: { cc_id: 0, min: 0, max: 127, invert: false, deadzone: 5 },
            ly: { cc_id: 1, min: 0, max: 127, invert: false, deadzone: 5 },
            rx: { cc_id: 9, min: 0, max: 127, invert: false, deadzone: 5 },
            ry: { cc_id: 10, min: 0, max: 127, invert: false, deadzone: 5 }
        },
        buttons: {
            x:     { type: BTN_MAP_TYPE.PAD, toggle: false, bank: 0, pad: 0, velocity: 100 },
            a:     { type: BTN_MAP_TYPE.PAD, toggle: false, bank: 0, pad: 1, velocity: 100 },
            b:     { type: BTN_MAP_TYPE.PAD, toggle: false, bank: 0, pad: 2, velocity: 100 },
            y:     { type: BTN_MAP_TYPE.PAD, toggle: false, bank: 0, pad: 3, velocity: 100 },
            lb:    { type: BTN_MAP_TYPE.NOTE, toggle: false, note: 60, velocity: 127 },
            rb:    { type: BTN_MAP_TYPE.NOTE, toggle: false, note: 62, velocity: 100 },
            lt:    { type: BTN_MAP_TYPE.CC_TOGGLE, toggle: true, cc_id: 15 },
            rt:    { type: BTN_MAP_TYPE.CC_TOGGLE, toggle: true, cc_id: 16 },
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

    const bytes = configToBytes(mixedConfig);
    const parsed = bytesToConfig(bytes);

    assertEqual(parsed.midiChannel, 2, 'MIDI channel 2 preserved');

    // PAD buttons
    assertEqual(parsed.buttons.x.type, BTN_MAP_TYPE.PAD, 'Button X type is PAD');
    assertEqual(parsed.buttons.x.bank, 0, 'Button X bank preserved');
    assertEqual(parsed.buttons.x.pad, 0, 'Button X pad preserved');
    assertEqual(parsed.buttons.x.velocity, 100, 'Button X velocity preserved');

    assertEqual(parsed.buttons.a.pad, 1, 'Button A pad preserved');
    assertEqual(parsed.buttons.b.pad, 2, 'Button B pad preserved');
    assertEqual(parsed.buttons.y.pad, 3, 'Button Y pad preserved');

    // NOTE buttons
    assertEqual(parsed.buttons.lb.type, BTN_MAP_TYPE.NOTE, 'Button LB type is NOTE');
    assertEqual(parsed.buttons.lb.note, 60, 'Button LB note preserved');
    assertEqual(parsed.buttons.lb.velocity, 127, 'Button LB velocity preserved');
    assertEqual(parsed.buttons.rb.note, 62, 'Button RB note preserved');

    // CC_TOGGLE buttons
    assertEqual(parsed.buttons.lt.type, BTN_MAP_TYPE.CC_TOGGLE, 'Button LT type is CC_TOGGLE');
    assertEqual(parsed.buttons.lt.toggle, true, 'Button LT toggle preserved');
    assertEqual(parsed.buttons.lt.cc_id, 15, 'Button LT CC ID preserved');
}

console.log('\n=== Test 3: Real firmware data from EEPROM ===');
{
    // This is real data captured from the device:
    // 02 00 00 7f 00 05 01 00 7f 01 05 09 00 7f 00 05 0a 00 7f 01 05
    // 03 00 00 00 64 03 00 00 01 64 03 00 00 02 64 03 00 00 03 64
    // 01 00 08 00 00 01 00 08 00 00 01 00 08 00 00 01 00 08 00 00
    // 01 00 08 00 00 01 00 08 00 00 01 00 08 00 00 01 00 08 00 00
    // 07 7f 00 07 7f 00 07 7f 00 07 7f 00

    const firmwareData = [
        0x02, // channel = 2
        // Axes: LX
        0x00, 0x00, 0x7f, 0x00, 0x05,
        // Axes: LY
        0x01, 0x00, 0x7f, 0x01, 0x05,
        // Axes: RX
        0x09, 0x00, 0x7f, 0x00, 0x05,
        // Axes: RY
        0x0a, 0x00, 0x7f, 0x01, 0x05,
        // Buttons X: PAD type (3), bank=0, pad=0, vel=100
        0x03, 0x00, 0x00, 0x00, 0x64,
        // Buttons A: PAD type (3), bank=0, pad=1, vel=100
        0x03, 0x00, 0x00, 0x01, 0x64,
        // Buttons B: PAD type (3), bank=0, pad=2, vel=100
        0x03, 0x00, 0x00, 0x02, 0x64,
        // Buttons Y: PAD type (3), bank=0, pad=3, vel=100
        0x03, 0x00, 0x00, 0x03, 0x64,
        // Buttons LB: CC_MOMENTARY (1), cc_id=8
        0x01, 0x00, 0x08, 0x00, 0x00,
        // Buttons RB: CC_MOMENTARY (1), cc_id=8
        0x01, 0x00, 0x08, 0x00, 0x00,
        // Buttons LT: CC_MOMENTARY (1), cc_id=8
        0x01, 0x00, 0x08, 0x00, 0x00,
        // Buttons RT: CC_MOMENTARY (1), cc_id=8
        0x01, 0x00, 0x08, 0x00, 0x00,
        // Buttons BACK: CC_MOMENTARY (1), cc_id=8
        0x01, 0x00, 0x08, 0x00, 0x00,
        // Buttons START: CC_MOMENTARY (1), cc_id=8
        0x01, 0x00, 0x08, 0x00, 0x00,
        // Buttons L3: CC_MOMENTARY (1), cc_id=8
        0x01, 0x00, 0x08, 0x00, 0x00,
        // Buttons R3: CC_MOMENTARY (1), cc_id=8
        0x01, 0x00, 0x08, 0x00, 0x00,
        // DPad: up, down, left, right
        0x07, 0x7f, 0x00,
        0x07, 0x7f, 0x00,
        0x07, 0x7f, 0x00,
        0x07, 0x7f, 0x00
    ];

    assertEqual(firmwareData.length, 93, 'Firmware data is 93 bytes');

    const parsed = bytesToConfig(firmwareData);

    assertEqual(parsed.midiChannel, 2, 'MIDI channel = 2');

    // Axes
    assertEqual(parsed.axes.lx.cc_id, 0, 'LX CC ID = 0');
    assertEqual(parsed.axes.lx.min, 0, 'LX min = 0');
    assertEqual(parsed.axes.lx.max, 127, 'LX max = 127');
    assertEqual(parsed.axes.lx.invert, false, 'LX invert = false');
    assertEqual(parsed.axes.lx.deadzone, 5, 'LX deadzone = 5');

    assertEqual(parsed.axes.ly.cc_id, 1, 'LY CC ID = 1');
    assertEqual(parsed.axes.ly.invert, true, 'LY invert = true');

    assertEqual(parsed.axes.rx.cc_id, 9, 'RX CC ID = 9');
    assertEqual(parsed.axes.ry.cc_id, 10, 'RY CC ID = 10');

    // PAD buttons
    assertEqual(parsed.buttons.x.type, BTN_MAP_TYPE.PAD, 'Button X type = PAD');
    assertEqual(parsed.buttons.x.bank, 0, 'Button X bank = 0');
    assertEqual(parsed.buttons.x.pad, 0, 'Button X pad = 0');
    assertEqual(parsed.buttons.x.velocity, 100, 'Button X velocity = 100');

    assertEqual(parsed.buttons.a.type, BTN_MAP_TYPE.PAD, 'Button A type = PAD');
    assertEqual(parsed.buttons.a.pad, 1, 'Button A pad = 1');

    assertEqual(parsed.buttons.b.type, BTN_MAP_TYPE.PAD, 'Button B type = PAD');
    assertEqual(parsed.buttons.b.pad, 2, 'Button B pad = 2');

    assertEqual(parsed.buttons.y.type, BTN_MAP_TYPE.PAD, 'Button Y type = PAD');
    assertEqual(parsed.buttons.y.pad, 3, 'Button Y pad = 3');

    // CC_MOMENTARY buttons
    assertEqual(parsed.buttons.lb.type, BTN_MAP_TYPE.CC_MOMENTARY, 'Button LB type = CC_MOMENTARY');
    assertEqual(parsed.buttons.lb.cc_id, 8, 'Button LB cc_id = 8');

    assertEqual(parsed.buttons.rb.type, BTN_MAP_TYPE.CC_MOMENTARY, 'Button RB type = CC_MOMENTARY');
    assertEqual(parsed.buttons.back.type, BTN_MAP_TYPE.CC_MOMENTARY, 'Button BACK type = CC_MOMENTARY');
    assertEqual(parsed.buttons.start.type, BTN_MAP_TYPE.CC_MOMENTARY, 'Button START type = CC_MOMENTARY');

    // DPad
    assertEqual(parsed.dpad.up.cc_id, 7, 'DPad up cc_id = 7');
    assertEqual(parsed.dpad.up.value_press, 127, 'DPad up value_press = 127');
    assertEqual(parsed.dpad.up.value_release, 0, 'DPad up value_release = 0');

    // Round-trip test
    const reencoded = configToBytes(parsed);
    assertEqual(reencoded.length, 93, 'Re-encoded length is 93 bytes');

    let roundTripOk = true;
    for (let i = 0; i < firmwareData.length; i++) {
        if (firmwareData[i] !== reencoded[i]) {
            roundTripOk = false;
            console.log(`    Mismatch at byte ${i}: expected ${firmwareData[i].toString(16)}, got ${reencoded[i].toString(16)}`);
        }
    }
    assert(roundTripOk, 'Round-trip matches original firmware data');
}

console.log('\n=== Test 4: Edge cases ===');
{
    // Test with channel 16 (max)
    const config16 = {
        midiChannel: 16,
        axes: {
            lx: { cc_id: 127, min: 0, max: 127, invert: false, deadzone: 0 },
            ly: { cc_id: 127, min: 0, max: 127, invert: false, deadzone: 0 },
            rx: { cc_id: 127, min: 0, max: 127, invert: false, deadzone: 0 },
            ry: { cc_id: 127, min: 0, max: 127, invert: false, deadzone: 0 }
        },
        buttons: {
            x:     { type: BTN_MAP_TYPE.CC_MOMENTARY, toggle: false, cc_id: 127 },
            a:     { type: BTN_MAP_TYPE.CC_MOMENTARY, toggle: false, cc_id: 127 },
            b:     { type: BTN_MAP_TYPE.CC_MOMENTARY, toggle: false, cc_id: 127 },
            y:     { type: BTN_MAP_TYPE.CC_MOMENTARY, toggle: false, cc_id: 127 },
            lb:    { type: BTN_MAP_TYPE.CC_MOMENTARY, toggle: false, cc_id: 127 },
            rb:    { type: BTN_MAP_TYPE.CC_MOMENTARY, toggle: false, cc_id: 127 },
            lt:    { type: BTN_MAP_TYPE.CC_MOMENTARY, toggle: false, cc_id: 127 },
            rt:    { type: BTN_MAP_TYPE.CC_MOMENTARY, toggle: false, cc_id: 127 },
            back:  { type: BTN_MAP_TYPE.CC_MOMENTARY, toggle: false, cc_id: 127 },
            start: { type: BTN_MAP_TYPE.CC_MOMENTARY, toggle: false, cc_id: 127 },
            l3:    { type: BTN_MAP_TYPE.CC_MOMENTARY, toggle: false, cc_id: 127 },
            r3:    { type: BTN_MAP_TYPE.CC_MOMENTARY, toggle: false, cc_id: 127 }
        },
        dpad: {
            up:    { cc_id: 127, value_press: 127, value_release: 0 },
            down:  { cc_id: 127, value_press: 127, value_release: 0 },
            left:  { cc_id: 127, value_press: 127, value_release: 0 },
            right: { cc_id: 127, value_press: 127, value_release: 0 }
        }
    };

    const bytes16 = configToBytes(config16);
    const parsed16 = bytesToConfig(bytes16);
    assertEqual(parsed16.midiChannel, 16, 'Max channel 16 preserved');
    assertEqual(parsed16.axes.lx.cc_id, 127, 'Disabled CC (127) preserved');
}

console.log('\n=== Test 5: Error handling ===');
{
    // Too short data
    const shortData = [0x01, 0x02, 0x03];
    const parsedShort = bytesToConfig(shortData);
    assertEqual(parsedShort, null, 'Returns null for too short data');

    // Exactly 92 bytes (1 byte short)
    const almost = new Array(92).fill(0);
    const parsedAlmost = bytesToConfig(almost);
    assertEqual(parsedAlmost, null, 'Returns null for 92 bytes (needs 93)');

    // Exactly 93 bytes works
    const exact = new Array(93).fill(0);
    const parsedExact = bytesToConfig(exact);
    assert(parsedExact !== null, 'Accepts exactly 93 bytes');
}

// Summary
console.log('\n========================================');
console.log(`Tests passed: ${testsPassed}`);
console.log(`Tests failed: ${testsFailed}`);
console.log('========================================');

if (testsFailed > 0) {
    process.exit(1);
}
