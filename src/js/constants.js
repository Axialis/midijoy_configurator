/**
 * @file constants.js
 * @brief SP404 MK2 MIDI constants for configurator
 */

// MIDI Channel range
export const MIDI_CHANNEL_MIN = 1;
export const MIDI_CHANNEL_MAX = 16;

// SP404 MK2 Control Change IDs (matches sp404mk2_midi_sdk.h)
export const SP404_CC = {
    CTRL1: 0,
    CTRL2: 1,
    CTRL3: 2,
    BUS1_ASSIGN: 3,
    BUS2_ASSIGN: 4,
    BUS3_ASSIGN: 5,
    BUS4_ASSIGN: 6,
    MFX_SELECT: 7,
    MFX_ON: 8,
    MFX_PARAM1: 9,
    MFX_PARAM2: 10,
    MFX_PARAM3: 11,
    BPM_SYNC: 12,
    GATE_MODE: 13,
    LOOP_MODE: 14,
    REVERSE: 15,
    ROLL: 16,
    FIXED_VELOCITY: 17,
    PAD_MUTE: 18,
    PATTERN_SELECT: 19,
    PATTERN_START: 20,
    PATTERN_STOP: 21,
    DJ_MODE_ENABLE: 22,
    INPUT_LEVEL: 23,
    INPUT_FX_TYPE: 24,
    COUNT_IN: 25,
    END_SNAP: 26,
    LOOPER_RECORD: 27,
    LOOPER_OVERDUB: 28,
    LOOPER_UNDO: 29,
    LOOPER_REDO: 30,
    SYSTEM_PARAM: 31
};

// Human-readable CC names
export const SP404_CC_NAMES = {
    [SP404_CC.CTRL1]: 'Control Knob 1',
    [SP404_CC.CTRL2]: 'Control Knob 2',
    [SP404_CC.CTRL3]: 'Control Knob 3',
    [SP404_CC.BUS1_ASSIGN]: 'Bus 1 Assign',
    [SP404_CC.BUS2_ASSIGN]: 'Bus 2 Assign',
    [SP404_CC.BUS3_ASSIGN]: 'Bus 3 Assign',
    [SP404_CC.BUS4_ASSIGN]: 'Bus 4 Assign',
    [SP404_CC.MFX_SELECT]: 'MFX Select',
    [SP404_CC.MFX_ON]: 'MFX On/Off',
    [SP404_CC.MFX_PARAM1]: 'MFX Parameter 1',
    [SP404_CC.MFX_PARAM2]: 'MFX Parameter 2',
    [SP404_CC.MFX_PARAM3]: 'MFX Parameter 3',
    [SP404_CC.BPM_SYNC]: 'BPM Sync',
    [SP404_CC.GATE_MODE]: 'Gate Mode',
    [SP404_CC.LOOP_MODE]: 'Loop Mode',
    [SP404_CC.REVERSE]: 'Reverse',
    [SP404_CC.ROLL]: 'Roll',
    [SP404_CC.FIXED_VELOCITY]: 'Fixed Velocity',
    [SP404_CC.PAD_MUTE]: 'Pad Mute',
    [SP404_CC.PATTERN_SELECT]: 'Pattern Select',
    [SP404_CC.PATTERN_START]: 'Pattern Start',
    [SP404_CC.PATTERN_STOP]: 'Pattern Stop',
    [SP404_CC.DJ_MODE_ENABLE]: 'DJ Mode',
    [SP404_CC.INPUT_LEVEL]: 'Input Level',
    [SP404_CC.INPUT_FX_TYPE]: 'Input FX Type',
    [SP404_CC.COUNT_IN]: 'Count In',
    [SP404_CC.END_SNAP]: 'End Snap',
    [SP404_CC.LOOPER_RECORD]: 'Looper Record',
    [SP404_CC.LOOPER_OVERDUB]: 'Looper Overdub',
    [SP404_CC.LOOPER_UNDO]: 'Looper Undo',
    [SP404_CC.LOOPER_REDO]: 'Looper Redo',
    [SP404_CC.SYSTEM_PARAM]: 'System Parameter'
};

// Button mapping types
export const BTN_MAP_TYPE = {
    NOTE: 0,
    CC_MOMENTARY: 1,
    CC_TOGGLE: 2,
    PAD: 3
};

export const BTN_MAP_TYPE_NAMES = {
    [BTN_MAP_TYPE.NOTE]: 'MIDI Note',
    [BTN_MAP_TYPE.CC_MOMENTARY]: 'CC Momentary',
    [BTN_MAP_TYPE.CC_TOGGLE]: 'CC Toggle',
    [BTN_MAP_TYPE.PAD]: 'SP404 Pad'
};

// SP404 Banks
export const SP404_BANKS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
export const SP404_PAD_COUNT = 16;

// Gamepad button IDs
export const GAMEPAD_BUTTONS = {
    X: 'btn_x',
    A: 'btn_a',
    B: 'btn_b',
    Y: 'btn_y',
    LB: 'btn_lb',
    RB: 'btn_rb',
    LT: 'btn_lt',
    RT: 'btn_rt',
    BACK: 'btn_back',
    START: 'btn_start',
    L3: 'btn_l3',
    R3: 'btn_r3'
};

// Gamepad axes IDs
export const GAMEPAD_AXES = {
    LX: 'axis_lx',
    LY: 'axis_ly',
    RX: 'axis_rx',
    RY: 'axis_ry'
};

// D-Pad directions
export const DPAD_DIRECTIONS = {
    UP: 'dpad_up',
    DOWN: 'dpad_down',
    LEFT: 'dpad_left',
    RIGHT: 'dpad_right'
};

// Transport protocol constants (matches communication.h)
export const FRAME_START_MARKER = 0x7E;
export const FRAME_END_MARKER = 0x7F;
export const ESCAPE_CHAR = 0x7D;
export const XOR_VALUE = 0x20;
export const MAX_FRAME_SIZE = 256;

// Message types (matches communication.h)
export const MSG_TYPE = {
    UPDATE_CONFIGURATION: 0,
    CURRENT_CONFIGURATION: 1,
    ERROR_FIFO_READ: 2,
    ERROR_PACKING_FAILED: 3,
    ERROR_TRANSPORT_FAILED: 4,
    ERROR_INVALID_DATA: 5,
    ERROR_DEVICE_DISCONNECTED: 6,
    GET_CONFIGURATION: 7,
    SET_CONFIGURATION: 8,
    SAVE_CONFIGURATION: 9,
    RESET_CONFIGURATION: 10
};
