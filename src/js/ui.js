/**
 * @file ui.js
 * @brief UI components for MIDI configurator
 */

import { SP404_CC, SP404_CC_NAMES, BTN_MAP_TYPE, BTN_MAP_TYPE_NAMES, SP404_BANKS, SP404_PAD_COUNT, MIDI_CHANNEL_MIN, MIDI_CHANNEL_MAX } from './constants.js';

/**
 * Create select element with options
 */
function createSelect(id, options, selectedValue, onChange) {
    const select = document.createElement('select');
    select.id = id;
    select.className = 'config-select';

    for (const [value, label] of Object.entries(options)) {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = label;
        if (parseInt(value) === selectedValue) {
            option.selected = true;
        }
        select.appendChild(option);
    }

    if (onChange) {
        select.addEventListener('change', (e) => onChange(parseInt(e.target.value)));
    }

    return select;
}

/**
 * Create number input
 */
function createNumberInput(id, min, max, value, onChange) {
    const input = document.createElement('input');
    input.type = 'number';
    input.id = id;
    input.className = 'config-input';
    input.min = min;
    input.max = max;
    input.value = value;

    if (onChange) {
        input.addEventListener('change', (e) => onChange(parseInt(e.target.value)));
    }

    return input;
}

/**
 * Create checkbox
 */
function createCheckbox(id, checked, label, onChange) {
    const wrapper = document.createElement('label');
    wrapper.className = 'checkbox-wrapper';

    const input = document.createElement('input');
    input.type = 'checkbox';
    input.id = id;
    input.checked = checked;

    if (onChange) {
        input.addEventListener('change', (e) => onChange(e.target.checked));
    }

    wrapper.appendChild(input);
    wrapper.appendChild(document.createTextNode(label));

    return wrapper;
}

/**
 * Create axis configuration panel
 */
export function createAxisPanel(axisId, axisName, config, onUpdate) {
    const panel = document.createElement('div');
    panel.className = 'config-panel axis-panel';
    panel.dataset.axis = axisId;

    const header = document.createElement('h3');
    header.textContent = axisName;
    panel.appendChild(header);

    const content = document.createElement('div');
    content.className = 'panel-content';

    // CC Select
    const ccRow = document.createElement('div');
    ccRow.className = 'config-row';
    ccRow.innerHTML = '<label>Control Change:</label>';
    ccRow.appendChild(createSelect(
        `${axisId}-cc`,
        SP404_CC_NAMES,
        config.ccId,
        (value) => onUpdate(axisId, 'ccId', value)
    ));
    content.appendChild(ccRow);

    // Min/Max values
    const rangeRow = document.createElement('div');
    rangeRow.className = 'config-row range-row';
    rangeRow.innerHTML = '<label>Range:</label>';

    const minInput = createNumberInput(`${axisId}-min`, 0, 127, config.minValue,
        (value) => onUpdate(axisId, 'minValue', value));
    const maxInput = createNumberInput(`${axisId}-max`, 0, 127, config.maxValue,
        (value) => onUpdate(axisId, 'maxValue', value));

    rangeRow.appendChild(minInput);
    rangeRow.appendChild(document.createTextNode(' - '));
    rangeRow.appendChild(maxInput);
    content.appendChild(rangeRow);

    // Deadzone
    const deadzoneRow = document.createElement('div');
    deadzoneRow.className = 'config-row';
    deadzoneRow.innerHTML = '<label>Deadzone:</label>';
    deadzoneRow.appendChild(createNumberInput(`${axisId}-deadzone`, 0, 50, config.deadzone,
        (value) => onUpdate(axisId, 'deadzone', value)));
    content.appendChild(deadzoneRow);

    // Invert
    const invertRow = document.createElement('div');
    invertRow.className = 'config-row';
    invertRow.appendChild(createCheckbox(`${axisId}-invert`, config.invert, 'Invert',
        (value) => onUpdate(axisId, 'invert', value)));
    content.appendChild(invertRow);

    panel.appendChild(content);
    return panel;
}

/**
 * Create button configuration panel
 */
export function createButtonPanel(btnId, btnName, config, onUpdate) {
    const panel = document.createElement('div');
    panel.className = 'config-panel button-panel';
    panel.dataset.button = btnId;

    const header = document.createElement('h3');
    header.textContent = btnName;
    panel.appendChild(header);

    const content = document.createElement('div');
    content.className = 'panel-content';

    // Mapping type
    const typeRow = document.createElement('div');
    typeRow.className = 'config-row';
    typeRow.innerHTML = '<label>Type:</label>';
    typeRow.appendChild(createSelect(
        `${btnId}-type`,
        BTN_MAP_TYPE_NAMES,
        config.type,
        (value) => {
            onUpdate(btnId, 'type', value);
            updateButtonPanelForType(content, btnId, value, config, onUpdate);
        }
    ));
    content.appendChild(typeRow);

    // Type-specific options container
    const optionsContainer = document.createElement('div');
    optionsContainer.className = 'type-options';
    optionsContainer.id = `${btnId}-options`;
    content.appendChild(optionsContainer);

    // Toggle checkbox
    const toggleRow = document.createElement('div');
    toggleRow.className = 'config-row';
    toggleRow.appendChild(createCheckbox(`${btnId}-toggle`, config.toggle, 'Toggle Mode',
        (value) => onUpdate(btnId, 'toggle', value)));
    content.appendChild(toggleRow);

    panel.appendChild(content);

    // Initialize type-specific options
    updateButtonPanelForType(optionsContainer, btnId, config.type, config, onUpdate);

    return panel;
}

/**
 * Update button panel for selected type
 */
function updateButtonPanelForType(container, btnId, type, config, onUpdate) {
    container.innerHTML = '';

    switch (type) {
        case BTN_MAP_TYPE.NOTE:
            // Note number
            const noteRow = document.createElement('div');
            noteRow.className = 'config-row';
            noteRow.innerHTML = '<label>Note:</label>';
            noteRow.appendChild(createNumberInput(`${btnId}-note`, 0, 127,
                config.note?.note || 36,
                (value) => onUpdate(btnId, 'note.note', value)));
            container.appendChild(noteRow);

            // Velocity
            const velRow = document.createElement('div');
            velRow.className = 'config-row';
            velRow.innerHTML = '<label>Velocity:</label>';
            velRow.appendChild(createNumberInput(`${btnId}-velocity`, 0, 127,
                config.note?.velocity || 100,
                (value) => onUpdate(btnId, 'note.velocity', value)));
            container.appendChild(velRow);
            break;

        case BTN_MAP_TYPE.CC_MOMENTARY:
        case BTN_MAP_TYPE.CC_TOGGLE:
            // CC Select
            const ccRow = document.createElement('div');
            ccRow.className = 'config-row';
            ccRow.innerHTML = '<label>Control Change:</label>';
            ccRow.appendChild(createSelect(`${btnId}-cc`, SP404_CC_NAMES,
                config.cc?.ccId || 0,
                (value) => onUpdate(btnId, 'cc.ccId', value)));
            container.appendChild(ccRow);
            break;

        case BTN_MAP_TYPE.PAD:
            // Bank select
            const bankRow = document.createElement('div');
            bankRow.className = 'config-row';
            bankRow.innerHTML = '<label>Bank:</label>';
            const bankOptions = {};
            SP404_BANKS.forEach((b, i) => bankOptions[i] = `Bank ${b}`);
            bankRow.appendChild(createSelect(`${btnId}-bank`, bankOptions,
                config.pad?.bank || 0,
                (value) => onUpdate(btnId, 'pad.bank', value)));
            container.appendChild(bankRow);

            // Pad select
            const padRow = document.createElement('div');
            padRow.className = 'config-row';
            padRow.innerHTML = '<label>Pad:</label>';
            const padOptions = {};
            for (let i = 0; i < SP404_PAD_COUNT; i++) {
                padOptions[i] = `Pad ${i + 1}`;
            }
            padRow.appendChild(createSelect(`${btnId}-pad`, padOptions,
                config.pad?.pad || 0,
                (value) => onUpdate(btnId, 'pad.pad', value)));
            container.appendChild(padRow);

            // Velocity
            const padVelRow = document.createElement('div');
            padVelRow.className = 'config-row';
            padVelRow.innerHTML = '<label>Velocity:</label>';
            padVelRow.appendChild(createNumberInput(`${btnId}-pad-velocity`, 0, 127,
                config.pad?.velocity || 100,
                (value) => onUpdate(btnId, 'pad.velocity', value)));
            container.appendChild(padVelRow);
            break;
    }
}

/**
 * Create D-Pad configuration panel
 */
export function createDPadPanel(dirId, dirName, config, onUpdate) {
    const panel = document.createElement('div');
    panel.className = 'config-panel dpad-panel';
    panel.dataset.dpad = dirId;

    const header = document.createElement('h3');
    header.textContent = dirName;
    panel.appendChild(header);

    const content = document.createElement('div');
    content.className = 'panel-content';

    // CC Select
    const ccRow = document.createElement('div');
    ccRow.className = 'config-row';
    ccRow.innerHTML = '<label>Control Change:</label>';
    ccRow.appendChild(createSelect(`${dirId}-cc`, SP404_CC_NAMES, config.ccId,
        (value) => onUpdate(dirId, 'ccId', value)));
    content.appendChild(ccRow);

    // Press value
    const pressRow = document.createElement('div');
    pressRow.className = 'config-row';
    pressRow.innerHTML = '<label>Press Value:</label>';
    pressRow.appendChild(createNumberInput(`${dirId}-press`, 0, 127, config.valuePress,
        (value) => onUpdate(dirId, 'valuePress', value)));
    content.appendChild(pressRow);

    // Release value
    const releaseRow = document.createElement('div');
    releaseRow.className = 'config-row';
    releaseRow.innerHTML = '<label>Release Value:</label>';
    releaseRow.appendChild(createNumberInput(`${dirId}-release`, 0, 127, config.valueRelease,
        (value) => onUpdate(dirId, 'valueRelease', value)));
    content.appendChild(releaseRow);

    panel.appendChild(content);
    return panel;
}

/**
 * Create channel selector
 */
export function createChannelSelector(channel, onUpdate) {
    const container = document.createElement('div');
    container.className = 'channel-selector';
    container.innerHTML = '<label>MIDI Channel:</label>';

    const channelOptions = {};
    for (let i = MIDI_CHANNEL_MIN; i <= MIDI_CHANNEL_MAX; i++) {
        channelOptions[i] = `Channel ${i}`;
    }

    container.appendChild(createSelect('midi-channel', channelOptions, channel,
        (value) => onUpdate(value)));

    return container;
}

/**
 * Create connection status indicator
 */
export function createConnectionStatus() {
    const container = document.createElement('div');
    container.className = 'connection-status';
    container.id = 'connection-status';

    const indicator = document.createElement('span');
    indicator.className = 'status-indicator disconnected';
    indicator.id = 'status-indicator';

    const text = document.createElement('span');
    text.className = 'status-text';
    text.id = 'status-text';
    text.textContent = 'Disconnected';

    container.appendChild(indicator);
    container.appendChild(text);

    return container;
}

/**
 * Update connection status display
 */
export function updateConnectionStatus(connected) {
    const indicator = document.getElementById('status-indicator');
    const text = document.getElementById('status-text');

    if (indicator && text) {
        indicator.className = `status-indicator ${connected ? 'connected' : 'disconnected'}`;
        text.textContent = connected ? 'Connected' : 'Disconnected';
    }
}

/**
 * Create toolbar with action buttons
 */
export function createToolbar(callbacks) {
    const toolbar = document.createElement('div');
    toolbar.className = 'toolbar';

    // Connect button
    const connectBtn = document.createElement('button');
    connectBtn.id = 'connect-btn';
    connectBtn.className = 'btn btn-primary';
    connectBtn.textContent = 'Connect';
    connectBtn.addEventListener('click', callbacks.onConnect);
    toolbar.appendChild(connectBtn);

    // Read config button
    const readBtn = document.createElement('button');
    readBtn.id = 'read-btn';
    readBtn.className = 'btn';
    readBtn.textContent = 'Read Config';
    readBtn.disabled = true;
    readBtn.addEventListener('click', callbacks.onRead);
    toolbar.appendChild(readBtn);

    // Send config button
    const sendBtn = document.createElement('button');
    sendBtn.id = 'send-btn';
    sendBtn.className = 'btn';
    sendBtn.textContent = 'Send Config';
    sendBtn.disabled = true;
    sendBtn.addEventListener('click', callbacks.onSend);
    toolbar.appendChild(sendBtn);

    // Save button
    const saveBtn = document.createElement('button');
    saveBtn.id = 'save-btn';
    saveBtn.className = 'btn btn-success';
    saveBtn.textContent = 'Save to Device';
    saveBtn.disabled = true;
    saveBtn.addEventListener('click', callbacks.onSave);
    toolbar.appendChild(saveBtn);

    // Reset button
    const resetBtn = document.createElement('button');
    resetBtn.id = 'reset-btn';
    resetBtn.className = 'btn btn-warning';
    resetBtn.textContent = 'Reset to Defaults';
    resetBtn.addEventListener('click', callbacks.onReset);
    toolbar.appendChild(resetBtn);

    // Export/Import
    const exportBtn = document.createElement('button');
    exportBtn.id = 'export-btn';
    exportBtn.className = 'btn';
    exportBtn.textContent = 'Export';
    exportBtn.addEventListener('click', callbacks.onExport);
    toolbar.appendChild(exportBtn);

    const importBtn = document.createElement('button');
    importBtn.id = 'import-btn';
    importBtn.className = 'btn';
    importBtn.textContent = 'Import';
    importBtn.addEventListener('click', callbacks.onImport);
    toolbar.appendChild(importBtn);

    return toolbar;
}

/**
 * Enable/disable device-dependent buttons
 */
export function setDeviceButtonsEnabled(enabled) {
    const buttons = ['read-btn', 'send-btn', 'save-btn'];
    buttons.forEach(id => {
        const btn = document.getElementById(id);
        if (btn) btn.disabled = !enabled;
    });

    const connectBtn = document.getElementById('connect-btn');
    if (connectBtn) {
        connectBtn.textContent = enabled ? 'Disconnect' : 'Connect';
    }
}
