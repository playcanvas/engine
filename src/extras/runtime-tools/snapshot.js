import { revision, version } from '../../core/core.js';

// resolved by the jscc preprocessor per build variant; unprocessed source
// (dev/tests) executes every block and resolves to 'debug'
let buildVariant = 'release';
// #if _PROFILER
buildVariant = 'profiler';
// #endif
// #if _DEBUG
buildVariant = 'debug';
// #endif

const countNodes = (root) => {
    let count = 0;
    const stack = [root];
    while (stack.length) {
        const node = stack.pop();
        count++;
        for (let i = 0; i < node.children.length; i++) {
            stack.push(node.children[i]);
        }
    }
    return count;
};

/**
 * Builds a protocol v1 snapshot for an attached app. Profiler-gated stats are null in
 * release builds; `engine.buildVariant` tells consumers why.
 *
 * @param {object} entry - Registry entry: { app, id, started, destroyed, timeMs, errors }.
 * @returns {object} A JSON-serializable snapshot.
 * @ignore
 */
const buildSnapshot = (entry) => {
    const { app } = entry;
    const device = app.graphicsDevice;
    const stats = app.stats;
    const assets = app.assets.list();
    const cameras = app.systems.camera.cameras;
    const profiler = buildVariant !== 'release';
    const assetErrors = entry.errors.toArray().filter(e => e.kind === 'asset');

    let gpuMs = null;
    const passTimings = device.gpuProfiler?.passTimings;
    if (passTimings && passTimings.size > 0) {
        gpuMs = 0;
        passTimings.forEach((ms) => {
            gpuMs += ms;
        });
    }

    return {
        version: 1,
        engine: { version, revision, buildVariant },
        app: {
            id: entry.id,
            frame: app.frame,
            time: entry.timeMs / 1000,
            running: entry.started && !entry.destroyed,
            canvas: {
                id: device.canvas.id || null,
                width: device.canvas.width,
                height: device.canvas.height
            },
            device: {
                type: device.deviceType,
                maxTextureSize: device.maxTextureSize
            }
        },
        scene: {
            entities: countNodes(app.root),
            cameras: cameras.map(c => ({ entity: c.entity.name, priority: c.priority })),
            lights: app.root.findComponents('light').length,
            layers: app.scene.layers.layerList.map(l => ({ id: l.id, name: l.name, enabled: l.enabled }))
        },
        assets: {
            counts: {
                total: assets.length,
                loaded: assets.filter(a => a.loaded).length,
                loading: assets.filter(a => a.loading).length,
                failed: assetErrors.length,
                preloadPending: assets.filter(a => a.preload && !a.loaded).length
            },
            failures: assetErrors.slice(-20)
        },
        render: {
            drawCalls: stats.drawCalls.total,
            triangles: profiler ? stats.frame.triangles : null,
            shaderErrors: 0, // populated once engine shader-error events exist (separate plan)
            visibleMeshes: null, // protocol v2
            activeCamera: cameras.length ? cameras[cameras.length - 1].entity.name : null
        },
        diagnostics: {
            errors: entry.errors.length,
            warnings: 0,
            failedRequests: 0,
            missingAssets: assetErrors.filter(e => e.url).length
        },
        perf: {
            fps: stats.frame.fps,
            frameMs: stats.frame.ms,
            cpuMs: profiler ? stats.frame.updateTime + stats.frame.renderTime : null,
            gpuMs
        }
    };
};

export { buildSnapshot };
