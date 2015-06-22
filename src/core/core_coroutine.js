pc.extend(pc, (function () {

    //Manager interface to run coroutines;
    var CoroutineManager = function CoroutineManager() {
        var self = this;
        self._coroutines = [];
        //Create a function to act over time
        function execute(fn) {

            return function (start, end, time, callback, tie) {
                var t = 0;
                if (start === undefined || end === undefined) {
                    throw new Error("start and end must be specified");
                }
                time = time || 1;
                start = typeof start == 'object' ? start.clone() : start;
                end = typeof end == 'object' ? end.clone() : end;
                var coroutine = new pc.Coroutine(function (dt, coroutine) {
                    t = Math.min(1, t + dt / time);
                    var result = fn(start, end, t);
                    if (callback) {
                        callback(result, t);
                    }
                    coroutine.fire('value', result, t);
                    if (t >= 1) {
                        return false;
                    }
                }, undefined, tie);
                return self._add(coroutine);
            };
        }

        function executeWithSource(fn) {

            return function (source, start, end, time, callback, tie) {
                var t = 0;
                if (start === undefined || end === undefined) {
                    throw new Error("start and end must be specified");
                }
                time = time || 1;
                start = typeof start == 'object' ? start.clone() : start;
                end = typeof end == 'object' ? end.clone() : end;
                var coroutine = new pc.Coroutine(function (dt, coroutine) {
                    t = Math.min(1, t + dt / time);
                    var result = fn(source, start, end, t);
                    if (callback) {
                        callback(result, t);
                    }
                    coroutine.fire('value', result, t);
                    if (t >= 1) {
                        return false;
                    }
                }, undefined, tie);
                return self._add(coroutine);
            };
        }


        pc.extend(this, {
            /**
             * @namespace
             * @name pc.CoroutineManager.overTime
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
             *     movement.cancel(); //Can also pass a delay
             * }
             *
             */

            interpolate: {
                /**
                 * @name pc.CoroutineManager.interpolate.easeIn
                 * @description ease the start of a change of value over time from start to end
                 *     with a callback and an event to provide the current value
                 * @param {pc.Vec3|pc.Quat|Number} start The start value
                 * @param {pc.Vec3|pc.Quat|Number} end The target value
                 * @param {Number} time The number of seconds to complete the transition
                 * @param {pc.interpolate~valuecb} callback An optional callback function to be
                 *     passed the value when it changes
                 * @param {Object} tie An object containing an enabled property, the blend only
                 *     occurs when the enabled property is true
                 * @returns {pc.Coroutine} The coroutine managing the interpolation
                 * @example
                 *
                 * //Start a movement between two locations that takes 3 seconds to complete
                 * //and has a the start of the motion eased
                 * var movement = app.coroutine.interpolate.easeIn(this.entity.getPosition(),
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
                easeIn: execute(pc.interpolate.easeIn),
                /**
                 * @name pc.CoroutineManager.interpolate.easeOut
                 * @description ease the end of a change of value over time from start to end with
                 *     a
                 *     callback and an event to provide the current value
                 * @param {pc.Vec3|pc.Quat|Number} start The start value
                 * @param {pc.Vec3|pc.Quat|Number} end The target value
                 * @param {Number} time The number of seconds to complete the transition
                 * @param {pc.interpolate~valuecb} callback An optional callback function to be
                 *     passed the value when it changes
                 * @param {Object} tie An object containing an enabled property, the blend only
                 *     occurs when the enabled property is true
                 * @returns {pc.Coroutine} The coroutine managing the interpolation
                 * @example
                 *
                 * //Start a movement between two locations that takes 3 seconds to complete
                 * //and has a the start of the motion eased
                 * var movement = app.coroutine.interpolate.easeIn(this.entity.getPosition(),
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
                easeOut: execute(pc.interpolate.easeOut),
                /**
                 * @name pc.CoroutineManager.interpolate.easeInOut
                 * @description smoothly change a value over time from start to end with a callback
                 *     and an event using an ease in and out of the change
                 * @param {pc.Vec3|pc.Quat|Number} start The start value
                 * @param {pc.Vec3|pc.Quat|Number} end The target value
                 * @param {Number} time The number of seconds to complete the transition
                 * @param {pc.interpolate~valuecb} callback An optional callback function to be
                 *     passed the value when it changes
                 * @param {Object} tie An object containing an enabled property, the blend only
                 *     occurs when the enabled property is true
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
                 * //Ease the scaling of the entity to 3x size over 5 seconds
                 * pc.interpolate.overTime.easeInOut(1, 3, 5, function(value) {
                 *     this.entity.setLocalScale(value, value, value);
                 * });
                 */
                easeInOut: execute(pc.interpolate.easeInOut),
                /**
                 * @name pc.CoroutineManager.interpolate.lerp
                 * @description linear interpolate a value over time from start to end with a
                 *     callback and an event
                 * @param {pc.Vec3|pc.Quat|Number} start The start value
                 * @param {pc.Vec3|pc.Quat|Number} end The target value
                 * @param {Number} time The number of seconds to complete the transition
                 * @param {pc.interpolate~valuecb} callback An optional callback function to be
                 *     passed the value when it changes
                 * @param {Object} tie An object containing an enabled property, the blend only
                 *     occurs when the enabled property is true
                 * @returns {pc.Coroutine} The coroutine managing the interpolation
                 * @example
                 *
                 * //Start a linear movement between two locations that takes 3 seconds to complete
                 * var movement = app.coroutine.interpolate.lerp(this.entity.getPosition(),
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
                 * app.coroutine.interpolate.lerp(this.entity.getRotation(),
                 *     this.entity.getRotation().clone().mul(new
                 *     pc.Quat().setFromEulerAngles(0,90,0)),
                 *     5, function(value) { this.entity.setRotation(value);
                 * });
                 */
                lerp: execute(pc.interpolate.lerp),
                /**
                 * @name pc.CoroutineManager.interpolate.curve
                 * @description interpolate a value over time from start to end with a callback and
                 *     an event using a specified curve
                 * @param {pc.Curve} curve The Curve to use for interpolation
                 * @param {pc.Vec3|pc.Quat|Number} start The start value
                 * @param {pc.Vec3|pc.Quat|Number} end The target value
                 * @param {Number} time The number of seconds to complete the transition
                 * @param {pc.interpolate~valuecb} callback An optional callback function to be
                 *     passed the value when it changes
                 * @param {Object} tie An object containing an enabled property, the blend only
                 *     occurs when the enabled property is true
                 * @returns {pc.Coroutine} The coroutine managing the interpolation
                 * @remarks To enable bounce and hyper extension effects it is possible for the
                 *     value being interpolated to exceed the limits of start and end if the curve
                 *     specifies values < 0 and/or > 1
                 */
                curve: executeWithSource(pc.interpolate.curve),
                /**
                 * @name pc.CoroutineManager.interpolate.curveSet
                 * @description interpolate a set of values over time from start to end with a
                 *     callback and an event using a specified curveSet
                 * @param {pc.CurveSet} curveset The CurveSet to use for interpolation
                 * @param {pc.Vec3|pc.Quat|Number} start The start value
                 * @param {pc.Vec3|pc.Quat|Number} end The target value
                 * @param {Number} time The number of seconds to complete the transition
                 * @param {pc.interpolate~valuecb} callback An optional callback function to be
                 *     passed the value when it changes, this will be passed an array of values
                 *     with one result from each curve in the CurveSet
                 * @param {Object} tie An object containing an enabled property, the blend only
                 *     occurs when the enabled property is true
                 * @returns {pc.Coroutine} The coroutine managing the interpolation
                 * @remarks To enable bounce and hyper extension effects it is possible for the
                 *     value being interpolated to exceed the limits of start and end if the curve
                 *     specifies values < 0 and/or > 1
                 */
                curveSet: executeWithSource(pc.interpolate.curveSet)
            }
        });
    };



    CoroutineManager.prototype = {
        _update: function (dt) {
            var coroutines = this._coroutines;
            for (var i = coroutines.length - 1; i >= 0; i--) {
                try {
                    coroutines[i]._step(dt);
                }
                catch (e) {
                    console.error(e);
                }
            }
        },
        _add: function (coroutine) {
            var self = this;
            if (coroutine._manager) {
                throw new Error("Coroutine is already attached to a manager");
            }
            coroutine._manager = this;
            coroutine.on('ended', function () {
                coroutine.off('ended');
                self._remove(coroutine);
            });
            this._coroutines.push(coroutine);
            return coroutine;
        },
        _remove: function (coroutine) {
            var coroutines = this._coroutines;
            var idx = coroutines.indexOf(coroutine);
            if (idx != -1) {
                coroutines.splice(idx, 1);
            }
            return coroutine;
        },

        /**
         * @function
         * @name pc.CoroutineManager.startCoroutine
         * @param {pc.Coroutine~callback} fn Coroutine function
         * @param {pc.Coroutine~parameters} opts Optional parameters for the coroutine
         * @returns {pc.Coroutine} The coroutine that has been created
         */
        startCoroutine: function (fn, opts) {
            var coroutine = new pc.Coroutine(fn, opts);
            this._add(coroutine);
            return coroutine;
        },
        /**
         * @function
         * @name pc.CoroutineManager.timeout
         * @description Executes a function after a specified delay in game time
         * @remarks This is a useful version of setTimeout that works based on game time rather than
         *     system clock and hence can be slowed down with timeScale
         * @param {Function} fn Function to execute
         * @param {Number} time Time in seconds before execution
         * @param {pc.Coroutine~parameters} options Optional object with an enabled property whose
         *     value will control the execution of the coroutine
         * @example
         * app.coroutine.timeout(function() {
         *   spawnEnemy();
         * }, 1.5);
         */
        timeout: function (fn, time, options) {
            var run = false;
            return this.startCoroutine(function () {
                return !run ? (run = true, time) : function () {
                    try {
                        fn()
                    }
                    catch (e) {
                        console.error(e)
                    }
                    return false
                };
            }, options);
        }

        ,

        /**
         * @function
         * @name pc.CoroutineManager.interval
         * @description Executes a function every interval specified in game time
         * @remarks This is a useful version of setInterval that works based on game time rather
         *     than system clock and hence can be slowed down with timeScale
         * @param {Function} fn Function to execute
         * @param {Number} interval Time in seconds between executions
         * @param {pc.Coroutine~parameters} options Optional object with an enabled property whose
         *     value will control the execution of the coroutine
         * @example
         * //Spawn an enemy every 1.5 seconds
         * app.coroutine.interval(function() {
         *    spawnEnemy();
         * }, 1.5);
         */
        interval: function (fn, interval, options) {
            var t = interval;
            return this.startCoroutine(function (dt) {
                t -= dt;
                if (t <= 0) {
                    t += interval;
                    return fn();
                }
            }, options);
        }


    }
    ;

    return {
        CoroutineManager: CoroutineManager
    };

})());


pc.extend(pc, (function () {


    function noop() {
    }


    /**
     * @event
     * @name pc.Coroutine#ended
     * @description Fired when the coroutine is terminated for any reason
     */

    /**
     * @callback
     * @name pc.Coroutine~callback
     * @description Called every time the coroutine executes
     * @param {Number} dt The delta time since the last Update call
     * @param {pc.Coroutine} coroutine The coroutine currently executing
     * @returns {undefined|Boolean|pc.Coroutine~callback|Number} The return value designates what
     *     will happen next.<br><br> Returning undefined, true or any string will cause the
     *     Coroutine to run on the next frame. Returning 'false' will immediately terminate the
     *     coroutine. Returning a number will delay the next execution for that many seconds.<br>
     *     You may also return a different function which will be subsequently used to be the body
     *     of the coroutine, you can access the current function using coroutine.fn and capture it
     *     with a closue so you can return to it later.
     */

    /**
     * @class
     * @name pc.Coroutine~parameters
     * @description options for coroutine creation
     * @property {Number} duration Duration of the coroutine
     * @property {Object} tie An object to use so that the function only executes when the tied
     *     object had an enabled property set 'truthy'
     * @property {Number} delay Delay before the coroutine executes
     */

    /**
     * @class
     * @name pc.Coroutine
     * @description Basic support for coroutines that run for a fixed period, either dependent on
     *     an object or independently
     * @constructor Creates a new coroutine
     * @param {pc.Coroutine~callback} fn The function to be run every frame
     * @param {pc.Coroutine~parameters} options Optional object with an enabled property whose
     *     value will control the execution of the coroutine
     * @property {pc.Coroutine~callback} fn The currently running function
     * @returns {pc.Coroutine} The new coroutine
     */
    function Coroutine(fn, options) {
        options = options || {};
        this._fn = fn || noop;
        this._tie = options.tie;
        this._destroyDelay = options.duration;
        this._callDelay = options.delay || 0;
        Object.defineProperties(this, {
            fn: {
                get: function () {
                    return this._fn;
                }.bind(this)
            }
        });
        pc.events.attach(this);
        this._step(0);

    }

    Coroutine.prototype = {
        /**
         * @function
         * @name pc.Coroutine#after
         * @description From a Coroutine you can return the result of this function to have the
         *     specified function run after the elapsed delay.
         * @param {Number} delay The delay in seconds before running the function
         * @param {pc.Coroutine~callback} fn The function to be run after the delay
         */
        after: function (delay, fn) {
            return {
                after: delay,
                then: fn
            };
        },
        /**
         * @function
         * @name pc.Coroutine#attach
         * @param {pc.Application} app The application to attach to
         * @description Attaches a coroutine to an application so that it can be processed
         * @remarks Normally the best way to create a coroutine is by using
         *     app.coroutine.startCoroutine
         */
        attach: function (app) {
            if (this._manager) {
                throw new Error("Coroutine is already attached to an manager");
            }
            app.coroutine._add(this);
        },
        /**
         * @function
         * @name pc.Coroutine#call
         * @description From a Coroutine you can return the result of this function to have a sub
         *     coroutine run until it returns false at that point the current function will resume
         *     operation
         * @param {pc.Coroutine~callback} fn The function you wish call until it returns false
         */
        call: function (fn) {
            var ret = this._fn;
            return function (dt, cr) {
                var result = fn(dt, cr);
                if (result === false) {
                    result = ret;
                }
                return result;
            };
        },
        /**
         * @function
         * @name pc.Coroutine#cancel
         * @description Cancels execution of the coroutine
         * @param {Number} delay Optional delay in seconds before the coroutine is terminated
         */
        cancel: function (delay) {
            if (delay) {
                this._destroyDelay = delay;
            } else {
                this.fire('ended');
                this.off();
            }
            return this;
        },
        _step: function (dt) {
            if (this._destroyDelay !== undefined) {
                this._destroyDelay -= dt;
                if (this._destroyDelay <= 0) {
                    this.cancel();
                    return;
                }
            }
            this._callDelay -= dt;
            if (this._callDelay <= 0) {
                if (!this._tie || this._tie.enabled !== false) {
                    var result = this._fn(dt, this);
                    if (result !== true && result !== false && !isNaN(result)) {
                        this._callDelay = +result;
                    }
                    if (result === false) {
                        this.cancel();
                    }
                    if (typeof result == 'function') {
                        this._fn = result;
                    }
                    if (typeof result == 'object' && !isNaN(result.after) && typeof result.then == 'function') {
                        this._callDelay = +result.after;
                        this._fn = result.then;
                    }
                }
            }

        }

    };



    return {
        EXIT_COROUTINE: false,
        Coroutine: Coroutine
    };


})());
