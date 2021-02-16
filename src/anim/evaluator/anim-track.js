/**
 * @private
 * @class
 * @name AnimTrack
 * @classdesc AnimTrack contains a set of curve data which can be used to animate a set of target nodes.
 * @description Create a new animation track.
 * @param {string} name - the track name
 * @param {number} duration - the duration of the track in seconds.
 * @param {AnimData[]} inputs - list of curve key data.
 * @param {AnimData[]} outputs - list of curve value data.
 * @param {AnimCurve[]} curves - the list of curves.
 */
class AnimTrack {
    constructor(name, duration, inputs, outputs, curves) {
        this._name = name;
        this._duration = duration;
        this._inputs = inputs;
        this._outputs = outputs;
        this._curves = curves;
    }

    get name() {
        return this._name;
    }

    get duration() {
        return this._duration;
    }

    get inputs() {
        return this._inputs;
    }

    get outputs() {
        return this._outputs;
    }

    get curves() {
        return this._curves;
    }

    // evaluate all track curves at the specified time and store results
    // in the provided snapshot.
    eval(time, snapshot) {
        snapshot._time = time;

        var inputs = this._inputs;
        var outputs = this._outputs;
        var curves = this._curves;
        var cache = snapshot._cache;
        var results = snapshot._results;

        var i;

        // evaluate inputs
        for (i = 0; i < inputs.length; ++i) {
            cache[i].update(time, inputs[i]._data);
        }

        // evalute outputs
        for (i = 0; i < curves.length; ++i) {
            var curve = curves[i];
            var output = outputs[curve._output];
            var result = results[i];
            cache[curve._input].eval(result, curve._interpolation, output);
        }
    }
}

export { AnimTrack };
