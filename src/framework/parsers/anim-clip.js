import { Http } from '../../platform/net/http.js';
import { AnimCurve } from '../anim/evaluator/anim-curve.js';
import { AnimData } from '../anim/evaluator/anim-data.js';
import { AnimTrack } from '../anim/evaluator/anim-track.js';

/**
 * Parser for animation clip resources. Fetches the JSON data and builds an {@link AnimTrack}.
 *
 * @ignore
 */
class AnimClipParser {
    canParse() {
        // json is the only built-in animation clip format; it acts as the catch-all, so any clip
        // asset resolves to it unless a more specific parser is registered
        return true;
    }

    load(url, callback, asset) {
        const original = typeof url === 'string' ? url : url.original;
        this.handler.fetch(url, Http.ResponseType.JSON, (err, response) => {
            if (err) {
                callback(`Error loading animation clip resource: ${original} [${err}]`);
            } else {
                callback(null, response);
            }
        }, asset);
    }

    open(url, data) {
        const name = data.name;
        const duration = data.duration;
        const inputs = data.inputs.map((input) => {
            return new AnimData(1, input);
        });
        const outputs = data.outputs.map((output) => {
            return new AnimData(output.components, output.data);
        });
        const curves = data.curves.map((curve) => {
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

export { AnimClipParser };
