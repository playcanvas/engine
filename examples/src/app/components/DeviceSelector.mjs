import { Component } from 'react';

import { SelectInput } from './OverlaySelectInput.mjs';
import {
    DEVICETYPE_WEBGPU,
    DEVICETYPE_WEBGPU_BARE,
    DEVICETYPE_WEBGL2,
    DEVICETYPE_NULL
} from '../constants.mjs';
import { jsx } from '../jsx.mjs';

/** @import { DeviceEvent } from '../events.js' */

/**
 * @param {string} dt - The device type.
 * @returns {boolean} True if the device type is WebGPU.
 */
const isWebGPU = dt => dt === 'webgpu' || dt.startsWith('webgpu:');

/** @type {Record<string, string>} */
const deviceTypeNames = {
    [DEVICETYPE_WEBGPU]: 'WebGPU',
    [DEVICETYPE_WEBGPU_BARE]: 'WebGPU Bare',
    [DEVICETYPE_WEBGL2]: 'WebGL 2',
    [DEVICETYPE_NULL]: 'Null'
};

/**
 * @param {string | null | undefined} value - Device type value.
 * @returns {string | undefined} The valid device type.
 */
const validDeviceType = value => (value && deviceTypeNames[value] ? value : undefined);

/**
 * @typedef {object} Props
 * @property {Function} onSelect - On select handler.
 */

/**
 * @typedef {object} State
 * @property {string[] | null} fallbackOrder - The fallbackOrder.
 * @property {Record<string, string> | null} disabledOptions - The disabledOptions.
 * @property {string | undefined} activeDevice - The active device reported from the running example.
 */

/** @type {typeof Component<Props, State>} */
const TypedComponent = Component;

class DeviceSelector extends TypedComponent {
    /** @type {State} */
    state = {
        fallbackOrder: null,
        disabledOptions: null,
        activeDevice: this.activeGraphicsDevice
    };

    /**
     * @param {Props} props - Component properties.
     */
    constructor(props) {
        super(props);
        this._handleUpdateDevice = this._handleUpdateDevice.bind(this);
    }

    /**
     * @param {DeviceEvent} event - The event.
     */
    _handleUpdateDevice(event) {
        const { deviceType } = event.detail;
        this.onSetActiveGraphicsDevice(deviceType);
    }

    componentDidMount() {
        window.addEventListener('updateActiveDevice', this._handleUpdateDevice);
        const activeDevice = validDeviceType(window.activeGraphicsDevice);
        if (activeDevice) {
            this.onSetActiveGraphicsDevice(activeDevice);
        }
    }

    componentWillUnmount() {
        window.removeEventListener('updateActiveDevice', this._handleUpdateDevice);
    }

    /**
     * @param {Partial<State>} state - New partial state.
     */
    mergeState(state) {
        // new state is always calculated from the current state,
        // avoiding any potential issues with asynchronous updates
        this.setState(prevState => ({ ...prevState, ...state }));
    }

    /**
     * @param {string} value - The preferred graphics device.
     */
    set preferredGraphicsDevice(value) {
        localStorage.setItem('preferredGraphicsDevice', value);
        window.preferredGraphicsDevice = value;
    }

    /**
     * @returns {string | undefined} The preferred graphics device.
     */
    get preferredGraphicsDevice() {
        return validDeviceType(window.preferredGraphicsDevice) ??
            validDeviceType(localStorage.getItem('preferredGraphicsDevice')) ??
            DEVICETYPE_WEBGL2;
    }

    /**
     * @returns {string | undefined} The active graphics device.
     */
    get activeGraphicsDevice() {
        return validDeviceType(window.activeGraphicsDevice) ?? this.preferredGraphicsDevice;
    }

    /**
     * If our preferred device was e.g. WebGPU, but our active device is suddenly e.g. WebGL 2,
     * then we basically infer that WebGPU wasn't supported and mark it like that.
     * @param {string} preferredDevice - The preferred device.
     * @param {string} activeDevice - The active device reported from
     * the example iframe.
     */
    setDisabledOptions(preferredDevice = DEVICETYPE_WEBGPU, activeDevice) {
        if (preferredDevice === DEVICETYPE_WEBGL2 && activeDevice !== DEVICETYPE_WEBGL2) {
            const fallbackOrder = [DEVICETYPE_WEBGPU];
            const disabledOptions = {
                [DEVICETYPE_WEBGL2]: 'WebGL 2 (not supported)'
            };
            this.mergeState({ fallbackOrder, disabledOptions, activeDevice });
        } else if (isWebGPU(preferredDevice) && !isWebGPU(activeDevice)) {
            const fallbackOrder = [DEVICETYPE_WEBGL2];
            const disabledOptions = {
                [preferredDevice]: `${deviceTypeNames[preferredDevice] || 'WebGPU'} (not supported)`
            };
            this.mergeState({ fallbackOrder, disabledOptions, activeDevice });
        } else {
            const fallbackOrder = null;
            const disabledOptions = null;
            this.mergeState({ fallbackOrder, disabledOptions, activeDevice });
        }
    }

    /**
     * Disable MiniStats because WebGPU / Null renderer can't use it.
     * @param {string} value - Selected device.
     */
    updateMiniStats(value) {
        const disableMiniStats = value === DEVICETYPE_NULL;
        const button = /** @type {any} */ (document.getElementById('showMiniStatsButton'));
        const miniStatsEnabled = button?.ui.class.contains('selected');
        if (disableMiniStats && miniStatsEnabled) {
            button?.ui.class.remove('selected');
        }
    }

    /**
     * @param {string} value - Is graphics device active.
     */
    onSetActiveGraphicsDevice(value) {
        const preferredDevice = this.preferredGraphicsDevice ?? value;
        if (!this.preferredGraphicsDevice) {
            this.preferredGraphicsDevice = preferredDevice;
        }
        this.setDisabledOptions(preferredDevice, value);
        this.updateMiniStats(value);
    }

    /**
     * @param {string} value - The newly picked graphics device.
     */
    onSetPreferredGraphicsDevice(value) {
        this.mergeState({ disabledOptions: null, activeDevice: value });
        this.preferredGraphicsDevice = value;
        this.updateMiniStats(value);
        this.props.onSelect(value);
    }

    render() {
        const { fallbackOrder, disabledOptions, activeDevice } = this.state;
        const options = [
            { t: deviceTypeNames[DEVICETYPE_WEBGPU], v: DEVICETYPE_WEBGPU },
            ...(process.env.NODE_ENV === 'development' ? [
                { t: deviceTypeNames[DEVICETYPE_WEBGPU_BARE], v: DEVICETYPE_WEBGPU_BARE }
            ] : []),
            { t: deviceTypeNames[DEVICETYPE_WEBGL2], v: DEVICETYPE_WEBGL2 },
            { t: deviceTypeNames[DEVICETYPE_NULL], v: DEVICETYPE_NULL }
        ];
        return jsx(SelectInput, {
            id: 'deviceTypeSelectInput',
            options,
            value: activeDevice,
            fallbackOrder: fallbackOrder ?? undefined,
            disabledOptions: disabledOptions ?? undefined,
            onSelect: this.onSetPreferredGraphicsDevice.bind(this),
            prefix: 'Active Device: '
        });
    }
}

export { DeviceSelector };
