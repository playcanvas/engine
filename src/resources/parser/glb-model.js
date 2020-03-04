Object.assign(pc, function () {
    'use strict';

    var GlbModelParser = function (device) {
        this._device = device;
        this._defaultMaterial = pc.getDefaultMaterial();
    };

    Object.assign(GlbModelParser.prototype, {
        parseAsync: function (data, callback) {
            var self = this;
            pc.GlbParser.parse(data, this._device, function (err, result) {
                if (err) {
                    callback(err);
                } else {
                    // construct model
                    callback(null, pc.GlbParser.createModel(result, self._defaultMaterial));
                }
            });
        }
    });

    return {
        GlbModelParser: GlbModelParser
    };
}());
