import { Debug } from '../core/debug.js';
import {
    SHADER_FORWARD, SHADER_FORWARDHDR, SHADER_DEPTH, SHADER_PICK, SHADER_SHADOW
} from './constants.js';

import { DeviceCache } from '../platform/graphics/device-cache.js';

// device cache storing shader pass data per device
const shaderPassDeviceCache = new DeviceCache();

/**
 * Info about a shader pass. Shader pass is represented by a unique index and a name, and the
 * index is used to access the shader required for the pass, from an array stored in the
 * material or mesh instance.
 *
 * @ignore
 */
class ShaderPassInfo {
    /** @type {number} */
    index;

    /** @type {string} */
    name;

    /** @type {string} */
    shaderDefine;

    constructor(name, index, options = {}) {

        Debug.assert(/^[a-zA-Z][_a-zA-Z0-9]*$/.test(name), `ShaderPass name can only contain letters, numbers and underscores and start with a letter: ${name}`);

        this.name = name;
        this.index = index;

        // assign options as properties to this object
        Object.assign(this, options);

        this.initShaderDefines();
    }

    initShaderDefines() {

        let keyword;
        if (this.isShadow) {
            keyword = 'SHADOW';
        } else if (this.isForward) {
            keyword = 'FORWARD';
        } else if (this.index === SHADER_DEPTH) {
            keyword = 'DEPTH';
        } else if (this.index === SHADER_PICK) {
            keyword = 'PICK';
        }

        // define based on on the options based name
        const define1 = keyword ? `#define ${keyword}_PASS\n` : '';

        // define based on the name
        const define2 = `#define ${this.name.toUpperCase()}_PASS\n`;

        this.shaderDefines = define1 + define2;
    }
}

/**
 * Class responsible for management of shader passes, associated with a device.
 *
 * @ignore
 */
class ShaderPass {
    /**
     * Allocated shader passes, map of a shader pass name to info.
     *
     * @type {Map<string, ShaderPassInfo>}
     */
    passesNamed = new Map();

    /**
     * Allocated shader passes, indexed by their index.
     *
     * @type {Array<ShaderPassInfo>}
     */
    passesIndexed = [];

    /** Next available index */
    nextIndex = 0;

    constructor() {

        const add = (name, index, options) => {
            const info = this.allocate(name, options);
            Debug.assert(info.index === index);
        };

        // add default passes in the required order, to match the constants
        add('forward', SHADER_FORWARD, { isForward: true });
        add('forward_hdr', SHADER_FORWARDHDR, { isForward: true });
        add('depth', SHADER_DEPTH);
        add('pick', SHADER_PICK);
        add('shadow', SHADER_SHADOW);
    }

    /**
     * Get access to the shader pass instance for the specified device.
     *
     * @param {import('../platform/graphics/graphics-device.js').GraphicsDevice} device - The
     * graphics device.
     * @returns { ShaderPass } The shader pass instance for the specified device.
     */
    static get(device) {
        Debug.assert(device);

        return shaderPassDeviceCache.get(device, () => {
            return new ShaderPass();
        });
    }

    /**
     * Allocates a shader pass with the specified name and options.
     *
     * @param {string} name - A name of the shader pass.
     * @param {object} options - Options for the shader pass, which are added as properties to the
     * shader pass info.
     * @returns {ShaderPassInfo} The allocated shader pass info.
     */
    allocate(name, options) {
        let info = this.passesNamed.get(name);
        if (info === undefined) {
            info = new ShaderPassInfo(name, this.nextIndex, options);
            this.passesNamed.set(info.name, info);
            this.passesIndexed[info.index] = info;
            this.nextIndex++;
        }
        return info;
    }

    /**
     * Return the shader pass info for the specified index.
     *
     * @param {number} index - The shader pass index.
     * @returns {ShaderPassInfo} - The shader pass info.
     */
    getByIndex(index) {
        const info = this.passesIndexed[index];
        Debug.assert(info);
        return info;
    }

    getByName(name) {
        return this.passesNamed.get(name);
    }
}

export { ShaderPass, ShaderPassInfo };
