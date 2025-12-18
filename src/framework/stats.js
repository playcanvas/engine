import { getApplication } from './globals.js';

/**
 * @import { GraphicsDevice } from '../platform/graphics/graphics-device.js'
 */

/**
 * Records performance-related statistics related to the application.
 */
class ApplicationStats {
    /**
     * Create a new ApplicationStats instance.
     *
     * @param {GraphicsDevice} device - The graphics device.
     */
    constructor(device) {
        this.frame = {
            fps: 0,
            ms: 0,
            dt: 0,

            updateStart: 0,
            updateTime: 0,
            renderStart: 0,
            renderTime: 0,
            physicsStart: 0,
            physicsTime: 0,
            scriptUpdateStart: 0,
            scriptUpdate: 0,
            scriptPostUpdateStart: 0,
            scriptPostUpdate: 0,
            animUpdateStart: 0,
            animUpdate: 0,
            cullTime: 0,
            sortTime: 0,
            skinTime: 0,
            morphTime: 0,
            instancingTime: 0, // deprecated

            triangles: 0,
            gsplats: 0,
            gsplatSort: 0,
            otherPrimitives: 0,
            shaders: 0,
            materials: 0,
            cameras: 0,
            shadowMapUpdates: 0,
            shadowMapTime: 0,
            depthMapTime: 0, // deprecated
            forwardTime: 0,

            lightClustersTime: 0,
            lightClusters: 0,

            _timeToCountFrames: 0,
            _fpsAccum: 0
        };

        this.drawCalls = {
            forward: 0,
            depth: 0, // deprecated
            shadow: 0,
            immediate: 0, // deprecated
            misc: 0, // everything that is not forward/depth/shadow (post effect quads etc)
            total: 0, // total = forward + depth + shadow + misc

            // Some of forward/depth/shadow/misc draw calls:
            skinned: 0,
            instanced: 0, // deprecated

            removedByInstancing: 0 // deprecated
        };

        this.misc = {
            renderTargetCreationTime: 0
        };

        this.particles = {
            updatesPerFrame: 0,
            _updatesPerFrame: 0,
            frameTime: 0,
            _frameTime: 0
        };

        this.shaders = device._shaderStats;
        this.vram = device._vram;
        this.gpu = device.gpuProfiler?.passTimings ?? new Map();

        Object.defineProperty(this.vram, 'totalUsed', {
            get: function () {
                return this.tex + this.vb + this.ib;
            }
        });

        Object.defineProperty(this.vram, 'geom', {
            get: function () {
                return this.vb + this.ib;
            }
        });
    }

    get scene() {
        return getApplication().scene._stats;
    }

    get lightmapper() {
        return getApplication().lightmapper?.stats;
    }

    get batcher() {
        const batcher = getApplication()._batcher;
        return batcher ? batcher._stats : null;
    }

    /**
     * Called at the end of each frame to reset per-frame statistics.
     *
     * @ignore
     */
    frameEnd() {
        this.frame.gsplatSort = 0;
    }
}

export { ApplicationStats };
