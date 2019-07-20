Object.assign(pc, (function () {
    // Maps locale to function that returns the plural index
    // based on the CLDR rules. See here for reference
    // https://www.unicode.org/cldr/charts/latest/supplemental/language_plural_rules.html
    // and http://unicode.org/reports/tr35/tr35-numbers.html#Operands .
    // An initial set of locales is supported and we can keep adding more as we go.
    var PLURALS = {};

    // Helper function to define the plural function for an array of locales
    var definePluralFn = function (locales, fn) {
        for (var i = 0, len = locales.length; i < len; i++) {
            PLURALS[locales[i]] = fn;
        }
    };

    // Gets the language portion form a locale
    var getLang = function (locale) {
        var idx = locale.indexOf('-');
        if (idx !== -1) {
            return locale.substring(0, idx);
        }

        return locale;
    };

    var DEFAULT_LOCALE = 'en-US';

    // default locale fallbacks if a specific locale
    // was not found. E.g. if the desired locale is en-AS but we
    // have en-US and en-GB then pick en-US. If a fallback does not exist either
    // then pick the first that satisfies the language.
    var DEFAULT_LOCALE_FALLBACKS = {
        'en': 'en-US',
        'es': 'en-ES',
        'zh': 'zh-CN',
        'fr': 'fr-FR',
        'de': 'de-DE',
        'it': 'it-IT',
        'ru': 'ru-RU',
        'ja': 'ja-JP'
    };

    // Only OTHER
    definePluralFn([
        'ja',
        'ko',
        'th',
        'vi',
        'zh'
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

    definePluralFn([
        'fr'
    ], function (n) {
        if (n >= 0 && n < 2) {
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
        'tr'
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
    var getPluralFn = function (lang) {
        return PLURALS[lang] || DEFAULT_PLURAL_FN;
    };

    /**
     * @private
     * @constructor
     * @name pc.I18n
     * @classdesc Handles localization. Responsible for loading localization assets
     * and returning translations for a certain key. Can also handle plural forms. To override
     * its default behaviour define a different implementation for {@link pc.I18n#getText} and {@link pc.I18n#getPluralText}.
     * @param {pc.Application} app The application.
     * @property {String} locale The current locale for example "en-US". Changing the locale will raise an event which will cause localized Text Elements to
     * change language to the new locale.
     * @property {Number[]|pc.Asset[]} assets An array of asset ids or assets that contain localization data in the expected format. I18n will automatically load
     * translations from these assets as the assets are loaded and it will also automatically unload translations if the assets get removed or unloaded at runtime.
     */
    var I18n = function (app) {
        pc.events.attach(this);

        this.locale = DEFAULT_LOCALE;
        this._translations = {};
        this._availableLangs = {};
        this._app = app;
        this._assets = [];
        this._parser = new pc.I18nParser();
    };

    /**
     * @private
     * @function
     * @name pc.I18n#findAvailableLocale
     * @description Returns the first available locale based on the desired locale specified. First
     * tries to find the desired locale and then tries to find an alternative locale based on the language.
     * @param {String} desiredLocale The desired locale e.g. en-US.
     * @param {Object} availableLocales A dictionary where each key is an available locale.
     * @returns {String} The locale found or if no locale is available returns the default en-US locale.
     */
    I18n.findAvailableLocale = function (desiredLocale, availableLocales) {
        if (availableLocales[desiredLocale]) {
            return desiredLocale;
        }

        var lang = getLang(desiredLocale);

        var fallback = DEFAULT_LOCALE_FALLBACKS[lang];
        if (availableLocales[fallback]) {
            return fallback;
        }

        if (availableLocales[lang]) {
            return lang;
        }

        return DEFAULT_LOCALE;
    };

    /**
     * @private
     * @function
     * @name pc.I18n#getText
     * @description Returns the translation for the specified key and locale. If the locale is not specified
     * it will use the current locale.
     * @param {String} key The localization key
     * @param {String} [locale] The desired locale.
     * @returns {String} The translated text. If no translations are found at all for the locale then it will return
     * the en-US translation. If no translation exists for that key then it will return the localization key.
     * @example
     * var localized = this.app.i18n.getText('localization-key');
     * var localizedFrench = this.app.i18n.getText('localization-key', 'fr-FR');
     */
    I18n.prototype.getText = function (key, locale) {
        // default translation is the key
        var result = key;

        var lang;
        if (!locale) {
            locale = this._locale;
            lang = this._lang;
        }

        var translations = this._translations[locale];
        if (!translations) {
            if (!lang) {
                lang = getLang(locale);
            }

            locale = this._findFallbackLocale(lang);
            translations = this._translations[locale];
        }

        if (translations && translations.hasOwnProperty(key)) {
            result = translations[key];

            // if this is a plural key then return the first entry in the array
            if (Array.isArray(result)) {
                result = result[0];
            }

            // if null or undefined switch back to the key (empty string is allowed)
            if (result === null || result === undefined) {
                result = key;
            }
        }

        return result;
    };

    /**
     * @private
     * @function
     * @name pc.I18n#getPluralText
     * @description Returns the pluralized translation for the specified key, number n and locale. If the locale is not specified
     * it will use the current locale.
     * @param {String} key The localization key
     * @param {Nubmer} n The number used to determine which plural form to use. E.g. for the phrase "5 Apples" n equals 5.
     * @param {String} [locale] The desired locale.
     * @returns {String} The translated text. If no translations are found at all for the locale then it will return
     * the en-US translation. If no translation exists for that key then it will return the localization key.
     * @example
     * // manually replace {number} in the resulting translation with our number
     * var localized = this.app.i18n.getPluralText('{number} apples', number).replace("{number}", number);
     */
    I18n.prototype.getPluralText = function (key, n, locale) {
        // default translation is the key
        var result = key;

        var pluralFn;
        var lang;

        if (!locale) {
            locale = this._locale;
            lang = this._lang;
            pluralFn = this._pluralFn;
        } else {
            lang = getLang(locale);
            pluralFn = getPluralFn(lang);
        }

        var translations = this._translations[locale];
        if (!translations) {
            locale = this._findFallbackLocale(lang);
            lang = getLang(locale);
            pluralFn = getPluralFn(lang);
            translations = this._translations[locale];
        }

        if (translations && translations[key] && pluralFn) {
            var index = pluralFn(n);
            result = translations[key][index];

            // if null or undefined switch back to the key (empty string is allowed)
            if (result === null || result === undefined) {
                result = key;
            }
        }

        return result;
    };

    /**
     * @private
     * @function
     * @name pc.I18n#addData
     * @description Adds localization data. If the locale and key for a translation already exists it will be overwritten.
     * @param {Object} data The localization data. See example for the expected format of the data.
     * @example
     * this.app.i18n.addData({
     *   header: {
     *      version: 1
     *   },
     *   data: [{
     *      info: {
     *          locale: 'en-US'
     *      },
     *      messages: {
     *          "key": "translation",
     *           // The number of plural forms depends on the locale. See the manual for more information.
     *          "plural_key": ["one item", "more than one items"]
     *      }
     *   }, {
     *      info: {
     *          locale: 'fr-FR'
     *      },
     *      messages: {
     *         // ...
     *      }
     *   }]
     * });
     */
    I18n.prototype.addData = function (data) {
        var parsed;
        try {
            parsed = this._parser.parse(data);
        } catch (err) {
            console.error(err);
            return;
        }

        for (var i = 0, len = parsed.length; i < len; i++) {
            var entry = parsed[i];
            var locale = entry.info.locale;
            var messages = entry.messages;
            if (!this._translations[locale]) {
                this._translations[locale] = {};
                var lang = getLang(locale);

                // remember the first locale we've found for that language
                // in case we need to fall back to it
                if (!this._availableLangs[lang]) {
                    this._availableLangs[lang] = locale;
                }
            }

            Object.assign(this._translations[locale], messages);

            this.fire('data:add', locale, messages);
        }
    };

    /**
     * @private
     * @function
     * @name pc.I18n#removeData
     * @description Removes localization data.
     * @param {Object} data The localization data. The data is expected to be in the same format as {@link pc.I18n#addData}.
     */
    I18n.prototype.removeData = function (data) {
        var parsed;
        var key;
        try {
            parsed = this._parser.parse(data);
        } catch (err) {
            console.error(err);
            return;
        }

        for (var i = 0, len = parsed.length; i < len; i++) {
            var entry = parsed[i];
            var locale = entry.info.locale;
            var translations = this._translations[locale];
            if (!translations) continue;

            var messages = entry.messages;
            for (key in messages) {
                delete translations[key];
            }

            // if no more entries for that locale then
            // delete the locale
            var hasAny = false;
            for (key in translations) {
                hasAny = true;
                break;
            }

            if (!hasAny) {
                delete this._translations[locale];
                delete this._availableLangs[getLang(locale)];
            }

            this.fire('data:remove', locale, messages);
        }
    };

    /**
     * @private
     * @function
     * @name pc.I18n#destroy
     * @description Frees up memory.
     */
    I18n.prototype.destroy = function () {
        this._translations = null;
        this._availableLangs = null;
        this._assets = null;
        this._parser = null;
        this.off();
    };

    Object.defineProperty(I18n.prototype, 'locale', {
        get: function () {
            return this._locale;
        },
        set: function (value) {
            if (this._locale === value) {
                return;
            }

            var old = this._locale;
            // cache locale, lang and plural function
            this._locale = value;
            this._lang = getLang(value);
            this._pluralFn = getPluralFn(this._lang);

            // raise event
            this.fire('set:locale', value, old);
        }
    });

    Object.defineProperty(I18n.prototype, 'assets', {
        get: function () {
            return this._assets;
        },
        set: function (value) {
            var i;
            var len;
            var id;
            var asset;

            var index = {};

            // convert array to dict
            for (i = 0, len = value.length; i < len; i++) {
                id = value[i] instanceof pc.Asset ? value[i].id : value[i];
                index[id] = true;
            }

            // remove assets not in value
            i = this._assets.length;
            while (i--) {
                id = this._assets[i];
                if (!index[id]) {
                    this._app.assets.off('add:' + id, this._onAssetAdd, this);
                    asset = this._app.assets.get(id);
                    if (asset) {
                        this._onAssetRemove(asset);
                    }
                    this._assets.splice(i, 1);
                }
            }

            // add assets in value that do not already exist here
            for (id in index) {
                id = parseInt(id, 10);
                if (this._assets.indexOf(id) !== -1) continue;

                this._assets.push(id);
                asset = this._app.assets.get(id);
                if (!asset) {
                    this._app.assets.once('add:' + id, this._onAssetAdd, this);
                } else {
                    this._onAssetAdd(asset);
                }
            }
        }
    });

    // Finds a fallback locale for the specified language.
    // 1) First tries DEFAULT_LOCALE_FALLBACKS
    // 2) If no translation exists for that locale return the first locale available for that language.
    // 3) If no translation exists for that either then return the DEFAULT_LOCALE
    I18n.prototype._findFallbackLocale = function (lang) {
        var result = DEFAULT_LOCALE_FALLBACKS[lang];
        if (result && this._translations[result]) {
            return result;
        }

        result = this._availableLangs[lang];
        if (result && this._translations[result]) {
            return result;
        }

        return DEFAULT_LOCALE;
    };

    I18n.prototype._onAssetAdd = function (asset) {
        asset.on('load', this._onAssetLoad, this);
        asset.on('change', this._onAssetChange, this);
        asset.on('remove', this._onAssetRemove, this);
        asset.on('unload', this._onAssetUnload, this);

        if (asset.resource) {
            this._onAssetLoad(asset);
        }
    };

    I18n.prototype._onAssetLoad = function (asset) {
        this.addData(asset.resource);
    };

    I18n.prototype._onAssetChange = function (asset) {
        if (asset.resource) {
            this.addData(asset.resource);
        }
    };

    I18n.prototype._onAssetRemove = function (asset) {
        asset.off('load', this._onAssetLoad, this);
        asset.off('change', this._onAssetChange, this);
        asset.off('remove', this._onAssetRemove, this);
        asset.off('unload', this._onAssetUnload, this);

        if (asset.resource) {
            this.removeData(asset.resource);
        }

        this._app.assets.once('add:' + asset.id, this._onAssetAdd, this);
    };

    I18n.prototype._onAssetUnload = function (asset) {
        if (asset.resource) {
            this.removeData(asset.resource);
        }
    };

    return {
        I18n: I18n
    };
}()));
