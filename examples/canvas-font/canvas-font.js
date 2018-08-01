var CanvasFont = function (app, options) {
    this.type = "bitmap";

    this.intensity = 0;

    options = options || {};
    this.weight = options.weight || 'normal';
    this.fontSize = parseInt(options.fontSize, 10) || 32;
    this.fontName = options.fontName || 'Arial';
    this.color = options.color || '#FFFFFF';

    this.glyphSize = options.glyphSize || 32;

    var w = options.width || 512;
    var h = options.height || 512;

    // Create a canvas to do the text rendering
    this.canvas = document.createElement('canvas');
    this.canvas.height = w;
    this.canvas.width = h;
    this.context = this.canvas.getContext('2d', {
        alpha: true
    });

    var texture = new pc.Texture(app.graphicsDevice, {
        format: pc.PIXELFORMAT_R8_G8_B8_A8,
        autoMipmap: true
    });

    texture.setSource(this.canvas);
    texture.minFilter = pc.FILTER_LINEAR_MIPMAP_LINEAR;
    texture.magFilter = pc.FILTER_LINEAR;
    texture.addressU = pc.ADDRESS_CLAMP_TO_EDGE;
    texture.addressV = pc.ADDRESS_CLAMP_TO_EDGE;

    this.textures = [texture];

    this.chars = "";
    this.data = {};
};

CanvasFont.prototype.autoRender = function (text) {
    // strip duplicates
    var set = {};
    var symbols = pc.string.getSymbols(text);
    var i;
    for (i = 0; i < symbols.length; i++) {
        var ch = symbols[i].char;
        if (set[ch]) continue;
        set[ch] = ch;
    }
    var _chars = Object.keys(set);

    // sort
    _chars.sort();

    // compare

    // different length so definitely update
    if (_chars.length !== this.chars.length) {
        this.renderAtlas(_chars);
        return;
    }

    // compare sorted characters for difference
    for (i = 0; i < _chars.length; i++) {
        if (_chars[i] !== this.chars[i]) {
            this.renderAtlas(_chars);
            return;
        }
    }
};

CanvasFont.prototype.renderAtlas = function (charsArray) {
    this.chars = charsArray;

    var ctx = this.context;
    var w = ctx.canvas.width;
    var h = ctx.canvas.height;

    // Clear the context to black/transparent
    ctx.clearRect(0, 0, w, h);

    // Write white text
    ctx.fillStyle = this.color;
    ctx.font = this.weight + ' ' + this.fontSize.toString() + 'px "' + this.fontName + '"';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';

    this.data = this.createJson(this.chars, this.fontName, w, h);

    var sx = this.glyphSize;
    var sy = this.glyphSize;
    var _x = sx / 2;
    var _y = sy;

    var symbols = pc.string.getSymbols(this.chars.join(''));
    for (var i = 0; i < symbols.length; i++) {
        var ch = symbols[i].char;
        var code = symbols[i].code;
        ctx.fillText(ch, _x, _y);
        var width = ctx.measureText(ch).width;
        var xoffset = (sx - width) / 2;
        var yoffset = 0;
        var xadvance = width;

        this.addChar(this.data, ch, code, _x - (sx / 2), _y - sy, sx, sy, xoffset, yoffset, xadvance);

        _x += (sx);
        if (_x > w) {
            _x = sx / 2;
            _y += sy;
        }
    }

    // Copy the canvas into the texture
    this.textures[0].upload();
};

CanvasFont.prototype.createJson = function (chars, fontName, width, height) {
    var base = {
        "version" : 2,
        "intensity" : 0,
        "info" : {
            "face" : fontName,
            "width" : width,
            "height" : height,
            "maps": [{
                "width": width,
                "height": height
            }]
        },
        "chars": {
        }
    };

    return base;
};

CanvasFont.prototype.addChar = function (json, char, charCode, x, y, w, h, xoffset, yoffset, xadvance) {
    json.chars[charCode] = {
        "id" : charCode,
        "letter" : char,
        "x" : x,
        "y" : y,
        "width" : w,
        "height" : h,
        "xadvance" : xadvance,
        "xoffset" : xoffset,
        "yoffset" : yoffset,
        "scale" : 1,
        "range" : 1,
        "map": 0
    };
};
