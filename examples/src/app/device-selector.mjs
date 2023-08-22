// Don't include all of 'playcanvas' for these defines, it just
// causes bigger bundles and prolongs the build time by ~3s.
import {
    DEVICETYPE_WEBGL1, DEVICETYPE_WEBGL2, DEVICETYPE_WEBGPU, DEVICETYPE_NULL
} from 'playcanvas/src/platform/graphics/constants.js';
import React, { Component } from 'react';
import { jsxSelectInput } from './jsx.mjs';

const deviceTypeNames = {
    [DEVICETYPE_WEBGL1]: 'WebGL 1',
    [DEVICETYPE_WEBGL2]: 'WebGL 2',
    [DEVICETYPE_WEBGPU]: 'WebGPU',
    [DEVICETYPE_NULL  ]: 'Null',
};

/**
 * @typedef {object} Props
 * @property {Function} onSelect
 * @property {import('@playcanvas/observer').Observer} [observer]
 */

/** @typedef {object} State */

/** @type {typeof Component<Props, State>} */
const c = Component;

class DeviceSelector extends c {
    deviceTypeSelectInputRef = React.createRef();

    /**
     * @param {Props} props 
     */
    constructor(props) {
        super(props);
        this.props.observer?.on('updateActiveDevice', this.onSetActiveGraphicsDevice.bind(this));
    }

    /**
     * @type {SelectInput|undefined}
     */
    get deviceTypeSelectInput() {
        return this.deviceTypeSelectInputRef.current?.element;
    }

    /**
     * @type {string}
     */
    set preferredGraphicsDevice(value) {
        window.preferredGraphicsDevice = value;
    }

    get preferredGraphicsDevice() {
        return window.preferredGraphicsDevice;
    }

    /**
     * @param {string} preferredDevice 
     * @param {string} activeDevice 
     */
    setDisabledOptions(preferredDevice = 'webgpu', activeDevice) {
        const selectInput = this.deviceTypeSelectInput;
        if ((preferredDevice === DEVICETYPE_WEBGL2 || preferredDevice === DEVICETYPE_WEBGPU) && activeDevice === DEVICETYPE_WEBGL1) {
            selectInput.fallbackOrder = [DEVICETYPE_WEBGPU, DEVICETYPE_WEBGL2, DEVICETYPE_WEBGL1];
            selectInput.disabledOptions = {
                [DEVICETYPE_WEBGPU]: 'WebGPU (not supported)',
                [DEVICETYPE_WEBGL2]: 'WebGL 2 (not supported)'
            };
        } else if (preferredDevice === DEVICETYPE_WEBGL1 && activeDevice === DEVICETYPE_WEBGL2) {
            selectInput.fallbackOrder = [DEVICETYPE_WEBGL1, DEVICETYPE_WEBGL2, DEVICETYPE_WEBGPU];
            selectInput.disabledOptions = {
                [DEVICETYPE_WEBGL1]: 'WebGL 1 (not supported)'
            };
        } else if (preferredDevice === DEVICETYPE_WEBGPU && activeDevice !== DEVICETYPE_WEBGPU) {
            selectInput.fallbackOrder = [DEVICETYPE_WEBGPU, DEVICETYPE_WEBGL2, DEVICETYPE_WEBGL1];
            selectInput.disabledOptions = {
                [DEVICETYPE_WEBGPU]: 'WebGPU (not supported)'
            };
        } else {
            selectInput.disabledOptions = null;
        }
    }

    /**
     * @param {string} value 
     */
    onSetActiveGraphicsDevice(value) {
        if (!this.preferredGraphicsDevice) {
            this.preferredGraphicsDevice = value;
            this.deviceTypeSelectInput.value = value;
        }
        this.setDisabledOptions(this.preferredGraphicsDevice, value);
        document.getElementById('showMiniStatsButton').ui.enabled = (value !== DEVICETYPE_WEBGPU) && (value !== DEVICETYPE_NULL);
    }

    /**
     * @param {string} value - todo
     */
    onSetPreferredGraphicsDevice(value) {
        this.deviceTypeSelectInput.disabledOptions = null;
        this.deviceTypeSelectInput.value = value;
        this.preferredGraphicsDevice = value;
        this.props.onSelect(value);
    }

    render() {
        this.props.onSelect
        return jsxSelectInput({
            id: 'deviceTypeSelectInput',
            options: [
                { t: deviceTypeNames[DEVICETYPE_WEBGL1], v: DEVICETYPE_WEBGL1 },
                { t: deviceTypeNames[DEVICETYPE_WEBGL2], v: DEVICETYPE_WEBGL2 },
                { t: deviceTypeNames[DEVICETYPE_WEBGPU], v: DEVICETYPE_WEBGPU },
                { t: deviceTypeNames[DEVICETYPE_NULL  ], v: DEVICETYPE_NULL   },
            ],
            value: DEVICETYPE_WEBGL2,
            onSelect: this.onSetPreferredGraphicsDevice.bind(this),
            prefix: 'Active Device: ', 
            // @ts-ignore this is setting a legacy ref
            ref: this.deviceTypeSelectInputRef
        })
    }
}

export { DeviceSelector };
