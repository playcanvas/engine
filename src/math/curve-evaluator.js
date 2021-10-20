import { CURVE_CARDINAL, CURVE_CATMULL, CURVE_LINEAR, CURVE_SMOOTHSTEP, CURVE_SPLINE, CURVE_STEP } from './constants.js';
import { math } from './math.js';

class CurveEvaluator {
    constructor(curve, time = 0) {
        this._curve = curve;
        this._left = -Infinity;
        this._right = Infinity;
        this._recip = 0;
        this._p0 = 0;
        this._p1 = 0;
        this._m0 = 0;
        this._m1 = 0;
        this._reset(time);
    }

    // Evaluate the curve at the given time. Specify forceReset if the
    // underlying curve keys have changed since the last evaluation.
    evaluate(time, forceReset) {
        if (forceReset || time < this._left || time >= this._right) {
            this._reset(time);
        }

        let result;

        const type = this._curve.type;
        if (type === CURVE_STEP) {
            // step
            result = this._p0;
        } else {
            // calculate normalized t
            const t = (this._recip === 0) ? 0 : (time - this._left) * this._recip;

            if (type === CURVE_LINEAR) {
                // linear
                result = math.lerp(this._p0, this._p1, t);
            } else if (type === CURVE_SMOOTHSTEP) {
                // smoothstep
                result = math.lerp(this._p0, this._p1, t * t * (3 - 2 * t));
            } else {
                // curve
                result = this._evaluateHermite(this._p0, this._p1, this._m0, this._m1, t);
            }
        }
        return result;
    }

    // Calculate weights for the curve interval at the given time
    _reset(time) {
        const keys = this._curve.keys;
        const len = keys.length;

        if (!len) {
            // curve is empty
            this._left = -Infinity;
            this._right = Infinity;
            this._recip = 0;
            this._p0 = this._p1 = this._m0 = this._m1 = 0;
        } else {
            if (time < keys[0][0]) {
                // iterator falls to the left of the start of the curve
                this._left = -Infinity;
                this._right = keys[0][0];
                this._recip = 0;
                this._p0 = this._p1 = keys[0][1];
                this._m0 = this._m1 = 0;
            } else if (time >= keys[len - 1][0]) {
                // iterator falls to the right of the end of the curve
                this._left = keys[len - 1][0];
                this._right = Infinity;
                this._recip = 0;
                this._p0 = this._p1 = keys[len - 1][1];
                this._m0 = this._m1 = 0;
            } else {
                // iterator falls within the bounds of the curve
                // perform a linear search for the key just left of the current time.
                // (TODO: for cases where the curve has more than 'n' keys it will
                // be more efficient to perform a binary search here instead. Which is
                // straight forward thanks to the sorted list of knots).
                let index = 0;
                while (time >= keys[index + 1][0]) {
                    index++;
                }
                this._left = keys[index][0];
                this._right = keys[index + 1][0];
                const diff = 1.0 / (this._right - this._left);
                this._recip = (isFinite(diff) ? diff : 0);
                this._p0 = keys[index][1];
                this._p1 = keys[index + 1][1];
                if (this._isHermite()) {
                    this._calcTangents(keys, index);
                }
            }
        }
    }

    // returns true if the curve is a hermite and false otherwise
    _isHermite() {
        return this._curve.type === CURVE_CATMULL ||
               this._curve.type === CURVE_CARDINAL ||
               this._curve.type === CURVE_SPLINE;
    }

    // calculate tangents for the hermite curve
    _calcTangents(keys, index) {
        let a;
        const b = keys[index];
        const c = keys[index + 1];
        let d;

        if (index === 0) {
            a = [keys[0][0] + (keys[0][0] - keys[1][0]),
                keys[0][1] + (keys[0][1] - keys[1][1])];
        } else {
            a = keys[index - 1];
        }

        if (index === keys.length - 2) {
            d = [keys[index + 1][0] + (keys[index + 1][0] - keys[index][0]),
                keys[index + 1][1] + (keys[index + 1][1] - keys[index][1])];
        } else {
            d = keys[index + 2];
        }

        if (this._curve.type === CURVE_SPLINE) {
            // calculate tangent scale (due to non-uniform knot spacing)
            const s1_ = 2 * (c[0] - b[0]) / (c[0] - a[0]);
            const s2_ = 2 * (c[0] - b[0]) / (d[0] - b[0]);

            this._m0 = this._curve.tension * (isFinite(s1_) ? s1_ : 0) * (c[1] - a[1]);
            this._m1 = this._curve.tension * (isFinite(s2_) ? s2_ : 0) * (d[1] - b[1]);
        } else {
            // original tangent scale calc
            const s1 = (c[0] - b[0]) / (b[0] - a[0]);
            const s2 = (c[0] - b[0]) / (d[0] - c[0]);

            const a_ = b[1] + (a[1] - b[1]) * (isFinite(s1) ? s1 : 0);
            const d_ = c[1] + (d[1] - c[1]) * (isFinite(s2) ? s2 : 0);

            const tension = (this._curve.type === CURVE_CATMULL) ? 0.5 : this._curve.tension;

            this._m0 = tension * (c[1] - a_);
            this._m1 = tension * (d_ - b[1]);
        }
    }

    _evaluateHermite(p0, p1, m0, m1, t) {
        const t2 = t * t;
        const twot = t + t;
        const omt = 1 - t;
        const omt2 = omt * omt;
        return p0 * ((1 + twot) * omt2) +
               m0 * (t * omt2) +
               p1 * (t2 * (3 - twot)) +
               m1 * (t2 * (t - 1));
    }
}

export { CurveEvaluator };
