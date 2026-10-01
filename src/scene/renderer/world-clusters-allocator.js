import { DebugHelper } from '../../core/debug.js';
import { WorldClusters } from '../lighting/world-clusters.js';

/**
 * @import { GraphicsDevice } from '../../platform/graphics/graphics-device.js'
 * @import { LayerRenderStep } from './layer-render-step.js'
 * @import { LightingParams } from '../lighting/lighting-params.js'
 */

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
     * Clusters allocated in a previous frame, available for reuse this frame. Owned by this
     * allocator (destroyed in {@link WorldClustersAllocator#destroy}) and only transiently non-empty
     * within a single {@link WorldClustersAllocator#upload} call.
     *
     * @type {WorldClusters[]}
     */
    _recycled = [];

    /**
     * Layer render steps that requested a cluster this frame, resolved together in
     * {@link WorldClustersAllocator#upload} (after culling).
     *
     * @type {LayerRenderStep[]}
     */
    _requestedSteps = [];

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

        // all other clusters, including any left in the recycle pool
        this._allocated.forEach((cluster) => {
            cluster.destroy();
        });
        this._allocated.length = 0;
        this._recycled.forEach((cluster) => {
            cluster.destroy();
        });
        this._recycled.length = 0;
        this._clusters.clear();
        this._requestedSteps.length = 0;
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
     * Discards the previous frame's cluster requests. Called once at the start of the frame (before
     * any {@link WorldClustersAllocator#request}), so a frame that builds but never uploads - e.g.
     * one interrupted before rendering - does not carry stale steps into the next.
     */
    reset() {
        this._requestedSteps.length = 0;
    }

    /**
     * Records that a layer render step will be rendered this frame and may need a light cluster.
     * Called during frame graph build (from a render pass's frameUpdate); eligibility, cluster
     * de-duplication and assignment are all resolved later in {@link WorldClustersAllocator#upload},
     * so they observe the final layer state after any culling callbacks.
     *
     * @param {LayerRenderStep} step - The layer render step that may need a cluster.
     */
    request(step) {
        this._requestedSteps.push(step);
    }

    /**
     * Resolves and uploads the clusters for the steps requested this frame. For each step whose
     * layer has clustered lights and meshes it assigns a cluster (steps whose layer shares the same
     * clustered-light set share one; others are left without a cluster and fall back to
     * {@link WorldClustersAllocator#empty} at render time), recycling the previous frame's clusters
     * and destroying any not reused, then uploads each unique cluster's light data.
     *
     * Runs from the clustered update pass - after cullComposition and its precull / postcull /
     * cull:end callbacks, and before the passes that use the clusters execute - so a callback that
     * adds or removes a layer's meshes or lights is reflected here. The whole assignment (including
     * the recycle pool) happens within this one synchronous call, so no partially-recycled cluster
     * is ever visible to {@link WorldClustersAllocator#destroy}.
     *
     * @param {LightingParams} lighting - The clustered lighting parameters.
     */
    upload(lighting) {

        // clusters allocated last frame become available for reuse this frame
        const recycled = this._recycled;
        recycled.push(...this._allocated);
        this._allocated.length = 0;
        this._clusters.clear();

        // assign a cluster to each requested step, deduplicated by the layer's clustered-light set
        const steps = this._requestedSteps;
        for (let i = 0; i < steps.length; i++) {
            const step = steps[i];
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
                    clusters = recycled.pop() ?? new WorldClusters(this.device);
                    DebugHelper.setName(clusters, `Cluster-${this._allocated.length}`);

                    this._allocated.push(clusters);
                    this._clusters.set(hash, step);
                }

                step.lightClusters = clusters;
            }
        }

        // delete clusters not reused this frame
        recycled.forEach(item => item.destroy());
        recycled.length = 0;

        // update all unique clusters
        this._clusters.forEach((step) => {
            step.lightClusters.update(step.layer.clusteredLightsSet, lighting);
        });
    }
}

export { WorldClustersAllocator };
