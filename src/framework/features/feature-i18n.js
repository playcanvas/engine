import { DebugHelper } from '../../core/debug.js';
import { Feature } from '../../scene/features/feature.js';
import { I18n } from '../i18n/i18n.js';
import { FEATURE_I18N } from './constants.js';

/**
 * @import { AppBase } from '../app-base.js'
 */

/**
 * Localization: translated texts and localized assets, see {@link I18n}.
 *
 * @type {Feature}
 * @ignore
 */
export const featureI18n = /* #__PURE__ */ new Feature({
    // creates the localization of the application
    install: (host) => {
        const app = /** @type {AppBase} */ (host);
        app.i18n = new I18n(app);
    }
});
DebugHelper.setName(featureI18n, FEATURE_I18N);
