/**
 * @file serial.js
 * @brief WebSerial API communication module
 */

import { FRAME_START_MARKER, FRAME_END_MARKER, ESCAPE_CHAR, XOR_VALUE, MAX_FRAME_SIZE } from './constants.js';

export class SerialConnection {
    constructor() {
        this.port = null;
        this.reader = null;
        this.writer = null;
        this.readableStreamClosed = null;
        this.writableStreamClosed = null;
        this.isConnected = false;
        this.onDataCallback = null;
        this.onDisconnectCallback = null;

        // RX state machine
        this.rxBuffer = new Uint8Array(MAX_FRAME_SIZE);
        this.rxIndex = 0;
        this.rxEscapeNext = false;
        this.rxInFrame = false;
    }

    /**
     * Check if WebSerial API is supported
     */
    static isSupported() {
        return 'serial' in navigator;
    }

    /**
     * Connect to serial port
     * @param {number} baudRate - Baud rate (default 115200)
     */
    async connect(baudRate = 115200) {
        if (!SerialConnection.isSupported()) {
            throw new Error('WebSerial API is not supported in this browser');
        }

        try {
            // Request port from user
            this.port = await navigator.serial.requestPort();

            // Open the port
            await this.port.open({ baudRate });

            this.isConnected = true;

            // Set up disconnect handler
            this.port.addEventListener('disconnect', () => {
                this.handleDisconnect();
            });

            // Start reading
            this.startReading();

            console.log('Serial port connected');
            return true;
        } catch (error) {
            console.error('Failed to connect:', error);
            this.isConnected = false;
            throw error;
        }
    }

    /**
     * Disconnect from serial port
     */
    async disconnect() {
        if (!this.isConnected) return;

        try {
            // Cancel the reader
            if (this.reader) {
                await this.reader.cancel();
                await this.readableStreamClosed.catch(() => {});
                this.reader = null;
            }

            // Close the port
            if (this.port) {
                await this.port.close();
                this.port = null;
            }

            this.isConnected = false;
            console.log('Serial port disconnected');
        } catch (error) {
            console.error('Error during disconnect:', error);
        }
    }

    /**
     * Handle unexpected disconnect
     */
    handleDisconnect() {
        this.isConnected = false;
        this.port = null;
        this.reader = null;

        if (this.onDisconnectCallback) {
            this.onDisconnectCallback();
        }
    }

    /**
     * Start reading from serial port
     */
    async startReading() {
        while (this.port && this.port.readable && this.isConnected) {
            this.reader = this.port.readable.getReader();

            try {
                while (true) {
                    const { value, done } = await this.reader.read();

                    if (done) {
                        break;
                    }

                    // Process received bytes
                    this.processBytes(value);
                }
            } catch (error) {
                console.error('Read error:', error);
            } finally {
                this.reader.releaseLock();
            }
        }
    }

    /**
     * Process received bytes through HDLC decoder
     * @param {Uint8Array} bytes - Received bytes
     */
    processBytes(bytes) {
        for (const byte of bytes) {
            this.processByte(byte);
        }
    }

    /**
     * Process single byte through HDLC state machine
     * @param {number} byte - Received byte
     */
    processByte(byte) {
        if (byte === FRAME_START_MARKER) {
            // Start of new frame
            this.rxIndex = 0;
            this.rxInFrame = true;
            this.rxEscapeNext = false;
            return;
        }

        if (byte === FRAME_END_MARKER) {
            // End of frame
            if (this.rxInFrame && this.rxIndex > 0) {
                // Frame complete, process it
                const frame = this.rxBuffer.slice(0, this.rxIndex);
                this.handleFrame(frame);
            }
            this.rxInFrame = false;
            this.rxIndex = 0;
            return;
        }

        if (!this.rxInFrame) {
            return; // Ignore bytes outside frame
        }

        if (byte === ESCAPE_CHAR) {
            this.rxEscapeNext = true;
            return;
        }

        if (this.rxEscapeNext) {
            byte ^= XOR_VALUE;
            this.rxEscapeNext = false;
        }

        if (this.rxIndex < MAX_FRAME_SIZE) {
            this.rxBuffer[this.rxIndex++] = byte;
        }
    }

    /**
     * Handle complete frame
     * @param {Uint8Array} frame - Complete frame data
     */
    handleFrame(frame) {
        if (this.onDataCallback) {
            this.onDataCallback(frame);
        }
    }

    /**
     * Send frame with HDLC encoding
     * @param {Uint8Array} data - Data to send
     */
    async sendFrame(data) {
        if (!this.isConnected || !this.port || !this.port.writable) {
            throw new Error('Serial port not connected');
        }

        // Encode frame
        const encoded = this.encodeFrame(data);

        // Write to port
        const writer = this.port.writable.getWriter();
        try {
            await writer.write(encoded);
        } finally {
            writer.releaseLock();
        }
    }

    /**
     * Encode data into HDLC frame
     * @param {Uint8Array} data - Raw data
     * @returns {Uint8Array} - Encoded frame
     */
    encodeFrame(data) {
        const encoded = [];
        encoded.push(FRAME_START_MARKER);

        for (const byte of data) {
            if (byte === FRAME_START_MARKER ||
                byte === FRAME_END_MARKER ||
                byte === ESCAPE_CHAR) {
                encoded.push(ESCAPE_CHAR);
                encoded.push(byte ^ XOR_VALUE);
            } else {
                encoded.push(byte);
            }
        }

        encoded.push(FRAME_END_MARKER);
        return new Uint8Array(encoded);
    }

    /**
     * Set callback for received data
     * @param {Function} callback - Callback function(frame)
     */
    onData(callback) {
        this.onDataCallback = callback;
    }

    /**
     * Set callback for disconnect event
     * @param {Function} callback - Callback function
     */
    onDisconnect(callback) {
        this.onDisconnectCallback = callback;
    }
}

// Export singleton instance
export const serialConnection = new SerialConnection();
