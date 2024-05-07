import { FloatPacking } from '../core/math/float-packing.js';
import { Texture } from '../platform/graphics/texture.js';
import { DeviceCache } from '../platform/graphics/device-cache.js';

import {
    ADDRESS_CLAMP_TO_EDGE,
    FILTER_LINEAR, FILTER_NEAREST,
    PIXELFORMAT_RGBA16F,
    TEXTURETYPE_DEFAULT
} from '../platform/graphics/constants.js';

// class used to hold LUT textures in the device cache
class AreaLightCacheEntry {
    constructor(texture0, texture1) {
        this.texture0 = texture0;
        this.texture1 = texture1;
    }

    destroy() {
        this.texture0?.destroy();
        this.texture1?.destroy();
    }
}

// device cache storing LUT textures, taking care of their removal when the device is destroyed
const deviceCache = new DeviceCache();

// static class managing LUT tables for the area lights
class AreaLightLuts {
    static createTexture(device, format, size, postfix = '') {
        const tex = new Texture(device, {
            name: `AreaLightLUT${postfix}`,
            width: size,
            height: size,
            format: format,
            addressU: ADDRESS_CLAMP_TO_EDGE,
            addressV: ADDRESS_CLAMP_TO_EDGE,
            type: TEXTURETYPE_DEFAULT,
            magFilter: FILTER_LINEAR,
            minFilter: FILTER_NEAREST,
            anisotropy: 1,
            mipmaps: false
        });
        return tex;
    }

    static applyTextures(device, texture1, texture2) {
        // remove previous textures from cache
        deviceCache.remove(device);

        // add new textures to cache
        deviceCache.get(device, () => {
            return new AreaLightCacheEntry(texture1, texture1 === texture2 ? null : texture2);
        });

        // set them as uniforms
        device.scope.resolve('areaLightsLutTex1').setValue(texture1);
        device.scope.resolve('areaLightsLutTex2').setValue(texture2);
    }

    // placeholder LUT textures for area light
    static createPlaceholder(device) {
        const texture = AreaLightLuts.createTexture(device, PIXELFORMAT_RGBA16F, 2, 'placeholder');

        const pixels = texture.lock();
        pixels.fill(0);
        texture.unlock();

        AreaLightLuts.applyTextures(device, texture, texture);
    }

    // creates LUT texture used by area lights
    static set(device, ltcMat1, ltcMat2) {

        function buildTexture(device, data, format) {
            const texture = AreaLightLuts.createTexture(device, format, 64);

            texture.lock().set(data);
            texture.unlock();

            return texture;
        }

        function convertToHalfFloat(data) {

            const count = data.length;
            const ret = new Uint16Array(count);
            const float2Half = FloatPacking.float2Half;
            for (let i = 0; i < count; i++) {
                ret[i] = float2Half(data[i]);
            }

            return ret;
        }

        const srcData1 = ltcMat1;
        const srcData2 = ltcMat2;

        // convert data to half format
        const data1 = convertToHalfFloat(srcData1);
        const data2 = convertToHalfFloat(srcData2);

        // create lut textures
        const tex1 = buildTexture(device, data1, PIXELFORMAT_RGBA16F);
        const tex2 = buildTexture(device, data2, PIXELFORMAT_RGBA16F);

        // assign to uniforms
        AreaLightLuts.applyTextures(device, tex1, tex2);
    }
}

export { AreaLightLuts };
