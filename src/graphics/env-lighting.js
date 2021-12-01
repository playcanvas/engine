import { Texture } from './texture.js';
import { RenderTarget } from './render-target.js';
import { reprojectTexture } from './reproject-texture.js';
import { TEXTURETYPE_DEFAULT, TEXTURETYPE_RGBM,
    ADDRESS_CLAMP_TO_EDGE,
    PIXELFORMAT_R8_G8_B8_A8, PIXELFORMAT_RGBA16F, PIXELFORMAT_RGBA32F } from './constants';

const fixCubemapSeams = true;

// calculate the number of mipmap levels given texture dimensions
const calcLevels = (width, height) => {
    return 1 + Math.floor(Math.log2(Math.max(width, height)));
};

const supportsFloat16 = (device) => {
    return device.extTextureHalfFloat && device.textureHalfFloatRenderable;
};

const supportsFloat32 = (device) => {
    return device.extTextureFloat && device.textureFloatRenderable;
};

// lighting source should be stored HDR
const lightingSourcePixelFormat = (device) => {
    return supportsFloat16(device) ? PIXELFORMAT_RGBA16F :
        supportsFloat32(device) ? PIXELFORMAT_RGBA32F :
            PIXELFORMAT_R8_G8_B8_A8;
};

// runtime lighting can be RGBM
const lightingPixelFormat = (device) => {
    return PIXELFORMAT_R8_G8_B8_A8;
};

const createCubemap = (device, size, format) => {
    return new Texture(device, {
        name: `lighting-${size}`,
        cubemap: true,
        width: size,
        height: size,
        format: format,
        type: format === PIXELFORMAT_R8_G8_B8_A8 ? TEXTURETYPE_RGBM : TEXTURETYPE_DEFAULT,
        addressU: ADDRESS_CLAMP_TO_EDGE,
        addressV: ADDRESS_CLAMP_TO_EDGE,
        fixCubemapSeams: fixCubemapSeams,
        mipmaps: false
    });
};

// copy a texture into one of the target's mipmaps (target level is calculated from mipmap
// texture size)
// target and mipmap can be either 2d or cubemap textures
// this is the slow version. it downloads the GPU data to CPU and then uploads it again to
// GPU.
const copyMipmapSlow = (target, mipmap) => {
    // allocate buffer for reading back the texture data
    const allocData = (texture) => {
        switch (texture.format) {
            case PIXELFORMAT_RGBA16F:
                return new Uint16Array(texture.width * texture.height * 4);
            case PIXELFORMAT_RGBA32F:
                return new Float32Array(texture.width * texture.height * 4);
            default:
                return new Uint8ClampedArray(texture.width * texture.height * 4);
        }
    };

    // read texture data of the given texture face
    const readPixels = (texture, face, data) => {
        const device = texture.device;
        const rt = new RenderTarget({ colorBuffer: texture, face: face, depth: false });
        device.setFramebuffer(rt._glFrameBuffer);
        device.initRenderTarget(rt);
        device.gl.readPixels(0, 0, texture.width, texture.height, texture._glFormat, texture._glPixelType, data);
        rt.destroy();
    };

    const device = target.device;
    const gl = device.gl;
    const level = calcLevels(target.width, target.height) - calcLevels(mipmap.width, mipmap.height);
    const data = allocData(mipmap);

    for (let f = 0; f < (target.cubemap ? 6 : 1); f++) {
        const glTarget = target.cubemap ? gl.TEXTURE_CUBE_MAP_POSITIVE_X + f : gl.TEXTURE_2D;

        // read data back to CPU
        readPixels(mipmap, f, data);

        device.setTexture(target, 0);
        gl.texImage2D(
            glTarget,
            level,
            target._glInternalFormat,
            mipmap.width,
            mipmap.height,
            0,
            mipmap._glFormat,
            mipmap._glPixelType,
            data
        );
    }
};

// copy mipmap texture into one of the target's mipmaps (level is calculated from texture sizes)
// target and mipmap can be 2d or cubemap textures
const copyMipmap = (target, mipmap) => {
    const device = target.device;

    if (!device.webgl2) {
        // copying directly from framebuffer to texture results in safari crashing
        // so for now we use the slow version.
        return copyMipmapSlow(target, mipmap);
    }

    // this version should be much faster, but crashes safari
    const gl = device.gl;
    const level = calcLevels(target.width, target.height) - calcLevels(mipmap.width, mipmap.height);

    const oldRt = device.renderTarget;

    for (let f = 0; f < (target.cubemap ? 6 : 1); f++) {
        const glTarget = target.cubemap ? gl.TEXTURE_CUBE_MAP_POSITIVE_X + f : gl.TEXTURE_2D;
        const renderTarget = new RenderTarget({
            colorBuffer: mipmap,
            face: f,
            depth: false
        });

        // get the device to create gl interfaces
        device.setRenderTarget(renderTarget);
        device.updateBegin();

        device.setTexture(target, 0);

        // create the target mipmap level
        gl.texImage2D(
            glTarget,
            level,
            mipmap._glInternalFormat,
            mipmap.width,
            mipmap.height,
            0,
            mipmap._glFormat,
            mipmap._glPixelType,
            null
        );

        // copy it
        gl.copyTexImage2D(
            glTarget,
            level,
            mipmap._glInternalFormat,
            0, 0, mipmap.width, mipmap.height,
            0
        );

        device.updateEnd();
        renderTarget.destroy();
    }

    // restore render target
    device.setRenderTarget(oldRt);
    device.updateBegin();
};

// generate mipmaps for the given target texture
// target is either 2d equirect or cubemap with mipmaps = false
const generateMipmaps = (target) => {
    const device = target.device;
    const gl = device.gl;
    const numLevels = calcLevels(target.width, target.height);

    let prevLevel = null;
    for (let i = 1; i < numLevels; ++i) {
        const level = new Texture(device, {
            name: target.name + '-tmp-' + i,
            cubemap: target.cubemap,
            width: Math.max(1, Math.floor(target.width >> i)),
            height: Math.max(1, Math.floor(target.height >> i)),
            format: target.format,
            type: target.type,
            addressU: target.addressU,
            addressV: target.addressV,
            fixCubemapSeams: target.fixCubemapSeams,
            mipmaps: false
        });

        // downsample texture using single sample reproject
        reprojectTexture(prevLevel || target, level, {
            numSamples: 1
        });

        // copy into target's mipmap
        copyMipmap(target, level);

        if (prevLevel) {
            prevLevel.destroy();
        }
        prevLevel = level;
    }

    if (prevLevel) {
        prevLevel.destroy();
    }

    // set filtering while bypassing the engine
    device.setTexture(target, 0);
    gl.texParameteri(target._glTarget, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(target._glTarget, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    target._mipmaps = true;
};

// helper functions to support prefiltering lighting data
class EnvLighting {
    /**
     * @private
     * @function
     * @name generateSkyboxCubemap
     * @description Generate a skybox cubemap in the correct pixel format from the source texture.
     * @param {Texture} source - The source texture. This is either a 2d texture in equirect format or a cubemap.
     * @param {number} [size] - Size of the resulting texture. Otherwise use automatic sizing.
     * @returns {Texture} The resulting cubemap.
     */
    static generateSkyboxCubemap(source, size) {
        if (!size) {
            size = source.cubemap ? source.width : source.width / 4;
        }

        const device = source.device;

        // generate faces cubemap
        const result = new Texture(device, {
            name: 'skyboxFaces',
            cubemap: true,
            width: size,
            height: size,
            type: TEXTURETYPE_RGBM,
            addressU: ADDRESS_CLAMP_TO_EDGE,
            addressV: ADDRESS_CLAMP_TO_EDGE,
            fixCubemapSeams: fixCubemapSeams,
            mipmaps: false
        });

        reprojectTexture(source, result, {
            numSamples: 1024
        });

        return result;
    }

    /**
     * @private
     * @function
     * @name generateLightingSource
     * @description Create a texture in the format needed to precalculate lighting data.
     * @param {Texture} source - The source texture. This is either a 2d texture in equirect format or a cubemap.
     * @returns {Texture} The resulting cubemap.
     */
    static generateLightingSource(source) {
        const device = source.device;
        const format = lightingSourcePixelFormat(device);

        const result = new Texture(device, {
            name: 'lightingSource',
            cubemap: true,
            width: 128,
            height: 128,
            format: format,
            type: format === PIXELFORMAT_R8_G8_B8_A8 ? TEXTURETYPE_RGBM : TEXTURETYPE_DEFAULT,
            addressU: ADDRESS_CLAMP_TO_EDGE,
            addressV: ADDRESS_CLAMP_TO_EDGE,
            fixCubemapSeams: fixCubemapSeams,
            mipmaps: false
        });

        // copy into top level
        reprojectTexture(source, result, {
            numSamples: source.mipmaps ? 1 : 1024
        });

        // generate mipmaps
        generateMipmaps(result);

        return result;
    }

    /**
     * @private
     * @function
     * @name generateReflection
     * @description Generate a prefiltered reflection texture for use in IBL.
     * @param {Texture} source - The source lighting texture, as returned from generateLightingSource.
     * @param {object} [options] - The optional options object.
     * @param {number} [options.numSamples] - Number of samples. Default is 1024.
     * @param {string} [options.distribution] - The specular distribution, either 'phong' or 'ggx'. Default is 'ggx'.
     * @returns {Texture} The prefiltered cubemap
     */
    static generateReflection(source, options) {
        const device = source.device;
        const format = lightingPixelFormat(device);
        const result = createCubemap(device, 128, format);

        // generate the top level specular - just a copy of source
        reprojectTexture(source, result, {
            numSamples: 1
        });

        // generate convolved mipmaps
        const levels = calcLevels(result.width, result.height);
        for (let i = 1; i < levels; ++i) {
            const level = createCubemap(device, Math.max(1, result.width >> i), format);
            reprojectTexture(source, level, {
                numSamples: options?.numSamples || 1024,
                distribution: options?.distribution || 'ggx',
                specularPower: Math.max(1, 2048 >> (i * 2))
            });
            copyMipmap(result, level);
            level.destroy();
        }

        // set filtering while bypassing engine
        device.setTexture(result, 0);
        device.gl.texParameteri(result._glTarget, device.gl.TEXTURE_MAG_FILTER, device.gl.LINEAR);
        device.gl.texParameteri(result._glTarget, device.gl.TEXTURE_MIN_FILTER, device.gl.LINEAR_MIPMAP_LINEAR);
        result._mipmaps = true;

        return result;
    }

    /**
     * @private
     * @function
     * @name generateAmbient
     * @description Generate a prefiltered ambient texture for use in IBL.
     * @param {Texture} source - The source lighting texture, as returned from generateLightingSource.
     * @param {object} [options] - The optional options object.
     * @param {number} [options.numSamples] - Number of samples to use. Default is 2048.
     * @returns {Texture} The prefiltered cubemap
     */
    static generateAmbient(source, options) {
        const device = source.device;
        const format = lightingPixelFormat(device);
        const result = createCubemap(device, 16, format);

        reprojectTexture(source, result, {
            numSamples: options?.numSamples || 2048,
            distribution: 'lambert'
        });

        const levels = calcLevels(result.width, result.height);
        for (let i = 1; i < levels; ++i) {
            const level = createCubemap(device, Math.max(1, result.width >> i), format);
            reprojectTexture(source, level, {
                numSamples: options?.numSamples || 2048,
                distribution: 'lambert'
            });
            copyMipmap(result, level);
            level.destroy();
        }

        // set filtering while bypassing engine
        device.setTexture(result, 0);
        device.gl.texParameteri(result._glTarget, device.gl.TEXTURE_MAG_FILTER, device.gl.LINEAR);
        device.gl.texParameteri(result._glTarget, device.gl.TEXTURE_MIN_FILTER, device.gl.LINEAR_MIPMAP_LINEAR);
        result._mipmaps = true;

        return result;
    }

    /**
     * @private
     * @function
     * @name generateAmbientLegacy
     * @description Generate a legacy prefiltered ambient texture for use in IBL.
     * @param {Texture} source - The source lighting texture, as returned from generateLightingSource.
     * @param {object} [options] - The optional options object.
     * @param {number} [options.numSamples] - Number of samples to use. Default is 4096.
     * @returns {Texture} The prefiltered cubemap
     */
    static generateAmbientLegacy(source, options) {
        const device = source.device;
        const format = lightingPixelFormat(device);
        const result = createCubemap(device, 16, format);

        reprojectTexture(source, result, {
            numSamples: options?.numSamples || 4096,
            distribution: 'phong',
            specularPower: 2
        });

        // generate mipmaps
        generateMipmaps(result);

        return result;
    }
}

export {
    EnvLighting
};
