import { platform } from '../../core/platform.js';

/**
 * The decoder configuration passed to {@link meshoptInitialize}.
 *
 * @type {{ decoder?: object, url?: string, numWorkers?: number } | null}
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
        resolved.hash = `meshopt-retry-${failedImports}`;
    }

    return resolved.toString();
};

const importDecoder = (url) => {
    // @ts-ignore
    return import(resolveUrl(url)).then(
        module => module.MeshoptDecoder ?? module.default,
        (err) => {
            failedImports++;
            throw err;
        }
    );
};

const loadDecoder = () => {
    const { decoder, url, numWorkers = 0 } = decoderConfig;

    const promise = decoder ? Promise.resolve(decoder) : importDecoder(url);

    return promise.then((decoder) => {
        if (!decoder?.supported) {
            throw new Error('The meshopt decoder is not supported on this platform');
        }
        if (numWorkers > 0) {
            decoder.useWorkers?.(numWorkers);
        }
        return decoder.ready.then(() => decoder);
    }).catch((err) => {
        // allow a later decode to retry, for example after a failed download
        decoderPromise = null;
        const source = url ? ` from ${url}` : '';
        throw new Error(`Failed to load the meshopt decoder${source}: ${err.message ?? err}`);
    });
};

/**
 * Initializes the decoder used to load glTF files compressed with the `EXT_meshopt_compression`
 * or `KHR_meshopt_compression` extensions, such as files produced by gltfpack or glTF-Transform.
 * Without a decoder, these files fail to load unless they also contain uncompressed fallback
 * data.
 *
 * The decoder is the meshoptimizer JavaScript decoder (`meshopt_decoder.mjs`). Pass the decoder
 * object itself, or the URL of the decoder module, which is then imported the first time a
 * compressed file loads. Files using `KHR_meshopt_compression` need meshoptimizer 1.0 or later.
 *
 * @param {object} config - The decoder configuration.
 * @param {object} [config.decoder] - The decoder object, such as the `MeshoptDecoder` exported by
 * the meshoptimizer package.
 * @param {string} [config.url] - The URL of the decoder module. Ignored when `decoder` is set.
 * @param {number} [config.numWorkers] - The number of web workers to decode on. Defaults to 0,
 * which decodes on the main thread.
 * @example
 * import { MeshoptDecoder } from 'meshoptimizer';
 *
 * pc.meshoptInitialize({ decoder: MeshoptDecoder });
 * @example
 * pc.meshoptInitialize({ url: 'lib/meshopt_decoder.mjs' });
 */
const meshoptInitialize = (config) => {
    decoderConfig = config ?? null;
    decoderPromise = null;
};

/**
 * Returns whether a decoder was supplied with {@link meshoptInitialize}.
 *
 * @returns {boolean} True if compressed data can be decoded.
 * @ignore
 */
const isMeshoptConfigured = () => !!(decoderConfig?.decoder || decoderConfig?.url);

/**
 * Decodes a buffer view compressed with `EXT_meshopt_compression` or `KHR_meshopt_compression`.
 *
 * @param {Uint8Array} source - The compressed data.
 * @param {number} count - The number of elements.
 * @param {number} stride - The size of each element in bytes.
 * @param {string} mode - The compression mode: 'ATTRIBUTES', 'TRIANGLES' or 'INDICES'.
 * @param {string} filter - The filter applied after decompression, such as 'OCTAHEDRAL'.
 * @returns {Promise<Uint8Array>} The decoded data.
 * @ignore
 */
const meshoptDecode = (source, count, stride, mode, filter) => {
    decoderPromise ??= loadDecoder();

    return decoderPromise.then((decoder) => {
        if (decoder.decodeGltfBufferAsync) {
            return decoder.decodeGltfBufferAsync(count, stride, source, mode, filter);
        }

        // decoders before meshoptimizer 0.18 only decode synchronously
        const target = new Uint8Array(count * stride);
        decoder.decodeGltfBuffer(target, count, stride, source, mode, filter);
        return target;
    });
};

export {
    meshoptInitialize,
    isMeshoptConfigured,
    meshoptDecode
};
