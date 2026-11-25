import { DebugHelper } from '../../core/debug.js';
import { Feature } from '../../scene/features/feature.js';
import { BundleRegistry } from '../bundle/bundle-registry.js';
import { BundleHandler } from '../handlers/bundle.js';
import { FEATURE_BUNDLES } from './constants.js';

/**
 * @import { FeatureHost } from '../../scene/features/feature.js'
 * @import { AppBase } from '../app-base.js'
 */

/**
 * Creates the bundle registry of the application, and registers the handler of bundle assets.
 *
 * @param {FeatureHost} host - The application the feature is installed into.
 */
function installBundles(host) {
    const app = /** @type {AppBase} */ (host);
    app.bundles = new BundleRegistry(app.assets);
    app.loader.addHandler('bundle', new BundleHandler(app));
}

/**
 * Asset bundles: loading assets from bundle assets, tar archives of their files.
 *
 * @type {Feature}
 * @ignore
 */
export const featureBundles = /* #__PURE__ */ new Feature({
    install: installBundles
});
DebugHelper.setName(featureBundles, FEATURE_BUNDLES);
