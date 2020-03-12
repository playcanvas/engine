Object.assign(pc, function () {
    'use strict';

    var GlbModelParser = function (device) {
        this._device = device;
        this._defaultMaterial = pc.getDefaultMaterial();
    };

    Object.assign(GlbModelParser.prototype, {
        parse: function (data) {
            var glb = pc.GlbParser.parse("filename.glb", data, this._device);
            if (!glb) {
                return null;
            }
            return pc.GlbParser.createModel(glb, this._defaultMaterial);
        }
    });

    return {
        GlbModelParser: GlbModelParser
    };
}());
