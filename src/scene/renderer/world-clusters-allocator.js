import { DebugHelper } from '../../core/debug.js';
import { WorldClusters } from '../lighting/world-clusters.js';

const tempClusterArray = [];

/**
 * A class managing instances of world clusters used by the renderer for layers with
 * unique sets of clustered lights.
 *
 * @ignore
 */
class WorldClustersAllocator {
    /**
     * Empty cluster with no lights.
     *
     * @type {WorldClusters|null}
     */
    _empty = null;

    /**
     * All allocated clusters
     *
     * @type {WorldClusters[]}
     */
    _allocated = [];

    /**
     * Render actions with all unique light clusters. The key is the hash of lights on a layer, the
     * value is a render action with unique light clusters.
     *
     * @type {Map<number, import('../composition/render-action.js').RenderAction>}
     */
    _clusters = new Map();

    /**
     * Create a new instance.
     *
     * @param {import('../../platform/graphics/graphics-device.js').GraphicsDevice} graphicsDevice -
     * The graphics device.
     */
    constructor(graphicsDevice) {
        this.device = graphicsDevice;
    }

    destroy() {

        // empty light cluster
        if (this._empty) {
            this._empty.destroy();
            this._empty = null;
        }

        // all other clusters
        this._allocated.forEach((cluster) => {
            cluster.destroy();
        });
        this._allocated.length = 0;
    }

    get count() {
        return this._allocated.length;
    }

    // returns an empty light cluster object to be used when no lights are used
    get empty() {
        if (!this._empty) {

            // create cluster structure with no lights
            const empty = new WorldClusters(this.device);
            empty.name = 'ClusterEmpty';

            // update it once to avoid doing it each frame
            empty.update([], false, null);
            this._empty = empty;
        }

        return this._empty;
    }

    // assign light clusters to render actions that need it
    assign(renderPasses) {

        const empty = this.empty;

        // reuse previously allocated clusters
        tempClusterArray.push(...this._allocated);
        this._allocated.length = 0;
        this._clusters.clear();

        // update render actions in passes that use them
        const passCount = renderPasses.length;
        for (let p = 0; p < passCount; p++) {

            const renderPass = renderPasses[p];
            const renderActions = renderPass.renderActions;
            if (renderActions) {

                // process all render actions
                const count = renderActions.length;
                for (let i = 0; i < count; i++) {
                    const ra = renderActions[i];
                    ra.lightClusters = null;

                    // if the layer has lights used by clusters, and meshes
                    const layer = ra.layer;
                    if (layer.hasClusteredLights && layer.meshInstances.length) {

                        // use existing clusters if the lights on the layer are the same
                        const hash = layer.getLightIdHash();
                        const existingRenderAction = this._clusters.get(hash);
                        let clusters = existingRenderAction?.lightClusters;

                        // no match, needs new clusters
                        if (!clusters) {

                            // use already allocated cluster from last frame, or create a new one
                            clusters = tempClusterArray.pop() ?? new WorldClusters(this.device);
                            DebugHelper.setName(clusters, `Cluster-${this._allocated.length}`);

                            this._allocated.push(clusters);
                            this._clusters.set(hash, ra);
                        }

                        ra.lightClusters = clusters;
                    }

                    // no clustered lights, use the cluster with no lights
                    if (!ra.lightClusters) {
                        ra.lightClusters = empty;
                    }
                }
            }
        }

        // delete leftovers
        tempClusterArray.forEach(item => item.destroy());
        tempClusterArray.length = 0;
    }

    update(renderPasses, lighting) {

        // assign clusters to render actions
        this.assign(renderPasses);

        // update all unique clusters
        this._clusters.forEach((renderAction) => {
            const layer = renderAction.layer;
            const cluster = renderAction.lightClusters;
            cluster.update(layer.clusteredLightsSet, lighting);
        });
    }
}

export { WorldClustersAllocator };
