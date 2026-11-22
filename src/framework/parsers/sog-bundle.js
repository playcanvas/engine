import { Debug } from '../../core/debug.js';
import { getFetchCredentials } from '../../platform/net/http.js';
import { GSplatResource } from '../../scene/gsplat/gsplat-resource.js';
import { GSplatSogData } from '../../scene/gsplat/gsplat-sog-data.js';
import { GSplatSogResource } from '../../scene/gsplat/gsplat-sog-resource.js';
import { checkSharedSogPalette, getSogTextureCache } from './sog-texture-cache.js';

/**
 * @import { AppBase } from '../app-base.js'
 * @import { Asset } from '../asset/asset.js'
 * @import { ResourceHandlerCallback } from '../handlers/handler.js'
 */

/**
 * Parse an ArrayBuffer containing a zip archive.
 *
 * @param {ArrayBuffer} data - the file data
 * @returns {Array<{filename: string, compression: 'none' | 'deflate' | 'unknown', data: Uint8Array}>} the extracted files
 */
const parseZipArchive = (data) => {
    const dataView = new DataView(data);
    const u16 = offset => dataView.getUint16(offset, true);
    const u32 = offset => dataView.getUint32(offset, true);

    // read the end of central directory record
    const extractEocd = (offset) => {
        return {
            magic: u32(offset),
            numFiles: u16(offset + 8),
            cdSizeBytes: u32(offset + 12),
            cdOffsetBytes: u32(offset + 16)
        };
    };

    const extractCdr = (offset) => {
        const filenameLength = u16(offset + 28);
        const extraFieldLength = u16(offset + 30);
        const fileCommentLength = u16(offset + 32);
        return {
            magic: u32(offset),
            compressionMethod: u16(offset + 10),
            compressedSizeBytes: u32(offset + 20),
            uncompressedSizeBytes: u32(offset + 24),
            lfhOffsetBytes: u32(offset + 42),
            filename: new TextDecoder().decode(new Uint8Array(data, offset + 46, filenameLength)),
            recordSizeBytes: 46 + filenameLength + extraFieldLength + fileCommentLength
        };
    };

    // read a local file header
    const extractLfh = (offset) => {
        const filenameLength = u16(offset + 26);
        const extraLength = u16(offset + 28);
        return {
            magic: u32(offset),
            offsetBytes: offset + 30 + filenameLength + extraLength
        };
    };

    // read the end of central directory record
    const eocd = extractEocd(dataView.byteLength - 22);

    if (eocd.magic !== 0x06054b50) {
        throw new Error('Invalid zip file: EOCDR not found');
    }

    if (eocd.cdOffsetBytes === 0xffffffff || eocd.cdSizeBytes === 0xffffffff) {
        throw new Error('Invalid zip file: Zip64 not supported');
    }

    // step over central directory records
    const result = [];
    let offset = eocd.cdOffsetBytes;
    for (let i = 0; i < eocd.numFiles; i++) {
        const cdr = extractCdr(offset);
        if (cdr.magic !== 0x02014b50) {
            throw new Error('Invalid zip file: CDR not found');
        }

        const lfh = extractLfh(cdr.lfhOffsetBytes);
        if (lfh.magic !== 0x04034b50) {
            throw new Error('Invalid zip file: LFH not found');
        }

        result.push({
            filename: cdr.filename,
            compression: { 0: 'none', 8: 'deflate' }[cdr.compressionMethod] ?? 'unknown',
            data: new Uint8Array(data, lfh.offsetBytes, cdr.compressedSizeBytes)
        });

        offset += cdr.recordSizeBytes;
    }

    return result;
};

const inflate = async (compressed) => {
    const ds = new DecompressionStream('deflate-raw');
    const out = new Blob([compressed]).stream().pipeThrough(ds);
    const ab = await new Response(out).arrayBuffer();
    return new Uint8Array(ab); // uncompressed file bytes
};

const downloadArrayBuffer = async (url, asset) => {
    const response = await (asset.file?.contents ?? fetch(url.load, { credentials: getFetchCredentials() }));
    if (!response) {
        throw new Error('Error loading resource');
    }

    // handle response object
    if (response instanceof Response) {
        if (!response.ok) {
            throw new Error(`Error loading resource: ${response.status} ${response.statusText}`);
        }

        const totalLength = parseInt(response.headers.get('content-length') ?? '0', 10);

        if (!response.body || !response.body.getReader) {
            const buf = await response.arrayBuffer();
            asset.fire('progress', buf.byteLength, totalLength);
            return buf;
        }

        const reader = response.body.getReader();
        const chunks = [];
        let totalReceived = 0;

        try {
            while (true) {
                /* eslint-disable no-await-in-loop */
                const { done, value } = await reader.read();
                if (done) {
                    break;
                }
                chunks.push(value);
                totalReceived += value.byteLength;
                asset.fire('progress', totalReceived, totalLength);
            }
        } finally {
            reader.releaseLock();
        }

        return new Blob(chunks).arrayBuffer();
    }

    // assume user passed in an ArrayBuffer directly
    return response;
};

class SogBundleParser {
    /** @type {AppBase} */
    app;

    constructor(app) {
        this.app = app;
    }

    canParse(context) {
        return context.ext === 'sog';
    }

    /**
     * Checks if loading should be aborted due to asset unload, app teardown or invalid device.
     *
     * Nothing cancels an in-flight request, so any of these callbacks can run after
     * {@link AppBase#destroy}. That tears down in a fixed order - the asset registry is dropped
     * before the graphics device is marked destroyed - so a callback can arrive while `app.assets`
     * is already null and the device still looks alive. Every access here has to tolerate that,
     * hence the optional chaining on the registry rather than only on the device.
     *
     * @param {Asset} asset - The asset being loaded.
     * @param {boolean} unloaded - Whether the asset was unloaded during async loading.
     * @returns {boolean} True if loading should be aborted.
     * @private
     */
    _shouldAbort(asset, unloaded) {
        if (unloaded) return true;
        if (!this.app?.graphicsDevice || this.app.graphicsDevice._destroyed) return true;
        return !this.app.assets?.get(asset.id);
    }

    /**
     * @param {object} url - The URL of the resource to load.
     * @param {string} url.load - The URL to use for loading the resource.
     * @param {string} url.original - The original URL useful for identifying the resource type.
     * @param {ResourceHandlerCallback} callback - The callback used when
     * the resource is loaded or an error occurs.
     * @param {Asset} asset - Container asset.
     */
    async load(url, callback, asset) {
        const gsplatCentersEnabledAtLoad = this.app.scene?.gsplatCentersEnabled !== false;

        // the handle on the referenced textures, and the textures by file name
        let handle = null;
        const refs = new Map();
        const releaseAll = () => handle?.release();

        // Set once `data` holds the texture handles: from then on they are released only through
        // data.destroy(), which the resource calls in its (ref-count deferred) destroy, as the
        // unified world may still be rendering from them when the asset unloads.
        let ownedByData = false;

        // the data and the resource that, once created, holds it and with it the textures (except
        // when decompressing); until then a throw (for example a malformed meta) releases them
        let data = null;
        let resource = null;

        try {
            const cache = getSogTextureCache(this);

            // Track if asset was unloaded during async loading
            let unloaded = false;

            // When the parent gsplat asset unloads while the textures still load (cancellation),
            // release them; the texture cache destroys a texture once nothing else holds it.
            // Registered before any await so an unload during the download or texture loading is
            // caught.
            asset.once('unload', () => {
                unloaded = true;
                if (!ownedByData) {
                    releaseAll();
                }
            });

            const arrayBuffer = await downloadArrayBuffer(url, asset);

            if (this._shouldAbort(asset, unloaded)) {
                callback(null, null);
                return;
            }

            const files = parseZipArchive(arrayBuffer);

            // deflate
            for (const file of files) {
                if (file.compression === 'deflate') {
                    file.data = await inflate(file.data);
                }
            }

            // access bundled meta.json
            const metaFile = files.find(f => f.filename === 'meta.json');
            if (!metaFile) {
                callback('Error: meta.json not found');
                return;
            }

            // parse json
            let meta;
            try {
                meta = JSON.parse(new TextDecoder().decode(metaFile.data));
            } catch (err) {
                callback(`Error parsing meta.json: ${err}`);
                return;
            }

            if (meta.version !== undefined && meta.version !== 2 && meta.version !== 3) {
                callback(`Error loading gsplat: unsupported SOG version ${meta.version} in ${url.original}`);
                return;
            }

            // extract filenames from meta.json (v3 may carry blind data)
            const filenames = [
                ...['means', 'scales', 'quats', 'sh0', 'shN'].map(key => meta[key]?.files ?? []).flat(),
                ...(meta.blind ?? []).map(t => t.files[0])
            ];

            // one handle on all textures from the app's texture cache: a url another file already
            // holds is shared, not loaded again. The texture cache drops the encoded bytes of an
            // embedded file (views into the downloaded zip arrayBuffer) once it is decoded, so
            // the whole archive buffer can be garbage collected.
            const unique = [...new Set(filenames)];
            handle = cache.acquire(unique.map((filename) => {
                const file = files.find(f => f.filename === filename);
                return file ?
                    // file is embedded
                    { url: `${url.load}/${filename}`, filename, contents: file.data } :
                    // file doesn't exist in bundle, treat it as a url
                    { url: (new URL(filename, new URL(filename, window.location.href).toString())).toString(), filename };
            }));
            unique.forEach((filename, i) => refs.set(filename, handle.entries[i]));

            const results = await Promise.allSettled(filenames.map(filename => refs.get(filename).promise));

            if (this._shouldAbort(asset, unloaded)) {
                releaseAll();
                callback(null, null);
                return;
            }

            // a texture that failed to load has no resource, so fail the whole load
            const failed = results.findIndex(r => r.status === 'rejected');
            if (failed !== -1) {
                releaseAll();
                callback(`Error loading gsplat: failed to load ${filenames[failed]} in ${url.original}: ${results[failed].reason}`);
                return;
            }

            const textureOf = filename => refs.get(filename)?.texture;
            Debug.call(() => checkSharedSogPalette(refs.get(meta.shN?.files[0]), meta, url.original));

            // construct the gsplat resource
            const decompress = asset.data?.decompress;

            data = new GSplatSogData();
            data.url = url.original;
            data.meta = meta;
            data.numSplats = meta.count;
            data.means_l = textureOf(meta.means.files[0]);
            data.means_u = textureOf(meta.means.files[1]);
            data.quats = textureOf(meta.quats.files[0]);
            data.scales = textureOf(meta.scales.files[0]);
            data.sh0 = textureOf(meta.sh0.files[0]);
            data.sh_centroids = textureOf(meta.shN?.files[0]);
            data.sh_labels = textureOf(meta.shN?.files[1]);
            data.blind = (meta.blind ?? []).map(t => textureOf(t.files[0]));
            data.shBands = GSplatSogData.calcBands(data.sh_centroids?.width);
            data.textureHandle = handle;
            ownedByData = true;

            if (!decompress) {
                if (this._shouldAbort(asset, unloaded)) {
                    data.destroy();
                    callback(null, null);
                    return;
                }

                // no need to prepare gpu data if decompressing
                data.prepareCodebook();
                if (gsplatCentersEnabledAtLoad) {
                    // An unload must cancel preparation even if the device never recovers.
                    const onUnload = asset.once('unload', () => data.destroy());
                    try {
                        await data.prepareGpuData();
                    } finally {
                        onUnload.off();
                    }
                }
            }

            if (this._shouldAbort(asset, unloaded)) {
                data.destroy();
                callback(null, null);
                return;
            }

            const prepareCenters = gsplatCentersEnabledAtLoad;
            if (decompress) {
                // the decompressed data is a copy, so the textures are released straight away
                const decompressed = await data.decompress();
                data.destroy();
                resource = new GSplatResource(this.app.graphicsDevice, decompressed, { prepareCenters });
            } else {
                resource = new GSplatSogResource(this.app.graphicsDevice, data, { prepareCenters });
            }
            resource.antiAlias = data.meta.model === 'antialiased';

            if (this._shouldAbort(asset, unloaded)) {
                resource.destroy();
                callback(null, null);
                return;
            }

            callback(null, resource);
        } catch (err) {
            if (!resource) {
                // handles are released once, so this is safe after a data.destroy() too
                data?.destroy();
                releaseAll();
            }
            callback(err);
        }
    }
}

export { SogBundleParser };
