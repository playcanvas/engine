Object.assign(pc, function () {
    'use strict';

    /**
     * @private
     * @class
     * @name pc.AnimationClipHandler
     * @implements {pc.ResourceHandler}
     * @classdesc Resource handler used for loading {@link pc.AnimationClip} resources.
     */
    var AnimationClipHandler = function () {
        this.retryRequests = false;
    };

    Object.assign(AnimationClipHandler.prototype, {
        load: function (url, callback) {
            if (typeof url === 'string') {
                url = {
                    load: url,
                    original: url
                };
            }

            // we need to specify JSON for blob URLs
            var options = {
                retry: this.retryRequests
            };

            if (url.load.startsWith('blob:')) {
                options.responseType = pc.Http.ResponseType.JSON;
            }

            pc.http.get(url.load, options, function (err, response) {
                if (err) {
                    callback(pc.string.format("Error loading animation clip resource: {0} [{1}]", url.original, err));
                } else {
                    callback(null, response);
                }
            });
        },

        open: function (url, data) {
            var name = data.name;
            var duration = data.duration;
            var inputs = data.inputs.map(function (input) {
                return new pc.AnimData(1, input);
            });
            var outputs = data.outputs.map(function (output) {
                return new pc.AnimData(output.components, output.data);
            });
            var curves = data.curves.map(function (curve) {
                return new pc.AnimCurve(
                    [curve.path],
                    curve.inputIndex,
                    curve.outputIndex,
                    curve.interpolation
                );
            });
            return new pc.AnimTrack(
                name,
                duration,
                inputs,
                outputs,
                curves
            );
        }
    });

    return {
        AnimationClipHandler: AnimationClipHandler
    };
}());
