import { EventHandler } from '../core/event-handler.js';

import { Asset } from '../asset/asset.js';

import { I18nParser } from './i18n-parser.js';

import {
    DEFAULT_LOCALE,
    DEFAULT_LOCALE_FALLBACKS
} from './constants.js';

import {
    replaceLang,
    getLang,
    getPluralFn,
    findAvailableLocale
} from './utils.js';

/**
 * @class
 * @name I18n
 * @augments EventHandler
 * @classdesc Handles localization. Responsible for loading localization assets
 * and returning translations for a certain key. Can also handle plural forms. To override
 * its default behavior define a different implementation for {@link I18n#getText} and {@link I18n#getPluralText}.
 * @param {Application} app - The application.
 * @property {string} locale The current locale for example "en-US". Changing the locale will raise an event which will cause localized Text Elements to
 * change language to the new locale.
 * @property {number[]|Asset[]} assets An array of asset ids or assets that contain localization data in the expected format. I18n will automatically load
 * translations from these assets as the assets are loaded and it will also automatically unload translations if the assets get removed or unloaded at runtime.
 */
class I18n extends EventHandler {
    constructor(app) {
        super();

        this.locale = DEFAULT_LOCALE;
        this._translations = {};
        this._availableLangs = {};
        this._app = app;
        this._assets = [];
        this._parser = new I18nParser();
    }

    /**
     * @private
     * @static
     * @function
     * @name I18n.findAvailableLocale
     * @description Returns the first available locale based on the desired locale specified. First
     * tries to find the desired locale and then tries to find an alternative locale based on the language.
     * @param {string} desiredLocale - The desired locale e.g. en-US.
     * @param {object} availableLocales - A dictionary where each key is an available locale.
     * @returns {string} The locale found or if no locale is available returns the default en-US locale.
     * @example
     * // With a defined dictionary of locales
     * var availableLocales = { en: 'en-US', fr: 'fr-FR' };
     * var locale = pc.I18n.getText('en-US', availableLocales);
     * // returns 'en'
     */
    static findAvailableLocale(desiredLocale, availableLocales) {
        return findAvailableLocale(desiredLocale, availableLocales);
    }

    /**
     * @function
     * @name I18n#findAvailableLocale
     * @description Returns the first available locale based on the desired locale specified. First
     * tries to find the desired locale in the loaded translations and then tries to find an alternative
     * locale based on the language.
     * @param {string} desiredLocale - The desired locale e.g. en-US.
     * @returns {string} The locale found or if no locale is available returns the default en-US locale.
     * @example
     * var locale = this.app.i18n.getText('en-US');
     */
    findAvailableLocale(desiredLocale) {
        if (this._translations[desiredLocale]) {
            return desiredLocale;
        }

        const lang = getLang(desiredLocale);
        return this._findFallbackLocale(desiredLocale, lang);
    }

    /**
     * @function
     * @name I18n#getText
     * @description Returns the translation for the specified key and locale. If the locale is not specified
     * it will use the current locale.
     * @param {string} key - The localization key.
     * @param {string} [locale] - The desired locale.
     * @returns {string} The translated text. If no translations are found at all for the locale then it will return
     * the en-US translation. If no translation exists for that key then it will return the localization key.
     * @example
     * var localized = this.app.i18n.getText('localization-key');
     * var localizedFrench = this.app.i18n.getText('localization-key', 'fr-FR');
     */
    getText(key, locale) {
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

            locale = this._findFallbackLocale(locale, lang);
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
    }

    /**
     * @function
     * @name I18n#getPluralText
     * @description Returns the pluralized translation for the specified key, number n and locale. If the locale is not specified
     * it will use the current locale.
     * @param {string} key - The localization key.
     * @param {number} n - The number used to determine which plural form to use. E.g. For the phrase "5 Apples" n equals 5.
     * @param {string} [locale] - The desired locale.
     * @returns {string} The translated text. If no translations are found at all for the locale then it will return
     * the en-US translation. If no translation exists for that key then it will return the localization key.
     * @example
     * // manually replace {number} in the resulting translation with our number
     * var localized = this.app.i18n.getPluralText('{number} apples', number).replace("{number}", number);
     */
    getPluralText(key, n, locale) {
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
            locale = this._findFallbackLocale(locale, lang);
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
    }

    /**
     * @function
     * @name I18n#addData
     * @description Adds localization data. If the locale and key for a translation already exists it will be overwritten.
     * @param {object} data - The localization data. See example for the expected format of the data.
     * @example
     * this.app.i18n.addData({
     *     header: {
     *         version: 1
     *     },
     *     data: [{
     *         info: {
     *             locale: 'en-US'
     *         },
     *         messages: {
     *             "key": "translation",
     *             // The number of plural forms depends on the locale. See the manual for more information.
     *             "plural_key": ["one item", "more than one items"]
     *         }
     *     }, {
     *         info: {
     *             locale: 'fr-FR'
     *         },
     *         messages: {
     *             // ...
     *         }
     *     }]
     * });
     */
    addData(data) {
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
    }

    /**
     * @function
     * @name I18n#removeData
     * @description Removes localization data.
     * @param {object} data - The localization data. The data is expected to be in the same format as {@link I18n#addData}.
     */
    removeData(data) {
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
    }

    /**
     * @function
     * @name I18n#destroy
     * @description Frees up memory.
     */
    destroy() {
        this._translations = null;
        this._availableLangs = null;
        this._assets = null;
        this._parser = null;
        this.off();
    }

    get locale() {
        return this._locale;
    }

    set locale(value) {
        if (this._locale === value) {
            return;
        }

        // replace 'in' language with 'id'
        // for Indonesian because both codes are valid
        // so that users only need to use the 'id' code
        var lang = getLang(value);
        if (lang === 'in') {
            lang = 'id';
            value = replaceLang(value, lang);
            if (this._locale === value) {
                return;
            }
        }

        var old = this._locale;
        // cache locale, lang and plural function
        this._locale = value;
        this._lang = lang;
        this._pluralFn = getPluralFn(this._lang);

        // raise event
        this.fire('set:locale', value, old);
    }

    get assets() {
        return this._assets;
    }

    set assets(value) {
        var i;
        var len;
        var id;
        var asset;

        var index = {};

        // convert array to dict
        for (i = 0, len = value.length; i < len; i++) {
            id = value[i] instanceof Asset ? value[i].id : value[i];
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

    // Finds a fallback locale for the specified locale and language.
    // 1) First tries DEFAULT_LOCALE_FALLBACKS
    // 2) If no translation exists for that locale return the first locale available for that language.
    // 3) If no translation exists for that either then return the DEFAULT_LOCALE
    _findFallbackLocale(locale, lang) {
        var result = DEFAULT_LOCALE_FALLBACKS[locale];
        if (result && this._translations[result]) {
            return result;
        }

        result = DEFAULT_LOCALE_FALLBACKS[lang];
        if (result && this._translations[result]) {
            return result;
        }

        result = this._availableLangs[lang];
        if (result && this._translations[result]) {
            return result;
        }

        return DEFAULT_LOCALE;
    }

    _onAssetAdd(asset) {
        asset.on('load', this._onAssetLoad, this);
        asset.on('change', this._onAssetChange, this);
        asset.on('remove', this._onAssetRemove, this);
        asset.on('unload', this._onAssetUnload, this);

        if (asset.resource) {
            this._onAssetLoad(asset);
        }
    }

    _onAssetLoad(asset) {
        this.addData(asset.resource);
    }

    _onAssetChange(asset) {
        if (asset.resource) {
            this.addData(asset.resource);
        }
    }

    _onAssetRemove(asset) {
        asset.off('load', this._onAssetLoad, this);
        asset.off('change', this._onAssetChange, this);
        asset.off('remove', this._onAssetRemove, this);
        asset.off('unload', this._onAssetUnload, this);

        if (asset.resource) {
            this.removeData(asset.resource);
        }

        this._app.assets.once('add:' + asset.id, this._onAssetAdd, this);
    }

    _onAssetUnload(asset) {
        if (asset.resource) {
            this.removeData(asset.resource);
        }
    }
}

export { I18n };
