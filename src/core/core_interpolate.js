pc.extend(pc, (function () {

    //Get the sign of a number
    function sign(v) {
        return v ? v < 0 ? -1 : 1 : 0;
    }


    //Find the difference between two quaternions
    function diffQuat(q2, q1) {
        var a = scratchQ.copy(q1).invert();
        return a.mul(q2);//
    }

    var scratch = new pc.Vec3();
    var scratch2 = new pc.Vec3();
    var scratchQ = new pc.Quat();

    function value(start, end, t) {
        var result = start;
        if (start instanceof pc.Vec3) {
            result = scratch.copy(end).sub(start).scale(t).add(start);
        }
        else if (start instanceof pc.Quat) {
            result = scratchQ.slerp(pc.Quat.IDENTITY, diffQuat(end, start), t).mul(start);
        }
        else if (!isNaN(start)) {
            result = (+end - +start) * t + +start;
        }
        return result;
    }

    function lerp(start, end, t) {
        return value(start, end, pc.math.clamp(t, 0, 1));
    }

    function easeInOut(start, end, t) {
        return interpolate.value(start, end, pc.math.smootherstep(0, 1, t));
    }

    function easeIn(start, end, t) {
        return t < 0.5 ? easeInOut(start,end,t) : lerp(start, end, t);
    }

    function easeOut(start, end, t) {
        return t > 0.5 ? easeInOut(start, end, t) : lerp(start, end, t);
    }

    function curve(curve, start, end, t) {
        var endTime = curve.get(curve.length-1)[0];
        var c = curve.value(endTime * t);
        return value(start, end, c);
    }

    function curveSet(curveset, start, end, t) {
        var curve = curveset.get(0);
        var endTime = curve.get(curve.length - 1)[0];
        return curveset.value(endTime * t).map(function(r) {
            return value(start, end, r);
        });
    }


    /**
     * @callback
     * @name pc.interpolate~valuecb
     * @description call back containing the value of an interpolation
     * @param {pc.Vec3|pc.Quat|Number} value The current value (if you wish to store this rather than consume it straigh away, and the result is a quaternion or a vector then you should clone it)
     * @param {Number} t The current proportion of the interpolation that is complete 0..1
     */

    var interpolate = {
        /**
         * @name pc.interpolate.value
         * @function
         * @description Get a value between start and end with unconstrained t (can be > 1 or < 0)
         * @param {pc.Vec3|pc.Quat|Number} start The start point for the interpolation
         * @param {pc.Vec3|pc.Quat|Number}end The end point for the interpolation
         * @param {Number} t The position between start and end
         * @returns {pc.Vec3|pc.Quat|Number} The point at the specified time
         */
        value: value,
        /**
         * @name pc.interpolate.lerp
         * @function
         * @description lerp a value between start and end with constrained t (forced between 0 and
         *     1)
         * @param {pc.Vec3|pc.Quat|Number} start The start point for the interpolation
         * @param {pc.Vec3|pc.Quat|Number} end The end point for the interpolation
         * @param {Number} t The position between start and end
         * @returns {pc.Vec3|pc.Quat|Number} The lerped value
         */
        lerp: lerp,
        /**
         * @name pc.interpolate.easeInOut
         * @function
         * @description Use smoothstep to make a natural lerp of a value between start and end with
         *      constrained t (forced between 0 and 1)
         * @param {pc.Vec3|pc.Quat|Number} start The start point for the interpolation
         * @param {pc.Vec3|pc.Quat|Number} end The end point for the interpolation
         * @param {Number} t The position between start and end
         * @returns {pc.Vec3|pc.Quat|Number} The smoothly interpolated value
         */
        easeInOut: easeInOut,
        /**
         * @name pc.interpolate.easeIn
         * @function
         * @description ease the begining of an interpolation using smoothstep
         * @param {pc.Vec3|pc.Quat|Number} start The start point for the interpolation
         * @param {pc.Vec3|pc.Quat|Number} end The end point for the interpolation
         * @param {Number} t The position between start and end
         * @returns {pc.Vec3|pc.Quat|Number} The interpolated value using easeIn
         */
        easeIn: easeIn,
        /**
         * @name pc.interpolate.easeOut
         * @function
         * @description ease the end of an interpolation using smoothstep
         * @param {pc.Vec3|pc.Quat|Number} start The start point for the interpolation
         * @param {pc.Vec3|pc.Quat|Number} end The end point for the interpolation
         * @param {Number} t The position between start and end
         * @returns {pc.Vec3|pc.Quat|Number} The interpolated value using easeOut
         */
        easeOut: easeOut,
        /**
         * @name pc.interpolate.curve
         * @function
         * @description use a curve to interpolate a value between start and end
         * @remarks To enable bounce and hyper extension effects it is possible for the value being interpolated
         * to exceed the limits of start and end if the curve specifies values < 0 and/or > 1
         * @param {pc.Curve} curve The curve to use to perform the interpolation
         * @param {pc.Vec3|pc.Quat|Number} start The start point for the interpolation
         * @param {pc.Vec3|pc.Quat|Number} end The end point for the interpolation
         * @param {Number} t The position between start and end
         * @returns {pc.Vec3|pc.Quat|Number} The interpolated value using the specified curve
         */
        curve: curve,
        /**
         * @name pc.interpolate.curveSet
         * @function
         * @description use a curve to interpolate a value between start and end
         * @remarks To enable bounce and hyper extension effects it is possible for the value being interpolated
         * to exceed the limits of start and end if the curve specifies values < 0 and/or > 1
         * @param {pc.CurveSet} curveset The curveSet to use to perform the interpolation
         * @param {pc.Vec3|pc.Quat|Number} start The start point for the interpolation
         * @param {pc.Vec3|pc.Quat|Number} end The end point for the interpolation
         * @param {Number} t The position between start and end
         * @returns {[pc.Vec3|pc.Quat|Number]} The an array of the interpolated values from each of the curves
         * in the curveSet
         */
        curveSet: curveSet,
        /**
         * @name pc.interpolate.moveTowards
         * @function
         * @description Move a value towards a target with a limited maximum step
         * @param {pc.Vec3|pc.Quat|Number} start The start point for the move
         * @param {pc.Vec3|pc.Quat|Number}end The target for the move
         * @param {Number} max The maximum distance to move, if start and end are vectors or
         *     numbers then this is a distance, if start and are quaternions then this is a
         *     distance measured in degrees
         * @example
         * update: function(dt) {
         *     this.entity.setPosition(pc.interpolate.moveTowards(this.entity.getPosition(),
         *     someTargetPosition, this.speed * dt));
         * }
         * @returns {pc.Vec3|pc.Quat|Number} The updated value
         */
        moveTowards: function (start, end, max) {
            var result = start;
            if (start instanceof pc.Vec3) {
                var range = end.clone().sub(start);
                length = range.length();
                if (length == 0) {
                    return end;
                }
                result = range.normalize().scale(Math.min(max, length)).add(start);
            }
            else if (start instanceof pc.Quat) {
                var v1 = start.transformVector(scratch.copy(pc.Vec3.FORWARD));
                var v2 = end.transformVector(scratch2.copy(pc.Vec3.FORWARD));
                var angle = Math.acos(Math.min(1, Math.max(-1,v1.dot(v2)))) * pc.math.RAD_TO_DEG;
                var useAngle = Math.min(max, angle);
                if (angle == 0) {
                    return end;
                }
                result =
                    scratchQ.slerp(pc.Quat.IDENTITY,
                        diffQuat(end, start),
                        useAngle / angle).mul(start);
            }
            else if (!isNaN(start)) {
                var diff = end - start;
                var s = sign(diff);
                result = start + Math.min(max, Math.abs(diff)) * s;
            }
            return result;
        }

    };

    return {
        /**
         * @name pc.interpolate
         * @namespace
         * @description Provides useful interpolations for numbers, vectors and quaternions
         * @example
         * var startPosition = new pc.Vec3(0,0,0);
         * var endPosition = new pc.Vec3(100,20,30);
         *
         * //Find the position half way between the two positions
         * pc.interpolate.lerp(startPosition, endPosition, 0.5);
         */
        interpolate: interpolate
    };

})());
