import { Debug } from '../../core/debug.js';
import { PIXELFORMAT_RGBA8 } from './constants.js';
import { DeviceCache } from './device-cache.js';
import { Texture } from './texture.js';

const textureData = {
    white: [255, 255, 255, 255],
    gray: [128, 128, 128, 255],
    black: [0, 0, 0, 255],
    normal: [128, 128, 255, 255]
};

// class used to hold LUT textures in the device cache
class BuiltInTextures {
    /** @type Map<string, Texture> */
    map = new Map();

    destroy() {
        this.map.forEach((texture) => {
            texture.destroy();
        });
    }
}

// device cache storing built-in textures, taking care of their removal when the device is destroyed
const deviceCache = new DeviceCache();

const getBuiltInTexture = (device, name) => {
    const cache = deviceCache.get(device, () => {
        return new BuiltInTextures();
    });

    if (!cache.map.has(name)) {
        const texture = new Texture(device, {
            name: `built-in-texture-${name}`,
            width: 1,
            height: 1,
            format: PIXELFORMAT_RGBA8
        });

        const pixels = texture.lock();
        const data = textureData[name];
        Debug.assert(data, `Data for built-in texture '${name}' not found`);
        pixels.set(data);
        texture.unlock();

        cache.map.set(name, texture);
    }

    return cache.map.get(name);
};

export { getBuiltInTexture };
