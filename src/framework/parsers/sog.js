import { Debug } from '../../core/debug.js';
import { http, Http } from '../../platform/net/http.js';
import { GSplatResource } from '../../scene/gsplat/gsplat-resource.js';
import { GSplatSogData } from '../../scene/gsplat/gsplat-sog-data.js';
import { GSplatSogResource } from '../../scene/gsplat/gsplat-sog-resource.js';
import { checkSharedSogPalette, getSogTextureCache } from './sog-texture-cache.js';

// combine the progress updates from multiple assets
// and fire progress events on the target
const combineProgress = (target, assets) => {
    const map = new Map();
    const count = assets.length;

    const fire = () => {
        let loaded = 0;
        let total = 0;

        map.forEach((value) => {
            loaded += value.loaded;
            total += value.total;
        });

        // Estimate total for assets that haven't reported yet by assuming
        // they are roughly the same average size as the ones that have.
        const reporting = map.size;
        if (reporting > 0 && reporting < count) {
            total = Math.ceil(total * count / reporting);
        }

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
            mins: meta.shN.mins,
            maxs: meta.shN.maxs,
            files: meta.shN.files
        };
    }

    return result;
};

/**
 * @import { AppBase } from '../app-base.js'
 * @import { Asset } from '../asset/asset.js'
 * @import { ResourceHandlerCallback } from '../handlers/handler.js'
 */

class SogParser {
    /** @type {AppBase} */
    app;

    /**
     * @param {AppBase} app - The app instance.
     */
    constructor(app) {
        this.app = app;
    }

    canParse(context) {
        return context.ext === 'json';
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

    async loadTextures(url, callback, asset, meta) {
        const gsplatCentersEnabledAtLoad = this.app.scene?.gsplatCentersEnabled !== false;

        // transform meta to latest shape
        if (meta.version === undefined) {
            Debug.deprecated('Loading SOG v1 data which is deprecated. Please recompress your scene with latest tools.');
            meta = upgradeMeta(meta);
        } else if (meta.version !== 2 && meta.version !== 3) {
            callback(`Error loading gsplat: unsupported SOG version ${meta.version} in ${url.original}`);
            return;
        }

        const cache = getSogTextureCache(this);

        // v3 may carry per-gaussian blind data
        const subs = ['means', 'quats', 'scales', 'sh0', 'shN', 'blind'];

        // resolve every texture url first, so a malformed meta throws before anything is acquired.
        // Urls are relative to the meta.json, so several files (for example those of a
        // level-of-detail scene) can point at one shared file (`../shared/shN_centroids.webp`).
        const base = window.document?.baseURI ?? window.location.href;
        const metaUrl = new URL(url.load, base).toString();
        const files = {};
        subs.forEach((sub) => {
            // blind is a list of textures, each with its own file
            const filenames = sub === 'blind' ? (meta.blind ?? []).map(t => t.files[0]) : (meta[sub]?.files ?? []);
            files[sub] = filenames.map(filename => ({
                filename,
                url: asset.options?.mapUrl?.(filename) ?? new URL(filename, metaUrl).toString()
            }));
        });

        // one handle on all textures from the app's texture cache: a url another file already
        // holds is shared, not loaded again. Releasing the handle again does nothing.
        const handle = cache.acquire(subs.map(sub => files[sub]).flat());
        const releaseAll = handle.release;

        // the textures, all and by sub
        const allRefs = handle.entries.slice();
        const refs = {};
        let first = 0;
        subs.forEach((sub) => {
            refs[sub] = allRefs.slice(first, first += files[sub].length);
        });

        // Track if asset was unloaded during async loading
        let unloaded = false;

        // Set once `data` holds the texture handles: from then on they are released only through
        // data.destroy(), which the resource calls in its (ref-count deferred) destroy, as the
        // unified world may still be rendering from them when the asset unloads.
        let ownedByData = false;

        // When the parent gsplat asset unloads while the textures still load (cancellation),
        // release them; the cache destroys a texture once nothing else holds it.
        asset.once('unload', () => {
            unloaded = true;
            if (!ownedByData) {
                releaseAll();
            }
        });

        // only textures still loading report progress
        combineProgress(asset, allRefs.filter(ref => !ref.asset.loaded).map(ref => ref.asset));

        // wait for all textures to complete loading
        const results = await Promise.allSettled(allRefs.map(ref => ref.promise));

        if (this._shouldAbort(asset, unloaded)) {
            releaseAll();
            callback(null, null);
            return;
        }

        // a texture that failed to load has no resource, so fail the whole load
        const failed = results.findIndex(r => r.status === 'rejected');
        if (failed !== -1) {
            releaseAll();
            callback(`Error loading gsplat: failed to load ${allRefs[failed].asset.file.filename} in ${url.original}: ${results[failed].reason}`);
            return;
        }

        Debug.call(() => checkSharedSogPalette(refs.shN?.[0], meta, url.original));

        // the resource, once created, holds the data and with it the textures (except when
        // decompressing); until then a throw (for example a malformed meta) releases them here
        let data = null;
        let resource = null;

        try {
            // construct the gsplat resource
            data = new GSplatSogData();
            data.url = url.original;
            data.meta = meta;
            data.numSplats = meta.count;
            data.means_l = refs.means[0].texture;
            data.means_u = refs.means[1].texture;
            data.quats = refs.quats[0].texture;
            data.scales = refs.scales[0].texture;
            data.sh0 = refs.sh0[0].texture;
            data.sh_centroids = refs.shN?.[0]?.texture;
            data.sh_labels = refs.shN?.[1]?.texture;
            data.blind = refs.blind.map(ref => ref.texture);
            data.shBands = GSplatSogData.calcBands(data.sh_centroids?.width);
            data.textureHandle = handle;
            ownedByData = true;

            const decompress = asset.data?.decompress;

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
        } catch (err) {
            if (!resource) {
                // handles are released once, so this is safe after a data.destroy() too
                data?.destroy();
                releaseAll();
            }
            throw err;
        }

        if (this._shouldAbort(asset, unloaded)) {
            resource.destroy();
            callback(null, null);
            return;
        }

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
        // report a throw as a load error instead of leaving the asset loading forever
        const loadTextures = (meta) => {
            this.loadTextures(url, callback, asset, meta).catch(err => callback(`Error loading gsplat: ${url.original} [${err}]`));
        };

        if (asset.data?.means) {
            // user can specify meta.json in asset data
            loadTextures(asset.data);
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
                retry: this.handler.maxRetries > 0,
                maxRetries: this.handler.maxRetries,
                responseType: Http.ResponseType.JSON
            };

            http.get(url.load, options, (err, meta) => {
                if (this._shouldAbort(asset, false)) {
                    callback(null, null);
                    return;
                }

                if (!err) {
                    loadTextures(meta);
                } else {
                    callback(`Error loading gsplat meta: ${url.original} [${err}]`);
                }
            });
        }
    }
}

export { SogParser };
