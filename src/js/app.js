/**
 * @file app.js
 * @brief Main application for MidiJoy Configurator
 */

import { serialConnection, SerialConnection } from './serial.js';
import { configProtocol } from './protocol.js';
import {
    createAxisPanel,
    createButtonPanel,
    createDPadPanel,
    createChannelSelector,
    createConnectionStatus,
    createToolbar,
    updateConnectionStatus,
    setDeviceButtonsEnabled
} from './ui.js';

class MidiJoyConfigurator {
    constructor() {
        this.config = configProtocol.getDefaultConfig();
        this.isConnected = false;
        this.svgElement = null;

        // Bind callbacks
        configProtocol.onConfigReceived = (config) => this.handleConfigReceived(config);
        configProtocol.onGamepadData = (data) => this.handleGamepadData(data);
        configProtocol.onError = (type, data) => this.handleError(type, data);

        serialConnection.onDisconnect(() => this.handleDisconnect());
    }

    /**
     * Initialize the application
     */
    async init() {
        // Check WebSerial support
        if (!SerialConnection.isSupported()) {
            this.showError('WebSerial API is not supported. Please use Chrome or Edge browser.');
            return;
        }

        // Build UI
        this.buildUI();

        // Load SVG
        await this.loadSVG();

        // Load saved config from localStorage
        this.loadLocalConfig();

        console.log('MidiJoy Configurator initialized');
    }

    /**
     * Build the main UI
     */
    buildUI() {
        const container = document.getElementById('svg-container');
        container.innerHTML = '';
        container.className = 'main-container';

        // Create layout
        const layout = document.createElement('div');
        layout.className = 'app-layout';

        // Left panel - Joystick visualization
        const leftPanel = document.createElement('div');
        leftPanel.className = 'left-panel';
        leftPanel.id = 'joystick-panel';
        layout.appendChild(leftPanel);

        // Right panel - Configuration
        const rightPanel = document.createElement('div');
        rightPanel.className = 'right-panel';

        // Header with status and toolbar
        const header = document.createElement('div');
        header.className = 'header';

        const title = document.createElement('h1');
        title.textContent = 'MidiJoy Configurator';
        header.appendChild(title);

        header.appendChild(createConnectionStatus());
        header.appendChild(createToolbar({
            onConnect: () => this.toggleConnection(),
            onRead: () => this.readConfig(),
            onSend: () => this.sendConfig(),
            onSave: () => this.saveConfig(),
            onReset: () => this.resetConfig(),
            onExport: () => this.exportConfig(),
            onImport: () => this.importConfig()
        }));

        rightPanel.appendChild(header);

        // Channel selector
        rightPanel.appendChild(createChannelSelector(this.config.channel,
            (ch) => this.updateConfig('channel', ch)));

        // Tabs for different sections
        const tabs = document.createElement('div');
        tabs.className = 'config-tabs';
        tabs.innerHTML = `
            <button class="tab-btn active" data-tab="axes">Axes</button>
            <button class="tab-btn" data-tab="buttons">Buttons</button>
            <button class="tab-btn" data-tab="dpad">D-Pad</button>
        `;
        rightPanel.appendChild(tabs);

        // Tab content containers
        const tabContent = document.createElement('div');
        tabContent.className = 'tab-content';

        // Axes tab
        const axesTab = document.createElement('div');
        axesTab.className = 'tab-pane active';
        axesTab.id = 'axes-tab';
        axesTab.appendChild(createAxisPanel('lx', 'Left Stick X', this.config.axes.lx,
            (axis, prop, value) => this.updateAxisConfig(axis, prop, value)));
        axesTab.appendChild(createAxisPanel('ly', 'Left Stick Y', this.config.axes.ly,
            (axis, prop, value) => this.updateAxisConfig(axis, prop, value)));
        axesTab.appendChild(createAxisPanel('rx', 'Right Stick X', this.config.axes.rx,
            (axis, prop, value) => this.updateAxisConfig(axis, prop, value)));
        axesTab.appendChild(createAxisPanel('ry', 'Right Stick Y', this.config.axes.ry,
            (axis, prop, value) => this.updateAxisConfig(axis, prop, value)));
        tabContent.appendChild(axesTab);

        // Buttons tab
        const buttonsTab = document.createElement('div');
        buttonsTab.className = 'tab-pane';
        buttonsTab.id = 'buttons-tab';

        const buttonNames = {
            btn_x: 'X Button',
            btn_a: 'A Button',
            btn_b: 'B Button',
            btn_y: 'Y Button',
            btn_lb: 'Left Bumper (LB)',
            btn_rb: 'Right Bumper (RB)',
            btn_lt: 'Left Trigger (LT)',
            btn_rt: 'Right Trigger (RT)',
            btn_back: 'Back Button',
            btn_start: 'Start Button',
            btn_l3: 'Left Stick Press (L3)',
            btn_r3: 'Right Stick Press (R3)'
        };

        for (const [id, name] of Object.entries(buttonNames)) {
            buttonsTab.appendChild(createButtonPanel(id, name, this.config.buttons[id],
                (btn, prop, value) => this.updateButtonConfig(btn, prop, value)));
        }
        tabContent.appendChild(buttonsTab);

        // D-Pad tab
        const dpadTab = document.createElement('div');
        dpadTab.className = 'tab-pane';
        dpadTab.id = 'dpad-tab';

        const dpadNames = {
            up: 'D-Pad Up',
            down: 'D-Pad Down',
            left: 'D-Pad Left',
            right: 'D-Pad Right'
        };

        for (const [id, name] of Object.entries(dpadNames)) {
            dpadTab.appendChild(createDPadPanel(id, name, this.config.dpad[id],
                (dir, prop, value) => this.updateDPadConfig(dir, prop, value)));
        }
        tabContent.appendChild(dpadTab);

        rightPanel.appendChild(tabContent);
        layout.appendChild(rightPanel);

        container.appendChild(layout);

        // Set up tab switching
        tabs.addEventListener('click', (e) => {
            if (e.target.classList.contains('tab-btn')) {
                this.switchTab(e.target.dataset.tab);
            }
        });
    }

    /**
     * Switch to a different tab
     */
    switchTab(tabName) {
        // Update tab buttons
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabName);
        });

        // Update tab panes
        document.querySelectorAll('.tab-pane').forEach(pane => {
            pane.classList.toggle('active', pane.id === `${tabName}-tab`);
        });
    }

    /**
     * Load joystick SVG
     */
    async loadSVG() {
        try {
            const response = await fetch('assets/images/joy.svg');
            if (!response.ok) throw new Error('SVG load failed');

            const svgText = await response.text();
            const container = document.getElementById('joystick-panel');
            container.innerHTML = svgText;

            this.svgElement = container.querySelector('svg');
            if (this.svgElement) {
                this.svgElement.setAttribute('preserveAspectRatio', 'xMidYMid meet');
                this.setupSVGInteraction();
            }
        } catch (error) {
            console.error('Error loading SVG:', error);
        }
    }

    /**
     * Set up SVG interactive elements
     */
    setupSVGInteraction() {
        if (!this.svgElement) return;

        // Add click handlers to buttons in SVG
        const buttonElements = this.svgElement.querySelectorAll('[data-button]');
        buttonElements.forEach(el => {
            el.style.cursor = 'pointer';
            el.addEventListener('click', () => {
                const btnId = el.dataset.button;
                this.highlightButton(btnId);
                this.switchTab('buttons');
                // Scroll to button panel
                const panel = document.querySelector(`[data-button="${btnId}"]`);
                if (panel) panel.scrollIntoView({ behavior: 'smooth' });
            });
        });
    }

    /**
     * Highlight button in SVG
     */
    highlightButton(btnId) {
        if (!this.svgElement) return;

        // Reset all highlights
        this.svgElement.querySelectorAll('.highlighted').forEach(el => {
            el.classList.remove('highlighted');
        });

        // Highlight selected
        const el = this.svgElement.querySelector(`[data-button="${btnId}"]`);
        if (el) {
            el.classList.add('highlighted');
        }
    }

    /**
     * Handle gamepad data for live preview
     */
    handleGamepadData(data) {
        if (!this.svgElement || !data || data.length < 6) return;

        // Update axis indicators
        const lx = data[0];
        const ly = data[1];
        const rx = data[2];
        const ry = data[3];

        // Could animate stick positions in SVG here
        // For now just log
        // console.log(`LX:${lx} LY:${ly} RX:${rx} RY:${ry}`);
    }

    /**
     * Toggle serial connection
     */
    async toggleConnection() {
        if (this.isConnected) {
            await serialConnection.disconnect();
            this.handleDisconnect();
        } else {
            try {
                await serialConnection.connect(115200);
                this.isConnected = true;
                updateConnectionStatus(true);
                setDeviceButtonsEnabled(true);
                console.log('Connected to device');
            } catch (error) {
                console.error('Connection failed:', error);
                this.showError('Failed to connect: ' + error.message);
            }
        }
    }

    /**
     * Handle disconnect event
     */
    handleDisconnect() {
        this.isConnected = false;
        updateConnectionStatus(false);
        setDeviceButtonsEnabled(false);
        console.log('Disconnected from device');
    }

    /**
     * Read configuration from device
     */
    async readConfig() {
        if (!this.isConnected) return;
        try {
            await configProtocol.requestConfig();
            console.log('Config request sent');
        } catch (error) {
            this.showError('Failed to read config: ' + error.message);
        }
    }

    /**
     * Handle received configuration
     */
    handleConfigReceived(config) {
        this.config = config;
        this.rebuildConfigUI();
        this.saveLocalConfig();
        console.log('Configuration received:', config);
    }

    /**
     * Send configuration to device
     */
    async sendConfig() {
        if (!this.isConnected) return;
        try {
            await configProtocol.sendConfig(this.config);
            console.log('Config sent');
        } catch (error) {
            this.showError('Failed to send config: ' + error.message);
        }
    }

    /**
     * Save configuration to device flash
     */
    async saveConfig() {
        if (!this.isConnected) return;
        try {
            await configProtocol.sendConfig(this.config);
            await configProtocol.saveConfig();
            console.log('Config saved to device');
            this.showSuccess('Configuration saved to device!');
        } catch (error) {
            this.showError('Failed to save config: ' + error.message);
        }
    }

    /**
     * Reset to default configuration
     */
    resetConfig() {
        if (confirm('Reset configuration to defaults?')) {
            this.config = configProtocol.getDefaultConfig();
            this.rebuildConfigUI();
            this.saveLocalConfig();
            console.log('Config reset to defaults');
        }
    }

    /**
     * Export configuration to JSON file
     */
    exportConfig() {
        const json = JSON.stringify(this.config, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = 'midijoy-config.json';
        a.click();

        URL.revokeObjectURL(url);
        console.log('Config exported');
    }

    /**
     * Import configuration from JSON file
     */
    importConfig() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';

        input.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            try {
                const text = await file.text();
                const config = JSON.parse(text);
                this.config = config;
                this.rebuildConfigUI();
                this.saveLocalConfig();
                console.log('Config imported');
            } catch (error) {
                this.showError('Failed to import config: ' + error.message);
            }
        });

        input.click();
    }

    /**
     * Update general config value
     */
    updateConfig(key, value) {
        this.config[key] = value;
        this.saveLocalConfig();
    }

    /**
     * Update axis configuration
     */
    updateAxisConfig(axis, prop, value) {
        if (!this.config.axes[axis]) {
            this.config.axes[axis] = {};
        }
        this.config.axes[axis][prop] = value;
        this.saveLocalConfig();
    }

    /**
     * Update button configuration
     */
    updateButtonConfig(btn, prop, value) {
        if (!this.config.buttons[btn]) {
            this.config.buttons[btn] = {};
        }

        // Handle nested properties like "note.velocity"
        const parts = prop.split('.');
        if (parts.length === 2) {
            if (!this.config.buttons[btn][parts[0]]) {
                this.config.buttons[btn][parts[0]] = {};
            }
            this.config.buttons[btn][parts[0]][parts[1]] = value;
        } else {
            this.config.buttons[btn][prop] = value;
        }

        this.saveLocalConfig();
    }

    /**
     * Update D-Pad configuration
     */
    updateDPadConfig(dir, prop, value) {
        if (!this.config.dpad[dir]) {
            this.config.dpad[dir] = {};
        }
        this.config.dpad[dir][prop] = value;
        this.saveLocalConfig();
    }

    /**
     * Rebuild config UI from current config
     */
    rebuildConfigUI() {
        // Rebuild the UI to reflect new config
        this.buildUI();
        this.loadSVG();
    }

    /**
     * Save configuration to localStorage
     */
    saveLocalConfig() {
        try {
            localStorage.setItem('midijoy-config', JSON.stringify(this.config));
        } catch (error) {
            console.warn('Failed to save to localStorage:', error);
        }
    }

    /**
     * Load configuration from localStorage
     */
    loadLocalConfig() {
        try {
            const saved = localStorage.getItem('midijoy-config');
            if (saved) {
                this.config = JSON.parse(saved);
                console.log('Loaded config from localStorage');
            }
        } catch (error) {
            console.warn('Failed to load from localStorage:', error);
        }
    }

    /**
     * Handle protocol error
     */
    handleError(type, data) {
        console.error('Protocol error:', type, data);
        this.showError(`Device error: ${type}`);
    }

    /**
     * Show error message
     */
    showError(message) {
        // Could use a toast notification library
        alert('Error: ' + message);
    }

    /**
     * Show success message
     */
    showSuccess(message) {
        alert(message);
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    const app = new MidiJoyConfigurator();
    app.init();
});

export { MidiJoyConfigurator };
