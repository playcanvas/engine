import { Asset } from '../../framework/asset/asset.js';
import { GSplatResource } from '../../scene/gsplat/gsplat-resource.js';
import { GSplatSogData } from '../../scene/gsplat/gsplat-sog-data.js';
import { GSplatSogResource } from '../../scene/gsplat/gsplat-sog-resource.js';

/**
 * @import { AppBase } from '../app-base.js'
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
    const response = await (asset.file?.contents ?? fetch(url.load));
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
     * Checks if loading should be aborted due to asset unload or invalid device.
     *
     * @param {Asset} asset - The asset being loaded.
     * @param {boolean} unloaded - Whether the asset was unloaded during async loading.
     * @returns {boolean} True if loading should be aborted.
     * @private
     */
    _shouldAbort(asset, unloaded) {
        if (unloaded || !this.app.assets.get(asset.id)) return true;
        if (!this.app?.graphicsDevice || this.app.graphicsDevice._destroyed) return true;
        return false;
    }

    /**
     * Checks if loading should be aborted due to asset unload or invalid device.
     *
     * @param {Asset} asset - The asset being loaded.
     * @param {boolean} unloaded - Whether the asset was unloaded during async loading.
     * @returns {boolean} True if loading should be aborted.
     * @private
     */
    _shouldAbort(asset, unloaded) {
        if (unloaded || !this.app.assets.get(asset.id)) return true;
        if (!this.app?.graphicsDevice || this.app.graphicsDevice._destroyed) return true;
        return false;
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

        try {
            const { assets } = this.app;

            // Track if asset was unloaded during async loading
            let unloaded = false;

            // Set once the GSplatSogResource takes ownership of the textures: from then on they
            // may only be destroyed through the resource's (ref-count deferred) destroy, as the
            // unified world may still be rendering from them when the asset unloads.
            let ownedByResource = false;

            // load referenced textures
            const textures = {};

            // When the parent gsplat asset unloads, remove child texture assets from the
            // registry. Destroy their texture resources only while the load is still in flight
            // (cancellation); once owned by the resource, destruction is left to it. Registered
            // before any await so an unload during the download or texture loading is caught.
            asset.once('unload', () => {
                unloaded = true;

                Object.values(textures).forEach((t) => {
                    // remove from registry
                    assets.remove(t);

                    if (!ownedByResource) {
                        // destroy texture resource
                        t.unload();
                    } else {
                        // The resource destroys the textures (possibly deferred), but they stay
                        // in the loader cache as t.unload() is not called. Clear the cache
                        // entries so a later load of the same urls recreates the textures
                        // instead of reusing the cached, destroyed ones.
                        assets._loader.clearCache(t.getFileUrl(), t.type);
                    }
                });
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

            // extract filenames from meta.json
            const filenames = ['means', 'scales', 'quats', 'sh0', 'shN'].map(key => meta[key]?.files ?? []).flat();

            const promises = [];
            for (const filename of filenames) {
                const file = files.find(f => f.filename === filename);
                let texture;
                if (file) {
                    // file is embedded
                    texture = new Asset(filename, 'texture', {
                        url: `${url.load}/${filename}`,
                        filename,
                        contents: file.data
                    }, {
                        mipmaps: false
                    }, {
                        crossOrigin: 'anonymous'
                    });
                } else {
                    // file doesn't exist in bundle, treat it as a url
                    const url = (new URL(filename, new URL(filename, window.location.href).toString())).toString();
                    texture = new Asset(filename, 'texture', {
                        url,
                        filename
                    }, {
                        mipmaps: false
                    }, {
                        crossOrigin: 'anonymous'
                    });
                }

                const promise = new Promise((resolve, reject) => {
                    texture.on('load', () => resolve(null));
                    texture.on('error', err => reject(err));
                });

                this.app.assets.add(texture);
                textures[filename] = texture;
                promises.push(promise);
            }

            Object.values(textures).forEach(t => this.app.assets.load(t));

            await Promise.allSettled(promises);

            if (this._shouldAbort(asset, unloaded)) {
                // Clean up texture assets that were created during the async load
                Object.values(textures).forEach((t) => {
                    assets.remove(t);
                    t.unload();
                });
                callback(null, null);
                return;
            }

            // Release the encoded source bytes held by the embedded texture assets. These are
            // views into the downloaded zip arrayBuffer; once the textures have been decoded and
            // uploaded, dropping them lets the whole archive buffer be garbage collected. The
            // decoded ImageBitmap retained by each texture (for re-upload on device context loss)
            // is unaffected.
            Object.values(textures).forEach((t) => {
                if (t.file) {
                    t.file.contents = null;
                }
            });

            // construct the gsplat resource
            const decompress = asset.data?.decompress;

            const data = new GSplatSogData();
            data.url = url.original;
            data.meta = meta;
            data.numSplats = meta.count;
            data.means_l = textures[meta.means.files[0]].resource;
            data.means_u = textures[meta.means.files[1]].resource;
            data.quats = textures[meta.quats.files[0]].resource;
            data.scales = textures[meta.scales.files[0]].resource;
            data.sh0 = textures[meta.sh0.files[0]].resource;
            data.sh_centroids = textures[meta.shN?.files[0]]?.resource;
            data.sh_labels = textures[meta.shN?.files[1]]?.resource;
            data.shBands = GSplatSogData.calcBands(data.sh_centroids?.width);

            if (!decompress) {
                if (this._shouldAbort(asset, unloaded)) {
                    data.destroy();
                    callback(null, null);
                    return;
                }

                // no need to prepare gpu data if decompressing
                data.prepareCodebook();
                if (gsplatCentersEnabledAtLoad) {
                    await data.prepareGpuData();
                }
            }

            if (this._shouldAbort(asset, unloaded)) {
                data.destroy();
                callback(null, null);
                return;
            }

            const prepareCenters = gsplatCentersEnabledAtLoad;
            const resource = decompress ?
                new GSplatResource(this.app.graphicsDevice, await data.decompress(), { prepareCenters }) :
                new GSplatSogResource(this.app.graphicsDevice, data, { prepareCenters });

            // the sog resource now owns the textures in `data` (when decompressing, the
            // decompressed data was copied out instead and the textures stay with the assets)
            ownedByResource = !decompress;

            if (this._shouldAbort(asset, unloaded)) {
                resource.destroy();
                callback(null, null);
                return;
            }

            callback(null, resource);
        } catch (err) {
            callback(err);
        }
    }
}

export { SogBundleParser };
