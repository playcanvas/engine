import { http, Http } from '../net/http.js';

import { AnimCurve } from '../anim/evaluator/anim-curve.js';
import { AnimData } from '../anim/evaluator/anim-data.js';
import { AnimTrack } from '../anim/evaluator/anim-track.js';

/**
 * @private
 * @class
 * @name AnimClipHandler
 * @implements {pc.ResourceHandler}
 * @classdesc Resource handler used for loading {@link pc.AnimClip} resources.
 */
class AnimClipHandler {
    constructor() {
        this.maxRetries = 0;
    }

    load(url, callback) {
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
    }

    open(url, data) {
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
}

export { AnimClipHandler };
