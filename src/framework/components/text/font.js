pc.extend(pc, function () {
    pc.FONT_MSDF = 'msdf';

    var Font = function (texture, data) {
        this.type = pc.FONT_MSDF;

        // this.xHeight = 0.5;
        // this.capHeight = 1;
        // this.descender = 0;
        this.em = 1;

        // atlas texture
        this.texture = texture;

        // json data
        this._data = null;
        this.data = data;

    };

    Font.prototype = {
    };

    Object.defineProperty(Font.prototype, "data", {
        get: function () {
            return this._data;
        },

        set: function (value){
            this._data = value;

            // var char = this._data.chars[80];
            // if (char) {
            //     var scale = 1 / char.scale;
            //     var y = char.yoffset / char.height;
            //     this.capHeight = scale - y;
            // }

            // char = this._data.chars[120];
            // if (char) {
            //     var scale = 1 / char.scale;
            //     var y = char.yoffset / char.height;
            //     this.xHeight = scale - y;
            // }

            // char = this._data.chars[103];
            // if (char) {
            //     var scale = 1 / char.scale;
            //     var y = char.yoffset / char.height;
            //     this.descender = ((scale - y) - this.xHeight);
            // }
        }
    })

    return {
        FONT_MSDF: pc.FONT_MSDF,
        Font: Font
    }
}());
