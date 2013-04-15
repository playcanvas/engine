/**
 * @name pc.time
 * @namespace Time API
 */
pc.time = function () {

    /**
     * @name pc.time.Timer
     * @constructor Create a new Timer instance
     * @class A Timer counts milliseconds from when start() is called until when stop() is called.
     */
    var Timer = function Timer() {
        this._isRunning = false;
        this._a = 0;
        this._b = 0;
    };
    
    /**
     * @function
     * @name pc.time.Timer#start
     * @description Start the timer
     */
    Timer.prototype.start = function() {
    
        this._isRunning = true;
        this._a = (new Date()).getTime();
    };
    
    /**
     * @function
     * @name pc.time.Timer#stop
     * @description Stop the timer
     */
    Timer.prototype.stop = function() {
    
        this._isRunning = false;
        this._b = (new Date()).getTime();
    };
    
    /**
     * @function
     * @name pc.time.Timer#getMilliseconds
     * @description Get the number of milliseconds that passed between start() and stop() being called
     */
    Timer.prototype.getMilliseconds = function() {
    
        return this._b - this._a;
    };

    return {
        Timer: Timer,

        /**
         * @function
         * @name pc.time.now
         * @description Get current time in milliseconds
         * @return {Number} The time in milliseconds
         */
        now: function () {
            return new Date().getTime();
        }
                
    };
} ();

