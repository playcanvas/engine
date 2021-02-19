/**
 * @private
 * @function
 * @name now
 * @description Get current time in milliseconds. Use it to measure time difference. Reference time may differ on different platforms.
 * @returns {number} The time in milliseconds.
 */
var now = (typeof window !== 'undefined') && window.performance && window.performance.now && window.performance.timing ? function () {
    return window.performance.now();
} : Date.now;

/**
 * @private
 * @class
 * @name Timer
 * @description Create a new Timer instance.
 * @classdesc A Timer counts milliseconds from when start() is called until when stop() is called.
 */
class Timer {
    constructor() {
        this._isRunning = false;
        this._a = 0;
        this._b = 0;
    }

    /**
     * @private
     * @function
     * @name Timer#start
     * @description Start the timer.
     */
    start() {
        this._isRunning = true;
        this._a = now();
    }

    /**
     * @private
     * @function
     * @name Timer#stop
     * @description Stop the timer.
     */
    stop() {
        this._isRunning = false;
        this._b = now();
    }

    /**
     * @private
     * @function
     * @name Timer#getMilliseconds
     * @description Get the number of milliseconds that passed between start() and stop() being called.
     * @returns {number} The elapsed milliseconds.
     */
    getMilliseconds() {
        return this._b - this._a;
    }
}

export { now, Timer };
