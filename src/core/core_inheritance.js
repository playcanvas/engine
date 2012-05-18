/**
 * Implementaton of inheritance for Javascript objects
 * e.g. Class can access all of Base's function prototypes
 * <pre lang="javascript"><code>
 * Base = function () {}
 * Class = function () {}
 * Class = Class.extendsFrom(Base)
 * </code></pre>
 * @param {Object} Super
 */
Function.prototype.extendsFrom = function (Super) {
    var Self;
    var Func;
	var Temp = function () {};
    
	Self = this;
    Func = function () {
        Super.apply(this, arguments);
        Self.apply(this, arguments);
        this.constructor = Self;
    };
    Func._super = Super.prototype;
    Temp.prototype = Super.prototype;
    Func.prototype = new Temp();
    return Func;
};

pc.extend(pc, function () {
    return {
        /**
         * Implementaton of inheritance for Javascript objects
         * e.g. Class can access all of Base's function prototypes
         * @example
         * Base = function () {}
         * Class = function () {}
         * Class = pc.inherits(Class, Base);
         * @param {Function} Self Constructor of derived class
         * @param {Function} Super Constructor of base class
         * @returns {Function} New instance of Self which inherits from Super
         */
        inherits: function (Self, Super) {
            //var Func;
            //var Base = Self;
            var Temp = function () {};
            var Func = function () {
                Super.apply(this, arguments);
                Self.apply(this, arguments);
                this.constructor = Self;
            };
            Func._super = Super.prototype;
            Temp.prototype = Super.prototype;
            Func.prototype = new Temp();
            return Func;
        }
    }
}());