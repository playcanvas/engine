pc.extend(pc, function () {
    pc.FONT_MSDF = 'msdf';

    var Font = function (texture, data) {
        this.type = pc.FONT_MSDF;
        // atlas texture
        this.texture = texture;
        // json data
        this.data = data;

        // pc.events.attach(this);
    };

    Font.prototype = {
    };

    return {
        FONT_MSDF: pc.FONT_MSDF,
        Font: Font
    }
}());
