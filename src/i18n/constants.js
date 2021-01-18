export const DEFAULT_LOCALE = 'en-US';

// default locale fallbacks if a specific locale
// was not found. E.g. if the desired locale is en-AS but we
// have en-US and en-GB then pick en-US. If a fallback does not exist either
// then pick the first that satisfies the language.
export const DEFAULT_LOCALE_FALLBACKS = {
    'en': 'en-US',
    'es': 'en-ES',
    'zh': 'zh-CN',
    'zh-HK': 'zh-TW',
    'zh-TW': 'zh-HK',
    'zh-MO': 'zh-HK',
    'fr': 'fr-FR',
    'de': 'de-DE',
    'it': 'it-IT',
    'ru': 'ru-RU',
    'ja': 'ja-JP'
};
