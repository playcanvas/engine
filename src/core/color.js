Object.assign(pc, (function () {
    /**
     * @constructor
     * @name pc.Color
     * @classdesc Representation of an RGBA color
     * @description Create a new Color object
     * @param {Number} [r] The value of the red component (0-1). If r is an array of length 3 or 4, the array will be used to populate all components.
     * @param {Number} [g] The value of the green component (0-1)
     * @param {Number} [b] The value of the blue component (0-1)
     * @param {Number} [a] The value of the alpha component (0-1)
     * @property {Number} r The red component of the color
     * @property {Number} g The green component of the color
     * @property {Number} b The blue component of the color
     * @property {Number} a The alpha component of the color
     */
    var Color = function (r, g, b, a) {
        var length = r && r.length;
        if (length === 3 || length === 4) {
            this.r = r[0];
            this.g = r[1];
            this.b = r[2];
            this.a = r[3] !== undefined ? r[3] : 1;
        } else {
            this.r = r || 0;
            this.g = g || 0;
            this.b = b || 0;
            this.a = a !== undefined ? a : 1;
        }
    };

    Object.assign(Color.prototype, {
        /**
         * @function
         * @name pc.Color#clone
         * @description Returns a clone of the specified color.
         * @returns {pc.Color} A duplicate color object
         */
        clone: function () {
            return new pc.Color(this.r, this.g, this.b, this.a);
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
            this.r = rhs.r;
            this.g = rhs.g;
            this.b = rhs.b;
            this.a = rhs.a;

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
            this.r = r;
            this.g = g;
            this.b = b;
            this.a = (a === undefined) ? 1 : a;

            return this;
        },


        /**
         * @function
         * @name pc.Color#lerp
         * @description Returns the result of a linear interpolation between two specified colors
         * @param {pc.Color} lhs The color to interpolate from
         * @param {pc.Color} rhs The color to interpolate to.
         * @param {Number} alpha The value controlling the point of interpolation. Between 0 and 1, the linear interpolant
         * will occur on a straight line between lhs and rhs. Outside of this range, the linear interpolant will occur on
         * a ray extrapolated from this line.
         * @returns {pc.Color} Self for chaining.
         * @example
         * var a = new pc.Color(0, 0, 0);
         * var b = new pc.Color(1, 1, 0.5);
         * var r = new pc.Color();
         *
         * r.lerp(a, b, 0);   // r is equal to a
         * r.lerp(a, b, 0.5); // r is 0.5, 0.5, 0.25
         * r.lerp(a, b, 1);   // r is equal to b
         */
        lerp: function (lhs, rhs, alpha) {
            this.r = lhs.r + alpha * (rhs.r - lhs.r);
            this.g = lhs.g + alpha * (rhs.g - lhs.g);
            this.b = lhs.b + alpha * (rhs.b - lhs.b);
            this.a = lhs.a + alpha * (rhs.a - lhs.a);

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
            var i = parseInt(hex.replace('#', '0x'), 16);
            var bytes;
            if (hex.length > 7) {
                bytes = pc.math.intToBytes32(i);
            } else {
                bytes = pc.math.intToBytes24(i);
                bytes[3] = 255;
            }

            this.set(bytes[0] / 255, bytes[1] / 255, bytes[2] / 255, bytes[3] / 255);

            return this;
        },

        /**
         * @function
         * @name pc.Color#toString
         * @description Converts the color to string form. The format is '#RRGGBBAA', where
         * RR, GG, BB, AA are the red, green, blue and alpha values. When the alpha value is not
         * included (the default), this is the same format as used in HTML/CSS.
         * @param {Boolean} alpha If true, the output string will include the alpha value.
         * @returns {String} The color in string form.
         * @example
         * var c = new pc.Color(1, 1, 1);
         * // Should output '#ffffffff'
         * console.log(c.toString());
         */
        toString: function (alpha) {
            var s = "#" + ((1 << 24) + (Math.round(this.r * 255) << 16) + (Math.round(this.g * 255) << 8) + Math.round(this.b * 255)).toString(16).slice(1);
            if (alpha === true) {
                var a = Math.round(this.a * 255).toString(16);
                if (this.a < 16 / 255) {
                    s += '0' + a;
                } else {
                    s += a;
                }

            }

            return s;
        }
    });

    return {
        Color: Color
    };
}()));
