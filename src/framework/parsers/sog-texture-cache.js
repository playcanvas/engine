import { Debug } from '../../core/debug.js';
import { RefCountedObject } from '../../core/ref-counted-object.js';
import { Asset } from '../asset/asset.js';

/**
 * @import { AppBase } from '../app-base.js'
 * @import { Texture } from '../../platform/graphics/texture.js'
 */

/**
 * A texture file to acquire from a {@link SogTextureCache}.
 *
 * @typedef {object} SogTextureFile
 * @property {string} url - Absolute url of the texture, the key it is shared by.
 * @property {string} filename - File name for the texture asset.
 * @property {Uint8Array} [contents] - Encoded file contents when already in memory (for example
 * extracted from a bundle). Dropped once the texture has loaded.
 * @ignore
 */

/**
 * A holder's handle on the textures it acquired from a {@link SogTextureCache}.
 *
 * @typedef {object} SogTextureHandle
 * @property {SogTextureEntry[]} entries - The textures, in the order they were acquired. Emptied
 * when the handle is released.
 * @property {() => void} release - Releases the textures; each is destroyed once nothing holds
 * it. Calling it again does nothing.
 * @property {() => void} releaseSource - Drops the CPU-side source (the decoded image kept to
 * re-upload after a device loss) of the textures this holder was the first to hold; the first
 * holder of a texture decides for all that share it.
 * @ignore
 */

/**
 * One cached texture. Its reference count is the number of holders; it is shared by url.
 *
 * The cache keeps its own map of these rather than using RefCountedKeyCache, which releases by
 * key: after a failed load the entry leaves the map so the next request downloads again, while
 * the holders of the failed entry still release it, and a release by key would then reach the
 * new entry for the same url instead.
 *
 * @ignore
 */
class SogTextureEntry extends RefCountedObject {
    /** @type {string} */
    url;

    /** @type {Asset} */
    asset;

    /**
     * Resolves with the texture once loaded, rejects when the load fails.
     *
     * @type {Promise<Texture>}
     */
    promise;

    /**
     * Set when the last holder releases it while its load is still in flight. It then stays
     * cached, so a request for its url meanwhile revives it, and is destroyed when the load
     * completes otherwise.
     */
    released = false;

    /**
     * @param {string} url - Absolute url of the texture.
     * @param {Asset} asset - The texture asset.
     */
    constructor(url, asset) {
        super();
        this.url = url;
        this.asset = asset;
    }

    /**
     * The loaded texture, or null while it loads or after a failed load.
     *
     * @type {Texture|null}
     */
    get texture() {
        return /** @type {Texture|null} */ (this.asset.resource ?? null);
    }
}

/**
 * Ref-counted cache of the textures SOG files load, keyed by absolute url. Files whose metadata
 * point at the same texture url (for example one SH palette shared by the files of a
 * level-of-detail scene) share one download and one GPU texture. Each holder gets one
 * {@link SogTextureHandle} for the textures it acquires, and a texture is destroyed, and removed
 * from the asset registry and loader cache, once its last holder releases it.
 *
 * Besides the SOG parsers, an application can hold a texture itself, so it stays resident while
 * no file uses it (for example between unloading some files and loading others that share it),
 * or to start its download early. The url must be the absolute url the parser resolves the file
 * name to (relative to the `meta.json` that names it).
 *
 * @example
 * const cache = app.loader.getHandler('gsplat').sogTextureCache;
 * const url = new URL('shared/shN_centroids.webp', rootUrl).toString();
 * const hold = cache.acquire([{ url, filename: 'shN_centroids.webp' }]);
 * // ... load and unload the files that share the palette ...
 * hold.release();
 *
 * @ignore
 */
class SogTextureCache {
    /**
     * @type {Map<string, SogTextureEntry>}
     * @private
     */
    _entries = new Map();

    /**
     * @param {AppBase} app - The app whose asset registry loads the textures.
     */
    constructor(app) {
        /** @private */
        this._app = app;
    }

    /**
     * Acquires textures for one holder, starting the load of each url no live holder has.
     *
     * @param {SogTextureFile[]} files - The textures.
     * @returns {SogTextureHandle} The holder's handle.
     */
    acquire(files) {
        // the textures this holder is the first to hold: only it decides about their CPU source
        const first = [];

        const entries = files.map((file) => {
            const entry = this._entries.get(file.url) ?? this._create(file);
            if (entry.refCount === 0) {
                first.push(entry);
            }

            // revives an entry released while its load is still in flight
            entry.released = false;
            entry.incRefCount();
            return entry;
        });

        return {
            entries,
            release: () => entries.splice(0).forEach(entry => this._release(entry)),
            releaseSource: () => first.forEach(entry => entry.texture?.setReleaseSourceAfterUpload())
        };
    }

    /**
     * @param {SogTextureFile} file - The texture to load.
     * @returns {SogTextureEntry} The new entry.
     * @private
     */
    _create({ url, filename, contents }) {
        const asset = new Asset(filename, 'texture', { url, filename, contents }, {
            mipmaps: false
        }, {
            crossOrigin: 'anonymous'
        });

        const entry = new SogTextureEntry(url, asset);

        entry.promise = new Promise((resolve, reject) => {
            asset.once('load', () => {
                // encoded contents are only needed for the decode, and may pin a whole downloaded
                // archive; the decoded image kept for context loss recovery is unaffected
                asset.file.contents = null;

                const texture = /** @type {Texture} */ (asset.resource);

                // every holder left while it was loading
                if (entry.released) {
                    this._destroy(entry);
                }

                resolve(texture);
            });

            asset.once('error', (err) => {
                // a failed load is not shared: later requests for the url download it again,
                // while holders of this entry still release it as usual
                if (this._entries.get(url) === entry) {
                    this._entries.delete(url);
                }

                // every holder left while it was loading
                if (entry.released) {
                    this._destroy(entry);
                }

                reject(err);
            });
        });

        // holders await the promise; a load nobody waits for any more must not be reported as an
        // unhandled rejection
        entry.promise.catch(() => {});

        this._entries.set(url, entry);

        const { assets } = this._app;
        assets.add(asset);
        assets.load(asset);

        return entry;
    }

    /**
     * @param {SogTextureEntry} entry - The entry a holder released.
     * @private
     */
    _release(entry) {
        Debug.assert(entry.refCount > 0, `SogTextureCache: ${entry.url} released more times than acquired.`);

        entry.decRefCount();
        if (entry.refCount > 0) return;

        if (entry.asset.loading) {
            // Keep a texture that is still loading cached, so a request for its url meanwhile
            // revives this entry. A second entry would load the url again, and the resource loader
            // would merge that request into this one and hand both the same texture, which this
            // entry would then destroy. Destroyed when its load completes unless revived.
            entry.released = true;
        } else {
            this._destroy(entry);
        }
    }

    /**
     * @param {SogTextureEntry} entry - The entry to destroy.
     * @private
     */
    _destroy(entry) {
        const { url, asset } = entry;
        const fileUrl = asset.getFileUrl();

        if (this._entries.get(url) === entry) {
            this._entries.delete(url);
        }

        this._app.assets?.remove(asset);

        // destroys the texture
        asset.unload();

        // the asset is no longer registered, so unload() may not reach the loader; clear the
        // loader's cache entry so a later load of the url creates a new texture instead of
        // returning the destroyed one
        this._app.loader?.clearCache(fileUrl, asset.type);
    }
}

/**
 * Returns the texture cache a SOG parser loads through: the app's, owned by the gsplat handler and
 * shared by its SOG parsers, or the parser's own when it is used without the handler.
 *
 * @param {object} parser - The parser, with its `app` and the `handler` it was registered with.
 * @returns {SogTextureCache} The cache.
 * @ignore
 */
const getSogTextureCache = (parser) => {
    return parser.handler?.sogTextureCache ?? (parser._ownTextureCache ??= new SogTextureCache(parser.app));
};

/**
 * Warns when SOG files sharing an SH palette disagree on its codebook, without which the shared
 * palette decodes to wrong colors. Debug builds only: call it through `Debug.call`, so release
 * builds drop both the call and this function.
 *
 * @param {SogTextureEntry|undefined} centroids - The SH palette, if the file has SH.
 * @param {object} meta - The file's meta.
 * @param {string} name - The file, for the warning.
 * @ignore
 */
const checkSharedSogPalette = (centroids, meta, name) => {
    if (centroids) {
        const { codebook, mins, maxs } = meta.shN;
        const key = JSON.stringify({ codebook, mins, maxs });

        // the first file to bring the palette sets the codebook the others must match
        const entry = /** @type {SogTextureEntry & { _shNKey?: string }} */ (centroids);
        entry._shNKey ??= key;
        if (entry._shNKey !== key) {
            Debug.warnOnce(`SogTextureCache: ${name} shares ${entry.url} with other SOG files but its codebook differs, so the shared texture decodes to wrong values.`);
        }
    }
};

export { SogTextureCache, getSogTextureCache, checkSharedSogPalette };
