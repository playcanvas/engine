pc.extend(pc, (function () {

    //Get the sign of a number
    function sign(v) {
        return v ? v < 0 ? -1 : 1 : 0;
    }

    //Execute a function over time
    function execute(fn) {
        return function (start, end, time, callback, bind) {
            var t = 0;
            if (start === undefined || end === undefined) {
                throw new Error("start and end must be specified");
            }
            time = time || 1;
            return new pc.Coroutine(function (dt, coroutine) {
                t = Math.min(1, t + dt / time);
                var result = fn(start, end, t);
                if (callback) {
                    callback(result, t);
                }
                coroutine.fire('value', result, t);
                if (t >= 1) {
                    return false;
                }
            }, undefined, bind);
        };
    }

    //Find the difference between two quaternions
    function diffQuat(q2, q1) {
        var a = q1.clone().invert();
        return a.mul(q2);//
    }



    function value(start, end, t) {
        var result = start;
        if (start instanceof pc.Vec3) {
            result = end.clone().sub(start).scale(t).add(start);
        }
        else if (start instanceof pc.Quat) {
            result = new pc.Quat().slerp(pc.Quat.IDENTITY, diffQuat(end, start), t).mul(start);
        }
        else if (!isNaN(start)) {
            result = (+end - +start) * t + +start;
        }
        return result;
    }

    function lerp(start, end, t) {
        return value(start, end, pc.math.clamp(t, 0, 1));
    }

    function smooth(start, end, t) {
        return interpolate.value(start, end, pc.math.smootherstep(0, 1, t));
    }

    /**
     * @callback
     * @name pc.interpolate~valuecb
     * @description call back containing the value of an interpolation
     * @param {pc.Vec3|pc.Quat|Number} value The current value
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
         * @name pc.interpolate.smooth
         * @function
         * @description Use smoothstep to make a natural lerp of a value between start and end with
         *     constrained t (forced between 0 and 1)
         * @param {pc.Vec3|pc.Quat|Number} start The start point for the interpolation
         * @param {pc.Vec3|pc.Quat|Number} end The end point for the interpolation
         * @param {Number} t The position between start and end
         * @returns {pc.Vec3|pc.Quat|Number} The smoothly interpolated value
         */
        smooth: smooth,
        /**
         * @name pc.interpolate.moveTowards
         * @function
         * @description Move a value towards a target with a limited maximum step
         * @param {pc.Vec3|pc.Quat|Number} start The start point for the move
         * @param {pc.Vec3|pc.Quat|Number}end The target for the move
         * @param {Number} max The maximum distance to move, if start and end are vectors or
         *     numbers then this is a distance, if start and are quaternions then this is a
         *     distance measured in radians
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
                if(length == 0) {
                    return end;
                }
                result = range.normalize().scale(Math.min(max, length)).add(start);
            }
            else if (start instanceof pc.Quat) {
                var v1 = start.transformVector(pc.Vec3.FORWARD.clone());
                var v2 = end.transformVector(pc.Vec3.FORWARD.clone());
                var angle = Math.acos(v1.dot(v2));
                var useAngle = Math.min(max, angle);
                if(angle == 0) {
                    return end;
                }
                result =
                    new pc.Quat().slerp(pc.Quat.IDENTITY,
                        diffQuat(end, start),
                        useAngle / angle).mul(start);
            }
            else if (!isNaN(start)) {
                var diff = end - start;
                var s = sign(diff);
                result = start + Math.min(max, Math.abs(diff)) * s;
            }
            return result;
        },
        /**
         * @namespace
         * @name pc.interpolate.overTime
         * @description Functions to interpolate a value over time with either a callback or an
         *     event to use the value
         * @example
         * //Start a movement between two locations that takes 3 seconds to complete
         * var movement = pc.interpolate.overTime.smooth(this.entity.getPosition(),
         *     someTargetPosition, 3)
         *     .on('value', function(value) {
		 *          this.entity.setPosition(value);
		 *     });
         *
         * //Cancel the movement
         * if(app.keyboard.isPressed(pc.KEY_SPACE)) {
		 *      movement.cancel(); //Can also pass a delay
		 * }
         *
         */
        overTime: {
            /**
             * @name pc.interpolate.overTime.smooth
             * @description smoothly change a value over time from start to end with a callback and
             *     an event
             * @param {pc.Vec3|pc.Quat|Number} start The start value
             * @param {pc.Vec3|pc.Quat|Number} end The target value
             * @param {Number} time The number of seconds to complete the transition
             * @param {pc.interpolate~valuecb} callback An optional callback function to be passed
             *     the value when it changes
             * @param {Object} bind An object containing an enabled property, the blend only occurs
             *     when the enabled property is true
             * @returns {pc.Coroutine} The coroutine managing the interpolation
             * @example
             *
             * //Start a movement between two locations that takes 3 seconds to complete
             * var movement = pc.interpolate.overTime.smooth(this.entity.getPosition(),
             *     someTargetPosition, 3)
             *     .on('value', function(value) {
			 *          this.entity.setPosition(value);
		     *     });
             *
             * //Cancel the movement
             * if(app.keyboard.isPressed(pc.KEY_SPACE)) {
		     *      movement.cancel(); //Can also pass a delay
		     * }
             *
             * //Smoothly scale the entity to 3x size over 5 seconds
             * pc.interpolate.overTime.smooth(1, 3, 5, function(value) {
			 *     this.entity.setLocalScale(value, value, value);
			 * });
             */
            smooth: execute(smooth),
            /**
             * @name pc.interpolate.overTime.lerp
             * @description linear interpolate a value over time from start to end with a callback
             *     and an event
             * @param {pc.Vec3|pc.Quat|Number} start The start value
             * @param {pc.Vec3|pc.Quat|Number} end The target value
             * @param {Number} time The number of seconds to complete the transition
             * @param {pc.interpolate~valuecb} callback An optional callback function to be passed
             *     the value when it changes
             * @param {Object} bind An object containing an enabled property, the blend only occurs
             *     when the enabled property is true
             * @returns {pc.Coroutine} The coroutine managing the interpolation
             * @example
             *
             * //Start a linear movement between two locations that takes 3 seconds to complete
             * var movement = pc.interpolate.overTime.lerp(this.entity.getPosition(),
             *     someTargetPosition, 3)
             *     .on('value', function(value) {
			 *          this.entity.setPosition(value);
		     *     });
             *
             * //Cancel the movement
             * if(app.keyboard.isPressed(pc.KEY_SPACE)) {
		     *      movement.cancel(); //Can also pass a delay
		     * }
             *
             * //Rotate 90 degrees about Y in 5 seconds
             * pc.interpolate.overTime.lerp(this.entity.getRotation(),
             *     this.entity.getRotation().clone().mul(new pc.Quat().setFromEulerAngles(0,90,0)),
             *     5, function(value) { this.entity.setRotation(value);
			 * });
             */
            lerp: execute(lerp)
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
