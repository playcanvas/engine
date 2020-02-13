Object.assign(pc, function () {
    'use strict';

    var GlbAnimationsParser = function (device) {
        this._device = device;
    };

    Object.assign(GlbAnimationsParser.prototype, {
        parse: function (data, callback) {
            pc.GlbParser.parse(data, this._device, function (err, result) {
                if (err) {
                    callback(err);
                } else {
                    // this loader is only interested in animations
                    callback(null, result.animations);
                }
            });
        }
    });

    return {
        GlbAnimationsParser: GlbAnimationsParser
    };
}());
