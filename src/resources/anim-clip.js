import { http, Http } from '../net/http.js';

import { AnimCurve, AnimData, AnimTrack } from '../anim/anim.js';

/**
 * @private
 * @class
 * @name pc.AnimClipHandler
 * @implements {pc.ResourceHandler}
 * @classdesc Resource handler used for loading {@link pc.AnimClip} resources.
 */
function AnimClipHandler() {
    this.maxRetries = 0;
}

Object.assign(AnimClipHandler.prototype, {
    load: function (url, callback) {
        if (typeof url === 'string') {
            url = {
                load: url,
                original: url
            };
        }

        // we need to specify JSON for blob URLs
        var options = {
            retry: this.maxRetries > 0,
            maxRetries: this.maxRetries
        };

        if (url.load.startsWith('blob:')) {
            options.responseType = Http.ResponseType.JSON;
        }

        http.get(url.load, options, function (err, response) {
            if (err) {
                callback("Error loading animation clip resource: " + url.original + " [" + err + "]");
            } else {
                callback(null, response);
            }
        });
    },

    open: function (url, data) {
        var name = data.name;
        var duration = data.duration;
        var inputs = data.inputs.map(function (input) {
            return new AnimData(1, input);
        });
        var outputs = data.outputs.map(function (output) {
            return new AnimData(output.components, output.data);
        });
        var curves = data.curves.map(function (curve) {
            return new AnimCurve(
                [curve.path],
                curve.inputIndex,
                curve.outputIndex,
                curve.interpolation
            );
        });
        return new AnimTrack(
            name,
            duration,
            inputs,
            outputs,
            curves
        );
    }
});

export { AnimClipHandler };
