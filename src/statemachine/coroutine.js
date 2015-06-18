pc.extend(pc, (function() {

	var coroutines = [];

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
	 * @name pc.Coroutine
	 * @description Basic support for coroutines that run for a fixed period, either dependent on an object or independently
	 * @constructor Creates a new coroutine
	 * @param {pc.Coroutine~callback} fn The function to be run every frame
	 * @param {Number} duration Optional duration, if specified the coroutine runs for this number of seconds
	 * @param {Object} bind Optional object with an enabled property whose value will control the execution of the coroutine
	 * @param {Number} delay Optional delay before executing the next step
	 * @property {pc.Coroutine~callback} fn The currently running functionå
	 * @returns {pc.Coroutine} The new coroutine
	 */
	function Coroutine(fn, duration, bind, delay) {
		this._fn = fn;
		this._bind = bind;
		this._destroyDelay = duration;
		this._callDelay = delay || 0;
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


	return {
		EXIT_COROUTINE: false,
		Coroutine: Coroutine
	};


})());
