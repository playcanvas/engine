import { blueNoiseData } from '../../core/math/blue-noise.js';
import { spatiotemporalBlueNoiseData } from '../../core/math/spatiotemporal-blue-noise.js';
import { ADDRESS_REPEAT, FILTER_NEAREST, PIXELFORMAT_R8, PIXELFORMAT_RGBA8, TEXTURETYPE_DEFAULT } from '../../platform/graphics/constants.js';
import { DeviceCache } from '../../platform/graphics/device-cache.js';
import { Texture } from '../../platform/graphics/texture.js';

/**
 * @import { GraphicsDevice } from '../../platform/graphics/graphics-device.js'
 */

const createTexture = (device, namePrefix, size, data) => {
    const texture = new Texture(device, {
        name: `${namePrefix}${size}`,
        width: size,
        height: size,
        format: PIXELFORMAT_RGBA8,
        addressU: ADDRESS_REPEAT,
        addressV: ADDRESS_REPEAT,
        type: TEXTURETYPE_DEFAULT,
        magFilter: FILTER_NEAREST,
        minFilter: FILTER_NEAREST,
        anisotropy: 1,
        mipmaps: false
    });

    texture.lock().set(data);
    texture.unlock();

    return texture;
};

// device cache storing the blue noise texture for the device
const deviceCacheBlueNoise = new DeviceCache();
const deviceCacheSTBN = new DeviceCache();

const getBlueNoiseTexture = (device) => {
    return deviceCacheBlueNoise.get(device, () => {

        const data = blueNoiseData();
        const size = Math.sqrt(data.length / 4);
        return createTexture(device, 'BlueNoise', size, data);
    });
};

/**
 * Returns a shared scalar 32x32x64 spatiotemporal blue-noise volume. Created on first use and
 * released with the graphics device; the retained CPU data also supports device recovery.
 *
 * @param {GraphicsDevice} device - Graphics device.
 * @returns {Texture} The noise volume.
 * @ignore
 */
const getSTBNTexture = (device) => {
    return deviceCacheSTBN.get(device, () => new Texture(device, {
        name: 'SpatiotemporalBlueNoise',
        width: 32,
        height: 32,
        depth: 64,
        volume: true,
        format: PIXELFORMAT_R8,
        addressU: ADDRESS_REPEAT,
        addressV: ADDRESS_REPEAT,
        addressW: ADDRESS_REPEAT,
        minFilter: FILTER_NEAREST,
        magFilter: FILTER_NEAREST,
        mipmaps: false,
        levels: [spatiotemporalBlueNoiseData()]
    }));
};

export { getBlueNoiseTexture, getSTBNTexture };
