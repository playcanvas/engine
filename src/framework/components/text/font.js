pc.extend(pc, function () {
    pc.FONT_MSDF = 'msdf';

    var Font = function (texture, data) {
        this.type = pc.FONT_MSDF;

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
        }
    })

    return {
        FONT_MSDF: pc.FONT_MSDF,
        Font: Font
    }
}());
