pc.extend(pc, (function () {
    /**
    * @name pc.Color
    * @class Representation of an RGBA color
    * @description Create a new Color object
    * @param {Number} r The value of the red component (0-1)
    * @param {Number} g The value of the green component (0-1)
    * @param {Number} b The value of the blue component (0-1)
    * @param {Number} [a] The value of the alpha component (0-1)
    * @property {Number} r The red component of the color
    * @property {Number} g The green component of the color
    * @property {Number} b The blue component of the color
    * @property {Number} a The alpha component of the color
    */
    var Color = function () {
        this.buffer = new ArrayBuffer(4 * 4);

        this.data = new Float32Array(this.buffer, 0, 4);
        this.data3 = new Float32Array(this.buffer, 0, 3);

        if (arguments.length >= 3) {
            this.data[0] = arguments[0];
            this.data[1] = arguments[1];
            this.data[2] = arguments[2];
            this.data[3] = (arguments.length >= 4) ? arguments[3] : 1;
        } else {
            this.data[0] = 0;
            this.data[1] = 0;
            this.data[2] = 0;
            this.data[3] = 1;
        }
    };

    Color.prototype = {
        /**
        * @function
        * @name pc.Color#clone
        * @description Returns a clone of the specified color.
        * @returns {pc.Color} A duplicate color object
        */
        clone: function () {
            return new pc.Color(this.data[0], this.data[1], this.data[2], this.data[3]);
        },

        /**
         * @function
         * @name pc.Color#copy
         * @description Copies the contents of a source color to a destination color.
         * @param {pc.Color} rhs A color to copy to the specified color.
         * @returns {pc.Color} Self for chaining
         * @example
         * var src = new pc.Color(1, 0, 0, 1);
         * var dst = new pc.Color();
         *
         * dst.copy(src);
         *
         * console.log("The two colors are " + (dst.equals(src) ? "equal" : "different"));
         */
        copy: function (rhs) {
            var a = this.data,
                b = rhs.data;

            a[0] = b[0];
            a[1] = b[1];
            a[2] = b[2];
            a[3] = b[3];

            return this;
        },

        /**
         * @function
         * @name pc.Color#set
         * @description Assign values to the color components, including alpha
         * @param {Number} r The value for red (0-1)
         * @param {Number} g The value for blue (0-1)
         * @param {Number} b The value for green (0-1)
         * @param {Number} [a] The value for the alpha (0-1), defaults to 1
         * @returns {pc.Color} Self for chaining
         */
        set: function (r, g, b, a) {
            var c = this.data;

            c[0] = r;
            c[1] = g;
            c[2] = b;
            c[3] = (a === undefined) ? 1 : a;

            return this;
        },

        /**
         * @function
         * @name pc.Color#fromString
         * @description Set the values of the color from a string representation '#11223344' or '#112233'.
         * @param {String} hex A string representation in the format '#RRGGBBAA' or '#RRGGBB'. Where RR, GG, BB, AA are red, green, blue and alpha values.
         * This is the same format used in HTML/CSS.
         * @returns {pc.Color} Self for chaining
         */
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

            return this;
        },

        /**
         * @function
         * @name pc.Color#toString
         * @description Converts the color to string form. The format is '#RRGGBBAA', where
         * RR, GG, BB, AA are the red, green, blue and alph values. When the alpha value is not
         * included (the default), this is the same format as used in HTML/CSS.
         * @returns {String} The color in string form.
         * @example
         * var c = new pc.Color(1, 1, 1);
         * // Should output '#ffffffff'
         * console.log(c.toString());
         */
        toString: function (alpha) {
            var s = "#" + ((1 << 24) + (parseInt(this.r*255) << 16) + (parseInt(this.g*255) << 8) + parseInt(this.b*255)).toString(16).slice(1);
            if (alpha === true) {
                var a = parseInt(this.a * 255).toString(16);
                if (this.a < 16/255) {
                    s += '0' + a;
                } else {
                    s += a;
                }

            }

            return s;
        }
    };

    Object.defineProperty(Color.prototype, 'r', {
        get: function () {
            return this.data[0];
        },
        set: function (value) {
            this.data[0] = value;
        }
    });

    Object.defineProperty(Color.prototype, 'g', {
        get: function () {
            return this.data[1];
        },
        set: function (value) {
            this.data[1] = value;
        }
    });

    Object.defineProperty(Color.prototype, 'b', {
        get: function () {
            return this.data[2];
        },
        set: function (value) {
            this.data[2] = value;
        }
    });

    Object.defineProperty(Color.prototype, 'a', {
        get: function () {
            return this.data[3];
        },
        set: function (value) {
            this.data[3] = value;
        }
    });

    return {
        Color: Color
    };
}()));
