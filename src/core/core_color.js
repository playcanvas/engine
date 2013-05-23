pc.extend(pc, (function () {
    /**
    * @name pc.Color
    * @class Representation of an RGBA color
    * @constructor Create a new Color object
    * @param {Number} r The value of the red component (0-1)
    * @param {Number} g The value of the green component (0-1)
    * @param {Number} b The value of the blue component (0-1)
    * @param {Number} [a] The value of the alpha component (0-1)
    */
    /**
    * @name pc.Color
    * @class Representation of an RGBA color
    * @constructor Create a new Color object
    * @param {pc.Color|pc.math.vec4|pc.math.vec3|String} color An existing color value. String value should be in the form "#FFFFFF"
    */
    var Color = function (r, g, b, a) {
        this.c = pc.math.vec4.create();

        if (arguments.length >= 3) {
            this.set(r, g, b, a);
        } else if (r === undefined) {
            this.set(0,0,0,1);
        } else if (typeof(r) === 'string') {
            this.fromString(r);
        } else if (r.length !== undefined) {
            this.set(r);
        }
    };

    Color.prototype = {
        get r () {
            return this.c[0];
        },

        set r (v) {
            this.c[0] = v;
        },

        get g () {
            return this.c[1];
        },

        set g (v) {
            this.c[1] = v;
        },

        get b () {
            return this.c[2];
        },

        set b (v) {
            this.c[2] = v;
        },

        get a () {
            return this.c[3];
        },

        set a (v) {
            this.c[3] = v;
        },

        /**
        * @function
        * @name pc.Color#set
        * @description Assign values to the color components, including alpha
        * @param {Number} r The value for red (0-1)
        * @param {Number} g The value for blue (0-1)
        * @param {Number} b The value for green (0-1)
        * @param {Number} [a] The value for the alpha (0-1), defaults to 1
        */
        /**
        * @function
        * @name pc.Color#set
        * @description Assign values to the color components
        * @param {pc.Color|pc.math.vec4|pc.math.vec3} color An existing color or vector
        */
        set: function (r, g, b, a) {
            if (arguments.length > 1) {
                if (a === undefined) {
                    a = 1;
                }
                pc.math.vec4.set(this.c, r, g, b, a);
            } else {
                if (r[3] === undefined) {
                    r[3] = 1;
                }
                pc.math.vec4.copy(r, this.c);
            }
            pc.math.vec4.normalize(this.c, this.c);
        },

        fromString: function (hex) {
            var i = parseInt(hex.replace('#', '0x'));
            var bytes;
            if (hex.length > 7) {
                bytes = pc.math.intToBytes32(i);
            } else {
                bytes = pc.math.intToBytes24(i);
                bytes[3] = 255;
            }

            this.set(bytes[0]/255, bytes[1]/255, bytes[2]/255, bytes[3]/255);
        }

        // toString: function () {

        // }
    };

    return {
        Color: Color
    };

}()));