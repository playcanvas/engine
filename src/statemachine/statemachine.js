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

	//For each loop
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
		this._currentState = "<none>";
		this.changeList = [];
		this.currentTime = Date.now();
		this.states = {};
		var enter = this.enter = {};
		var exit = this.exit = {};
		this._decorate = decorate || this;
		if (typeof states == 'object') {
			this.define(states);
		}
		Object.defineProperties(this, {
			state: {
				get: function () {
					return this._currentState;
				}.bind(this),
				set: function (v) {
					if (v == this._currentState) {
						return;
					}
					var lastState = this._currentState;
					var currentState = this._currentState = v;
					this._currentTime = Date.now();
					this.change();
					invoke(exit[lastState], this, currentState, lastState);
					invoke(exit["always"], this, currentState, lastState);
					invoke(enter[currentState], this, lastState, currentState);
					invoke(enter["always"], this, lastState, currentState);
				}.bind(this)
			},
			time: {
				get: function () {
					return (Date.now() - this._currentTime) / 1000;
				}.bind(this)
			}
		});

	}


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
				this.changeList.push(fn);
			}
			else {
				invoke(this.changeList);
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
			var registerState = function registerState(stateName, definition) {
				forEach(definition, function (method, methodName) {
					if(typeof method !== 'function') return;
					if (methodName != "enter" && methodName != "exit") {
						this.states[stateName][methodName] = method;
						registrationList.push(methodName);
					}
					else if (methodName == "enter") {
						this.enter[stateName] = this.enter[stateName] || [];
						this.enter[stateName].push(method);
					}
					else if (methodName == "exit") {
						this.exit[stateName] = this.exit[stateName] || [];
						this.exit[stateName].push(method);
					}
				}.bind(this));
			}.bind(this);

			if (typeof state == 'object' && !method && !fn) {
				forEach(state, function (s, i) {
					this.states[i] = this.states[i] || {};
					registerState(i, s);
				}.bind(this));
				this._register(registrationList);
				return this;
			}
			else if (typeof method == 'object' && typeof state == 'string' && fn) {
				this.states[state] = this.states[state] || {};
				registerState(state, method);
				this._register(registrationList);
				return this;
			}
			else if (typeof method == 'string' && typeof state == 'string' && fn) {
				this.states[state] = this.states[state] || {};
				this.states[state][method] = fn;
				this._register(method);
				return this;
			}
			else {
				throw new Error("Unrecognized configuration");
			}
		},
		_register: function register(method, decorate) {

			decorate = decorate || this._decorate;
			method = Array.isArray(method) ? method : method.split(' ');
			method.filter(function (m) {
				return m;
			}).forEach(function (method) {
				var working = noop;
				var lastState;
				this.change(function () {
					this.states[lastState = this.state] = this.states[this.state] || {};
					working =
						this.states[this.state][method] =
							this.states[this.state][method] || noop;
				}.bind(this));

				//Get any existing method
				var existing = decorate[method];
				if (existing && typeof existing == 'function') {
					//Use the existing method before running any new ones if it exists
					decorate[method] = function stateMachineBoundFunction() {
						existing.apply(this, arguments);
						return working.apply(this, arguments);
					}.bind(decorate);
				}
				else {
					//Call the function
					decorate[method] = function stateMachineBoundFunction() {
						return working.apply(this, arguments);
					}.bind(decorate);
				}

			}.bind(this));
			return this;
		}


	};



	return {
		StateMachine: StateMachine
	};
})());

