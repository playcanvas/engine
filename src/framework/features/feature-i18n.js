import { Feature } from '../../scene/features/feature.js';
import { I18n } from '../i18n/i18n.js';
import { FEATURE_I18N } from './constants.js';

/**
 * @import { FeatureHost } from '../../scene/features/feature.js'
 * @import { AppBase } from '../app-base.js'
 */

/**
 * Creates the localization of the application.
 *
 * @param {FeatureHost} host - The application the feature is installed into.
 */
function installI18n(host) {
    const app = /** @type {AppBase} */ (host);
    app.i18n = new I18n(app);
}

/**
 * Localization: translated texts and localized assets, see {@link I18n}.
 *
 * @type {Feature}
 * @ignore
 */
export const featureI18n = /* #__PURE__ */ new Feature({
    name: FEATURE_I18N,
    install: installI18n
});
