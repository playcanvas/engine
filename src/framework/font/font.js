import { FONT_MSDF } from './constants.js';

/**
 * @import { ResourceLoader } from '../handlers/loader.js'
 * @import { Texture } from '../../platform/graphics/texture.js'
 */

/**
 * Represents the resource of a font asset.
 *
 * @category User Interface
 */
class Font {
    /**
     * Create a new Font instance.
     *
     * @param {Texture[]} textures - The font textures.
     * @param {object} data - The font data.
     */
    constructor(textures, data) {
        this.type = data ? data.type || FONT_MSDF : FONT_MSDF;

        this.em = 1;

        /**
         * The font textures.
         *
         * @type {Texture[]}
         */
        this.textures = textures;

        /**
         * The font intensity.
         */
        this.intensity = 0.0;

        /**
         * The resource loader used to load the font textures. Set by the {@link FontHandler} so
         * that {@link Font#destroy} can release the textures from the loader cache. Null for fonts
         * created without going through the resource loader.
         *
         * @type {ResourceLoader|null}
         * @ignore
         */
        this._loader = null;

        // json data
        this._data = null;
        this.data = data;
    }

    /**
     * Frees the GPU textures owned by the font and removes them from the resource loader cache.
     * Called automatically when the owning font asset is unloaded (see {@link Asset#unload}).
     */
    destroy() {
        const textures = this.textures;
        if (textures) {
            for (let i = 0; i < textures.length; i++) {
                const texture = textures[i];

                // font textures are loaded directly through the resource loader (keyed by their
                // url, which is stored as the texture name), so remove the cache entry to avoid
                // handing back a destroyed texture on a subsequent load
                this._loader?.clearCache(texture.name, 'texture');
                texture.destroy();
            }
            this.textures = null;
        }

        this._loader = null;
        this._data = null;
    }

    set data(value) {
        this._data = value;
        if (!value) {
            return;
        }

        if (this._data.intensity !== undefined) {
            this.intensity = this._data.intensity;
        }

        if (!this._data.info) {
            this._data.info = {};
        }

        // check if we need to migrate to version 2
        if (!this._data.version || this._data.version < 2) {
            this._data.info.maps = [{
                width: this._data.info.width,
                height: this._data.info.height
            }];

            if (this._data.chars) {
                for (const key in this._data.chars) {
                    this._data.chars[key].map = 0;
                }
            }
        }
    }

    get data() {
        return this._data;
    }
}

export { Font };
