Object.assign(pc, function () {
    var MAX_TEXTURE_SIZE = 4096;
    var DEFAULT_TEXTURE_SIZE = 2048;

    function normalizeCharsSet(text) {
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
    }

    function getRgbaStringFromColor(color) {
        var r = Math.round(color.r * 255);
        var g = Math.round(color.g * 255);
        var b = Math.round(color.b * 255);
        return 'rgba(' + r + ',' + g + ',' + b + ',' + color.a + ')';
    }

    /**
     * @private
     * @constructor
     * @name pc.CanvasFont
     * @classdesc Represents the resource of a canvas font asset.
     * @param {pc.Application} app The application
     * @param {Object} options The font options
     */
    var CanvasFont = function (app, options) {
        this.type = "bitmap";

        this.app = app;

        this.intensity = 0;

        options = options || {};
        this.weight = options.weight || 'normal';
        this.fontSize = parseInt(options.fontSize, 10) || 32;
        this.fontName = options.fontName || 'Arial';
        this.color = options.color || new pc.Color(1, 1, 1);

        this.glyphSize = options.glyphSize || this.fontSize + 4;

        var w = options.width > MAX_TEXTURE_SIZE ? MAX_TEXTURE_SIZE : (options.width || DEFAULT_TEXTURE_SIZE);
        var h = options.height > MAX_TEXTURE_SIZE ? MAX_TEXTURE_SIZE : (options.height || DEFAULT_TEXTURE_SIZE);

        // Create a canvas to do the text rendering
        var canvas = document.createElement('canvas');
        canvas.height = w;
        canvas.width = h;

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
        var _chars = normalizeCharsSet(text);

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
        var _chars = normalizeCharsSet(text);
        var newCharsSet = [];
        for (var i = 0; i < _chars.length; i++) {
            var char = _chars[i];
            var code = pc.string.getCodePoint(char);
            if (!this.data.chars[code]) {
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
        this.weight = null;
    };

    CanvasFont.prototype._renderAtlas = function (charsArray) {
        this.chars = charsArray;

        var numTextures = 1;
        var canvas = this.textures[numTextures - 1].getSource();
        var ctx = canvas.getContext('2d', {
            alpha: true
        });
        var w = ctx.canvas.width;
        var h = ctx.canvas.height;
        var color = getRgbaStringFromColor(this.color);
        var transparent = color.replace(/[\d\.]+\)$/, '0)');

        // Clear the context to transparent
        ctx.fillStyle = transparent;
        ctx.fillRect(0, 0, w, h);
        ctx.font = this.weight + ' ' + this.fontSize.toString() + 'px "' + this.fontName + '"';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';

        this.data = this._createJson(this.chars, this.fontName, w, h);

        var sx = this.glyphSize;
        var sy = this.glyphSize;
        var _x = sx / 2;
        var _y = sy;
        var i;

        var symbols = pc.string.getSymbols(this.chars.join(''));
        var prevNumTextures = this.textures.length;
        for (i = 0; i < symbols.length; i++) {
            var ch = symbols[i];
            var code = pc.string.getCodePoint(symbols[i]);
            ctx.fillStyle = color;
            // Write text
            ctx.fillText(ch, _x, _y);
            var width = ctx.measureText(ch).width;
            var xoffset = (sx - width) / 2;
            var yoffset = 0;
            var xadvance = width;

            this._addChar(this.data, ch, code, _x - (sx / 2), _y - sy, sx, sy, xoffset, yoffset, xadvance, numTextures - 1, w, h);

            _x += (sx);
            if (_x > w) {
                // Wrap to the next row of this canvas
                _x = sx / 2;
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
                        ctx = canvas.getContext('2d', {
                            alpha: true
                        });
                        // Clear the context to transparent
                        ctx.font = this.weight + ' ' + this.fontSize.toString() + 'px "' + this.fontName + '"';
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'bottom';
                        ctx.fillStyle = transparent;
                        ctx.fillRect(0, 0, w, h);
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
                        ctx = canvas.getContext('2d', {
                            alpha: true
                        });
                        ctx.fillStyle = transparent;
                        ctx.fillRect(0, 0, w, h);
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
            "version": 2,
            "intensity": 0,
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

    CanvasFont.prototype._addChar = function (json, char, charCode, x, y, w, h, xoffset, yoffset, xadvance, mapNum, mapW, mapH) {
        if (json.info.maps.length < mapNum + 1) {
            json.info.maps.push({ "width": mapW, "height": mapH });
        }
        json.chars[charCode] = {
            "id": charCode,
            "letter": char,
            "x": x,
            "y": y,
            "width": w,
            "height": h,
            "xadvance": xadvance,
            "xoffset": xoffset,
            "yoffset": yoffset,
            "scale": 1,
            "range": 1,
            "map": mapNum,
            "bounds": [0, 0, w, h]
        };
    };

    return {
        CanvasFont: CanvasFont
    };
}());
