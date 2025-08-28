import { Asset } from '../../framework/asset/asset.js';
import { GSplatResource } from '../../scene/gsplat/gsplat-resource.js';
import { GSplatSogsData } from '../../scene/gsplat/gsplat-sogs-data.js';
import { GSplatSogsResource } from '../../scene/gsplat/gsplat-sogs-resource.js';

/**
 * @import { AppBase } from '../app-base.js'
 * @import { ResourceHandlerCallback } from '../handlers/handler.js'
 */

/**
 * @param {ArrayBuffer} data - the file data
 * @returns {Array<{filename: string, data: Uint8Array}>} the extracted files
 */
const extractZipArchiveFiles = (data) => {
    const dataView = new DataView(data);

    const getUint16 = offset => dataView.getUint16(offset, true);
    const getUint32 = offset => dataView.getUint32(offset, true);

    // read the end of central directory record
    const extractEocd = (offset) => {
        return {
            numFiles: getUint16(offset + 8),
            cdSizeBytes: getUint32(offset + 12),
            cdOffsetBytes: getUint32(offset + 16)
        };
    };

    // read a central directory record
    const extractCdr = (offset) => {
        const length = getUint16(offset + 28);
        const fileHeaderSize = 30 + length;
        return {
            fileSizeBytes: getUint32(offset + 20),
            fileOffsetBytes: getUint32(offset + 42) + fileHeaderSize,
            filename: new TextDecoder().decode(new Uint8Array(data, offset + 46, length)),
            recordSizeBytes: 46 + length
        };
    };

    // extract the end of central directory info
    const eocd = extractEocd(dataView.byteLength - 22);

    // extract cdr records
    const cdrs = [];
    let offset = eocd.cdOffsetBytes;
    for (let i = 0; i < eocd.numFiles; i++) {
        const cdr = extractCdr(offset);
        cdrs.push(cdr);
        offset += cdr.recordSizeBytes;
    }

    // extract the files
    return cdrs.map((cdr) => {
        const fileData = new Uint8Array(data, cdr.fileOffsetBytes, cdr.fileSizeBytes);
        return {
            filename: cdr.filename,
            data: fileData
        };
    });
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
            const files = extractZipArchiveFiles(arrayBuffer);

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
