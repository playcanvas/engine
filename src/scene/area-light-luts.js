import { Texture } from '../platform/graphics/texture.js';
import { DeviceCache } from '../platform/graphics/device-cache.js';
import {
    ADDRESS_CLAMP_TO_EDGE,
    FILTER_LINEAR, FILTER_NEAREST,
    PIXELFORMAT_RGBA16F,
    TEXTURETYPE_DEFAULT
} from '../platform/graphics/constants.js';
import { areaLightLutsData } from './area-light-luts-data.js';

/**
 * @import { GraphicsDevice } from '../platform/graphics/graphics-device.js'
 */

// the width and height of each LUT texture
const LUT_SIZE = 64;

// class used to hold LUT textures in the device cache
class AreaLightCacheEntry {
    constructor(texture0, texture1) {
        this.texture0 = texture0;
        this.texture1 = texture1;
    }

    destroy() {
        this.texture0.destroy();
        this.texture1.destroy();
    }
}

// device cache storing LUT textures, taking care of their removal when the device is destroyed
const deviceCache = new DeviceCache();

/**
 * The decoded LUT data, both tables as half floats, shared by all devices and decoded on first
 * use.
 *
 * @type {Uint16Array|null}
 */
let lutData = null;

const decodeLutData = () => {
    if (!lutData) {
        const bytes = Uint8Array.from(atob(areaLightLutsData), char => char.charCodeAt(0));
        lutData = new Uint16Array(bytes.buffer);
    }
    return lutData;
};

const createTexture = (device, data) => {
    return new Texture(device, {
        name: 'AreaLightLUT',
        width: LUT_SIZE,
        height: LUT_SIZE,
        format: PIXELFORMAT_RGBA16F,
        addressU: ADDRESS_CLAMP_TO_EDGE,
        addressV: ADDRESS_CLAMP_TO_EDGE,
        type: TEXTURETYPE_DEFAULT,
        magFilter: FILTER_LINEAR,
        minFilter: FILTER_NEAREST,
        anisotropy: 1,
        mipmaps: false,
        levels: [data]
    });
};

// static class managing LUT tables for the area lights
class AreaLightLuts {
    /**
     * Creates the LUT textures of area lights for a device, once, and sets them as uniforms.
     *
     * @param {GraphicsDevice} device - The graphics device.
     */
    static create(device) {
        const entry = deviceCache.get(device, () => {
            const data = decodeLutData();
            const tableSize = LUT_SIZE * LUT_SIZE * 4;
            return new AreaLightCacheEntry(
                createTexture(device, data.subarray(0, tableSize)),
                createTexture(device, data.subarray(tableSize, tableSize * 2))
            );
        });

        device.scope.resolve('areaLightsLutTex1').setValue(entry.texture0);
        device.scope.resolve('areaLightsLutTex2').setValue(entry.texture1);
    }
}

export { AreaLightLuts };
