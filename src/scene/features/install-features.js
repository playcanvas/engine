import { Debug } from '../../core/debug.js';
import { ShaderChunks } from '../shader-lib/shader-chunks.js';
import { Feature } from './feature.js';

/**
 * @import { FeatureHost } from './feature.js'
 * @import { GraphicsDevice } from '../../platform/graphics/graphics-device.js'
 */

/**
 * The named features installed on each device, recorded in debug builds only, to report two
 * different features sharing a name.
 *
 * @type {WeakMap<GraphicsDevice, Map<string, Feature>>}
 */
const debugFeatures = new WeakMap();

/**
 * Installs features into a host, such as an application, and records them in the features of its
 * graphics device. The features each feature requires are installed before it, and a
 * feature is installed only once, however many times it is listed or required.
 *
 * @param {FeatureHost} host - The host the features are installed into.
 * @param {Feature[]} features - The features to install.
 * @ignore
 */
const installFeatures = (host, features) => {
    const device = host.graphicsDevice;
    const installed = device.features;

    for (const feature of features) {
        Debug.assert(feature instanceof Feature, 'Only features provided by the engine can be installed', feature);

        if (installed.has(feature)) {
            continue;
        }

        // marked before its requirements are installed, so that a cycle cannot recurse forever
        installed.add(feature);

        // debug checks ask for features by name
        Debug.call(() => {
            const name = feature.name;
            Debug.assert(name, 'A feature is installed without a name, set with DebugHelper.setName', feature);
            if (!name) {
                return;
            }

            let byName = debugFeatures.get(device);
            if (!byName) {
                byName = new Map();
                debugFeatures.set(device, byName);
            }
            const existing = byName.get(name);
            Debug.assert(!existing || existing === feature, `Two different features are named ${name}`);
            byName.set(name, feature);
            device.featureNames.add(name);
        });

        installFeatures(host, feature.requires);

        const chunks = feature.chunks;
        if (chunks) {
            Debug.assert(chunks.language, `The shader chunk collection of feature ${feature.name} has no language`);
            ShaderChunks.get(device, chunks.language).add(chunks.chunks);
        }

        feature.install?.(host);
    }
};

export { installFeatures };
