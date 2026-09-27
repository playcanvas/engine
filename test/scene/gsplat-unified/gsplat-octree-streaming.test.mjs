import { expect } from 'chai';

import { Vec3 } from '../../../src/core/math/vec3.js';
import { GSplatAssetLoader } from '../../../src/framework/components/gsplat/gsplat-asset-loader.js';
import { GSPLAT_LODMODE_ERROR, PROJECTION_PERSPECTIVE } from '../../../src/scene/constants.js';
import { GraphNode } from '../../../src/scene/graph-node.js';
import { GSplatBudgetBalancer } from '../../../src/scene/gsplat-unified/gsplat-budget-balancer.js';
import { GSplatOctreeInstance } from '../../../src/scene/gsplat-unified/gsplat-octree-instance.js';
import { GSplatOctree } from '../../../src/scene/gsplat-unified/gsplat-octree.js';
import { GSplatPlacement } from '../../../src/scene/gsplat-unified/gsplat-placement.js';
import { GSplatWorld } from '../../../src/scene/gsplat-unified/gsplat-world.js';

// Splat counts of the two LOD levels every test leaf carries.
const FINE_COUNT = 100;
const COARSE_COUNT = 10;

// Leaves of unit half-extent centered on the given z positions of the camera axis. Each leaf has
// its own file per level - `fine_<i>` for LOD 0 and `coarse_<i>` for LOD 1 - so every load can
// be traced back to the one node and level that asked for it.
const makeOctree = (zs) => {
    const filenames = [
        ...zs.map((z, i) => `fine_${i}.json`),
        ...zs.map((z, i) => `coarse_${i}.json`)
    ];
    return new GSplatOctree('/scene/lod-meta.json', {
        lodLevels: 2,
        filenames,
        tree: {
            children: zs.map((z, i) => ({
                bound: { min: [-1, -1, z - 1], max: [1, 1, z + 1] },
                lods: {
                    0: { file: i, offset: 0, count: FINE_COUNT },
                    1: { file: zs.length + i, offset: 0, count: COARSE_COUNT }
                }
            }))
        }
    });
};

const fine = i => `/scene/fine_${i}.json`;
const coarse = i => `/scene/coarse_${i}.json`;

// A registry that records the order loads start in, and lets the test decide when each resolves.
const makeRegistry = () => {
    const registry = {
        started: [],
        add(asset) {
            asset.registry = registry;
        },
        remove() {},
        fire() {},
        getByUrl() {
            return null;
        },
        load(asset) {
            asset.loading = true;
            registry.started.push(asset.file.url);
        },
        loader: {
            getHandler: () => ({})
        },
        _loader: {
            clearCache() {}
        }
    };
    return registry;
};

// A camera at the origin looking down -z, with only the properties the LOD passes read.
const makeCamera = () => {
    const node = new GraphNode();
    node.camera = { projection: PROJECTION_PERSPECTIVE, fov: 45, horizontalFov: false, aspectRatio: 1 };
    return node;
};

// A real asset loader on a registry that records load starts, and the octree it streams for.
const makeStreaming = (zs, maxConcurrentLoads = 2) => {
    const registry = makeRegistry();
    const loader = new GSplatAssetLoader(registry);
    loader.maxConcurrentLoads = maxConcurrentLoads;

    const octree = makeOctree(zs);
    octree.assetLoader = loader;

    const resolve = (url) => {
        const asset = loader._urlToAsset.get(url);
        asset.loading = false;
        asset.loaded = true;
        asset.resource = { numSplats: 1 };
        asset.fire('load', asset);
    };

    // resolves every load that has started, until nothing is left to start
    const resolveAll = () => {
        for (let i = 0; i < registry.started.length; i++) {
            resolve(registry.started[i]);
        }
    };

    const queued = () => [...loader._loadQueue.keys()];

    return { registry, loader, octree, resolve, resolveAll, queued };
};

// An instance of the octree seen through its own camera, driven through the same passes a world
// LOD update runs, in the same order. Several of these on one octree stand in for the worlds of
// several cameras, each flushing the shared octree on its own LOD updates.
const addView = (octree, { lodUnderfillLimit = 1, lodBehindPenalty = 1.5 } = {}) => {
    const placement = new GSplatPlacement(null, new GraphNode());
    placement.lodFalloff = 1;

    const device = { on: () => ({ off() {} }) };
    const inst = new GSplatOctreeInstance(device, octree, placement);

    const camera = makeCamera();
    const params = { lodBehindPenalty, lodUnderfillLimit };
    const balancer = new GSplatBudgetBalancer();

    const lodUpdate = (budget = 1e6) => {
        inst.update();
        inst.resolveLodRange(GSPLAT_LODMODE_ERROR);
        inst.evaluateNodeCoverage(camera, params);
        balancer.balance(new Map([[placement, inst]]), budget);
        inst.applyLodChanges(params);
        octree.flushRequests();
    };

    return { inst, placement, camera, lodUpdate };
};

// A single camera streaming an octree.
const makeScene = (zs, { maxConcurrentLoads = 2, ...viewOptions } = {}) => {
    const streaming = makeStreaming(zs, maxConcurrentLoads);
    return { ...streaming, ...addView(streaming.octree, viewOptions) };
};

const isFine = url => url.includes('fine');

describe('GSplatOctree streaming order', function () {

    describe('load priority', function () {

        it('loads coarse data everywhere first, then refines, nearest the camera first', function () {
            // manifest order deliberately unrelated to distance
            const { registry, lodUpdate, resolveAll } = makeScene([-40, -10, -30, -20]);

            lodUpdate();
            resolveAll();

            expect(registry.started).to.deep.equal([
                coarse(1), coarse(3), coarse(2), coarse(0),
                fine(1), fine(3), fine(2), fine(0)
            ]);
        });

        it('loads what is in front of the camera before what is behind it', function () {
            // equally distant, one in front and one behind
            const { registry, lodUpdate, resolveAll } = makeScene([10, -10], { maxConcurrentLoads: 1 });

            lodUpdate();
            resolveAll();

            expect(registry.started).to.deep.equal([coarse(1), coarse(0), fine(1), fine(0)]);
        });

        it('reorders waiting loads when the camera moves', function () {
            const { registry, camera, lodUpdate, resolve } = makeScene([-10, -20, -30, -40], { maxConcurrentLoads: 1 });

            lodUpdate();
            expect(registry.started).to.deep.equal([coarse(0)]);

            // turn around behind the far end, which is now the nearest
            camera.setPosition(0, 0, -45);
            camera.setEulerAngles(0, 180, 0);
            lodUpdate();

            resolve(coarse(0));
            expect(registry.started).to.deep.equal([coarse(0), coarse(3)]);
        });

        it('keeps waiting placements queued across LOD updates', function () {
            const { registry, lodUpdate, queued } = makeScene([-10, -20, -30], { maxConcurrentLoads: 1, lodUnderfillLimit: 0 });

            lodUpdate();
            expect(registry.started).to.deep.equal([fine(0)]);
            expect(queued()).to.have.members([fine(1), fine(2)]);

            lodUpdate();
            expect(queued()).to.have.members([fine(1), fine(2)]);
        });
    });

    describe('withdrawing requests', function () {

        it('drops a queued prefetch that is no longer wanted', function () {
            const { registry, lodUpdate, resolveAll, queued } = makeScene([-10, -20, -30], { maxConcurrentLoads: 1 });

            lodUpdate();
            expect(queued()).to.include.members([fine(0), fine(1), fine(2)]);

            // a budget that only fits the coarse level, so no node wants the fine one any more
            lodUpdate(3 * COARSE_COUNT);
            expect(queued().filter(url => url.includes('fine'))).to.deep.equal([]);

            resolveAll();
            expect(registry.started.filter(url => url.includes('fine'))).to.deep.equal([]);
        });

        it('drops a queued placement as soon as its node moves on, without waiting for the cooldown', function () {
            const { lodUpdate, queued, inst } = makeScene([-10, -20, -30], { maxConcurrentLoads: 1, lodUnderfillLimit: 0 });

            lodUpdate();
            expect(queued()).to.have.members([fine(1), fine(2)]);

            lodUpdate(3 * COARSE_COUNT);
            expect(queued().filter(url => url.includes('fine'))).to.deep.equal([]);
            expect(inst.pending.has(1)).to.equal(false);
            expect(inst.pending.has(2)).to.equal(false);
        });

        it('lets a withdrawn download finish, then releases it after the cooldown', function () {
            const { octree, loader, lodUpdate, resolve } = makeScene([-10, -20], { maxConcurrentLoads: 8 });

            lodUpdate();
            expect(loader._currentlyLoading.has(fine(0))).to.equal(true);

            lodUpdate(2 * COARSE_COUNT);
            expect(loader._currentlyLoading.has(fine(0))).to.equal(true);
            expect(octree.cooldowns.has(0)).to.equal(true);

            resolve(fine(0));
            for (let i = 0; i < octree.cooldownTicks; i++) {
                octree.updateCooldownTick(octree.cooldownTicks);
            }
            expect(loader._urlToAsset.has(fine(0))).to.equal(false);
            expect(octree.getFileResource(0)).to.equal(undefined);
        });

        it('keeps a withdrawn download if it is requested again before the cooldown ends', function () {
            const { octree, loader, lodUpdate } = makeScene([-10, -20], { maxConcurrentLoads: 8 });

            lodUpdate();
            lodUpdate(2 * COARSE_COUNT);
            expect(octree.cooldowns.has(0)).to.equal(true);

            lodUpdate();
            expect(octree.cooldowns.has(0)).to.equal(false);
            expect(loader._currentlyLoading.has(fine(0))).to.equal(true);
        });

        it('stops tracking a prefetch nothing wants any more', function () {
            const { inst, lodUpdate } = makeScene([-10, -20], { maxConcurrentLoads: 1 });

            lodUpdate();
            expect([...inst.prefetchPending]).to.have.members([0, 1]);

            // only the coarse level fits now, so the fine files drop out and the coarse ones remain
            lodUpdate(2 * COARSE_COUNT);
            expect([...inst.prefetchPending]).to.have.members([2, 3]);
        });
    });

    describe('GSplatOctree#flushRequests', function () {

        const makeRecordingLoader = () => ({
            loads: [],
            dequeued: [],
            load(url, priority) {
                this.loads.push([url, priority]);
            },
            dequeue(url) {
                this.dequeued.push(url);
                return true;
            },
            getResource() {
                return undefined;
            },
            unload() {},
            destroy() {}
        });

        it('issues requests highest priority first, each file once at its highest priority', function () {
            const octree = makeOctree([-10, -20, -30]);
            const loader = makeRecordingLoader();
            octree.assetLoader = loader;

            // two instances sharing the octree, e.g. for two cameras
            octree.submitRequests('a', new Map([[0, 0.5], [1, 2.1], [2, 1.3]]));
            octree.submitRequests('b', new Map([[0, 2.7], [1, 0.2]]));
            octree.flushRequests();

            expect(loader.loads).to.deep.equal([
                [fine(0), 2.7],
                [fine(1), 2.1],
                [fine(2), 1.3]
            ]);
        });

        it('does not request a file that is already loaded', function () {
            const octree = makeOctree([-10, -20]);
            const loader = makeRecordingLoader();
            octree.assetLoader = loader;
            octree.fileResources.set(0, { numSplats: 1 });

            octree.submitRequests('a', new Map([[0, 2], [1, 1]]));
            octree.flushRequests();

            expect(loader.loads).to.deep.equal([[fine(1), 1]]);
        });

        it('withdraws only the requests that were not repeated', function () {
            const octree = makeOctree([-10, -20]);
            const loader = makeRecordingLoader();
            octree.assetLoader = loader;

            octree.submitRequests('a', new Map([[0, 1], [1, 1]]));
            octree.flushRequests();
            expect(loader.dequeued).to.deep.equal([]);

            octree.submitRequests('a', new Map([[1, 1]]));
            octree.flushRequests();
            expect(loader.dequeued).to.deep.equal([fine(0)]);
        });

        it('keeps a file one instance dropped while another still requests it, at its priority', function () {
            const octree = makeOctree([-10, -20]);
            const loader = makeRecordingLoader();
            octree.assetLoader = loader;

            octree.submitRequests('a', new Map([[0, 2.5]]));
            octree.submitRequests('b', new Map([[0, 0.5]]));
            octree.flushRequests();

            loader.loads.length = 0;
            octree.submitRequests('a', new Map());
            octree.flushRequests();
            expect(loader.dequeued).to.deep.equal([]);
            expect(loader.loads).to.deep.equal([[fine(0), 0.5]]);

            octree.submitRequests('b', new Map());
            octree.flushRequests();
            expect(loader.dequeued).to.deep.equal([fine(0)]);
        });

        it('lowers a queued priority at once when the instance that raised it is removed', function () {
            const octree = makeOctree([-10, -20]);
            const loader = makeRecordingLoader();
            octree.assetLoader = loader;

            octree.submitRequests('a', new Map([[0, 2.5]]));
            octree.submitRequests('b', new Map([[0, 0.5]]));
            octree.flushRequests();

            // no later flush is needed, the remaining instance may not update again for a while
            loader.loads.length = 0;
            octree.removeRequests('a', false);
            expect(loader.loads).to.deep.equal([[fine(0), 0.5]]);
            expect(loader.dequeued).to.deep.equal([]);
        });

        it('withdraws the requests of a removed instance that no other instance shares', function () {
            const octree = makeOctree([-10, -20]);
            const loader = makeRecordingLoader();
            octree.assetLoader = loader;

            octree.submitRequests('a', new Map([[0, 1], [1, 1]]));
            octree.submitRequests('b', new Map([[1, 1]]));
            octree.flushRequests();

            // withdrawn at once, as there may be no later flush
            octree.removeRequests('a', false);
            expect(loader.dequeued).to.deep.equal([fine(0)]);
        });
    });

    describe('several cameras', function () {

        it('does not withdraw the files another camera still waits for', function () {
            const { octree, queued } = makeStreaming([-10, -20, -30], 1);
            const a = addView(octree);
            const b = addView(octree);

            // B only renders the coarse level, so only A wants the fine files
            b.placement.lodRangeMin = 1;

            a.lodUpdate();
            expect(queued().filter(isFine)).to.have.members([fine(0), fine(1), fine(2)]);

            // B keeps re-evaluating while A's camera stays still
            for (let i = 0; i < 5; i++) {
                b.lodUpdate();
            }
            expect(queued().filter(isFine)).to.have.members([fine(0), fine(1), fine(2)]);
        });

        it('withdraws a file once no camera wants it', function () {
            const { octree, queued } = makeStreaming([-10, -20, -30], 1);
            const a = addView(octree);
            const b = addView(octree);

            a.lodUpdate();
            b.lodUpdate();
            expect(queued().filter(isFine)).to.have.members([fine(0), fine(1), fine(2)]);

            // a budget that only fits the coarse level
            a.lodUpdate(3 * COARSE_COUNT);
            expect(queued().filter(isFine)).to.have.members([fine(0), fine(1), fine(2)]);

            b.lodUpdate(3 * COARSE_COUNT);
            expect(queued().filter(isFine)).to.deep.equal([]);
        });

        it('keeps what another camera still wants when one camera is destroyed', function () {
            const { octree, loader, queued } = makeStreaming([-10, -20, -30], 1);
            const a = addView(octree);
            const b = addView(octree);
            b.placement.lodRangeMin = 1;

            a.lodUpdate();
            b.lodUpdate();

            b.inst.destroy(true);
            expect(queued().filter(isFine)).to.have.members([fine(0), fine(1), fine(2)]);

            a.inst.destroy(true);
            expect(queued()).to.deep.equal([]);
            expect(loader._currentlyLoading.size).to.equal(1);
        });

        it('starts the next load by the priorities of the cameras that remain', function () {
            const { registry, loader, octree, resolve } = makeStreaming([-10, -20, -30], 1);
            loader.load('/scene/busy.json', 0);

            // A rates file 0 highest, B rates file 1 above file 0
            octree.submitRequests('a', new Map([[0, 2.5]]));
            octree.submitRequests('b', new Map([[0, 0.5], [1, 1.5]]));
            octree.flushRequests();

            octree.removeRequests('a', false);
            resolve('/scene/busy.json');
            expect(registry.started).to.deep.equal(['/scene/busy.json', fine(1)]);
        });

        it('keeps a download in progress that another camera wants when one camera is torn down', function () {
            const { octree, loader } = makeStreaming([-10, -20], 8);
            const a = addView(octree);
            const b = addView(octree);

            a.lodUpdate();
            b.lodUpdate();
            expect(loader._currentlyLoading.has(fine(0))).to.equal(true);

            // without deferred ref counting a withdrawn download is unloaded at once, but B still
            // wants this one
            a.inst.destroy();
            expect(loader._currentlyLoading.has(fine(0))).to.equal(true);

            b.inst.destroy();
            expect(loader._urlToAsset.has(fine(0))).to.equal(false);
        });
    });

    describe('cooldowns', function () {

        it('advance once per token, however many worlds tick the octree', function () {
            const octree = makeOctree([-10]);
            octree.cooldowns.set(0, 5);

            // the worlds of two cameras sharing the octree, over two frames
            const makeWorld = () => {
                const world = Object.create(GSplatWorld.prototype);
                world._gsplat = { cooldownTicks: 100 };
                world._octreeInstances = new Map([[{}, { octree }]]);
                return world;
            };
            const worlds = [makeWorld(), makeWorld()];

            for (const token of [1, 2]) {
                for (const world of worlds) {
                    world.tickCooldowns(token);
                }
            }
            expect(octree.cooldowns.get(0)).to.equal(3);
        });
    });
});

describe('GSplatWorld#testCameraMovedForLod', function () {

    const makeWorld = (lodBehindPenalty) => {
        const world = Object.create(GSplatWorld.prototype);
        world._gsplat = { lodUpdateDistance: 1, lodUpdateAngle: 90, lodBehindPenalty };
        world._lastLodCameraPos = new Vec3(0, 0, 0);
        world._lastLodCameraFwd = new Vec3(0, 0, -1);
        world._lastLodCameraFov = 45;
        return world;
    };

    const turnedCamera = (degrees) => {
        const camera = makeCamera();
        camera.setEulerAngles(0, degrees, 0);
        return camera;
    };

    it('updates LOD when the camera turns past the angle with a behind-camera penalty', function () {
        expect(makeWorld(1.5).testCameraMovedForLod(turnedCamera(120))).to.equal(true);
        expect(makeWorld(1.5).testCameraMovedForLod(turnedCamera(60))).to.equal(false);
    });

    it('ignores rotation when there is no behind-camera penalty', function () {
        expect(makeWorld(1).testCameraMovedForLod(turnedCamera(120))).to.equal(false);
    });

    it('still updates LOD on translation when there is no behind-camera penalty', function () {
        const camera = makeCamera();
        camera.setPosition(0, 0, -2);
        expect(makeWorld(1).testCameraMovedForLod(camera)).to.equal(true);
    });
});
