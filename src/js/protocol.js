/**
 * @file protocol.js
 * @brief Protocol handling for configuration exchange
 */

import { MSG_TYPE, SP404_CC, BTN_MAP_TYPE } from './constants.js';
import { serialConnection } from './serial.js';

/**
 * Simple MessagePack-like encoder/decoder for configuration
 * Uses a simplified format compatible with the embedded mpack
 */
export class ConfigProtocol {
    constructor() {
        this.onConfigReceived = null;
        this.onError = null;
        this.onGamepadData = null;

        // Set up serial data handler
        serialConnection.onData((frame) => this.handleFrame(frame));
    }

    /**
     * Handle received frame
     * @param {Uint8Array} frame - Received frame data
     */
    handleFrame(frame) {
        try {
            const message = this.decodeMessage(frame);

            switch (message.type) {
                case MSG_TYPE.CURRENT_CONFIGURATION:
                    // Raw gamepad data for live preview
                    if (this.onGamepadData) {
                        this.onGamepadData(message.data);
                    }
                    break;

                case MSG_TYPE.GET_CONFIGURATION:
                    // Configuration response
                    if (this.onConfigReceived) {
                        const config = this.decodeConfig(message.data);
                        this.onConfigReceived(config);
                    }
                    break;

                case MSG_TYPE.ERROR_FIFO_READ:
                case MSG_TYPE.ERROR_PACKING_FAILED:
                case MSG_TYPE.ERROR_TRANSPORT_FAILED:
                case MSG_TYPE.ERROR_INVALID_DATA:
                case MSG_TYPE.ERROR_DEVICE_DISCONNECTED:
                    if (this.onError) {
                        this.onError(message.type, message.data);
                    }
                    break;

                default:
                    console.log('Unknown message type:', message.type);
            }
        } catch (error) {
            console.error('Error handling frame:', error);
            if (this.onError) {
                this.onError(-1, error.message);
            }
        }
    }

    /**
     * Decode MessagePack-like message
     * @param {Uint8Array} data - Raw frame data
     * @returns {Object} - Decoded message {type, data}
     */
    decodeMessage(data) {
        if (data.length < 2) {
            throw new Error('Message too short');
        }

        // Simple format: [type, length, ...data]
        // For MessagePack compatibility, we expect a map with 'type' and 'data' keys
        // Simplified: first byte is fixmap marker, then type, then data

        let offset = 0;

        // Check for fixmap (0x82 = map with 2 elements)
        if (data[offset] === 0x82) {
            offset++;

            // Skip 'type' key string
            const typeKeyLen = data[offset] & 0x1F; // fixstr
            offset += 1 + typeKeyLen;

            // Read type value
            const type = data[offset++];

            // Skip 'data' key string
            const dataKeyLen = data[offset] & 0x1F; // fixstr
            offset += 1 + dataKeyLen;

            // Read data array/bin
            let msgData;
            const dataMarker = data[offset++];

            if ((dataMarker & 0xF0) === 0x90) {
                // fixarray
                const len = dataMarker & 0x0F;
                msgData = data.slice(offset, offset + len);
            } else if (dataMarker === 0xC4) {
                // bin8
                const len = data[offset++];
                msgData = data.slice(offset, offset + len);
            } else if (dataMarker === 0xC0) {
                // nil
                msgData = null;
            } else {
                // Raw bytes
                msgData = data.slice(offset);
            }

            return { type, data: msgData };
        }

        // Fallback: simple format [type, ...data]
        return {
            type: data[0],
            data: data.slice(1)
        };
    }

    /**
     * Encode message for sending
     * @param {number} type - Message type
     * @param {Uint8Array|Object} data - Message data
     * @returns {Uint8Array} - Encoded message
     */
    encodeMessage(type, data = null) {
        const buffer = [];

        // fixmap with 2 elements
        buffer.push(0x82);

        // Key: "type" (fixstr)
        buffer.push(0xA4); // fixstr len 4
        buffer.push(...[0x74, 0x79, 0x70, 0x65]); // "type"

        // Value: type (uint8)
        buffer.push(type);

        // Key: "data" (fixstr)
        buffer.push(0xA4); // fixstr len 4
        buffer.push(...[0x64, 0x61, 0x74, 0x61]); // "data"

        // Value: data
        if (data === null) {
            buffer.push(0xC0); // nil
        } else if (data instanceof Uint8Array) {
            if (data.length < 256) {
                buffer.push(0xC4); // bin8
                buffer.push(data.length);
                buffer.push(...data);
            } else {
                buffer.push(0xC5); // bin16
                buffer.push((data.length >> 8) & 0xFF);
                buffer.push(data.length & 0xFF);
                buffer.push(...data);
            }
        } else if (typeof data === 'object') {
            const encoded = this.encodeConfig(data);
            buffer.push(0xC4); // bin8
            buffer.push(encoded.length);
            buffer.push(...encoded);
        }

        return new Uint8Array(buffer);
    }

    /**
     * Encode configuration object
     * @param {Object} config - Configuration object
     * @returns {Uint8Array} - Encoded config
     */
    encodeConfig(config) {
        const buffer = [];

        // Channel (1 byte)
        buffer.push(config.channel || 1);

        // Axes (4 axes × 5 bytes each = 20 bytes)
        for (const axis of ['lx', 'ly', 'rx', 'ry']) {
            const a = config.axes?.[axis] || { ccId: 0, minValue: 0, maxValue: 127, invert: false, deadzone: 5 };
            buffer.push(a.ccId);
            buffer.push(a.minValue);
            buffer.push(a.maxValue);
            buffer.push(a.invert ? 1 : 0);
            buffer.push(a.deadzone);
        }

        // Buttons (12 buttons × variable bytes)
        const buttons = ['btn_x', 'btn_a', 'btn_b', 'btn_y', 'btn_lb', 'btn_rb', 'btn_lt', 'btn_rt', 'btn_back', 'btn_start', 'btn_l3', 'btn_r3'];
        for (const btn of buttons) {
            const b = config.buttons?.[btn] || { type: BTN_MAP_TYPE.PAD, pad: { bank: 0, pad: 0, velocity: 100 }, toggle: false };
            buffer.push(b.type);
            buffer.push(b.toggle ? 1 : 0);

            switch (b.type) {
                case BTN_MAP_TYPE.NOTE:
                    buffer.push(b.note?.note || 36);
                    buffer.push(b.note?.velocity || 100);
                    buffer.push(0); // padding
                    break;
                case BTN_MAP_TYPE.CC_MOMENTARY:
                case BTN_MAP_TYPE.CC_TOGGLE:
                    buffer.push(b.cc?.ccId || 0);
                    buffer.push(0); // padding
                    buffer.push(0); // padding
                    break;
                case BTN_MAP_TYPE.PAD:
                default:
                    buffer.push(b.pad?.bank || 0);
                    buffer.push(b.pad?.pad || 0);
                    buffer.push(b.pad?.velocity || 100);
                    break;
            }
        }

        // D-Pad (4 directions × 3 bytes each = 12 bytes)
        for (const dir of ['up', 'down', 'left', 'right']) {
            const d = config.dpad?.[dir] || { ccId: 0, valuePress: 127, valueRelease: 64 };
            buffer.push(d.ccId);
            buffer.push(d.valuePress);
            buffer.push(d.valueRelease);
        }

        return new Uint8Array(buffer);
    }

    /**
     * Decode configuration from bytes
     * @param {Uint8Array} data - Encoded config data
     * @returns {Object} - Configuration object
     */
    decodeConfig(data) {
        if (!data || data.length < 1) {
            return this.getDefaultConfig();
        }

        let offset = 0;
        const config = {};

        // Channel
        config.channel = data[offset++] || 1;

        // Axes
        config.axes = {};
        for (const axis of ['lx', 'ly', 'rx', 'ry']) {
            if (offset + 5 > data.length) break;
            config.axes[axis] = {
                ccId: data[offset++],
                minValue: data[offset++],
                maxValue: data[offset++],
                invert: data[offset++] !== 0,
                deadzone: data[offset++]
            };
        }

        // Buttons
        config.buttons = {};
        const buttons = ['btn_x', 'btn_a', 'btn_b', 'btn_y', 'btn_lb', 'btn_rb', 'btn_lt', 'btn_rt', 'btn_back', 'btn_start', 'btn_l3', 'btn_r3'];
        for (const btn of buttons) {
            if (offset + 5 > data.length) break;
            const type = data[offset++];
            const toggle = data[offset++] !== 0;
            const b = { type, toggle };

            switch (type) {
                case BTN_MAP_TYPE.NOTE:
                    b.note = {
                        note: data[offset++],
                        velocity: data[offset++]
                    };
                    offset++; // padding
                    break;
                case BTN_MAP_TYPE.CC_MOMENTARY:
                case BTN_MAP_TYPE.CC_TOGGLE:
                    b.cc = { ccId: data[offset++] };
                    offset += 2; // padding
                    break;
                case BTN_MAP_TYPE.PAD:
                default:
                    b.pad = {
                        bank: data[offset++],
                        pad: data[offset++],
                        velocity: data[offset++]
                    };
                    break;
            }

            config.buttons[btn] = b;
        }

        // D-Pad
        config.dpad = {};
        for (const dir of ['up', 'down', 'left', 'right']) {
            if (offset + 3 > data.length) break;
            config.dpad[dir] = {
                ccId: data[offset++],
                valuePress: data[offset++],
                valueRelease: data[offset++]
            };
        }

        return config;
    }

    /**
     * Get default configuration
     * @returns {Object} - Default configuration
     */
    getDefaultConfig() {
        return {
            channel: 1,
            axes: {
                lx: { ccId: SP404_CC.CTRL1, minValue: 0, maxValue: 127, invert: false, deadzone: 5 },
                ly: { ccId: SP404_CC.CTRL2, minValue: 0, maxValue: 127, invert: true, deadzone: 5 },
                rx: { ccId: SP404_CC.MFX_PARAM1, minValue: 0, maxValue: 127, invert: false, deadzone: 5 },
                ry: { ccId: SP404_CC.MFX_PARAM2, minValue: 0, maxValue: 127, invert: true, deadzone: 5 }
            },
            buttons: {
                btn_x: { type: BTN_MAP_TYPE.PAD, pad: { bank: 0, pad: 0, velocity: 100 }, toggle: false },
                btn_a: { type: BTN_MAP_TYPE.PAD, pad: { bank: 0, pad: 1, velocity: 100 }, toggle: false },
                btn_b: { type: BTN_MAP_TYPE.PAD, pad: { bank: 0, pad: 2, velocity: 100 }, toggle: false },
                btn_y: { type: BTN_MAP_TYPE.PAD, pad: { bank: 0, pad: 3, velocity: 100 }, toggle: false },
                btn_lb: { type: BTN_MAP_TYPE.CC_MOMENTARY, cc: { ccId: SP404_CC.MFX_ON }, toggle: false },
                btn_rb: { type: BTN_MAP_TYPE.CC_TOGGLE, cc: { ccId: SP404_CC.DJ_MODE_ENABLE }, toggle: true },
                btn_lt: { type: BTN_MAP_TYPE.CC_MOMENTARY, cc: { ccId: SP404_CC.REVERSE }, toggle: false },
                btn_rt: { type: BTN_MAP_TYPE.CC_MOMENTARY, cc: { ccId: SP404_CC.ROLL }, toggle: false },
                btn_back: { type: BTN_MAP_TYPE.CC_MOMENTARY, cc: { ccId: SP404_CC.PATTERN_STOP }, toggle: false },
                btn_start: { type: BTN_MAP_TYPE.CC_MOMENTARY, cc: { ccId: SP404_CC.PATTERN_START }, toggle: false },
                btn_l3: { type: BTN_MAP_TYPE.CC_TOGGLE, cc: { ccId: SP404_CC.LOOP_MODE }, toggle: true },
                btn_r3: { type: BTN_MAP_TYPE.CC_TOGGLE, cc: { ccId: SP404_CC.GATE_MODE }, toggle: true }
            },
            dpad: {
                up: { ccId: SP404_CC.CTRL3, valuePress: 127, valueRelease: 64 },
                down: { ccId: SP404_CC.CTRL3, valuePress: 0, valueRelease: 64 },
                left: { ccId: SP404_CC.BPM_SYNC, valuePress: 0, valueRelease: 64 },
                right: { ccId: SP404_CC.BPM_SYNC, valuePress: 127, valueRelease: 64 }
            }
        };
    }

    /**
     * Request current configuration from device
     */
    async requestConfig() {
        const msg = this.encodeMessage(MSG_TYPE.GET_CONFIGURATION);
        await serialConnection.sendFrame(msg);
    }

    /**
     * Send configuration to device
     * @param {Object} config - Configuration object
     */
    async sendConfig(config) {
        const msg = this.encodeMessage(MSG_TYPE.SET_CONFIGURATION, config);
        await serialConnection.sendFrame(msg);
    }

    /**
     * Save configuration to device flash
     */
    async saveConfig() {
        const msg = this.encodeMessage(MSG_TYPE.SAVE_CONFIGURATION);
        await serialConnection.sendFrame(msg);
    }

    /**
     * Reset configuration to defaults
     */
    async resetConfig() {
        const msg = this.encodeMessage(MSG_TYPE.RESET_CONFIGURATION);
        await serialConnection.sendFrame(msg);
    }
}

// Export singleton
export const configProtocol = new ConfigProtocol();
