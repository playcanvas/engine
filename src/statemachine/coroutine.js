pc.extend(pc, (function() {

	var coroutines = [];
	function noop() {}

	pc.ComponentSystem.on('update', function(dt) {
		for(var i = coroutines.length - 1; i >= 0; i--) {
			try {
				coroutines[i]._step(dt);
			} catch(e) {
				console.error(e);
			}
		}
	});

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
	 * @returns {undefined|Boolean|pc.Coroutine~callback|Number} The return value designates what will happen next.<br><br> Returning undefined, true or any string will cause the Coroutine to run on the next frame. Returning 'false' will immediately terminate the coroutine. Returning a number will delay the next execution for that many seconds.<br> You may also return a different function which will be subsequently used to be the body of the coroutine, when you do this coroutine.pop() can be called to return the previous function to execution.
	 */

	/**
	 * @class
	 * @name pc.Coroutine~parameters
	 * @description options for coroutine creation
	 * @property {Number} duration Duration of the coroutine
	 * @property {Object} bind An object to bind the enabled state to
	 * @property {Number} delay Delay before the coroutine executes
	 */

	/**
	 * @class
	 * @name pc.Coroutine
	 * @description Basic support for coroutines that run for a fixed period, either dependent on an object or independently
	 * @constructor Creates a new coroutine
	 * @param {pc.Coroutine~callback} fn The function to be run every frame
	 * @param {pc.Coroutine~parameters} options Optional object with an enabled property whose value will control the execution of the coroutine
	 * @property {pc.Coroutine~callback} fn The currently running functionå
	 * @returns {pc.Coroutine} The new coroutine
	 */
	function Coroutine(fn, options) {
		options = options || {};
		this._fn = fn || noop;
		this._bind = options.bind;
		this._destroyDelay = options.duration;
		this._callDelay = options.delay || 0;
		coroutines.push(this);
		Object.defineProperties(this, {
			fn: {
				get: function () {
					return this._fn;
				}.bind(this)
			}
		});
		pc.events.attach(this);


	}
	Coroutine.prototype = {

		/**
		 * @function
		 * @name pc.Coroutine#cancel
		 * @description Cancels execution of the coroutine
		 * @param {Number} delay Optional delay in seconds before the coroutine is terminated
		 */
		cancel: function(delay) {
			if(delay) {
				this._destroyDelay = delay;
			} else {
				this.fire('ended');
				this.off();
				var idx = coroutines.indexOf(this);
				if (idx != -1) coroutines.splice(idx, 1);
			}
			return this;
		},
		_step: function(dt) {
			if(this._destroyDelay !== undefined) {
				this._destroyDelay -= dt;
				if(this._destroyDelay <= 0) {
					this.cancel();
					return;
				}
			}
			this._callDelay -= dt;
			if(this._callDelay <= 0) {
				if (!this._bind || this._bind.enabled !== false) {
					var result = this._fn(dt, this);
					if (result !== true && result !== false && !isNaN(result)) {
						this._callDelay = +result;
					}
					if(result === false) {
						this.cancel();
					}
					if(typeof result == 'function') {
						this._fn = result;
					}
				}
			}

		}

	};


	/**
	 * @function
	 * @name pc.Coroutine.timeout
	 * @description Executes a function after a specified delay in game time
	 * @remarks This is a useful version of setTimeout that works based on game time rather than system clock and
	 * hence can be slowed down with timeScale
	 * @param {Function} fn Function to execute
	 * @param {Number} time Time in seconds before execution
	 * @param {pc.Coroutine~parameters} options Optional object with an enabled property whose value will control the execution of the coroutine
	 * @example
	 * pc.Coroutine.timeout(function() {
		 *   spawnEnemy();
		 * }, 1.5);
	 */
	Coroutine.timeout = function (fn, time, options) {
		return new pc.Coroutine(function () {
			return time ? ((time = 0), true) : function () {
				fn();
				return false;
			}
		}, options);
	};

	/**
	 * @function
	 * @name pc.Coroutine.interval
	 * @description Executes a function every interval specified in game time
	 * @remarks This is a useful version of setInterval that works based on game time rather than system clock and
	 * hence can be slowed down with timeScale
	 * @param {Function} fn Function to execute
	 * @param {Number} interval Time in seconds between executions
	 * @param {pc.Coroutine~parameters} options Optional object with an enabled property whose value will control the execution of the coroutine
	 * @example
	 * //Spawn an enemy every 1.5 seconds
	 * pc.Coroutine.interval(function() {
		 *   spawnEnemy();
		 * }, 1.5);
	 */
	Coroutine.interval = function (fn, interval, options) {
		var t = interval;
		return new pc.Coroutine(function (dt) {
			t -= dt;
			if (t <= 0) {
				t += interval;
				return fn();
			}
		}, options);
	};


	return {
		EXIT_COROUTINE: false,
		Coroutine: Coroutine
	};


})());
