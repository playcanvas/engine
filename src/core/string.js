/**
 * @namespace
 * @name pc.string
 * @description Extended String API
 */
pc.string = function () {
    return {
        /**
         * @name pc.string.ASCII_LOWERCASE
         * @description All lowercase letters
         * @type String
         */
        ASCII_LOWERCASE: "abcdefghijklmnopqrstuvwxyz",

        /**
         * @name pc.string.ASCII_UPPERCASE
         * @description All uppercase letters
         * @type String
         */
        ASCII_UPPERCASE: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",

        /**
         * @name pc.string.ASCII_LETTERS
         * @description All ASCII letters
         * @type String
         */
        ASCII_LETTERS: this.ASCII_LOWERCASE + this.ASCII_UPPERCASE,
        /**
         * @function
         * @name pc.string.format
         * @description Return a string with {n} replaced with the n-th argument
         * @param {String} s The string to format
         * @param {Object} [arguments] All other arguments are substituted into the string
         * @returns {String} The formatted string
         * @example
         * var s = pc.string.format("Hello {0}", "world");
         * console.log(s); // Prints "Hello world"
         */
        format: function (s) {
            var i = 0,
                regexp,
                args = pc.makeArray(arguments);

            // drop first argument
            args.shift();

            for (i = 0; i < args.length; i++) {
                regexp = new RegExp('\\{' + i + '\\}', 'gi');
                s = s.replace(regexp, args[i]);
            }
            return s;
        },

        /**
         * @private
         * @function
         * @name pc.string.startsWith
         * @description Check if a string s starts with another string subs
         * @param {String} s The string to look in
         * @param {String} subs The string to look for
         * @returns {Boolean} True if s starts with subs
         * @deprecated
         * @example
         * var s = "abc";
         * if (pc.string.startsWith(s, "a")) {
         *   console.log('Starts with a');
         * }
         */
        startsWith: function (s, subs) {
            console.warn("WARNING: startsWith: Function is deprecated. Use String.startsWith instead.");
            return s.startsWith(subs);
        },

        /**
         * @private
         * @function
         * @name pc.string.endsWith
         * @description Check if a string s ends with another string subs
         * @param {String} s The string to look in
         * @param {String} subs The string to look for
         * @returns {Boolean} True if s ends with subs
         * @deprecated
         */
        endsWith: function (s, subs) {
            console.warn("WARNING: endsWith: Function is deprecated. Use String.endsWith instead.");
            return s.endsWith(subs);
        },

        /**
         * @function
         * @name pc.string.toBool
         * @description Convert a string value to a boolean. In non-strict mode (the default), 'true' is converted to true, all other values
         * are converted to false. In strict mode, 'true' is converted to true, 'false' is converted to false, all other values will throw
         * an Exception.
         * @param {String} s The string to convert
         * @param {Boolean} [strict] In strict mode an Exception is thrown if s is not an accepted string value. Defaults to false
         * @returns {Boolean} The converted value
         */
        toBool: function (s, strict) {
            if (s === 'true') {
                return true;
            }

            if (strict) {
                if (s === 'false') {
                    return false;
                }

                throw new TypeError('Not a boolean string');
            }

            return false;
        },
        getSurrogatePair: function (string, strIndex) {
            var first = string.charCodeAt(strIndex);
            var second;
            // See if the first char code has a high surrogate and there is another char code next to it
            if (first >= 0xD800 && first <= 0xDBFF && string.length > strIndex + 1) {
                // See if the next char code is a low surrogate
                second = string.charCodeAt(strIndex + 1);
                if (second >= 0xDC00 && second <= 0xDFFF) {
                    // https://mathiasbynens.be/notes/javascript-encoding#surrogate-formulae
                    var code = (first - 0xD800) * 0x400 + second - 0xDC00 + 0x10000;
                    return { char: string.substring(strIndex, strIndex + 2), code: code };
                }
            }
            return { char: string[strIndex], code: first };
        },
        getSymbols: function (string) {
            if (typeof string !== 'string') {
                throw new TypeError('Not a string');
            }
            var index = 0;
            var length = string.length;
            var output = [];
            while (index < length - 1) {
                var pair = this.getSurrogatePair(string, index);
                output.push(pair);
                index += pair.char.length;
            }
            return output;
        }
    };
}();
