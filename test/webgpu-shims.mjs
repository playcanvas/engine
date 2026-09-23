import { createCanvas, loadImage } from 'canvas';

/**
 * A swap chain stand-in for a canvas: `getCurrentTexture()` returns a texture the size of the
 * canvas, kept until the context is reconfigured or the canvas resized. Node has no canvas that
 * WebGPU could present to.
 */
export class HeadlessCanvasContext {
    /** @type {GPUCanvasConfiguration|null} */
    config = null;

    /** @type {GPUTexture|null} */
    texture = null;

    /**
     * @param {object} canvas - The canvas the context belongs to, read for its width and height.
     */
    constructor(canvas) {
        this.canvas = canvas;
    }

    configure(config) {
        this.config = config;
        this.drop();
    }

    unconfigure() {
        this.config = null;
        this.drop();
    }

    getConfiguration() {
        return this.config;
    }

    getCurrentTexture() {
        const width = Math.max(1, this.canvas.width | 0);
        const height = Math.max(1, this.canvas.height | 0);
        if (this.texture && (this.texture.width !== width || this.texture.height !== height)) {
            this.drop();
        }
        this.texture ??= this.config.device.createTexture({
            label: 'canvas',
            size: [width, height],
            format: this.config.format,
            usage: this.config.usage | GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC,
            viewFormats: this.config.viewFormats ?? []
        });
        return this.texture;
    }

    drop() {
        this.texture?.destroy();
        this.texture = null;
    }
}

/**
 * A stand-in for the browser's ImageBitmap: decoded RGBA8 pixels with straight alpha. The engine
 * uploads it with copyExternalImageToTexture, which {@link installImageUploadShim} turns into a
 * writeTexture, so texture loading follows the same path as in a browser.
 */
export class ImageBitmap {
    /**
     * @param {number} width - The width in pixels.
     * @param {number} height - The height in pixels.
     * @param {Uint8ClampedArray} data - RGBA8 pixels, top row first.
     */
    constructor(width, height, data) {
        this.width = width;
        this.height = height;
        this.data = data;
    }

    close() {
        this.data = null;
    }
}

/**
 * Reads RGBA8 pixels from an image source: an {@link ImageBitmap}, a jsdom canvas or image, or an
 * ImageData-like object.
 *
 * @param {object} source - The image source.
 * @returns {{ width: number, height: number, data: Uint8ClampedArray }|null} The pixels, or null
 * when the source is not one this shim understands.
 */
const readPixels = (source) => {
    if (source instanceof ImageBitmap) {
        return source;
    }
    if (typeof source.getContext === 'function') {
        const { width, height } = source;
        return source.getContext('2d').getImageData(0, 0, width, height);
    }
    if (typeof source.naturalWidth === 'number' && source.ownerDocument) {
        const width = source.naturalWidth;
        const height = source.naturalHeight;
        const canvas = source.ownerDocument.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext('2d');
        context.drawImage(source, 0, 0);
        return context.getImageData(0, 0, width, height);
    }
    if (source.data && typeof source.width === 'number' && typeof source.height === 'number') {
        return source;
    }
    return null;
};

const premultiply = (data) => {
    for (let i = 0; i < data.length; i += 4) {
        const alpha = data[i + 3] / 255;
        data[i] *= alpha;
        data[i + 1] *= alpha;
        data[i + 2] *= alpha;
    }
};

const extent = (size) => {
    if (Array.isArray(size)) {
        return { width: size[0], height: size[1] ?? 1 };
    }
    return { width: size.width, height: size.height ?? 1 };
};

const origin2D = (origin) => {
    if (!origin) return { x: 0, y: 0 };
    if (Array.isArray(origin)) return { x: origin[0] ?? 0, y: origin[1] ?? 0 };
    return { x: origin.x ?? 0, y: origin.y ?? 0 };
};

/**
 * Decodes an image the way the browser's createImageBitmap does, supporting the sources and
 * options the engine uses: a Blob (decoded with node-canvas), an ImageBitmap, a jsdom canvas or
 * image, or ImageData, with `imageOrientation: 'flipY'` and `premultiplyAlpha: 'premultiply'`.
 *
 * @param {object} source - The image source.
 * @param {...*} rest - Either the options, or a crop rectangle (ignored) followed by the options.
 * @returns {Promise<ImageBitmap>} The decoded image.
 */
export const createImageBitmap = async (source, ...rest) => {
    const options = (rest.length === 1 ? rest[0] : rest[4]) ?? {};

    let pixels;
    // a Blob from Node or from jsdom's realm, which is not an instance of Node's Blob
    if (typeof source.arrayBuffer === 'function' && typeof source.size === 'number') {
        const image = await loadImage(Buffer.from(await source.arrayBuffer()));
        const canvas = createCanvas(image.width, image.height);
        const context = canvas.getContext('2d');
        context.drawImage(image, 0, 0);
        pixels = context.getImageData(0, 0, image.width, image.height);
    } else {
        pixels = readPixels(source);
        if (!pixels) {
            throw new TypeError('createImageBitmap: unsupported image source');
        }
    }

    const { width, height } = pixels;
    const data = new Uint8ClampedArray(pixels.data);
    if (options.imageOrientation === 'flipY') {
        const row = width * 4;
        for (let y = 0; y < height >> 1; y++) {
            const top = data.slice(y * row, (y + 1) * row);
            data.copyWithin(y * row, (height - 1 - y) * row, (height - y) * row);
            data.set(top, (height - 1 - y) * row);
        }
    }
    if (options.premultiplyAlpha === 'premultiply') {
        premultiply(data);
    }
    return new ImageBitmap(width, height, data);
};

/**
 * Makes `queue.copyExternalImageToTexture` accept the image sources available in Node - an
 * {@link ImageBitmap}, a jsdom canvas or image - by converting them to pixels and writing those
 * with `writeTexture`. Dawn itself only accepts browser image types. Supports the 8-bit RGBA and
 * BGRA texture formats, `flipY` and `premultipliedAlpha`; other sources go to Dawn unchanged.
 *
 * @param {GPUDevice} device - The device whose queue to patch.
 */
export const installImageUploadShim = (device) => {
    const queue = device.queue;
    const copyExternalImageToTexture = queue.copyExternalImageToTexture.bind(queue);

    queue.copyExternalImageToTexture = (source, destination, copySize) => {
        const pixels = readPixels(source.source);
        if (!pixels) {
            return copyExternalImageToTexture(source, destination, copySize);
        }

        const format = destination.texture.format;
        const bgra = format.startsWith('bgra8unorm');
        if (!bgra && !format.startsWith('rgba8unorm')) {
            throw new Error(`copyExternalImageToTexture shim: unsupported texture format ${format}`);
        }

        const { width, height } = extent(copySize);
        const { x, y } = origin2D(source.origin);
        const out = new Uint8Array(width * height * 4);
        for (let row = 0; row < height; row++) {
            const sourceRow = source.flipY ? pixels.height - 1 - (y + row) : y + row;
            const from = (sourceRow * pixels.width + x) * 4;
            out.set(pixels.data.subarray(from, from + width * 4), row * width * 4);
        }
        if (bgra) {
            for (let i = 0; i < out.length; i += 4) {
                const red = out[i];
                out[i] = out[i + 2];
                out[i + 2] = red;
            }
        }
        if (destination.premultipliedAlpha) {
            premultiply(out);
        }

        queue.writeTexture({
            texture: destination.texture,
            mipLevel: destination.mipLevel ?? 0,
            origin: destination.origin ?? [0, 0, 0],
            aspect: destination.aspect ?? 'all'
        }, out, { bytesPerRow: width * 4, rowsPerImage: height }, copySize);
    };
};
