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

const MAX_ENTITIES = 200;
const MAX_RENDERABLES = 120;
const MAX_COLLISIONS = 120;
const MAX_ANIMATIONS = 80;

const round = (n) => {
    const r = Number.isFinite(n) ? Math.round(n * 1000) / 1000 : null;
    return Object.is(r, -0) ? 0 : r;
};
const v3 = (v) => v ? [round(v.x), round(v.y), round(v.z)] : null;

const pathOf = (e) => {
    const parts = [];
    for (let n = e; n; n = n.parent) {
        parts.push(n.name || '(unnamed)');
    }
    return parts.reverse().join('/');
};

const walkEntities = (root, limit = MAX_ENTITIES) => {
    const out = [];
    const stack = [root];
    while (stack.length && out.length < limit) {
        const e = stack.pop();
        out.push(e);
        for (let i = e.children.length - 1; i >= 0; i--) {
            stack.push(e.children[i]);
        }
    }
    return out;
};

const componentsOf = (e) => Object.keys(e.c ?? {}).sort();

const entityInfo = (e) => ({
    name: e.name,
    path: pathOf(e),
    enabled: e.enabled,
    position: v3(e.getPosition?.()),
    rotation: v3(e.getEulerAngles?.()),
    scale: v3(e.getLocalScale?.()),
    components: componentsOf(e)
});

const renderablesOf = (app) => {
    const out = [];
    for (const comp of [...app.root.findComponents('render'), ...app.root.findComponents('model')]) {
        const entity = comp.entity;
        const instances = comp.meshInstances ?? comp.model?.meshInstances ?? [];
        for (let i = 0; i < instances.length && out.length < MAX_RENDERABLES; i++) {
            const aabb = instances[i].aabb;
            out.push({
                entity: entity.name,
                path: pathOf(entity),
                type: comp.type ?? comp.asset?.name ?? null,
                center: v3(aabb?.center),
                halfExtents: v3(aabb?.halfExtents),
                min: aabb ? v3(aabb.getMin()) : null,
                max: aabb ? v3(aabb.getMax()) : null
            });
        }
    }
    return out;
};

const collisionsOf = (app) => app.root.findComponents('collision').slice(0, MAX_COLLISIONS).map(c => ({
    entity: c.entity.name,
    path: pathOf(c.entity),
    type: c.type,
    position: v3(c.entity.getPosition?.()),
    scale: v3(c.entity.getLocalScale?.()),
    halfExtents: v3(c.halfExtents),
    radius: round(c.radius),
    height: round(c.height),
    axis: c.axis ?? null,
    rigidbody: c.entity.rigidbody ? {
        type: c.entity.rigidbody.type,
        enabled: c.entity.rigidbody.enabled
    } : null
}));

const animationsOf = (app) => [
    ...app.root.findComponents('anim').map(a => ({
        entity: a.entity.name,
        path: pathOf(a.entity),
        system: 'anim',
        playing: a.playing ?? null,
        baseLayer: a.baseLayer ? {
            activeState: a.baseLayer.activeState,
            previousState: a.baseLayer.previousState
        } : null,
        layers: a.layers?.map(l => ({
            name: l.name,
            activeState: l.activeState,
            previousState: l.previousState
        })) ?? []
    })),
    ...app.root.findComponents('animation').map(a => ({
        entity: a.entity.name,
        path: pathOf(a.entity),
        system: 'animation',
        playing: a.playing ?? null,
        currAnim: a.currAnim?.name ?? null,
        animations: Object.keys(a.animations ?? {})
    }))
].slice(0, MAX_ANIMATIONS);

/**
 * Builds a protocol v1 snapshot for an attached app. Profiler-gated stats (triangles, cpuMs)
 * are null in release builds — `engine.buildVariant` tells consumers why; gpuMs depends on
 * device timestamp-query support, not build variant.
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
    const entities = walkEntities(app.root);

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
            layers: app.scene.layers.layerList.map(l => ({ id: l.id, name: l.name, enabled: l.enabled })),
            entitySample: entities.map(entityInfo),
            renderables: renderablesOf(app),
            collisions: collisionsOf(app),
            animations: animationsOf(app),
            recentInput: entry.input?.toArray?.().slice(-50) ?? []
        },
        assets: {
            counts: {
                total: assets.length,
                loaded: assets.filter(a => a.loaded).length,
                loading: assets.filter(a => a.loading).length,
                failed: assetErrors.length,
                preloadPending: assets.filter(a => a.preload && !a.loaded).length
            },
            failures: assetErrors.slice(-20).map(e => ({
                kind: 'asset',
                message: e.message ?? null,
                assetId: e.assetId ?? null,
                name: e.name ?? null,
                url: e.url ?? null,
                frame: e.frame ?? null
            }))
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
