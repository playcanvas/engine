pc.extend(pc, (function () {


    /**
     * @callback
     * @name pc.StateMachine~enter
     * @description Called when a state is entered
     * @param {String} previousState the state that is being switched from
     * @param {String} state the current state
     */

    /**
     * @callback
     * @name pc.StateMachine~exit
     * @description Called when a state is exited
     * @param {String} newState the state that is being switched to
     * @param {String} currentState the state that is being switched from
     */
    //

    function forEach(collection, fn) {
        if (Array.isArray(collection)) {
            var l = collection.length;
            for (var j = 0; j < l; j++) {
                fn(collection[j], j, collection);
            }
        }
        else if (typeof collection == 'object') {
            for (var k in collection) {
                if (collection.hasOwnProperty(k)) {
                    fn(collection[k], k, collection);
                }
            }
        }
        else {
            throw new Error("Iterated item is not an array or an object");
        }
    }

    //Invoke an array of functions with parameters
    function invokeParams(array, refThis, b) {
        if (!array || array.$processing) {
            return;
        }

        array.$processing = true;

        var i, l;
        var parameters = Array.prototype.slice.call(arguments, 2);

        for (i = array.length; i >= 0; i--) {
            try {
                var v = array[i];
                if (v) {
                    v.apply(refThis, parameters);
                }
            }
            catch (e) {
                console.error(e.stack);
            }
        }
        array.$processing = false;
    }

    //Invoke an array of functions
    function invoke(array, refThis) {
        if (!array) {
            return;
        }
        //Check if we are passing parameters
        if (refThis) {
            return invokeParams.apply(refThis, Array.prototype.slice.call(arguments));
        }
        //Fast function execution
        for (var i = array.length; i >= 0; i--) {
            var v = array[i];
            if (v) {
                v();
            }
        }
    }

    //Do nothing
    function noop() {
    }

    /**
     * @class
     * @name pc.StateMachine
     * @description A state machine that allows groups of functions to be easily switched in and
     *     out. Has provision for enter and exit functions to provide transition support.
     * @constructor Creates a new state machine
     * @param {Object} states The definition of the states that will be implemented by the state
     *     machine
     * @param {Object} decorate Optional parameter that sets the target for the state machine
     *     functions.  Often you will decorate a script so that the state functions become part of
     *     the calling script.  Defaults to be the statemachine.
     * @property {String} state The current state of the statemachine. Setting the state will cause
     *     exit and enter transitions.
     * @property {Number} time The number of seconds that the state machine has been in the current
     *     state
     * @remarks The state machine takes a states object that describes all of the states that the
     *     object should possess to start with (in rare circumstances you may declare other states
     *     programatically).<br><br> The functions in each state are added to the object being
     *     decorated (any existing functions are maintained).<br><br> Each state may have and
     *     {pc.StateMachine~exit} 'exit' and {pc.StateMachine~enter} 'enter' functions defined,
     *     these will be called immediate on entering and exiting states and can be used for setup
     *     and tear down of state related variables.<br><br>
     *
     * @example
     *
     *
     * var player;
     *
     * var states = {
     *      patrol: {
     *          enter: function() {
     *              this.targetPos = new pc.Vec3(Math.random() * 10, 0, Math.random() * 10);
     *              this.patrolTime = Math.random() * 20;
     *          },
     *          update: function(dt) {
     *              this.entity.setPosition(pc.interpolate.moveTowards(this.entity.getPosition(),
     *     this.targetPos, dt * 2)); if(this.stateMachine.time > this.patrolTime) {
     *     this.stateMachine.state = 'seekPlayer';
     *              }
     *          },
     *          //On trigger event only happens in the patrol state
     *          ontrigger: function(entity) {
     *              if(entity == player) {
     *                  this.state = 'seekPlayer';
     *              }
     *          }
     *      },
     *      seekPlayer: {
     *          enter: function() {
     *              this.seekTime = Math.random() * 7;
     *          },
     *          update: function(dt) {
     *              this.entity.setPosition(pc.interpolate.moveTowards(this.entity.getPosition(),
     *     player.getPosition(), dt * 3)); if(this.stateMachine.time > this.seekTime) {
     *     this.stateMachine.state = 'patrol';
     *              }
     *          }
     *      }
     * };
     *
     * var Enemy = function(entity) {
     *     this.entity = entity;
     *     this.stateMachine = new pc.StateMachine(states, this);
     * };
     *
     * Enemy.prototype = {
     *     initialize: function() {
     *         player = app.root.findByName('Player');
     *         this.entity.collision.on('triggerenter', this.ontrigger);
     *         this.stateMachine.state = Math.random() < 0.5 ? 'patrol' : 'seekPlayer';
     *     }
     * };
     *
     * return Enemy;
     *
     *
     */
    function StateMachine(states, decorate) {
        var self = this;
        this._currentState = "<none>";
        this._changeList = [];
        this._currentTime = Date.now();
        this.states = {};
        var enter = this._enter = {};
        var exit = this._exit = {};
        this._decorate = decorate || this;
        if (typeof states == 'object') {
            this.define(states);
        }
        Object.defineProperties(this, {
            state: {
                get: function () {
                    return self._currentState;
                },
                set: function (v) {
                    if (v == self._currentState) {
                        return;
                    }
                    var lastState = self._currentState;
                    var currentState = self._currentState = v;
                    self._currentTime = Date.now();
                    self.change();
                    invoke(exit[lastState], self.decorate, currentState, lastState);
                    invoke(exit["always"], self.decorate, currentState, lastState);
                    invoke(enter[currentState], self.decorate, lastState, currentState);
                    invoke(enter["always"], self.decorate, lastState, currentState);
                }
            },
            time: {
                get: function () {
                    return (Date.now() - self._currentTime) / 1000;
                }
            }
        });

    }

    var register = function register(stateMachine, method, decorate) {
        var states = stateMachine.states;
        decorate = decorate || stateMachine._decorate;
        method = Array.isArray(method) ? method : method.split(' ');
        method.filter(function (m) {
            return m;
        }).forEach(function (method) {
            var working = noop;
            var lastState;
            stateMachine.change(function () {
                var state = states[lastState = stateMachine.state] = states[stateMachine.state] || {};
                working = state[method] = state[method] || noop;
            });

            //Get any existing method
            var existing = decorate[method];
            if (existing && typeof existing == 'function') {
                //Use the existing method before running any new ones if it exists
                decorate[method] = function stateMachineBoundFunction() {
                    existing.apply(decorate, arguments);
                    return working.apply(decorate, arguments);
                };
            }
            else {
                //Call the function
                decorate[method] = function stateMachineBoundFunction() {
                    return working.apply(decorate, arguments);
                };
            }

        });
        return this;
    };


    StateMachine.prototype = {
        /**
         * @function
         * @description register a function to be called on every state change, or trigger a state
         *     recalculation
         * @remarks This function is rarely used externally
         * @name pc.StateMachine.change
         * @param {Function} fn Optional function, if specified it is added to the change list,
         *     otherwise this function simulates a state change
         */
        change: function (fn) {
            if (fn) {
                this._changeList.push(fn);
            }
            else {
                invoke(this._changeList);
            }
        },
        /**
         * @function
         * @name pc.StateMachine.define
         * @description Define the states associated with this state machine or add to the existing
         *     states
         * @param {String|Object} state either an object declaring the states and methods or the
         *     name of a state to append a method to. If state is an object it should be the only
         *     parameter passed.
         * @param {String|Object} method Either the name of a method to add to a state or an object
         *     describing all of the methods of the state
         * @param {Function} fn The function to call if both state and method were strings
         * @remarks It's not normally necessary to call this function as states are usually defined
         *     up front by passing a state descriptor to the constructor
         * @example
         * //Add a die method to the class and define it for the 'walking' state
         * this.stateMachine.define('walking', 'die', function() { //do something });
         */
        define: function (state, method, fn) {
            var registrationList = [];
            var self = this;
            var states = this.states;
            var registerState = function registerState(stateName, definition) {
                forEach(definition, function (method, methodName) {
                    if (typeof method !== 'function') {
                        return;
                    }
                    if (methodName != "enter" && methodName != "exit") {
                        states[stateName][methodName] = method;
                        registrationList.push(methodName);
                    }
                    else if (methodName == "enter") {
                        var enter = self._enter[stateName] = self._enter[stateName] || [];
                        enter.push(method);
                    }
                    else if (methodName == "exit") {
                        var exit = self._exit[stateName] = self._exit[stateName] || [];
                        exit.push(method);
                    }
                });
            };

            if (typeof state == 'object' && !method && !fn) {
                forEach(state, function (s, i) {
                    states[i] = states[i] || {};
                    registerState(i, s);
                });
                register(this, registrationList);
                return this;
            }
            else if (typeof method == 'object' && typeof state == 'string' && fn) {
                states[state] = states[state] || {};
                registerState(state, method);
                register(this, registrationList);
                return this;
            }
            else if (typeof method == 'string' && typeof state == 'string' && fn) {
                var stateobject = states[state] = states[state] || {};
                stateobject[method] = fn;
                register(this, method);
                return this;
            } else {
                throw new Error("Unrecognized configuration");
            }
        }


    };



    return {
        StateMachine: StateMachine
    };
})());

