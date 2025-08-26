import { Asset } from '../../framework/asset/asset.js';
import { http, Http } from '../../platform/net/http.js';
import { GSplatResource } from '../../scene/gsplat/gsplat-resource.js';
import { GSplatSogsData } from '../../scene/gsplat/gsplat-sogs-data.js';
import { GSplatSogsResource } from '../../scene/gsplat/gsplat-sogs-resource.js';

// combine the progress updates from multiple assets
// and fire progress events on the target
const combineProgress = (target, assets) => {
    const map = new Map();

    const fire = () => {
        let loaded = 0;
        let total = 0;

        map.forEach((value) => {
            loaded += value.loaded;
            total += value.total;
        });

        target.fire('progress', loaded, total);
    };

    assets.forEach((asset) => {
        const progress = (loaded, total) => {
            map.set(asset, { loaded, total });
            fire();
        };

        const done = () => {
            asset.off('progress', progress);
            asset.off('load', done);
            asset.off('error', done);
        };

        asset.on('progress', progress);
        asset.on('load', done);
        asset.on('error', done);
    });
};

// given a v1 meta.json, upgrade it to the v2 shape
const upgradeMeta = (meta) => {
    const result = {
        version: 1,
        count: meta.means.shape[0],
        means: {
            mins: meta.means.mins,
            maxs: meta.means.maxs,
            files: meta.means.files
        },
        scales: {
            mins: meta.scales.mins,
            maxs: meta.scales.maxs,
            files: meta.scales.files
        },
        quats: {
            files: meta.quats.files
        },
        sh0: {
            mins: meta.sh0.mins,
            maxs: meta.sh0.maxs,
            files: meta.sh0.files
        }
    };

    if (meta.shN) {
        result.shN = {
            codebook: new Array(256).fill(0).map((_, i) => meta.shN.mins + (meta.shN.maxs - meta.shN.mins) * (i / 255)),
            files: meta.shN.files
        };
    }

    return result;
};

/**
 * @import { AppBase } from '../app-base.js'
 * @import { ResourceHandlerCallback } from '../handlers/handler.js'
 */

class SogsParser {
    /** @type {AppBase} */
    app;

    /** @type {number} */
    maxRetries;

    /**
     * @param {AppBase} app - The app instance.
     * @param {number} maxRetries - Maximum amount of retries.
     */
    constructor(app, maxRetries) {
        this.app = app;
        this.maxRetries = maxRetries;
    }

    async loadTextures(url, callback, asset, meta) {
        // transform meta to latest shape
        if (meta.version !== 2) {
            meta = upgradeMeta(meta);
        }

        const { assets } = this.app;

        const subs = ['means', 'quats', 'scales', 'sh0', 'shN'];

        const textures = {};
        const promises = [];

        subs.forEach((sub) => {
            const files = meta[sub]?.files ?? [];
            textures[sub] = files.map((filename) => {
                const texture = new Asset(filename, 'texture', {
                    url: asset.options?.mapUrl?.(filename) ?? (new URL(filename, new URL(url.load, window.location.href).toString())).toString(),
                    filename
                }, {
                    mipmaps: false
                });

                const promise = new Promise((resolve, reject) => {
                    texture.on('load', () => resolve(null));
                    texture.on('error', err => reject(err));
                });

                assets.add(texture);
                promises.push(promise);

                return texture;
            });
        });

        const textureAssets = subs.map(sub => textures[sub]).flat();

        combineProgress(asset, textureAssets);

        textureAssets.forEach(t => assets.load(t));

        // wait for all textures to complete loading
        await Promise.allSettled(promises);

        // construct the gsplat resource
        const data = new GSplatSogsData();
        data.meta = meta;
        data.numSplats = meta.count;
        data.means_l = textures.means[0].resource;
        data.means_u = textures.means[1].resource;
        data.quats = textures.quats[0].resource;
        data.scales = textures.scales[0].resource;
        data.sh0 = textures.sh0[0].resource;
        data.sh_centroids = textures.shN?.[0]?.resource;
        data.sh_labels = textures.shN?.[1]?.resource;

        const decompress = asset.data?.decompress;

        if (!decompress) {
            // no need to prepare gpu data if decompressing
            await data.prepareGpuData();
        }

        const resource = decompress ?
            new GSplatResource(this.app.graphicsDevice, await data.decompress()) :
            new GSplatSogsResource(this.app.graphicsDevice, data);

        callback(null, resource);
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
        if (asset.data?.means) {
            // user can specify meta.json in asset data
            this.loadTextures(url, callback, asset, asset.data);
        } else {
            // otherwise download meta.json using asset url
            if (typeof url === 'string') {
                url = {
                    load: url,
                    original: url
                };
            }

            // we need to specify JSON for blob URLs
            const options = {
                retry: this.maxRetries > 0,
                maxRetries: this.maxRetries,
                responseType: Http.ResponseType.JSON
            };

            http.get(url.load, options, (err, meta) => {
                if (!err) {
                    this.loadTextures(url, callback, asset, meta);
                } else {
                    callback(`Error loading gsplat meta: ${url.original} [${err}]`);
                }
            });
        }
    }
}

export { SogsParser };
