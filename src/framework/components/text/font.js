pc.extend(pc, function () {
    pc.FONT_MSDF = 'msdf';

    /**
    * @name pc.Font
    * @class Represents the resource of a font asset.
    * @param {pc.Texture} texture The font texture
    * @param {Object} data The font data
    * @property {Number} intensity The font intensity
    */
    var Font = function (texture, data) {
        this.type = pc.FONT_MSDF;

        this.em = 1;

        // atlas texture
        this.texture = texture;

        // intensity
        this.intensity = 0.0;

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
            if (this._data && this._data.intensity !== undefined) {
                this.intensity = this._data.intensity;
            }
        }
    });

    return {
        FONT_MSDF: pc.FONT_MSDF,
        Font: Font
    };
}());
