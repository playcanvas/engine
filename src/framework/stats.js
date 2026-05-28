import { PRIMITIVE_TRIANGLES, PRIMITIVE_TRIFAN, PRIMITIVE_TRISTRIP } from '../platform/graphics/constants.js';
import { getApplication } from './globals.js';

/**
 * @import { ForwardRenderer } from '../scene/renderer/forward-renderer.js'
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
            gsplatBufferCopy: 0,
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
                return this.tex + this.vb + this.ib + this.ub + this.sb;
            }
        });

        Object.defineProperty(this.vram, 'geom', {
            get: function () {
                return this.vb + this.ib;
            }
        });

        Object.defineProperty(this.vram, 'buffers', {
            get: function () {
                return this.ub + this.sb;
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
     * Update basic per-frame stats. Called every frame from `AppBase.tick`.
     *
     * @param {number} now - High-resolution timestamp for the current frame (ms).
     * @param {number} dt - Delta time in seconds (time-scaled, clamped).
     * @param {number} ms - Raw inter-frame time in ms.
     * @param {ForwardRenderer} renderer - The forward renderer.
     * @param {GraphicsDevice} device - The graphics device.
     * @ignore
     */
    updateBasic(now, dt, ms, renderer, device) {
        // Timing stats
        const stats = this.frame;
        stats.dt = dt;
        stats.ms = ms;
        if (now > stats._timeToCountFrames) {
            stats.fps = stats._fpsAccum;
            stats._fpsAccum = 0;
            stats._timeToCountFrames = now + 1000;
        } else {
            stats._fpsAccum++;
        }

        // total draw call
        this.drawCalls.total = device._drawCallsPerFrame;
        device._drawCallsPerFrame = 0;

        stats.gsplats = renderer._gsplatCount;
        stats.gsplatBufferCopy = renderer._gsplatBufferCopy ?? 0;
    }

    /**
     * Update detailed per-frame stats (profiler build only). Resets per-frame
     * counters on the renderer and graphics device.
     *
     * @param {ForwardRenderer} renderer - The forward renderer.
     * @param {GraphicsDevice} device - The graphics device.
     * @ignore
     */
    updateDetailed(renderer, device) {
        let stats = this.frame;

        // Render stats
        stats.cameras = renderer._camerasRendered;
        stats.materials = renderer._materialSwitches;
        stats.shaders = device._shaderSwitchesPerFrame;
        stats.shadowMapUpdates = renderer._shadowMapUpdates;
        stats.shadowMapTime = renderer._shadowMapTime;
        stats.depthMapTime = renderer._depthMapTime;
        stats.forwardTime = renderer._forwardTime;
        const prims = device._primsPerFrame;
        stats.triangles = prims[PRIMITIVE_TRIANGLES] / 3 +
            Math.max(prims[PRIMITIVE_TRISTRIP] - 2, 0) +
            Math.max(prims[PRIMITIVE_TRIFAN] - 2, 0);
        stats.cullTime = renderer._cullTime;
        stats.sortTime = renderer._sortTime;
        stats.skinTime = renderer._skinTime;
        stats.morphTime = renderer._morphTime;
        stats.lightClusters = renderer._lightClusters;
        stats.lightClustersTime = renderer._lightClustersTime;
        stats.otherPrimitives = 0;
        for (let i = 0; i < prims.length; i++) {
            if (i < PRIMITIVE_TRIANGLES) {
                stats.otherPrimitives += prims[i];
            }
            prims[i] = 0;
        }
        renderer._camerasRendered = 0;
        renderer._materialSwitches = 0;
        renderer._shadowMapUpdates = 0;
        device._shaderSwitchesPerFrame = 0;
        renderer._cullTime = 0;
        renderer._layerCompositionUpdateTime = 0;
        renderer._lightClustersTime = 0;
        renderer._sortTime = 0;
        renderer._skinTime = 0;
        renderer._morphTime = 0;
        renderer._shadowMapTime = 0;
        renderer._depthMapTime = 0;
        renderer._forwardTime = 0;

        // Draw call stats
        stats = this.drawCalls;
        stats.forward = renderer._forwardDrawCalls;
        stats.culled = renderer._numDrawCallsCulled;
        stats.depth = 0;
        stats.shadow = renderer._shadowDrawCalls;
        stats.skinned = renderer._skinDrawCalls;
        stats.immediate = 0;
        stats.instanced = 0;
        stats.removedByInstancing = 0;
        stats.misc = stats.total - (stats.forward + stats.shadow);
        renderer._depthDrawCalls = 0;
        renderer._shadowDrawCalls = 0;
        renderer._forwardDrawCalls = 0;
        renderer._numDrawCallsCulled = 0;
        renderer._skinDrawCalls = 0;
        renderer._immediateRendered = 0;
        renderer._instancedDrawCalls = 0;

        this.misc.renderTargetCreationTime = device.renderTargetCreationTime;

        stats = this.particles;
        stats.updatesPerFrame = stats._updatesPerFrame;
        stats.frameTime = stats._frameTime;
        stats._updatesPerFrame = 0;
        stats._frameTime = 0;
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
