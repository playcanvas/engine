import { Texture } from './texture.js';
import { RenderTarget } from './render-target.js';
import { reprojectTexture } from './reproject-texture.js';
import { TEXTURETYPE_DEFAULT, TEXTURETYPE_RGBM, ADDRESS_CLAMP_TO_EDGE } from './constants';

// helper functions to support prefiltering lighting data
class Prefilter {
    /**
     * @private
     * @function
     * @name isValidSkyboxCubemap
     * @description Returns true if the texture is valid for use as a skybox.
     * @param {Texture} texture - The texture to test.
     * @returns {boolean} True if the texture is valid for use as a cubemap otherwise false.
     */
    static isValidSkyboxCubemap(texture) {
        return texture && texture.cubemap && (texture.type === TEXTURETYPE_DEFAULT || texture.type === TEXTURETYPE_RGBM);
    }

    /**
     * @private
     * @function
     * @name generateSkyboxCubemap
     * @description Generate a skybox cubemap in the correct pixel format from the source texture.
     * @param {Texture} source - The source texture. This is either a 2d texture in equirect format or a cubemap.
     * @param {number} size - Size of the resulting texture. Specify 0 for automatic sizing.
     * @returns {Texture} The resulting cubemap.
     */
    static generateSkyboxCubemap(source, size = 0) {
        if (size === 0) {
            size = source.cubemap ? source.width : source.width / 4;
        }

        const device = source.device;

        // generate faces cubemap
        const faces = new Texture(device, {
            name: 'skyboxFaces',
            cubemap: true,
            width: size,
            height: size,
            type: TEXTURETYPE_RGBM,
            addressU: ADDRESS_CLAMP_TO_EDGE,
            addressV: ADDRESS_CLAMP_TO_EDGE,
            fixCubemapSeams: false,
            mipmaps: false
        });

        reprojectTexture(source, faces);

        return faces;
    }

    /**
     * @private
     * @function
     * @name generatePrefilteredCubemaps
     * @description Generate a set of prefiltered IBL cubemaps.
     * @param {Texture} source - The source texture. Either a 2d texture in equirect format or a cubemap.
     * @param {boolean} mipmaps - Specify true to have mipmaps generated or false otherwise.
     * @returns {Texture[]} The array of cubemaps containing prefiltered lighting data.
     */
    static generatePrefilteredCubemaps(source, mipmaps = true) {
        const device = source.device;
        const cubemaps = [];

        const createCubemap = (size) => {
            return new Texture(device, {
                name: 'skyboxPrefilter' + size,
                cubemap: true,
                width: size,
                height: size,
                type: TEXTURETYPE_RGBM,
                addressU: ADDRESS_CLAMP_TO_EDGE,
                addressV: ADDRESS_CLAMP_TO_EDGE,
                fixCubemapSeams: true,
                // prefiltering doesn't work correctly with mipmaps
                mipmaps: false
            });
        };

        // generate the top level cubemap, just a downsample of the scene at 128x128
        cubemaps[0] = createCubemap(128);

        // TODO: pre-generate mipmap chain instead of using 1024 samples?
        reprojectTexture(source, cubemaps[0], {
            numSamples: source.mipmaps ? 1 : 1024
        });

        // generate prefiltered lighting data
        const sizes = [64, 32, 16, 8, 4, 2, 1];
        const specPower = [512, 128, 32, 8, 2, 1, 1];
        for (let i = 0; i < sizes.length; ++i) {
            cubemaps[i + 1] = createCubemap(sizes[i]);
            reprojectTexture(cubemaps[0], cubemaps[i + 1], {
                specularPower: specPower[i],
                numSamples: 2048
            });
        }

        // the prefiltered chain has been generated so we can now generate mipmaps on them for
        // use in rendering.
        if (mipmaps) {
            device.activeTexture(0);
            cubemaps.forEach((cubemap) => {
                device.bindTexture(cubemap);
                device.gl.generateMipmap(cubemap._glTarget);
                device.gl.texParameteri(cubemap._glTarget, device.gl.TEXTURE_MIN_FILTER, device.gl.LINEAR_MIPMAP_LINEAR);
            });
        }

        return cubemaps;
    }

    /**
     * @private
     * @function
     * @name generatePrefilteredCubemap
     * @description Generates a prefiltered IBL cubemap of size 128 containing the 6 levels
     * of prefiltered lighting data packed into its mipmaps.
     * @param {Texture} source - The source texture. Either a 2d texture in equirect format or a cubemap.
     * @returns {Texture} A cubemap with each mipmap containing the prefiltered lighting data.
     */
    static generatePrefilteredCubemap(source) {
        // generate the individual prefiltered cubemaps
        const device = source.device;
        const gl = device.gl;
        const cubemaps = Prefilter.generatePrefilteredCubemaps(source, false);

        const cubemap = new Texture(device, {
            name: 'skyboxPrefilterSet',
            cubemap: true,
            width: 128,
            height: 128,
            type: TEXTURETYPE_RGBM,
            addressU: ADDRESS_CLAMP_TO_EDGE,
            addressV: ADDRESS_CLAMP_TO_EDGE,
            fixCubemapSeams: false,
            // create the texture with mipmaps = false so the device doesn't automatically
            // (and unnecessarily) auto generateMipmaps
            mipmaps: false
        });

        // oh no :`(
        // cubemaps have a render target flag which results in their Y axis being flipped at
        // render time (see RIGHT_HANDED_CUBEMAP). here we are manually updating the texture
        // and not using RenderTarget so must set the internal flag manually.
        cubemap._isRenderTarget = true;

        // get the device to create the gl interfaces and set texture parameters
        device.setTexture(cubemap, 0);

        // copy prefiltered data into texture mipmaps
        cubemaps.forEach((c, level) => {
            for (let face = 0; face < 6; ++face) {
                const renderTarget = new RenderTarget({
                    colorBuffer: c,
                    face: face,
                    depth: false
                });

                // get the device to create gl interfaces
                device.initRenderTarget(renderTarget);

                const size = 128 >> level;      // === c.width === c.height

                // specify face mip
                gl.texImage2D(
                    gl.TEXTURE_CUBE_MAP_POSITIVE_X + face,
                    level,
                    cubemap._glInternalFormat,
                    size,
                    size,
                    0,
                    cubemap._glFormat,
                    cubemap._glPixelType,
                    null
                );

                // copy directly into cubemap
                gl.copyTexImage2D(
                    gl.TEXTURE_CUBE_MAP_POSITIVE_X + face,
                    level,
                    gl.RGBA,
                    0, 0, size, size,
                    0
                );

                renderTarget.destroy();
            }
        });

        // manually set the filtering mode to enable the mipmaps we generated
        gl.texParameteri(cubemap._glTarget, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);

        // destroy
        cubemaps.forEach(c => c.destroy());

        return cubemap;
    }
}

export {
    Prefilter
};
