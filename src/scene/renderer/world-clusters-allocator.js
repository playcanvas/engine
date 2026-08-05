import { DebugHelper } from '../../core/debug.js';
import { WorldClusters } from '../lighting/world-clusters.js';
import { FramePassMultiView } from './frame-pass-multi-view.js';

/**
 * @import { GraphicsDevice } from '../../platform/graphics/graphics-device.js'
 * @import { LayerRenderStep } from './layer-render-step.js'
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
            empty.update([]);
            this._empty = empty;
        }

        return this._empty;
    }

    /**
     * Assign clusters for one frame pass that owns {@link RenderPassForward#layerRenderSteps}.
     * No-op when the pass has no layer render steps.
     *
     * @param {import('../../platform/graphics/frame-pass.js').FramePass} renderPass - Render pass
     * (not a {@link FramePassMultiView} wrapper; those are unwrapped in {@link WorldClustersAllocator#assign}).
     * @private
     */
    _assignClustersForPass(renderPass) {
        const layerRenderSteps = renderPass.layerRenderSteps;
        if (!layerRenderSteps) {
            return;
        }

        const count = layerRenderSteps.length;
        for (let i = 0; i < count; i++) {
            const step = layerRenderSteps[i];
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

                    // use already allocated cluster from last frame, or create a new one
                    clusters = tempClusterArray.pop() ?? new WorldClusters(this.device);
                    DebugHelper.setName(clusters, `Cluster-${this._allocated.length}`);

                    this._allocated.push(clusters);
                    this._clusters.set(hash, step);
                }

                step.lightClusters = clusters;
            }

            // no clustered lights, use the cluster with no lights
            if (!step.lightClusters) {
                step.lightClusters = this.empty;
            }
        }
    }

    // assign light clusters to layer render steps that need it
    assign(renderPasses) {

        // reuse previously allocated clusters
        tempClusterArray.push(...this._allocated);
        this._allocated.length = 0;
        this._clusters.clear();

        // FramePassMultiView children are not on the frame graph list (merge safety); still assign
        // clusters to their layer render steps before those passes run.
        const passCount = renderPasses.length;
        for (let p = 0; p < passCount; p++) {
            const pass = renderPasses[p];
            if (pass instanceof FramePassMultiView) {
                const children = pass.children;
                for (let c = 0; c < children.length; c++) {
                    this._assignClustersForPass(children[c]);
                }
            } else {
                this._assignClustersForPass(pass);
            }
        }

        // delete leftovers
        tempClusterArray.forEach(item => item.destroy());
        tempClusterArray.length = 0;
    }

    update(renderPasses, lighting) {

        // assign clusters to layer render steps
        this.assign(renderPasses);

        // update all unique clusters
        this._clusters.forEach((step) => {
            const layer = step.layer;
            const cluster = step.lightClusters;
            cluster.update(layer.clusteredLightsSet, lighting);
        });
    }
}

export { WorldClustersAllocator };
