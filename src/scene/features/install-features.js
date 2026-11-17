import { Debug } from '../../core/debug.js';
import { ShaderChunks } from '../shader-lib/shader-chunks.js';
import { Feature } from './feature.js';

/**
 * @import { FeatureHost } from './feature.js'
 */

/**
 * Installs features into a host, such as an application. The features each feature requires are
 * installed before it, and a feature is installed only once, however many times it is listed or
 * required.
 *
 * @param {FeatureHost} host - The host the features are installed into.
 * @param {Feature[]} features - The features to install.
 * @param {Set<Feature>} installed - The features already installed in the host, which this
 * function adds to.
 * @ignore
 */
const installFeatures = (host, features, installed) => {
    for (const feature of features) {
        Debug.assert(feature instanceof Feature, 'Only features provided by the engine can be installed', feature);
        if (installed.has(feature)) {
            continue;
        }

        // marked before its requirements are installed, so that a cycle cannot recurse forever
        installed.add(feature);

        installFeatures(host, feature.requires, installed);

        const chunks = feature.chunks;
        if (chunks) {
            Debug.assert(chunks.language, `Shader chunk collection ${chunks.name} of feature ${feature.name} has no language`);
            ShaderChunks.get(host.graphicsDevice, chunks.language).add(chunks.chunks);
        }

        feature.install?.(host);
    }
};

export { installFeatures };
