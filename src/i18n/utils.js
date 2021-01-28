import {
    DEFAULT_LOCALE,
    DEFAULT_LOCALE_FALLBACKS
} from './constants.js';

// Maps locale to function that returns the plural index
// based on the CLDR rules. See here for reference
// https://www.unicode.org/cldr/charts/latest/supplemental/language_plural_rules.html
// and http://unicode.org/reports/tr35/tr35-numbers.html#Operands .
// An initial set of locales is supported and we can keep adding more as we go.
var PLURALS = {};

// Helper function to define the plural function for an array of locales
function definePluralFn(locales, fn) {
    for (var i = 0, len = locales.length; i < len; i++) {
        PLURALS[locales[i]] = fn;
    }
}

// Gets the language portion form a locale
function getLang(locale) {
    var idx = locale.indexOf('-');
    if (idx !== -1) {
        return locale.substring(0, idx);
    }

    return locale;
}

// Replaces the language in the specified locale and returns the result
function replaceLang(locale, desiredLang) {
    var idx = locale.indexOf('-');
    if (idx !== -1) {
        return desiredLang + locale.substring(idx);
    }

    return desiredLang;
}

function findAvailableLocale(desiredLocale, availableLocales) {
    if (availableLocales[desiredLocale]) {
        return desiredLocale;
    }

    var fallback = DEFAULT_LOCALE_FALLBACKS[desiredLocale];
    if (fallback && availableLocales[fallback]) {
        return fallback;
    }

    var lang = getLang(desiredLocale);

    fallback = DEFAULT_LOCALE_FALLBACKS[lang];
    if (availableLocales[fallback]) {
        return fallback;
    }

    if (availableLocales[lang]) {
        return lang;
    }

    return DEFAULT_LOCALE;
}

// Only OTHER
definePluralFn([
    'ja',
    'ko',
    'th',
    'vi',
    'zh',
    'id'
], function (n) {
    return 0;
});

// ONE, OTHER
definePluralFn([
    'fa',
    'hi'
], function (n) {
    if (n >= 0 && n <= 1) {
        return 0; // one
    }

    return 1; // other
});

// from Unicode rules: i = 0..1
definePluralFn([
    'fr',
    'pt'
], function (n) {
    if (n >= 0 && n < 2) {
        return 0; // one
    }

    return 1; // other
});

// danish
definePluralFn([
    'da'
], function (n) {
    if (n === 1 || !Number.isInteger(n) && n >= 0 && n <= 1) {
        return 0; // one
    }

    return 1; // other
});

definePluralFn([
    'de',
    'en',
    'it',
    'el',
    'es',
    'tr',
    'fi',
    'sv',
    'nb',
    'no',
    'ur'
], function (n) {
    if (n === 1)  {
        return 0; // one
    }

    return 1; // other
});

// ONE, FEW, MANY, OTHER
definePluralFn([
    'ru',
    'uk'
], function (n) {
    if (Number.isInteger(n)) {
        var mod10 = n % 10;
        var mod100 = n % 100;

        if (mod10 === 1 && mod100 !== 11) {
            return 0; // one
        } else if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
            return 1; // few
        } else if (mod10 === 0 || mod10 >= 5 && mod10 <= 9 || mod100 >= 11 && mod100 <= 14) {
            return 2; // many
        }
    }

    return 3; // other
});

// polish
definePluralFn([
    'pl'
], function (n) {
    if (Number.isInteger(n)) {
        if (n === 1) {
            return 0; // one
        }
        var mod10 = n % 10;
        var mod100 = n % 100;

        if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
            return 1; // few
        } else if (mod10 >= 0 && mod10 <= 1 || mod10 >= 5 && mod10 <= 9 || mod100 >= 12 && mod100 <= 14) {
            return 2; // many
        }
    }

    return 3; // other
});

// ZERO, ONE, TWO, FEW, MANY, OTHER
definePluralFn([
    'ar'
], function (n) {
    if (n === 0)  {
        return 0; // zero
    } else if (n === 1) {
        return 1; // one
    } else if (n === 2) {
        return 2; // two
    }

    if (Number.isInteger(n)) {
        var mod100 = n % 100;
        if (mod100 >= 3 && mod100 <= 10) {
            return 3; // few
        } else if (mod100 >= 11 && mod100 <= 99) {
            return 4; // many
        }
    }

    return 5; // other
});

var DEFAULT_PLURAL_FN = PLURALS[getLang(DEFAULT_LOCALE)];

// Gets the function that converts to plural for a language
function getPluralFn(lang) {
    return PLURALS[lang] || DEFAULT_PLURAL_FN;
}

export {
    replaceLang,
    getLang,
    getPluralFn,
    findAvailableLocale
};
