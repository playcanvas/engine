import { http, Http } from '../net/http.js';

import { AnimCurve } from '../anim/evaluator/anim-curve.js';
import { AnimData } from '../anim/evaluator/anim-data.js';
import { AnimTrack } from '../anim/evaluator/anim-track.js';

/**
 * @private
 * @class
 * @name AnimClipHandler
 * @implements {ResourceHandler}
 * @classdesc Resource handler used for loading {@link AnimClip} resources.
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
        const options = {
            retry: this.maxRetries > 0,
            maxRetries: this.maxRetries
        };

        if (url.load.startsWith('blob:')) {
            options.responseType = Http.ResponseType.JSON;
        }

        http.get(url.load, options, function (err, response) {
            if (err) {
                callback(`Error loading animation clip resource: ${url.original} [${err}]`);
            } else {
                callback(null, response);
            }
        });
    }

    open(url, data) {
        const name = data.name;
        const duration = data.duration;
        const inputs = data.inputs.map(function (input) {
            return new AnimData(1, input);
        });
        const outputs = data.outputs.map(function (output) {
            return new AnimData(output.components, output.data);
        });
        const curves = data.curves.map(function (curve) {
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
