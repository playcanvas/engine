import { DebugHelper } from '../../core/debug.js';
import { WorldClusters } from '../lighting/world-clusters.js';

/**
 * @import { GraphicsDevice } from '../../platform/graphics/graphics-device.js'
 * @import { LayerRenderStep } from './layer-render-step.js'
 * @import { LightingParams } from '../lighting/lighting-params.js'
 */

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
     * Layer render steps with all unique light clusters. The key is the hash of lights on a layer,
     * the value is a layer render step with unique light clusters.
     *
     * @type {Map<number, LayerRenderStep>}
     */
    _clusters = new Map();

    /**
     * Create a new instance.
     *
     * @param {GraphicsDevice} graphicsDevice - The graphics device.
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
        this._clusters.clear();
    }

    get count() {
        return this._allocated.length;
    }

    // returns an empty light cluster object to be used when no lights are used
    get empty() {
        return this._empty ?? this.createEmpty();
    }

    /**
     * Creates the shared empty (no-lights) cluster if it does not exist yet, and returns it. This
     * uploads the cluster's texture, so it must run outside a render pass - the clustered update
     * pass calls it at construction. Reading {@link WorldClustersAllocator#empty} also creates it
     * lazily, as a fallback.
     *
     * @returns {WorldClusters} The empty cluster.
     */
    createEmpty() {
        if (!this._empty) {

            // create cluster structure with no lights
            const empty = new WorldClusters(this.device);
            empty.name = 'ClusterEmpty';

            // update it once to avoid doing it each frame
            empty.update([]);
            this._empty = empty;
        }

        return this._empty;
    }

    /**
     * Recycle the previous frame's clusters and clear the per-frame assignment map. Call once at the
     * start of the frame, before any {@link WorldClustersAllocator#request}.
     */
    reset() {
        // clusters allocated last frame become available for reuse this frame
        tempClusterArray.push(...this._allocated);
        this._allocated.length = 0;
        this._clusters.clear();
    }

    /**
     * Assign a light cluster to a layer render step that will be rendered this frame. Steps whose
     * layer shares the same set of clustered lights share a single cluster. Called during frame
     * graph build (from a render pass's frameUpdate); the light data is uploaded later, once, by
     * {@link WorldClustersAllocator#upload}. A step whose layer has no clustered lights is left
     * without a cluster and falls back to {@link WorldClustersAllocator#empty} at render time.
     *
     * @param {LayerRenderStep} step - The layer render step to assign a cluster to.
     */
    request(step) {
        step.lightClusters = null;

        // if the layer has lights used by clusters, and meshes
        const layer = step.layer;
        if (layer.hasClusteredLights && layer.meshInstances.length) {

            // use existing clusters if the lights on the layer are the same
            const hash = layer.getLightIdHash();
            const existingStep = this._clusters.get(hash);
            let clusters = existingStep?.lightClusters;

            // no match, needs new clusters
            if (!clusters) {

                // reuse a cluster allocated in a previous frame, or create a new one
                clusters = tempClusterArray.pop() ?? new WorldClusters(this.device);
                DebugHelper.setName(clusters, `Cluster-${this._allocated.length}`);

                this._allocated.push(clusters);
                this._clusters.set(hash, step);
            }

            step.lightClusters = clusters;
        }
    }

    /**
     * Destroy any clusters not reused this frame, then upload the light data of every unique cluster
     * requested this frame. Call once after all {@link WorldClustersAllocator#request} calls and
     * before the passes that use the clusters execute.
     *
     * @param {LightingParams} lighting - The clustered lighting parameters.
     */
    upload(lighting) {

        // delete leftovers not reused this frame
        tempClusterArray.forEach(item => item.destroy());
        tempClusterArray.length = 0;

        // update all unique clusters
        this._clusters.forEach((step) => {
            step.lightClusters.update(step.layer.clusteredLightsSet, lighting);
        });
    }
}

export { WorldClustersAllocator };
