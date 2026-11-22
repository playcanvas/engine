import { Debug } from '../../core/debug.js';
import { RefCountedObject } from '../../core/ref-counted-object.js';
import { Asset } from '../asset/asset.js';

/**
 * @import { AppBase } from '../app-base.js'
 * @import { Texture } from '../../platform/graphics/texture.js'
 */

/**
 * One cached texture, shared by every handle on its url. Its reference count is the number of
 * live handles.
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

    /** Number of live handles that asked for the texture's CPU source to be released. */
    sourceReleases = 0;

    /**
     * Set once the last handle is released. The texture is then destroyed, or is when a load
     * still in flight completes.
     */
    released = false;

    /**
     * Value the first holder registered with {@link SogTextureCache#checkShared}, compared
     * against later holders in debug builds.
     *
     * @type {string|undefined}
     */
    sharedKey;

    constructor(url, asset) {
        super();
        this.url = url;
        this.asset = asset;
    }
}

/**
 * A holder's handle on a texture in a {@link SogTextureCache}. Each handle is released once, with
 * {@link SogTextureRef#release}; the texture is destroyed when its last handle is released.
 *
 * @ignore
 */
class SogTextureRef {
    /** @private */
    _released = false;

    /** @private */
    _sourceReleased = false;

    /**
     * @param {SogTextureCache} cache - The cache that issued the handle.
     * @param {SogTextureEntry} entry - The cached texture.
     */
    constructor(cache, entry) {
        /** @private */
        this._cache = cache;

        /** @private */
        this._entry = entry;
    }

    /**
     * The url the texture is shared by.
     *
     * @type {string}
     */
    get url() {
        return this._entry.url;
    }

    /**
     * The texture asset. Shared by all handles on the url, so it must not be unloaded directly.
     *
     * @type {Asset}
     */
    get asset() {
        return this._entry.asset;
    }

    /**
     * Resolves with the texture once loaded, rejects when the load fails.
     *
     * @type {Promise<Texture>}
     */
    get promise() {
        return this._entry.promise;
    }

    /**
     * The loaded texture, or null while it loads or after a failed load.
     *
     * @type {Texture|null}
     */
    get texture() {
        return /** @type {Texture|null} */ (this._entry.asset.resource ?? null);
    }

    /**
     * True when other handles share the texture.
     *
     * @type {boolean}
     */
    get shared() {
        return this._entry.refCount > 1;
    }

    /**
     * Releases this handle. Calling it again does nothing.
     */
    release() {
        if (this._released) return;
        this._released = true;
        this._cache._release(this._entry, this._sourceReleased);
    }

    /**
     * Asks for the texture's CPU-side source (the decoded image kept to re-upload after a device
     * loss) to be dropped after upload. It is dropped only once every live handle has asked, so a
     * holder that relies on context-loss recovery keeps it for all.
     */
    releaseSource() {
        if (this._released || this._sourceReleased) return;
        this._sourceReleased = true;
        this._entry.sourceReleases++;
        this._cache._applySourceRelease(this._entry);
    }
}

/**
 * Ref-counted cache of the textures SOG files load, keyed by absolute url. Files whose metadata
 * point at the same texture url (for example one SH palette shared by the files of a
 * level-of-detail scene) share one download and one GPU texture. Each holder gets its own
 * {@link SogTextureRef}, and the texture is destroyed, and removed from the asset registry and
 * loader cache, once its last handle is released.
 *
 * Besides the SOG parsers, an application can hold a texture itself, so it stays resident while
 * no file uses it (for example between unloading some files and loading others that share it),
 * or to start its download early. The url must be the absolute url the parser resolves the file
 * name to (relative to the `meta.json` that names it).
 *
 * @example
 * const cache = app.loader.getHandler('gsplat').sogTextureCache;
 * const palette = cache.acquire(new URL('shared/shN_centroids.webp', rootUrl).toString());
 * // ... load and unload the files that share the palette ...
 * palette.release();
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
     * Number of urls with live handles.
     *
     * @type {number}
     */
    get size() {
        return this._entries.size;
    }

    /**
     * Returns a handle on the texture at a url, starting its load if no live handle holds it.
     *
     * @param {string} url - Absolute url of the texture.
     * @param {object} [options] - Options used when the texture is not cached yet.
     * @param {string} [options.filename] - File name for the texture asset. Defaults to the url.
     * @param {ArrayBuffer|Uint8Array} [options.contents] - Encoded file contents, when already
     * in memory (for example extracted from a bundle). Dropped once the texture has loaded.
     * @returns {SogTextureRef} The handle. Release it with {@link SogTextureRef#release}.
     */
    acquire(url, options = {}) {
        let entry = this._entries.get(url);
        if (!entry) {
            entry = this._create(url, options);
        }
        entry.incRefCount();
        return new SogTextureRef(this, entry);
    }

    /**
     * Registers a value that every holder of a shared texture must agree on, and warns once when a
     * later holder brings a different one. Used in debug builds to check that SOG files sharing an
     * SH palette also share its codebook, without which the palette decodes to wrong colors.
     *
     * @param {SogTextureRef} ref - A handle on the texture.
     * @param {object} value - JSON-serializable value to compare.
     * @param {string} context - Name of the holder, for the warning.
     */
    checkShared(ref, value, context) {
        const entry = ref._entry;
        const key = JSON.stringify(value);
        if (entry.sharedKey === undefined) {
            entry.sharedKey = key;
        } else if (entry.sharedKey !== key) {
            Debug.warnOnce(`SogTextureCache: ${context} shares ${entry.url} with other SOG files but its codebook differs, so the shared texture decodes to wrong values.`);
        }
    }

    /**
     * @param {string} url - Absolute url of the texture.
     * @param {object} options - See {@link SogTextureCache#acquire}.
     * @returns {SogTextureEntry} The new entry.
     * @private
     */
    _create(url, { filename = url, contents } = {}) {
        const file = { url, filename };
        if (contents) {
            file.contents = contents;
        }

        const asset = new Asset(filename, 'texture', file, {
            mipmaps: false
        }, {
            crossOrigin: 'anonymous'
        });

        const entry = new SogTextureEntry(url, asset);

        entry.promise = new Promise((resolve, reject) => {
            asset.once('load', () => {
                // encoded contents are only needed for the decode, and may pin a whole downloaded
                // archive; the decoded image kept for context loss recovery is unaffected
                if (asset.file?.contents) {
                    asset.file.contents = null;
                }

                const texture = /** @type {Texture} */ (asset.resource);

                if (entry.released) {
                    // every holder left while it was loading
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
     * @param {SogTextureEntry} entry - The entry a handle was released on.
     * @param {boolean} sourceReleased - Whether that handle had asked to release the source.
     * @private
     */
    _release(entry, sourceReleased) {
        Debug.assert(entry.refCount > 0, `SogTextureCache: ${entry.url} released more times than acquired.`);

        entry.decRefCount();
        if (sourceReleased) {
            entry.sourceReleases--;
        }

        if (entry.refCount > 0) {
            // the holders left may all have asked to release the source
            this._applySourceRelease(entry);
            return;
        }

        entry.released = true;
        if (this._entries.get(entry.url) === entry) {
            this._entries.delete(entry.url);
        }

        // keep the asset out of the registry from now on, also while a load is still in flight
        this._app.assets?.remove(entry.asset);

        // a texture still loading is destroyed when its load completes
        if (!entry.asset.loading) {
            this._destroy(entry);
        }
    }

    /**
     * @param {SogTextureEntry} entry - The entry to check.
     * @private
     */
    _applySourceRelease(entry) {
        if (entry.refCount > 0 && entry.sourceReleases === entry.refCount) {
            // permanent: a holder that joins later shares the texture without a CPU source
            /** @type {Texture|null} */ (entry.asset.resource)?.setReleaseSourceAfterUpload();
        }
    }

    /**
     * @param {SogTextureEntry} entry - The entry to destroy.
     * @private
     */
    _destroy(entry) {
        const { asset } = entry;
        const fileUrl = asset.getFileUrl();

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
 * Warns when SOG files sharing an SH palette disagree on its codebook. Meant for debug builds,
 * through `Debug.call`.
 *
 * @param {SogTextureCache} cache - The texture cache.
 * @param {SogTextureRef|undefined} centroids - Handle on the SH palette, if the file has SH.
 * @param {object} meta - The file's meta.
 * @param {string} name - The file, for the warning.
 * @ignore
 */
const checkSharedSogPalette = (cache, centroids, meta, name) => {
    if (centroids) {
        const { codebook, mins, maxs } = meta.shN;
        cache.checkShared(centroids, { codebook, mins, maxs }, name);
    }
};

export { SogTextureCache, SogTextureRef, getSogTextureCache, checkSharedSogPalette };
