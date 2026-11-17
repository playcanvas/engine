import { Debug } from '../../core/debug.js';
import { ShaderChunks } from '../shader-lib/shader-chunks.js';
import { Feature } from './feature.js';

/**
 * @import { FeatureHost } from './feature.js'
 * @import { GraphicsDevice } from '../../platform/graphics/graphics-device.js'
 */

/**
 * The features installed on each device by name, recorded in debug builds only, to report two
 * different features sharing a name.
 *
 * @type {WeakMap<GraphicsDevice, Map<string, Feature>>}
 */
const debugFeatures = new WeakMap();

/**
 * Installs features into a host, such as an application, and records their names in the features
 * of its graphics device. The features each feature requires are installed before it, and a
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

        Debug.call(() => {
            let byName = debugFeatures.get(device);
            if (!byName) {
                byName = new Map();
                debugFeatures.set(device, byName);
            }
            const existing = byName.get(feature.name);
            Debug.assert(!existing || existing === feature, `Two different features are named ${feature.name}`);
            byName.set(feature.name, feature);
        });

        if (installed.has(feature.name)) {
            continue;
        }

        // marked before its requirements are installed, so that a cycle cannot recurse forever
        installed.add(feature.name);

        installFeatures(host, feature.requires);

        const chunks = feature.chunks;
        if (chunks) {
            Debug.assert(chunks.language, `Shader chunk collection ${chunks.name} of feature ${feature.name} has no language`);
            ShaderChunks.get(device, chunks.language).add(chunks.chunks);
        }

        feature.install?.(host);
    }
};

export { installFeatures };
