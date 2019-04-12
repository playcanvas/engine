Object.assign(pc, (function () {
    'use strict';

    /**
     *
     * @constructor
     * @name pc.CurveIterator
     * @classdesc CurveIterator performs fast evaluation of a curve by caching
     * knot information where possible.
     * @description Creates a new curve iterator.
     * @param {Curve} curve The curve to iterator over
     * @param {Number} time The time to start iteration, defaults to 0.
     */
    var CurveIterator = function (curve, time) {
        this.curve = curve;
        this.time_ = time || 0;
        this.left = -Infinity;
        this.right = Infinity;
        this.recip = 0;
        this.p0 = 0;
        this.p1 = 0;
        this.m0 = 0;
        this.m1 = 0;

        this.reset(this.time_);
    };

    Object.assign(CurveIterator.prototype, {
        /**
         * @function
         * @name pc.CurveIterator#reset
         * @description Reset the iterator to the specified time
         * @param {Number} time The new time for the iterator
         */
        reset: function (time) {
            var keys = this.curve.keys;
            var len = keys.length;

            this.time_ = time;
            if (!len) {
                this.left = -Infinity;
                this.right = Infinity;
                this.recip = 0;
                this.p0 = this.p1 = this.m0 = this.m1 = 0;
            } else {
                if (this.time_ < keys[0][0]) {
                    this.left = -Infinity;
                    this.right = keys[0][0];
                    this.recip = 0;
                    this.p0 = this.p1 = keys[0][1];
                    this.m0 = this.m1 = 0;
                } else if (this.time_ >= keys[len - 1][0]) {
                    this.left = keys[len - 1][0];
                    this.right = Infinity;
                    this.recip = 0;
                    this.p0 = this.p1 = keys[len - 1][1];
                    this.m0 = this.m1 = 0;
                } else {
                    // linear search for the left most key (TODO: for cases with more than
                    // 'n' keys it will be quicker to perform a binary search instead).
                    index = 0;
                    while (this.time_ > keys[index + 1][0]) {
                        index++;
                    }
                    this.left = keys[index][0];
                    this.right = keys[index + 1][0];
                    this.recip = 1.0 / (this.right - this.left);
                    this.p0 = keys[index][1];
                    this.p1 = keys[index + 1][1];
                    if (this._isCurve()) {
                        this._calcTangents(keys, index);
                    }
                }
            }
        },

        _isCurve: function () {
            return [pc.CURVE_CATMULL,
                pc.CURVE_CARDINAL,
                pc.CURVE_CARDINAL_STABLE].indexOf(this.curve.type) != -1;
        },

        _calcTangents: function (keys, index) {
            var a;
            var b = keys[index];
            var c = keys[index + 1];
            var d;

            if (index === 0) {
                a = [keys[0][0] + (keys[0][0] - keys[1][0]),
                    keys[0][1] + (keys[0][1] - keys[1][1])];
            } else {
                a = keys[index - 1];
            }

            if (index == keys.length - 2) {
                d = [keys[index + 1][0] + (keys[index + 1][0] - keys[index][0]),
                    keys[index + 1][1] + (keys[index + 1][1] - keys[index][1])];
            } else {
                d = keys[index + 2];
            }

            // tension
            var tension = this.curve.tension;

            if (this.curve.type === pc.CURVE_CARDINAL_STABLE) {
                // scale (due to non-uniform knot spacing)
                var s1_ = 2 * (c[0] - b[0]) / (c[0] - a[0]);
                var s2_ = 2 * (c[0] - b[0]) / (d[0] - b[0]);

                this.m0 = tension * s1_ * (c[1] - a[1]);
                this.m1 = tension * s2_ * (d[1] - b[1]);
            } else {
                if (this.curve.type === pc.CURVE_CATMULL) {
                    tension = 0.5;
                }

                // original cardinal tangent calc
                var s1 = (c[0] - b[0]) / (b[0] - a[0]);
                var s2 = (c[0] - b[0]) / (d[0] - c[0]);

                var a_ = b[1] + (a[1] - b[1]) * s1;
                var d_ = c[1] + (d[1] - c[1]) * s2;

                this.m0 = tension * (c[1] - a_);
                this.m1 = tension * (d_ - b[1]);
            }
        },

        /**
         * @function
         * @name pc.CurveIterator#time
         * @description Get the current iterator time
         * @returns {Number} The current time.
         */
        time: function () {
            return this.time_;
        },

        /**
         * @function
         * @name pc.CurveIterator#evaluate
         * @description Evaluate the curve at the current time
         * @returns {Number} The curve value at the current time
         */
        evaluate: function () {
            var curve = this.curve;

            var result;
            if (curve.type === pc.CURVE_STEP) {
                // step
                result = this.p0;
            } else {
                // calculate normalized t
                var t = 0;
                if (this.recip !== 0) {
                    t = (this.time_ - this.left) * this.recip;
                }

                if (curve.type === pc.CURVE_LINEAR) {
                    // linear
                    result = pc.math.lerp(this.p0, this.p1, t);
                } else if (curve.type === pc.CURVE_SMOOTHSTEP) {
                    // smoothstep
                    result = pc.math.lerp(this.p0, this.p1, t * t * (3 - 2 * t));
                } else {
                    // curve
                    result = curve._interpolateHermite(this.p0, this.p1, this.m0, this.m1, t);
                }
            }
            return result;
        },

        /**
         * @function
         * @name pc.CurveIterator#advance
         * @description Advance the iterator by the passed in amount
         * @param {Number} amount The amount of time to advance the iterator
         */
        advance: function (amount) {
            this.time_ += amount;

            if (amount >= 0) {
                if (this.time_ > this.right) {
                    this.reset(this.time_);
                }
            } else if (this.time_ < this.left) {
                this.reset(this.time_);
            }
        },

        /**
         * @function
         * @name pc.CurveIterator.value
         * @description Evaluate the curve at the given time
         * @param {Number} time The time to evaluate
         * @returns {Number} The curve value at the given time
         */
        value: function (time) {
            if (time < this.left || time > this.right) {
                this.reset(time);
            } else {
                this.time_ = time;
            }
            return this.evaluate();
        }
    });

    var DummyIterator = function (curve, time) {
        this.curve = curve;
        this.time_ = time || 0;
    };

    Object.assign(DummyIterator.prototype, {
        reset: function (time) {
            this.time_ = time;
        },
        time: function () {
            return this.time_;
        },
        evaluate: function () {
            return this.curve.value(this.time_);
        },
        advance: function (amount) {
            this.time_ += amount;
        },
        value: function (time) {
            this.reset(time);
            return this.evaluate();
        }
    });

    return {
        CurveIterator: CurveIterator,
        DummyIterator: DummyIterator
    };
}()));
