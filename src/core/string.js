/**
 * @namespace
 * @name pc.string
 * @description Extended String API
 */
pc.string = function () {
    var HIGH_SURROGATE_BEGIN = 0xD800;
    var HIGH_SURROGATE_END = 0xDBFF;
    var LOW_SURROGATE_BEGIN = 0xDC00;
    var LOW_SURROGATE_END = 0xDFFF;
    var ZERO_WIDTH_JOINER = 0x200D;

    // Flag emoji
    var REGIONAL_INDICATOR_BEGIN = 0x1F1E6;
    var REGIONAL_INDICATOR_END = 0x1F1FF;

    // Skin color modifications to emoji
    var FITZPATRICK_MODIFIER_BEGIN = 0x1F3FB;
    var FITZPATRICK_MODIFIER_END = 0x1F3FF;

    // Accent characters
    var DIACRITICAL_MARKS_BEGIN = 0x20D0;
    var DIACRITICAL_MARKS_END = 0x20FF;

    // Special emoji joins
    var VARIATION_MODIFIER_BEGIN = 0xFE00;
    var VARIATION_MODIFIER_END = 0xFE0F;

    function getCodePoint(string) {
        var size = string.length;
        var first = string.charCodeAt(0);
        var second;
        if (size > 1 && first >= HIGH_SURROGATE_BEGIN && first <= HIGH_SURROGATE_END) {
            second = string.charCodeAt(1);
            if (second >= LOW_SURROGATE_BEGIN && second <= LOW_SURROGATE_END) {
                // https://mathiasbynens.be/notes/javascript-encoding#surrogate-formulae
                return (first - HIGH_SURROGATE_BEGIN) * 0x400 + second - LOW_SURROGATE_BEGIN + 0x10000;
            }
        }
        return first;
    }

    function isCodeBetween(string, begin, end) {
        if (!string)
            return false;
        var code = getCodePoint(string);
        return code >= begin && code <= end;
    }

    function numCharsToTakeForNextSymbol(string, index) {
        if (index === string.length - 1) {
            // Last character in the string, so we can only take 1
            return 1;
        }
        if (isCodeBetween(string[index], HIGH_SURROGATE_BEGIN, HIGH_SURROGATE_END)) {
            var first = string.substring(index, index + 2);
            var second = string.substring(index + 2, index + 4);
            if (
                isCodeBetween(second, FITZPATRICK_MODIFIER_BEGIN, FITZPATRICK_MODIFIER_END) ||
                (isCodeBetween(first, REGIONAL_INDICATOR_BEGIN, REGIONAL_INDICATOR_END) &&
                isCodeBetween(second, REGIONAL_INDICATOR_BEGIN, REGIONAL_INDICATOR_END))
            ) {
                return 4;
            }
            return 2;
        }
        return 1;
    }

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
        getCodePoint: getCodePoint,
        getSymbols: function (string) {
            if (typeof string !== 'string') {
                throw new TypeError('Not a string');
            }
            var index = 0;
            var length = string.length;
            var output = [];
            var take = 0;
            var ch;
            while (index < length) {
                take += numCharsToTakeForNextSymbol(string, index + take);
                ch = string[index + take];
                // Handle special cases
                if (isCodeBetween(ch, DIACRITICAL_MARKS_BEGIN, DIACRITICAL_MARKS_END)) {
                    ch = string[index + (take++)];
                }
                if (isCodeBetween(ch, VARIATION_MODIFIER_BEGIN, VARIATION_MODIFIER_END)) {
                    ch = string[index + (take++)];
                }
                if (ch && ch.charCodeAt(0) === ZERO_WIDTH_JOINER) {
                    ch = string[index + (take++)];
                    // Not a complete char yet
                    continue;
                }
                var char = string.substring(index, index + take);
                output.push(char);
                index += take;
                take = 0;
            }
            return output;
        }
    };
}();
