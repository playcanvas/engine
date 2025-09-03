import { Asset } from '../../framework/asset/asset.js';
import { GSplatResource } from '../../scene/gsplat/gsplat-resource.js';
import { GSplatSogsData } from '../../scene/gsplat/gsplat-sogs-data.js';
import { GSplatSogsResource } from '../../scene/gsplat/gsplat-sogs-resource.js';

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

class SogBundleParser {
    /** @type {AppBase} */
    app;

    /** @type {number} */
    maxRetries;

    constructor(app, maxRetries = 3) {
        this.app = app;
        this.maxRetries = maxRetries;
    }

    /**
     * @param {object} url - The URL of the resource to load.
     * @param {string} url.load - The URL to use for loading the resource.
     * @param {string} url.original - The original URL useful for identifying the resource type.
     * @param {ResourceHandlerCallback} callback - The callback used when
     * the resource is loaded or an error occurs.
     * @param {Asset} asset - Container asset.
     */
    load(url, callback, asset) {
        const handleArrayBuffer = async (arrayBuffer) => {
            const files = parseZipArchive(arrayBuffer);

            // deflate
            for (const file of files) {
                if (file.compression === 'deflate') {
                    file.data = await inflate(file.data);   // eslint-disable-line no-await-in-loop
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

            // load referenced textures
            const textures = {};
            const promises = [];
            for (const filename of filenames) {
                const file = files.find(f => f.filename === filename);
                let texture;
                if (file) {
                    // file is embedded
                    texture = new Asset(filename, 'texture', {
                        url: filename,
                        filename,
                        contents: file.data
                    }, {
                        mipmaps: false
                    });
                } else {
                    // file doesn't exist in bundle, treat it as a url
                    const url = (new URL(filename, new URL(filename, window.location.href).toString())).toString();
                    texture = new Asset(filename, 'texture', {
                        url,
                        filename
                    }, {
                        mipmaps: false
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

            // construct the gsplat resource
            const data = new GSplatSogsData();
            data.meta = meta;
            data.numSplats = meta.count;
            data.means_l = textures[meta.means.files[0]].resource;
            data.means_u = textures[meta.means.files[1]].resource;
            data.quats = textures[meta.quats.files[0]].resource;
            data.scales = textures[meta.scales.files[0]].resource;
            data.sh0 = textures[meta.sh0.files[0]].resource;
            data.sh_centroids = textures[meta.shN?.files[0]]?.resource;
            data.sh_labels = textures[meta.shN?.files[1]]?.resource;

            const decompress = asset.data?.decompress;

            if (!decompress) {
                // no need to prepare gpu data if decompressing
                await data.prepareGpuData();
            }

            const resource = decompress ?
                new GSplatResource(this.app.graphicsDevice, await data.decompress()) :
                new GSplatSogsResource(this.app.graphicsDevice, data);

            callback(null, resource);
        };

        Asset.fetchArrayBuffer(url.load, (error, arrayBuffer) => {
            if (error) {
                callback(error);
            } else {
                handleArrayBuffer(arrayBuffer);
            }
        }, asset, this.maxRetries);
    }
}

export { SogBundleParser };
