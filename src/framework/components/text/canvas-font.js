Object.assign(pc, function () {
    var MAX_TEXTURE_SIZE = 4096;
    var DEFAULT_TEXTURE_SIZE = 2048;

    /**
     * @private
     * @constructor
     * @name pc.CanvasFont
     * @classdesc Represents the resource of a canvas font asset.
     * @param {pc.Application} app The application
     * @param {Object} options The font options
     * @param {String} [options.fontName] The name of the font, use in the same manner as a CSS font
     * @param {String} [options.fontWeight] The weight of the font, e.g. 'normal', 'bold', defaults to "normal"
     * @param {Number} [options.fontSize] The size the font will be rendered into to the texture atlas at, defaults to 32
     * @param {pc.Color} [options.color] The color the font will be rendered into the texture atlas as, defaults to white
     * @param {Number} [options.width] The width of each texture atlas, defaults to 2048
     * @param {Number} [options.height] The height of each texture atlas, defaults to 2048
     * @param {Number} [options.getCharScale] A custom function which takes a codepoint and return scale value 0-1 to scale char down before rendering into atlas. Return -1 to use default scale value.
     */
    var CanvasFont = function (app, options) {
        this.type = "bitmap";

        this.app = app;

        this.intensity = 0;

        options = options || {};
        this.fontWeight = options.fontWeight || 'normal';
        this.fontSize = parseInt(options.fontSize, 10);
        this.glyphSize = this.fontSize;
        this.fontName = options.fontName || 'Arial';
        this.color = options.color || new pc.Color(1, 1, 1);

        this._customGetCharScale = options.getCharScale || null;

        var w = options.width > MAX_TEXTURE_SIZE ? MAX_TEXTURE_SIZE : (options.width || DEFAULT_TEXTURE_SIZE);
        var h = options.height > MAX_TEXTURE_SIZE ? MAX_TEXTURE_SIZE : (options.height || DEFAULT_TEXTURE_SIZE);

        // Create a canvas to do the text rendering
        var canvas = document.createElement('canvas');
        canvas.height = h;
        canvas.width = w;

        var texture = new pc.Texture(this.app.graphicsDevice, {
            format: pc.PIXELFORMAT_R8_G8_B8_A8,
            autoMipmap: true
        });

        texture.setSource(canvas);
        texture.minFilter = pc.FILTER_LINEAR_MIPMAP_LINEAR;
        texture.magFilter = pc.FILTER_LINEAR;
        texture.addressU = pc.ADDRESS_CLAMP_TO_EDGE;
        texture.addressV = pc.ADDRESS_CLAMP_TO_EDGE;

        this.textures = [texture];

        this.chars = "";
        this.data = {};
    };

    /**
     * @private
     * @function
     * @name pc.CanvasFont#createTextures
     * @description Render the nessecary textures for all characters in a string to be used for the canvas font
     * @param {String} text The string to look in
     */
    CanvasFont.prototype.createTextures = function (text) {
        var _chars = this._normalizeCharsSet(text);

        // different length so definitely update
        if (_chars.length !== this.chars.length) {
            this._renderAtlas(_chars);
            return;
        }

        // compare sorted characters for difference
        for (var i = 0; i < _chars.length; i++) {
            if (_chars[i] !== this.chars[i]) {
                this._renderAtlas(_chars);
                return;
            }
        }
    };

    /**
     * @private
     * @function
     * @name pc.CanvasFont#updateTextures
     * @description Ensures the existing textures include all the characters in a new string, and if not, any new
     * required textures are rendered as needed
     * @param {String} text The string to look for new characters in
     */
    CanvasFont.prototype.updateTextures = function (text) {
        var _chars = this._normalizeCharsSet(text);
        var newCharsSet = [];

        for (var i = 0; i < _chars.length; i++) {
            var char = _chars[i];
            if (!this.data.chars[char]) {
                newCharsSet.push(char);
            }
        }

        if (newCharsSet.length > 0) {
            this._renderAtlas(this.chars.concat(newCharsSet));
        }
    };

    /**
     * @private
     * @function
     * @name pc.CanvasFont#destroy
     * @description Tears down all resources used by the font
     */
    CanvasFont.prototype.destroy = function () {
        // call texture.destroy on any created textures
        for (var i = 0; i < this.textures.length; i++) {
            this.textures[i].destroy();
        }
        // null instance variables to make it obvious this font is no longer valid
        this.chars = null;
        this.color = null;
        this.data = null;
        this.fontName = null;
        this.fontSize = null;
        this.glyphSize = null;
        this.intensity = null;
        this.textures = null;
        this.type = null;
        this.fontWeight = null;
    };

    CanvasFont.prototype._getAndClearContext = function (canvas, clearColor) {
        var w = canvas.width;
        var h = canvas.height;

        var ctx = canvas.getContext('2d', {
            alpha: true
        });

        ctx.clearRect(0, 0, w, h);  // clear to black first to remove everything as clear color is transparent
        ctx.fillStyle = clearColor;
        ctx.fillRect(0, 0, w, h);   // clear to color

        return ctx;
    };

    CanvasFont.prototype._colorToRgbString = function (color, alpha) {
        var str;

        if (alpha) {
            str = pc.string.format('rgba({0}, {1}, {2}, {3})', Math.round(255 * color.r), Math.round(255 * color.g), Math.round(255 * color.b), color.a);
        } else {
            str = pc.string.format('rgb({0}, {1}, {2})', Math.round(255 * color.r), Math.round(255 * color.g), Math.round(255 * color.b));
        }

        return str;
    };

    CanvasFont.prototype._renderAtlas = function (charsArray) {
        this.chars = charsArray;

        var numTextures = 1;

        var canvas = this.textures[numTextures - 1].getSource();
        var w = canvas.width;
        var h = canvas.height;

        // fill color
        var color = this._colorToRgbString(this.color, false);

        // generate a "transparent" color for the background
        // browsers seem to optimize away all color data if alpha=0
        // so setting alpha to min value and hope this isn't noticable
        // might be able to
        var a = this.color.a;
        this.color.a = 1 / 255;
        var transparent = this._colorToRgbString(this.color, true);
        this.color.a = a;

        var TEXT_ALIGN = 'center';
        var TEXT_BASELINE = 'bottom';

        var ctx = this._getAndClearContext(canvas, transparent);

        ctx.font = this.fontWeight + ' ' + this.fontSize.toString() + 'px "' + this.fontName + '"';
        ctx.textAlign = TEXT_ALIGN;
        ctx.textBaseline = TEXT_BASELINE;

        this.data = this._createJson(this.chars, this.fontName, w, h);

        var sx = this.glyphSize;
        var sy = this.glyphSize;
        var halfWidth = sx / 2;
        var _x = halfWidth;
        var _y = sy;
        var i;

        var symbols = pc.string.getSymbols(this.chars.join(''));
        var prevNumTextures = this.textures.length;
        for (i = 0; i < symbols.length; i++) {
            var ch = symbols[i];
            var code = pc.string.getCodePoint(symbols[i]);

            var fs = this._getCharScale(code) * this.fontSize;
            ctx.font = this.fontWeight + ' ' + fs.toString() + 'px "' + this.fontName + '"';
            ctx.textAlign = TEXT_ALIGN;
            ctx.textBaseline = TEXT_BASELINE;

            ctx.fillStyle = color;
            // Write text
            ctx.fillText(ch, _x, _y);
            var width = ctx.measureText(ch).width;
            var xoffset = (sx - width) / 2;
            var yoffset = 0;
            var xadvance = width;

            this._addChar(this.data, ch, code, _x - halfWidth, _y - sy, sx, sy, xoffset, yoffset, xadvance, numTextures - 1, w, h);

            _x += sx;
            if (_x + halfWidth > w) {
                // Wrap to the next row of this canvas if the right edge of the next glyph would overflow
                _x = halfWidth;
                _y += sy;
                if (_y > h) {
                    // We ran out of space on this texture!
                    // Copy the canvas into the texture and upload it
                    this.textures[numTextures - 1].upload();
                    // Create a new texture (if needed) and continue on
                    numTextures++;
                    _y = sy;
                    if (numTextures > prevNumTextures) {
                        canvas = document.createElement('canvas');
                        canvas.height = h;
                        canvas.width = w;

                        ctx = this._getAndClearContext(canvas, transparent);

                        var texture = new pc.Texture(this.app.graphicsDevice, {
                            format: pc.PIXELFORMAT_R8_G8_B8_A8,
                            autoMipmap: true
                        });
                        texture.setSource(canvas);
                        texture.minFilter = pc.FILTER_LINEAR_MIPMAP_LINEAR;
                        texture.magFilter = pc.FILTER_LINEAR;
                        texture.addressU = pc.ADDRESS_CLAMP_TO_EDGE;
                        texture.addressV = pc.ADDRESS_CLAMP_TO_EDGE;
                        this.textures.push(texture);
                    } else {
                        canvas = this.textures[numTextures - 1].getSource();
                        ctx = this._getAndClearContext(canvas, transparent);
                    }
                }
            }
        }
        // Copy any remaining characters in the canvas into the last texture and upload it
        this.textures[numTextures - 1].upload();

        // Cleanup any remaining (unused) textures
        if (numTextures < prevNumTextures) {
            for (i = numTextures; i < prevNumTextures; i++) {
                this.textures[i].destroy();
            }
            this.textures.splice(numTextures);
        }
    };

    CanvasFont.prototype._createJson = function (chars, fontName, width, height) {
        var base = {
            "version": 3,
            "intensity": this.intensity,
            "info": {
                "face": fontName,
                "width": width,
                "height": height,
                "maps": [{
                    "width": width,
                    "height": height
                }]
            },
            "chars": {}
        };

        return base;
    };

    // Most characters are rendered at the same pixel size as specified
    // Some very tall characters will render outside of the box, for these
    // we scale them down when rendering and character data in the font
    // is set so that they are scaled up again when rendered in the quad
    //
    // This default implementation checks for capital letters with accents
    // and emoji-style unicode characters which are usually render too tall
    //
    // If we required we can allow a user-custom function here that users can
    // supply special cases for their character set
    CanvasFont.prototype._getCharScale = function (code) {
        // if a custom scale function is available use it
        // custom scale function can ignore chars by return -1
        if (this._customGetCharScale) {
            var scale = this._customGetCharScale(code);
            if (scale >= 0) {
                return scale;
            }
        }

        if (code >= 0x00C0 && code <= 0x00DD) {
            // capital letters with accents
            return 0.875;
        } else if (code >= 0x1f000 && code <= 0x1F9FF) {
            // "emoji" misc. images and emoticon range of unicode
            return 0.8;
        } else if (code >= 0x2600 && code <= 0x26FF) {
            // 'miscelaneous symbols'
            return 0.8;
        } else if (code >= 0x2700 && code <= 0x27BF) {
            // 'dingbats'
            return 0.8;
        } else if (code === 0x27A1 || (code >= 0x2B00 && code <= 0x2B0F)) {
            // arrows
            return 0.8;
        }

        return 1.0;
    };

    CanvasFont.prototype._addChar = function (json, char, charCode, x, y, w, h, xoffset, yoffset, xadvance, mapNum, mapW, mapH) {
        if (json.info.maps.length < mapNum + 1) {
            json.info.maps.push({ "width": mapW, "height": mapH });
        }

        var scale = this._getCharScale(charCode) * this.fontSize / 32;

        json.chars[char] = {
            "id": charCode,
            "letter": char,
            "x": x,
            "y": y,
            "width": w,
            "height": h,
            "xadvance": xadvance / scale,
            "xoffset": xoffset / scale,
            "yoffset": yoffset / scale,
            "scale": scale,
            "range": 1,
            "map": mapNum,
            "bounds": [0, 0, w / scale, h / scale]
        };
    };


    // take a unicode string and produce
    // the set of characters used to create that string
    // e.g. "abcabcabc" -> ['a', 'b', 'c']
    CanvasFont.prototype._normalizeCharsSet = function (text) {
        // normalize unicode if needed
        var unicodeConverterFunc = this.app.systems.element.getUnicodeConverter();
        if (unicodeConverterFunc) {
            text = unicodeConverterFunc(text);
        }
        // strip duplicates
        var set = {};
        var symbols = pc.string.getSymbols(text);
        var i;
        for (i = 0; i < symbols.length; i++) {
            var ch = symbols[i];
            if (set[ch]) continue;
            set[ch] = ch;
        }
        var chars = Object.keys(set);
        // sort
        return chars.sort();
    };

    return {
        CanvasFont: CanvasFont
    };
}());
