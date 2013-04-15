/**
 * Implementaton of inheritance for Javascript objects
 * e.g. Class can access all of Base's function prototypes
 * <pre lang="javascript"><code>
 * Base = function () {}
 * Class = function () {}
 * Class = Class.extendsFrom(Base)
 * </code></pre>
 * @param {Object} Super
 * @deprecated
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
         * @function
         * @name pc.inherits
         * @description Implementaton of inheritance for Javascript objects
         * e.g. Class can access all of Base's function prototypes
         * The super classes prototype is available on the derived class as _super
         * @param {Function} Self Constructor of derived class
         * @param {Function} Super Constructor of base class
         * @returns {Function} New instance of Self which inherits from Super
         * @example
         * Base = function () {};
         * Base.prototype.fn = function () { 
         *   console.log('base'); 
         * };
         * Class = function () {}
         * Class = pc.inherits(Class, Base);
         * Class.prototype.fn = function () { 
         *   // Call overridden method
         *   Class._super.fn(); 
         *   console.log('class'); 
         * };
         * 
         * var c = new Class();
         * c.fn(); // prints 'base' then 'class'
         */
        inherits: function (Self, Super) {
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
    };
}());