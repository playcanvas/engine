/**
 * @import { AppBase } from './app-base.js'
 * @import { ForwardRenderer } from '../scene/renderer/forward-renderer.js'
 * @import { GraphicsDevice } from '../platform/graphics/graphics-device.js'
 */

/**
 * Read-only performance statistics for an application, accessed through {@link AppBase#stats}.
 * Includes frame cadence, CPU phase timings, overall GPU frame timing, and estimated GPU resource
 * memory usage. CPU timings, GPU timings and memory statistics are available in all builds, subject
 * to graphics capabilities. Primitive counting requires a debug or profiler build; see each getter
 * for its availability.
 *
 * Durations are in milliseconds and memory sizes are in bytes. Values are the latest available
 * measurements, not averages, except for {@link fps}, which refreshes approximately once per second.
 * Frame counters are published at the start of the next application tick; CPU timings are updated
 * when their respective phases finish. CPU phases overlap and must not all be added together.
 * CPU timings and counters are initially zero. GPU results arrive asynchronously and can describe
 * an older frame than the CPU measurements.
 *
 * GPU profiling is disabled by default. Enable it with
 * `app.graphicsDevice.gpuProfiler.enabled = true` when a profiler exists (see the example below).
 * WebGL requires the disjoint timer query extension; WebGPU requires the timestamp-query feature.
 * Enabling profiling on an unsupported device produces no timings. {@link gpuFrameTime} returns
 * undefined when profiling is disabled, unsupported, or no valid result has arrived. Reading stats
 * does not enable profiling. MiniStats also enables GPU profiling when it creates its GPU timer.
 *
 * Memory statistics estimate resources tracked by the application's graphics device, which may be
 * shared by applications. They do not represent total physical GPU memory usage or capacity, and
 * exclude untracked driver overhead and JavaScript memory.
 *
 * @example
 * const profiler = app.graphicsDevice.gpuProfiler;
 * if (profiler) {
 *     profiler.enabled = true;
 * }
 *
 * app.on('frameend', () => {
 *     const stats = app.stats;
 *     console.log(stats.cpuUpdateTime, stats.cpuRenderTime, stats.gpuFrameTime);
 * });
 *
 * @see AppBase#stats
 */
class AppStats {
    /**
     * @type {AppBase}
     * @private
     */
    _app;

    /**
     * Create a new AppStats instance.
     *
     * @param {AppBase} app - The application.
     * @ignore
     */
    constructor(app) {
        this._app = app;

        const device = app.graphicsDevice;
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

            // #if _PROFILER
            primitives: 0,
            // #endif
            gsplats: 0,
            gsplatSort: 0,
            gsplatBufferCopy: 0,
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

    /**
     * Total draw calls submitted during the previous frame, published at the start of the next
     * application tick. Available in all builds.
     *
     * @type {number}
     */
    get drawCallCount() {
        return this.drawCalls.total;
    }

    /**
     * Total primitives submitted during the previous frame, published at the start of the next
     * application tick. Counts triangles, lines and points across all passes, including instances
     * and CPU-authored multi-draw commands. Counts are calculated before GPU clipping and culling.
     *
     * Available only in debug and profiler builds. Returns undefined in release and minified builds.
     * This is an estimate from draw parameters: GPU-generated indirect draws are excluded, and
     * primitive-restart indices in indexed strips are not inspected. No GPU readback is performed.
     *
     * @type {number|undefined}
     */
    get primitiveCount() {
        return this.frame.primitives;
    }

    /**
     * Interval between application ticks in milliseconds, including time outside the engine.
     * Unaffected by time scaling or delta-time clamping. Available in all builds.
     *
     * @type {number}
     */
    get frameTime() {
        return this.frame.ms;
    }

    /**
     * Frame count over the latest approximately one-second reporting interval. Initially zero
     * until an interval completes. Available in all builds.
     *
     * @type {number}
     */
    get fps() {
        return this.frame.fps;
    }

    /**
     * CPU duration of the latest application update in milliseconds, including component systems,
     * application update event listeners and input updates. Excludes graphics device updates.
     * Includes the other CPU update phase timings. Available in all builds.
     *
     * @type {number}
     */
    get cpuUpdateTime() {
        return this.frame.updateTime;
    }

    /**
     * CPU duration of the latest scene render in milliseconds, including prerender and postrender
     * event listeners, hierarchy synchronization, batching and render command submission. Excludes
     * graphics device frameStart/frameEnd work and does not measure GPU execution. Retains the
     * latest measurement when rendering is skipped. Available in all builds.
     *
     * @type {number}
     */
    get cpuRenderTime() {
        return this.frame.renderTime;
    }

    /**
     * CPU duration of the latest component systems update phase in milliseconds. Includes script
     * updates, physics and other systems subscribed to the update event. Part of
     * {@link cpuUpdateTime}. Available in all builds.
     *
     * @type {number}
     */
    get cpuSystemUpdateTime() {
        return this.frame.scriptUpdate;
    }

    /**
     * CPU duration of the latest component systems post-update phase in milliseconds, including
     * script postUpdate callbacks. Part of {@link cpuUpdateTime}. Available in all builds.
     *
     * @type {number}
     */
    get cpuSystemPostUpdateTime() {
        return this.frame.scriptPostUpdate;
    }

    /**
     * CPU duration of the latest dedicated animation-update phase in milliseconds, used by
     * {@link AnimComponentSystem}. Excludes the legacy {@link AnimationComponentSystem}, which
     * runs in the system update phase. Part of {@link cpuUpdateTime}. Available in all builds.
     *
     * @type {number}
     */
    get cpuAnimationTime() {
        return this.frame.animUpdate;
    }

    /**
     * CPU duration of the most recent physics step in milliseconds, including synchronization and
     * contact handling. Normally part of {@link cpuSystemUpdateTime}. Multiple manual steps are not
     * accumulated. Zero before any step or when physics is paused through its timeScale property.
     * Available in all builds.
     *
     * @type {number}
     */
    get cpuPhysicsTime() {
        return this.frame.physicsTime;
    }

    /**
     * Overall duration of the most recently resolved GPU frame in milliseconds. Available in all
     * builds when GPU profiling is supported and enabled. Returns undefined until a valid timing
     * arrives, when profiling is disabled, or after timing invalidation such as context loss.
     * Results arrive asynchronously and may be several frames old.
     *
     * WebGL measures a whole-frame timer query. WebGPU measures the span from the first profiled
     * pass beginning to the last pass ending, including gaps between passes. This is elapsed GPU
     * time, not GPU utilization, and is not the sum of potentially overlapping pass durations.
     *
     * @type {number|undefined}
     */
    get gpuFrameTime() {
        return this._app.graphicsDevice.gpuProfiler?.frameTime;
    }

    /**
     * Total estimated GPU resource memory in bytes: textures, vertex buffers, index buffers,
     * uniform buffers and storage buffers. Available in all builds.
     *
     * @type {number}
     */
    get vramTotalBytes() {
        const vram = this.vram;
        return vram.tex + vram.vb + vram.ib + vram.ub + vram.sb;
    }

    /**
     * Estimated GPU texture memory in bytes. Available in all builds.
     *
     * @type {number}
     */
    get vramTextureBytes() {
        return this.vram.tex;
    }

    /**
     * Estimated GPU vertex buffer memory in bytes. Available in all builds.
     *
     * @type {number}
     */
    get vramVertexBufferBytes() {
        return this.vram.vb;
    }

    /**
     * Estimated GPU index buffer memory in bytes. Available in all builds.
     *
     * @type {number}
     */
    get vramIndexBufferBytes() {
        return this.vram.ib;
    }

    /**
     * Estimated GPU uniform buffer memory in bytes. Available in all builds. Zero when no tracked
     * uniform buffers have been allocated.
     *
     * @type {number}
     */
    get vramUniformBufferBytes() {
        return this.vram.ub;
    }

    /**
     * Estimated GPU storage buffer memory in bytes. Available in all builds. Zero on backends
     * without storage buffers or when none have been allocated.
     *
     * @type {number}
     */
    get vramStorageBufferBytes() {
        return this.vram.sb;
    }

    /** @ignore */
    get scene() {
        return this._app.scene._stats;
    }

    /** @ignore */
    get lightmapper() {
        return this._app.lightmapper?.stats;
    }

    /** @ignore */
    get batcher() {
        const batcher = this._app._batcher;
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
        // #if _PROFILER
        stats.primitives = device._primitiveCount;
        device._primitiveCount = 0;
        // #endif
        stats.cullTime = renderer._cullTime;
        stats.sortTime = renderer._sortTime;
        stats.skinTime = renderer._skinTime;
        stats.morphTime = renderer._morphTime;
        stats.lightClusters = renderer._lightClusters;
        stats.lightClustersTime = renderer._lightClustersTime;
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

export { AppStats };
