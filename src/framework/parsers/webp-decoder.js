import { platform } from '../../core/platform.js';

/**
 * The decoder configuration passed to {@link webpInitialize}.
 *
 * @type {{ decoder?: object, url?: string } | null}
 */
let decoderConfig = null;

/**
 * Resolves to the decoder once it is loaded and ready. Created by the first decode.
 *
 * @type {Promise<object> | null}
 */
let decoderPromise = null;

/**
 * The number of failed decoder module imports, used to request a fresh module on a retry.
 *
 * @type {number}
 */
let failedImports = 0;

// resolve a relative module url as the page or worker would, as dynamic import resolves it
// against the engine instead
const resolveUrl = (url) => {
    let baseUrl;
    if (platform.environment === 'node') {
        const cwdUrl = new URL('file:///');
        cwdUrl.pathname = `${process.cwd()}/`;
        baseUrl = cwdUrl.href;
    } else {
        // the document base honors <base href>, and a worker has no document
        baseUrl = globalThis.document?.baseURI ?? globalThis.location?.href;
    }

    const resolved = new URL(url, baseUrl);

    // browsers keep a failed module import for its url, so a retry imports a distinct url. A
    // fragment is not sent to the server, so signed urls stay valid.
    if (failedImports > 0) {
        resolved.hash = `webp-retry-${failedImports}`;
    }

    return resolved.toString();
};

const importDecoder = (url) => {
    // @ts-ignore
    return import(resolveUrl(url)).then(
        (module) => {
            const codec = module.WebPCodec ?? module.default;
            if (typeof codec?.create !== 'function') {
                throw new Error('The module has no WebPCodec or default export with a create() method');
            }
            return codec.create();
        },
        (err) => {
            failedImports++;
            throw err;
        }
    );
};

const loadDecoder = () => {
    const { decoder, url } = decoderConfig;

    const promise = decoder ? Promise.resolve(decoder) : importDecoder(url);

    return promise.then((decoder) => {
        if (typeof decoder?.decodeRGBA !== 'function') {
            throw new Error('The WebP decoder has no decodeRGBA() method');
        }
        return decoder;
    }).catch((err) => {
        // allow a later decode to retry, for example after a failed download
        decoderPromise = null;
        const source = url ? ` from ${url}` : '';
        throw new Error(`Failed to load the WebP decoder${source}: ${err.message ?? err}`);
    });
};

/**
 * Initializes a decoder used to load WebP texture images in software instead of in the browser.
 * Configure it when the color of pixels with an alpha below 255 must load unchanged, as in data
 * textures such as those of SOG v3 gaussian splats. WebKit (Safari, and every browser on iOS)
 * premultiplies the alpha of an ImageBitmap even when asked not to, which corrupts these textures
 * on devices that load images as an ImageBitmap, such as the WebGPU device.
 *
 * Once configured, texture assets whose file has the `.webp` extension are decoded by it and
 * uploaded as RGBA8 pixel data, so the `flipY` texture option does not apply to them. Other image
 * formats still load in the browser.
 *
 * The decoder is an object with a `decodeRGBA(bytes)` method, which takes the WebP file as a
 * `Uint8Array` and returns `{ rgba, width, height }`, or a promise of it, where `rgba` is a
 * `Uint8Array` of `width * height * 4` bytes. The `WebPCodec` of the `@playcanvas/splat-transform`
 * package creates such a decoder. Pass the decoder itself, or the URL of a module whose
 * `WebPCodec` or default export has a `create()` method returning the decoder or a promise of it.
 * The module is then imported the first time a WebP file loads.
 *
 * @param {object} config - The decoder configuration.
 * @param {object} [config.decoder] - The decoder object, such as an instance created by
 * `WebPCodec.create()` of the `@playcanvas/splat-transform` package.
 * @param {string} [config.url] - The URL of the decoder module. Ignored when `decoder` is set.
 * @example
 * import { WebPCodec } from '@playcanvas/splat-transform';
 *
 * pc.webpInitialize({ decoder: await WebPCodec.create() });
 * @example
 * // a module that exports the WebPCodec of @playcanvas/splat-transform
 * pc.webpInitialize({ url: 'lib/webp-codec.mjs' });
 */
const webpInitialize = (config) => {
    decoderConfig = config ?? null;
    decoderPromise = null;
};

/**
 * Returns whether a decoder was supplied with {@link webpInitialize}.
 *
 * @returns {boolean} True if WebP files are decoded in software.
 * @ignore
 */
const isWebpConfigured = () => !!(decoderConfig?.decoder || decoderConfig?.url);

/**
 * Decodes a WebP file into RGBA8 pixels, keeping the color of pixels with an alpha below 255.
 *
 * @param {Uint8Array} bytes - The WebP file.
 * @returns {Promise<{ rgba: Uint8Array, width: number, height: number }>} The decoded pixels and
 * their size.
 * @ignore
 */
const webpDecode = (bytes) => {
    decoderPromise ??= loadDecoder();

    return decoderPromise.then(decoder => decoder.decodeRGBA(bytes));
};

export {
    webpInitialize,
    isWebpConfigured,
    webpDecode
};
