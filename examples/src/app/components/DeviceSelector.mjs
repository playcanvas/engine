// Don't include all of 'playcanvas' for these defines, it just
// causes bigger bundles and prolongs the build time by ~3s.
import {
    DEVICETYPE_WEBGL1,
    DEVICETYPE_WEBGL2,
    DEVICETYPE_WEBGPU,
    DEVICETYPE_NULL
} from 'playcanvas';
import { Component } from 'react';
import { SelectInput } from '@playcanvas/pcui/react';

import { jsx } from '../jsx.mjs';
import '../events.js';

const deviceTypeNames = {
    [DEVICETYPE_WEBGL1]: 'WebGL 1',
    [DEVICETYPE_WEBGL2]: 'WebGL 2',
    [DEVICETYPE_WEBGPU]: 'WebGPU',
    [DEVICETYPE_NULL]: 'Null'
};

/**
 * @typedef {object} Props
 * @property {Function} onSelect - On select handler.
 */

/**
 * @typedef {object} State
 * @property {any} fallbackOrder - The fallbackOrder.
 * @property {any} disabledOptions - The disabledOptions.
 * @property {string} activeDevice - The active device reported from the running example.
 */

/** @type {typeof Component<Props, State>} */
const TypedComponent = Component;

class DeviceSelector extends TypedComponent {
    state = {
        fallbackOrder: null,
        disabledOptions: null,
        activeDevice: this.preferredGraphicsDevice
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
     * @type {string}
     */
    set preferredGraphicsDevice(value) {
        localStorage.setItem('preferredGraphicsDevice', value);
        // @ts-ignore
        window.preferredGraphicsDevice = value;
    }

    get preferredGraphicsDevice() {
        // @ts-ignore
        return window.preferredGraphicsDevice;
    }

    /**
     * If our preferred device was e.g. WebGPU, but our active device is suddenly e.g. WebGL 2,
     * then we basically infer that WebGPU wasn't supported and mark it like that.
     * @param {string} preferredDevice - The preferred device.
     * @param {string} activeDevice - The active device reported from the example iframe.
     */
    setDisabledOptions(preferredDevice = 'webgpu', activeDevice) {
        if (
            (preferredDevice === DEVICETYPE_WEBGL2 || preferredDevice === DEVICETYPE_WEBGPU) &&
            activeDevice === DEVICETYPE_WEBGL1
        ) {
            const fallbackOrder = [DEVICETYPE_WEBGPU, DEVICETYPE_WEBGL2, DEVICETYPE_WEBGL1];
            const disabledOptions = {
                [DEVICETYPE_WEBGPU]: 'WebGPU (not supported)',
                [DEVICETYPE_WEBGL2]: 'WebGL 2 (not supported)'
            };
            this.mergeState({ fallbackOrder, disabledOptions, activeDevice });
        } else if (preferredDevice === DEVICETYPE_WEBGL1 && activeDevice === DEVICETYPE_WEBGL2) {
            const fallbackOrder = [DEVICETYPE_WEBGL1, DEVICETYPE_WEBGL2, DEVICETYPE_WEBGPU];
            const disabledOptions = {
                [DEVICETYPE_WEBGL1]: 'WebGL 1 (not supported)'
            };
            this.mergeState({ fallbackOrder, disabledOptions, activeDevice });
        } else if (preferredDevice === DEVICETYPE_WEBGPU && activeDevice !== DEVICETYPE_WEBGPU) {
            const fallbackOrder = [DEVICETYPE_WEBGPU, DEVICETYPE_WEBGL2, DEVICETYPE_WEBGL1];
            const disabledOptions = {
                [DEVICETYPE_WEBGPU]: 'WebGPU (not supported)'
            };
            this.mergeState({ fallbackOrder, disabledOptions, activeDevice });
        } else {
            const disabledOptions = null;
            this.mergeState({ disabledOptions, activeDevice });
        }
    }

    /**
     * Disable MiniStats because WebGPU / Null renderer can't use it.
     * @param {string} value - Selected device.
     */
    updateMiniStats(value) {
        const disableMiniStats = value === DEVICETYPE_NULL;
        const miniStatsEnabled = document.getElementById('showMiniStatsButton')?.ui.class.contains('selected');
        if (disableMiniStats && miniStatsEnabled) {
            document.getElementById('showMiniStatsButton')?.ui.class.remove('selected');
        }
    }

    /**
     * @param {string} value - Is graphics device active
     */
    onSetActiveGraphicsDevice(value) {
        if (!this.preferredGraphicsDevice) {
            this.preferredGraphicsDevice = value;
        }
        this.setDisabledOptions(this.preferredGraphicsDevice, value);
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
        return jsx(SelectInput, {
            id: 'deviceTypeSelectInput',
            options: [
                { t: deviceTypeNames[DEVICETYPE_WEBGL1], v: DEVICETYPE_WEBGL1 },
                { t: deviceTypeNames[DEVICETYPE_WEBGL2], v: DEVICETYPE_WEBGL2 },
                { t: deviceTypeNames[DEVICETYPE_WEBGPU], v: DEVICETYPE_WEBGPU },
                { t: deviceTypeNames[DEVICETYPE_NULL], v: DEVICETYPE_NULL }
            ],
            value: activeDevice,
            fallbackOrder,
            disabledOptions,
            onSelect: this.onSetPreferredGraphicsDevice.bind(this),
            prefix: 'Active Device: '
        });
    }
}

export { DeviceSelector };
