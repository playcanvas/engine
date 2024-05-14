import { string } from '../../core/string.js';
import { EventHandler } from '../../core/event-handler.js';

import { Color } from '../../core/math/color.js';

import {
    ADDRESS_CLAMP_TO_EDGE,
    FILTER_LINEAR, FILTER_LINEAR_MIPMAP_LINEAR,
    PIXELFORMAT_RGBA8
} from '../../platform/graphics/constants.js';
import { Texture } from '../../platform/graphics/texture.js';

const MAX_TEXTURE_SIZE = 4096;
const DEFAULT_TEXTURE_SIZE = 512;

class Atlas {
    constructor(device, width, height, name) {
        this.canvas = document.createElement('canvas');
        this.canvas.width = width;
        this.canvas.height = height;

        this.texture = new Texture(device, {
            name: name,
            format: PIXELFORMAT_RGBA8,
            width: width,
            height: height,
            mipmaps: true,
            minFilter: FILTER_LINEAR_MIPMAP_LINEAR,
            magFilter: FILTER_LINEAR,
            addressU: ADDRESS_CLAMP_TO_EDGE,
            addressV: ADDRESS_CLAMP_TO_EDGE,
            levels: [this.canvas]
        });

        this.ctx = this.canvas.getContext('2d', {
            alpha: true
        });
    }

    destroy() {
        this.texture.destroy();
    }

    clear(clearColor) {
        const { width, height } = this.canvas;

        // clear to black first to remove everything as clear color is transparent
        this.ctx.clearRect(0, 0, width, height);

        // clear to color
        this.ctx.fillStyle = clearColor;
        this.ctx.fillRect(0, 0, width, height);
    }
}

/**
 * Represents the resource of a canvas font asset.
 *
 * @ignore
 */
class CanvasFont extends EventHandler {
    /**
     * Create a new CanvasFont instance.
     *
     * @param {import('../app-base.js').AppBase} app - The application.
     * @param {object} options - The font options.
     * @param {string} [options.fontName] - The name of the font. CSS font names are supported.
     * Defaults to 'Arial'.
     * @param {string} [options.fontWeight] - The weight of the font, e.g. 'normal', 'bold'.
     * Defaults to 'normal'.
     * @param {number} [options.fontSize] - The font size in pixels. Defaults to 32.
     * @param {Color} [options.color] - The font color.Defaults to white.
     * @param {number} [options.width] - The width of each texture atlas. Defaults to 512.
     * @param {number} [options.height] - The height of each texture atlas. Defaults to 512.
     * @param {number} [options.padding] - Amount of glyph padding in pixels that is added to each
     * glyph in the atlas. Defaults to 0.
     */
    constructor(app, options = {}) {
        super();

        this.type = 'bitmap';

        this.app = app;

        this.intensity = 0;

        this.fontWeight = options.fontWeight || 'normal';
        this.fontSize = parseInt(options.fontSize, 10);
        this.glyphSize = this.fontSize;
        this.fontName = options.fontName || 'Arial';
        this.color = options.color || new Color(1, 1, 1);
        this.padding = options.padding || 0;

        this.width = Math.min(MAX_TEXTURE_SIZE, options.width || DEFAULT_TEXTURE_SIZE);
        this.height = Math.min(MAX_TEXTURE_SIZE, options.height || DEFAULT_TEXTURE_SIZE);
        this.atlases = [];

        this.chars = '';
        this.data = {};
    }

    /**
     * Render the necessary textures for all characters in a string to be used for the canvas font.
     *
     * @param {string} text - The list of characters to render into the texture atlas.
     */
    createTextures(text) {
        const _chars = this._normalizeCharsSet(text);

        // different length so definitely update
        if (_chars.length !== this.chars.length) {
            this._renderAtlas(_chars);
            return;
        }

        // compare sorted characters for difference
        for (let i = 0; i < _chars.length; i++) {
            if (_chars[i] !== this.chars[i]) {
                this._renderAtlas(_chars);
                return;
            }
        }
    }

    /**
     * Update the list of characters to include in the atlas to include those provided and
     * re-render the texture atlas to include all the characters that have been supplied so far.
     *
     * @param {string} text - The list of characters to add to the texture atlas.
     */
    updateTextures(text) {
        const _chars = this._normalizeCharsSet(text);
        const newCharsSet = [];

        for (let i = 0; i < _chars.length; i++) {
            const char = _chars[i];
            if (!this.data.chars[char]) {
                newCharsSet.push(char);
            }
        }

        if (newCharsSet.length > 0) {
            this._renderAtlas(this.chars.concat(newCharsSet));
        }
    }

    /**
     * Destroys the font. This also destroys the textures owned by the font.
     */
    destroy() {
        this.atlases.forEach(atlas => atlas.destroy());

        // null instance variables to make it obvious this font is no longer valid
        this.chars = null;
        this.color = null;
        this.data = null;
        this.fontName = null;
        this.fontSize = null;
        this.glyphSize = null;
        this.intensity = null;
        this.atlases = null;
        this.type = null;
        this.fontWeight = null;
    }

    /**
     * @param {Color} color - The color to covert.
     * @param {boolean} alpha - Whether to include the alpha channel.
     * @returns {string} The hex string for the color.
     * @private
     */
    _colorToRgbString(color, alpha) {
        let str;
        const r = Math.round(255 * color.r);
        const g = Math.round(255 * color.g);
        const b = Math.round(255 * color.b);

        if (alpha) {
            str = `rgba(${r}, ${g}, ${b}, ${color.a})`;
        } else {
            str = `rgb(${r}, ${g}, ${b})`;
        }

        return str;
    }

    /**
     * @param {CanvasRenderingContext2D} context - The canvas 2D context.
     * @param {string} char - The character to render.
     * @param {number} x - The x position to render the character at.
     * @param {number} y - The y position to render the character at.
     * @param {string} color - The color to render the character in.
     * @ignore
     */
    renderCharacter(context, char, x, y, color) {
        context.fillStyle = color;
        context.fillText(char, x, y);
    }

    /**
     * Return the atlas at the specified index.
     *
     * @param {number} index - The atlas index
     * @private
     */
    _getAtlas(index) {
        if (index >= this.atlases.length) {
            this.atlases[index] = new Atlas(this.app.graphicsDevice, this.width, this.height, `font-atlas-${this.fontName}-${index}`);
        }
        return this.atlases[index];
    }

    /**
     * Renders an array of characters into one or more textures atlases.
     *
     * @param {string[]} charsArray - The list of characters to render.
     * @private
     */
    _renderAtlas(charsArray) {
        this.chars = charsArray;

        const w = this.width;
        const h = this.height;

        // fill color
        const color = this._colorToRgbString(this.color, false);

        // generate a "transparent" color for the background
        // browsers seem to optimize away all color data if alpha=0
        // so setting alpha to min value and hope this isn't noticeable
        const a = this.color.a;
        this.color.a = 1 / 255;
        const transparent = this._colorToRgbString(this.color, true);
        this.color.a = a;

        const TEXT_ALIGN = 'center';
        const TEXT_BASELINE = 'alphabetic';

        let atlasIndex = 0;
        let atlas = this._getAtlas(atlasIndex++);
        atlas.clear(transparent);

        this.data = this._createJson(this.chars, this.fontName, w, h);

        const symbols = string.getSymbols(this.chars.join(''));

        let maxHeight = 0;
        let maxDescent = 0;
        const metrics = {};
        for (let i = 0; i < symbols.length; i++) {
            const ch = symbols[i];
            metrics[ch] = this._getTextMetrics(ch);
            maxHeight = Math.max(maxHeight, metrics[ch].height);
            maxDescent = Math.max(maxDescent, metrics[ch].descent);
        }

        this.glyphSize = Math.max(this.glyphSize, maxHeight);

        const sx = this.glyphSize + this.padding * 2;
        const sy = this.glyphSize + this.padding * 2;
        const _xOffset = this.glyphSize / 2 + this.padding;
        const _yOffset = sy - maxDescent - this.padding;
        let _x = 0;
        let _y = 0;

        for (let i = 0; i < symbols.length; i++) {
            const ch = symbols[i];
            const code = string.getCodePoint(symbols[i]);

            let fs = this.fontSize;
            atlas.ctx.font = this.fontWeight + ' ' + fs.toString() + 'px ' + this.fontName;
            atlas.ctx.textAlign = TEXT_ALIGN;
            atlas.ctx.textBaseline = TEXT_BASELINE;

            let width = atlas.ctx.measureText(ch).width;

            if (width > fs) {
                fs = this.fontSize * this.fontSize / width;
                atlas.ctx.font = this.fontWeight + ' ' + fs.toString() + 'px ' + this.fontName;
                width = this.fontSize;
            }

            this.renderCharacter(atlas.ctx, ch, _x + _xOffset, _y + _yOffset, color);

            const xoffset = this.padding + (this.glyphSize - width) / 2;
            const yoffset = -this.padding + metrics[ch].descent - maxDescent;
            const xadvance = width;

            this._addChar(this.data, ch, code, _x, _y, sx, sy, xoffset, yoffset, xadvance, atlasIndex - 1, w, h);

            _x += sx;
            if (_x + sx > w) {
                // Wrap to the next row of this canvas if the right edge of the next glyph would overflow
                _x = 0;
                _y += sy;
                if (_y + sy > h) {
                    // We ran out of space on this texture!
                    atlas = this._getAtlas(atlasIndex++);
                    atlas.clear(transparent);
                    _y = 0;
                }
            }
        }

        // remove any unused characters
        this.atlases.splice(atlasIndex).forEach(atlas => atlas.destroy());

        // upload textures
        this.atlases.forEach(atlas => atlas.texture.upload());

        // alert text-elements that the font has been re-rendered
        this.fire('render');
    }

    /**
     * @param {string[]} chars - A list of characters.
     * @param {string} fontName - The font name.
     * @param {number} width - The width of the texture atlas.
     * @param {number} height - The height of the texture atlas.
     * @returns {object} The font JSON object.
     * @private
     */
    _createJson(chars, fontName, width, height) {
        const base = {
            'version': 3,
            'intensity': this.intensity,
            'info': {
                'face': fontName,
                'width': width,
                'height': height,
                'maps': [{
                    'width': width,
                    'height': height
                }]
            },
            'chars': {}
        };

        return base;
    }

    /**
     * @param {object} json - Font data.
     * @param {string} char - The character to add.
     * @param {number} charCode - The code point number of the character to add.
     * @param {number} x - The x position of the character.
     * @param {number} y - The y position of the character.
     * @param {number} w - The width of the character.
     * @param {number} h - The height of the character.
     * @param {number} xoffset - The x offset of the character.
     * @param {number} yoffset - The y offset of the character.
     * @param {number} xadvance - The x advance of the character.
     * @param {number} mapNum - The map number of the character.
     * @param {number} mapW - The width of the map.
     * @param {number} mapH - The height of the map.
     * @private
     */
    _addChar(json, char, charCode, x, y, w, h, xoffset, yoffset, xadvance, mapNum, mapW, mapH) {
        if (json.info.maps.length < mapNum + 1) {
            json.info.maps.push({ 'width': mapW, 'height': mapH });
        }

        const scale = this.fontSize / 32;

        json.chars[char] = {
            'id': charCode,
            'letter': char,
            'x': x,
            'y': y,
            'width': w,
            'height': h,
            'xadvance': xadvance / scale,
            'xoffset': xoffset / scale,
            'yoffset': (yoffset + this.padding) / scale,
            'scale': scale,
            'range': 1,
            'map': mapNum,
            'bounds': [0, 0, w / scale, h / scale]
        };
    }

    /**
     * Take a unicode string and produce the set of characters used to create that string.
     * e.g. "abcabcabc" -> ['a', 'b', 'c']
     *
     * @param {string} text - The unicode string to process.
     * @returns {string[]} The set of characters used to create the string.
     * @private
     */
    _normalizeCharsSet(text) {
        // normalize unicode if needed
        const unicodeConverterFunc = this.app.systems.element.getUnicodeConverter();
        if (unicodeConverterFunc) {
            text = unicodeConverterFunc(text);
        }
        // strip duplicates
        const set = {};
        const symbols = string.getSymbols(text);
        for (let i = 0; i < symbols.length; i++) {
            const ch = symbols[i];
            if (set[ch]) continue;
            set[ch] = ch;
        }
        const chars = Object.keys(set);
        // sort
        return chars.sort();
    }

    /**
     * Calculate some metrics that aren't available via the browser API, notably character height
     * and descent size.
     *
     * @param {string} text - The text to measure.
     * @returns {{ascent: number, descent: number, height: number}} The metrics of the text.
     * @private
     */
    _getTextMetrics(text) {
        const textSpan = document.createElement('span');
        textSpan.id = 'content-span';
        textSpan.innerHTML = text;

        const block = document.createElement('div');
        block.id = 'content-block';
        block.style.display = 'inline-block';
        block.style.width = '1px';
        block.style.height = '0px';

        const div = document.createElement('div');
        div.appendChild(textSpan);
        div.appendChild(block);
        div.style.font = this.fontSize + 'px ' + this.fontName;

        const body = document.body;
        body.appendChild(div);

        let ascent = -1;
        let descent = -1;
        let height = -1;

        try {
            block.style['vertical-align'] = 'baseline';
            ascent = block.offsetTop - textSpan.offsetTop;
            block.style['vertical-align'] = 'bottom';
            height = block.offsetTop - textSpan.offsetTop;
            descent = height - ascent;
        } finally {
            document.body.removeChild(div);
        }

        return {
            ascent: ascent,
            descent: descent,
            height: height
        };
    }

    // nasty, other systems are accessing textures directly
    get textures() {
        return this.atlases.map(atlas => atlas.texture);
    }
}

export { CanvasFont };
