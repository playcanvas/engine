Object.assign(pc, function () {
    var MAX_TEXTURE_SIZE = 4096;
    var DEFAULT_TEXTURE_SIZE = 512;

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
     * @param {Number} [options.width] The width of each texture atlas, defaults to 512
     * @param {Number} [options.height] The height of each texture atlas, defaults to 512
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

        texture.name = 'font';
        texture.setSource(canvas);
        texture.minFilter = pc.FILTER_LINEAR_MIPMAP_LINEAR;
        texture.magFilter = pc.FILTER_LINEAR;
        texture.addressU = pc.ADDRESS_CLAMP_TO_EDGE;
        texture.addressV = pc.ADDRESS_CLAMP_TO_EDGE;

        this.textures = [texture];

        this.chars = "";
        this.data = {};

        pc.events.attach(this);
    };

    /**
     * @private
     * @function
     * @name pc.CanvasFont#createTextures
     * @description Render the necessary textures for all characters in a string to be used for the canvas font
     * @param {String} text The list of characters to render into the texture atlas
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
     * @description Update the list of characters to include in the atlas to include those provided and re-render the texture atlas
     * to include all the characters that have been supplied so far.
     * @param {String} text The list of characters to add to the texture atlas
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
        var r = Math.round(255 * color.r);
        var g = Math.round(255 * color.g);
        var b = Math.round(255 * color.b);

        if (alpha) {
            str = "rgba(" + r + ", " + g + ", " + b + ", " + color.a + ")";
        } else {
            str = "rgb(" + r + ", " + g + ", " + b + ")";
        }

        return str;
    };

    CanvasFont.prototype.renderCharacter = function (context, char, x, y, color) {
        context.fillStyle = color;
        context.fillText(char, x, y);
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
        var a = this.color.a;
        this.color.a = 1 / 255;
        var transparent = this._colorToRgbString(this.color, true);
        this.color.a = a;

        var TEXT_ALIGN = 'center';
        var TEXT_BASELINE = 'bottom';

        var ctx = this._getAndClearContext(canvas, transparent);

        ctx.font = this.fontWeight + ' ' + this.fontSize.toString() + 'px ' + this.fontName;
        ctx.textAlign = TEXT_ALIGN;
        ctx.textBaseline = TEXT_BASELINE;

        this.data = this._createJson(this.chars, this.fontName, w, h);

        var symbols = pc.string.getSymbols(this.chars.join(''));
        var prevNumTextures = this.textures.length;

        var maxHeight = 0;
        var maxDescent = 0;
        var metrics = {};
        var i, ch;
        for (i = 0; i < symbols.length; i++) {
            ch = symbols[i];
            metrics[ch] = this._getTextMetrics(ch);
            maxHeight = Math.max(maxHeight, metrics[ch].height);
            maxDescent = Math.max(maxDescent, metrics[ch].descent);
        }

        this.glyphSize = Math.max(this.glyphSize, maxHeight);

        var sx = this.glyphSize;
        var sy = this.glyphSize;
        var halfWidth = sx / 2;
        var _x = halfWidth;
        var _y = sy;

        for (i = 0; i < symbols.length; i++) {
            ch = symbols[i];
            var code = pc.string.getCodePoint(symbols[i]);

            var fs = this.fontSize;
            ctx.font = this.fontWeight + ' ' + fs.toString() + 'px ' + this.fontName;
            ctx.textAlign = TEXT_ALIGN;
            ctx.textBaseline = TEXT_BASELINE;

            var width = ctx.measureText(ch).width;

            if (width > fs) {
                fs = this.fontSize * this.fontSize / width;
                ctx.font = this.fontWeight + ' ' + fs.toString() + 'px ' + this.fontName;
                width = this.fontSize;
            }

            this.renderCharacter(ctx, ch, _x, _y, color);

            var xoffset = (sx - width) / 2;
            var yoffset = metrics[ch].descent - maxDescent;
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
                        texture.name = 'font-atlas';
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

        // alert text-elements that the font has been re-rendered
        this.fire("render");
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

    CanvasFont.prototype._addChar = function (json, char, charCode, x, y, w, h, xoffset, yoffset, xadvance, mapNum, mapW, mapH) {
        if (json.info.maps.length < mapNum + 1) {
            json.info.maps.push({ "width": mapW, "height": mapH });
        }

        var scale = this.fontSize / 32;

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

    // Calculate some metrics that aren't available via the
    // browser API, notably character height and descent size
    CanvasFont.prototype._getTextMetrics = function (text) {
        var textSpan = document.createElement('span');
        textSpan.id = 'content-span';
        textSpan.innerHTML = text;

        var block = document.createElement("div");
        block.id = 'content-block';
        block.style.display = 'inline-block';
        block.style.width = '1px';
        block.style.height = '0px';

        var div = document.createElement('div');
        div.appendChild(textSpan);
        div.appendChild(block);
        div.style.font = this.fontName;
        div.style.fontSize = this.fontSize + 'px';

        var body = document.body;
        body.appendChild(div);

        var ascent = -1;
        var descent = -1;
        var height = -1;

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
    };

    return {
        CanvasFont: CanvasFont
    };
}());
