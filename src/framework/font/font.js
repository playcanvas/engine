import { FONT_MSDF } from './constants.js';

/**
 * Represents the resource of a font asset.
 *
 * @category User Interface
 */
class Font {
    /**
     * Create a new Font instance.
     *
     * @param {import('../../platform/graphics/texture.js').Texture[]} textures - The font
     * textures.
     * @param {object} data - The font data.
     */
    constructor(textures, data) {
        this.type = data ? data.type || FONT_MSDF : FONT_MSDF;

        this.em = 1;

        /**
         * The font textures.
         *
         * @type {import('../../platform/graphics/texture.js').Texture[]}
         */
        this.textures = textures;

        /**
         * The font intensity.
         *
         * @type {number}
         */
        this.intensity = 0.0;

        // json data
        this._data = null;
        this.data = data;
    }

    set data(value) {
        this._data = value;
        if (!value)
            return;

        if (this._data.intensity !== undefined) {
            this.intensity = this._data.intensity;
        }

        if (!this._data.info)
            this._data.info = {};

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
