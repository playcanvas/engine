import { blueNoiseData } from "../../core/math/blue-noise.js";
import { ADDRESS_REPEAT, FILTER_NEAREST, PIXELFORMAT_L8, TEXTURETYPE_DEFAULT } from "../../platform/graphics/constants.js";
import { DeviceCache } from "../../platform/graphics/device-cache.js";
import { Texture } from "../../platform/graphics/texture.js";

// device cache storing the blue noise texture for the device
const deviceCache = new DeviceCache();

function getBlueNoiseTexture(device) {

    return deviceCache.get(device, () => {

        const data = blueNoiseData();
        const size = 32;

        const texture = new Texture(device, {
            name: `BlueNoise${size}`,
            width: size,
            height: size,
            arrayLength: size,
            volume: false,
            format: PIXELFORMAT_L8,
            addressU: ADDRESS_REPEAT,
            addressV: ADDRESS_REPEAT,
            type: TEXTURETYPE_DEFAULT,
            magFilter: FILTER_NEAREST,
            minFilter: FILTER_NEAREST,
            anisotropy: 1,
            mipmaps: false,
            levels: [data]
        });

        // texture.lock().set(data);
        // texture.unlock();

        return texture;
    });
}

export { getBlueNoiseTexture };
