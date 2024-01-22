const ASCII_LOWERCASE = 'abcdefghijklmnopqrstuvwxyz';
const ASCII_UPPERCASE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const ASCII_LETTERS = ASCII_LOWERCASE + ASCII_UPPERCASE;

const HIGH_SURROGATE_BEGIN = 0xD800;
const HIGH_SURROGATE_END = 0xDBFF;
const LOW_SURROGATE_BEGIN = 0xDC00;
const LOW_SURROGATE_END = 0xDFFF;
const ZERO_WIDTH_JOINER = 0x200D;

// Flag emoji
const REGIONAL_INDICATOR_BEGIN = 0x1F1E6;
const REGIONAL_INDICATOR_END = 0x1F1FF;

// Skin color modifications to emoji
const FITZPATRICK_MODIFIER_BEGIN = 0x1F3FB;
const FITZPATRICK_MODIFIER_END = 0x1F3FF;

// Accent characters
const DIACRITICAL_MARKS_BEGIN = 0x20D0;
const DIACRITICAL_MARKS_END = 0x20FF;

// Special emoji joins
const VARIATION_MODIFIER_BEGIN = 0xFE00;
const VARIATION_MODIFIER_END = 0xFE0F;

function getCodePointData(string, i = 0) {
    const size = string.length;

    // Account for out-of-bounds indices:
    if (i < 0 || i >= size) {
        return null;
    }
    const first = string.charCodeAt(i);
    if (size > 1 && first >= HIGH_SURROGATE_BEGIN && first <= HIGH_SURROGATE_END) {
        const second = string.charCodeAt(i + 1);
        if (second >= LOW_SURROGATE_BEGIN && second <= LOW_SURROGATE_END) {
            // https://mathiasbynens.be/notes/javascript-encoding#surrogate-formulae
            return {
                code: (first - HIGH_SURROGATE_BEGIN) * 0x400 + second - LOW_SURROGATE_BEGIN + 0x10000,
                long: true
            };
        }
    }

    return {
        code: first,
        long: false
    };
}

function isCodeBetween(string, begin, end) {
    if (!string)
        return false;
    const codeData = getCodePointData(string);
    if (codeData) {
        const code = codeData.code;
        return code >= begin && code <= end;
    }
    return false;
}

function numCharsToTakeForNextSymbol(string, index) {
    if (index === string.length - 1) {
        // Last character in the string, so we can only take 1
        return 1;
    }
    if (isCodeBetween(string[index], HIGH_SURROGATE_BEGIN, HIGH_SURROGATE_END)) {
        const first = string.substring(index, index + 2);
        const second = string.substring(index + 2, index + 4);

        // check if second character is fitzpatrick (color) modifier
        // or if this is a pair of regional indicators (a flag)
        if (isCodeBetween(second, FITZPATRICK_MODIFIER_BEGIN, FITZPATRICK_MODIFIER_END) ||
            (isCodeBetween(first, REGIONAL_INDICATOR_BEGIN, REGIONAL_INDICATOR_END) &&
            isCodeBetween(second, REGIONAL_INDICATOR_BEGIN, REGIONAL_INDICATOR_END))
        ) {
            return 4;
        }

        // check if next character is a modifier, in which case we should return it
        if (isCodeBetween(second, VARIATION_MODIFIER_BEGIN, VARIATION_MODIFIER_END)) {
            return 3;
        }

        // return surrogate pair
        return 2;
    }

    // check if next character is the emoji modifier, in which case we should include it
    if (isCodeBetween(string[index + 1], VARIATION_MODIFIER_BEGIN, VARIATION_MODIFIER_END)) {
        return 2;
    }

    // just a regular character
    return 1;
}

/**
 * Extended String API.
 *
 * @namespace
 */
const string = {
    /**
     * All lowercase letters.
     *
     * @type {string}
     */
    ASCII_LOWERCASE: ASCII_LOWERCASE,

    /**
     * All uppercase letters.
     *
     * @type {string}
     */
    ASCII_UPPERCASE: ASCII_UPPERCASE,

    /**
     * All ASCII letters.
     *
     * @type {string}
     */
    ASCII_LETTERS: ASCII_LETTERS,

    /**
     * Return a string with \{n\} replaced with the n-th argument.
     *
     * @param {string} s - The string to format.
     * @param {...*} args - All other arguments are substituted into the string.
     * @returns {string} The formatted string.
     * @example
     * const s = pc.string.format("Hello {0}", "world");
     * console.log(s); // Prints "Hello world"
     */
    format(s, ...args) {
        for (let i = 0; i < args.length; i++) {
            s = s.replace(`{${i}}`, args[i]);
        }
        return s;
    },

    /**
     * Get the code point number for a character in a string. Polyfill for
     * [`codePointAt`]{@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/codePointAt}.
     *
     * @param {string} string - The string to get the code point from.
     * @param {number} [i] - The index in the string.
     * @returns {number} The code point value for the character in the string.
     */
    getCodePoint(string, i) {
        const codePointData = getCodePointData(string, i);
        return codePointData && codePointData.code;
    },

    /**
     * Gets an array of all code points in a string.
     *
     * @param {string} string - The string to get code points from.
     * @returns {number[]} The code points in the string.
     */
    getCodePoints(string) {
        if (typeof string !== 'string') {
            throw new TypeError('Not a string');
        }
        let i = 0;
        const arr = [];
        let codePoint;
        while (!!(codePoint = getCodePointData(string, i))) {
            arr.push(codePoint.code);
            i += codePoint.long ? 2 : 1;
        }
        return arr;
    },

    /**
     * Gets an array of all grapheme clusters (visible symbols) in a string. This is needed because
     * some symbols (such as emoji or accented characters) are actually made up of multiple
     * character codes. See {@link https://mathiasbynens.be/notes/javascript-unicode here} for more
     * info.
     *
     * @param {string} string - The string to break into symbols.
     * @returns {string[]} The symbols in the string.
     */
    getSymbols(string) {
        if (typeof string !== 'string') {
            throw new TypeError('Not a string');
        }
        let index = 0;
        const length = string.length;
        const output = [];
        let take = 0;
        let ch;
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
            const char = string.substring(index, index + take);
            output.push(char);
            index += take;
            take = 0;
        }
        return output;
    },

    /**
     * Get the string for a given code point or set of code points. Polyfill for
     * [`fromCodePoint`]{@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/fromCodePoint}.
     *
     * @param {...number} args - The code points to convert to a string.
     * @returns {string} The converted string.
     */
    fromCodePoint(/* ...args */) {
        const chars = [];
        let current;
        let codePoint;
        let units;
        for (let i = 0; i < arguments.length; ++i) {
            current = Number(arguments[i]);
            codePoint = current - 0x10000;
            units = current > 0xFFFF ? [(codePoint >> 10) + 0xD800, (codePoint % 0x400) + 0xDC00] : [current];
            chars.push(String.fromCharCode.apply(null, units));
        }
        return chars.join('');
    }
};

export { string };
