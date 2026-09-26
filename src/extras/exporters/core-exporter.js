import { ShaderUtils } from '../../scene/shader-lib/shader-utils.js';
import { Texture } from '../../platform/graphics/texture.js';
import { BlendState } from '../../platform/graphics/blend-state.js';
import { drawQuadWithShader } from '../../scene/graphics/quad-render-utils.js';
import { RenderTarget } from '../../platform/graphics/render-target.js';
import {
    FILTER_LINEAR, ADDRESS_CLAMP_TO_EDGE, isCompressedPixelFormat, PIXELFORMAT_RGBA8,
    SEMANTIC_POSITION
} from '../../platform/graphics/constants.js';

/**
 * @import { Color } from '../../core/math/color.js'
 */

/**
 * The base class for the exporters, implementing shared functionality.
 *
 * @category Exporter
 * @ignore
 */
class CoreExporter {
    /**
     * Create a new instance of the exporter.
     */
    // eslint-disable-next-line no-useless-constructor
    constructor() { }

    /**
     * Converts a texture to a canvas.
     *
     * @param {Texture} texture - The source texture to be converted.
     * @param {object} options - Object for passing optional arguments.
     * @param {Color} [options.color] - The tint color to modify the texture with.
     * @param {number} [options.maxTextureSize] - Maximum texture size. Texture is resized if over the size.
     * @returns {Promise<HTMLCanvasElement>|Promise<undefined>} - The canvas element containing the image.
     *
     * @ignore
     */
    textureToCanvas(texture, options = {}) {

        const image = texture.getSource();

        if ((typeof HTMLImageElement !== 'undefined' && image instanceof HTMLImageElement) ||
            (typeof HTMLCanvasElement !== 'undefined' && image instanceof HTMLCanvasElement) ||
            (typeof OffscreenCanvas !== 'undefined' && image instanceof OffscreenCanvas) ||
            (typeof ImageBitmap !== 'undefined' && image instanceof ImageBitmap)) {

            // texture dimensions
            const { width, height } = this.calcTextureSize(image.width, image.height, options.maxTextureSize);

            // convert to a canvas
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const context = canvas.getContext('2d');
            if (context === null) {
                return Promise.resolve(undefined);
            }
            context.drawImage(image, 0, 0, canvas.width, canvas.height);

            // tint the texture by specified color
            if (options.color) {
                const { r, g, b } = options.color;

                const imagedata = context.getImageData(0, 0, width, height);
                const data = imagedata.data;

                for (let i = 0; i < data.length; i += 4) {
                    data[i + 0] = data[i + 0] * r;
                    data[i + 1] = data[i + 1] * g;
                    data[i + 2] = data[i + 2] * b;
                }

                context.putImageData(imagedata, 0, 0);
            }

            return Promise.resolve(canvas);
        }

        // for other image sources, for example compressed textures, we extract the data by rendering the texture to a render target
        const { width, height } = this.calcTextureSize(texture.width, texture.height, options.maxTextureSize);
        const format = isCompressedPixelFormat(texture.format) ? PIXELFORMAT_RGBA8 : texture.format;

        return this.readTexturePixels(texture, width, height, format).then((textureData) => {
            const pixels = new Uint8ClampedArray(width * height * 4);
            pixels.set(textureData);
            return this.pixelsToCanvas(pixels, width, height);
        });
    }

    /**
     * Reads the pixels of a texture by rendering it to a render target. The texture is sampled
     * into the target, so a target of a linear format reads the values a shader samples, decoded
     * from sRGB, and not premultiplied by alpha as the pixels of a canvas are.
     *
     * @param {Texture} texture - The texture to read.
     * @param {number} width - The width of the render target.
     * @param {number} height - The height of the render target.
     * @param {number} format - The pixel format of the render target.
     * @returns {Promise<Uint8Array|Uint16Array|Uint32Array|Float32Array>} The pixels.
     * @ignore
     */
    readTexturePixels(texture, width, height, format) {
        const device = texture.device;
        const dstTexture = new Texture(device, {
            name: 'ExtractedTexture',
            width,
            height,
            format: format,
            cubemap: false,
            mipmaps: false,
            minFilter: FILTER_LINEAR,
            magFilter: FILTER_LINEAR,
            addressU: ADDRESS_CLAMP_TO_EDGE,
            addressV: ADDRESS_CLAMP_TO_EDGE
        });

        const renderTarget = new RenderTarget({
            colorBuffer: dstTexture,
            depth: false
        });

        const shader = ShaderUtils.createShader(device, {
            uniqueName: 'ShaderCoreExporterBlit',
            attributes: { vertex_position: SEMANTIC_POSITION },
            vertexChunk: 'fullscreenQuadVS',
            fragmentChunk: 'outputTex2DPS'
        });

        // Freeing these goes through the device, so it has to happen while the device is still usable.
        // The destroy event fires before the backend is torn down for exactly this, and the read
        // settling is the other way it can come about - whichever happens first releases them once.
        let released = false;
        const release = () => {
            if (released) {
                return;
            }
            released = true;
            device.off('destroy', release);
            dstTexture.destroy();
            renderTarget.destroy();
        };
        device.on('destroy', release);

        device.scope.resolve('source').setValue(texture);
        device.setBlendState(BlendState.NOBLEND);
        drawQuadWithShader(device, renderTarget, shader, undefined, undefined, 'ExportTexture');

        // async read back the pixels of the texture
        // released as soon as the read settles, before the pixels are copied out and turned into a
        // canvas - holding them for that would raise the peak cost of a large export for nothing
        return dstTexture.read(0, 0, width, height, {
            renderTarget: renderTarget,
            immediate: true
        }).finally(release).then((pixels) => {

            // The quad places the first row of the texture at the bottom of the render target, in
            // normalized device coordinates. That is the first row a read returns on WebGL, and
            // the last on WebGPU, so the rows of a WebGPU read are reversed.
            if (device.isWebGPU) {
                const rowLength = pixels.length / height;
                const row = pixels.slice(0, rowLength);
                for (let top = 0, bottom = height - 1; top < bottom; top++, bottom--) {
                    const topStart = top * rowLength;
                    const bottomStart = bottom * rowLength;
                    row.set(pixels.subarray(topStart, topStart + rowLength));
                    pixels.copyWithin(topStart, bottomStart, bottomStart + rowLength);
                    pixels.set(row, bottomStart);
                }
            }

            return pixels;
        });
    }

    /**
     * Copies RGBA8 pixels to a canvas.
     *
     * @param {Uint8ClampedArray} pixels - The pixels.
     * @param {number} width - The width of the pixels.
     * @param {number} height - The height of the pixels.
     * @returns {HTMLCanvasElement|undefined} The canvas, or undefined when no 2D context is
     * available.
     * @ignore
     */
    pixelsToCanvas(pixels, width, height) {
        const newImage = new ImageData(pixels, width, height);
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const newContext = canvas.getContext('2d');
        if (!newContext) {
            return undefined;
        }
        newContext.putImageData(newImage, 0, 0);

        return canvas;
    }

    calcTextureSize(width, height, maxTextureSize) {

        if (maxTextureSize) {
            const scale = Math.min(maxTextureSize / Math.max(width, height), 1);
            width = Math.round(width * scale);
            height = Math.round(height * scale);
        }

        return { width, height };
    }
}

export { CoreExporter };
