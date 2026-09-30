import { expect } from 'chai';

import { Vec2 } from '../../../src/core/math/vec2.js';
import { BoundingBox } from '../../../src/core/shape/bounding-box.js';
import { PROJECTION_PERSPECTIVE } from '../../../src/scene/constants.js';
import { GraphNode } from '../../../src/scene/graph-node.js';
import { GSplatBudgetBalancer } from '../../../src/scene/gsplat-unified/gsplat-budget-balancer.js';
import { GSplatInfo } from '../../../src/scene/gsplat-unified/gsplat-info.js';
import { buildGSplatIntervalData, INTERVAL_STRIDE } from '../../../src/scene/gsplat-unified/gsplat-interval-data.js';
import { GSplatOctreeInstance } from '../../../src/scene/gsplat-unified/gsplat-octree-instance.js';
import { GSplatOctree } from '../../../src/scene/gsplat-unified/gsplat-octree.js';
import { GSplatPlacement } from '../../../src/scene/gsplat-unified/gsplat-placement.js';

const LEVELS = 4;

// A square grid of `side` x `side` leaves, `size` wide, on the xz plane, under a binary tree that
// halves the grid alternately along x and z - the shape splat-transform's kd-tree writes. Leaf
// counts vary a little, a few leaves are wider than the rest (so distance shrink applies to them),
// and some leaves stop before the coarsest level (so they have an empty level).
const makeGridManifest = (side, size = 10) => {
    const leaf = (ix, iz) => {
        const base = 400 + ((ix * 7 + iz * 13) % 5) * 100;
        const levels = (ix + iz) % 7 === 0 ? LEVELS - 1 : LEVELS;
        const lods = {};
        for (let l = 0; l < levels; l++) {
            lods[l] = { file: l, offset: 0, count: Math.max(1, Math.floor(base / 2 ** l)) };
        }
        const wide = (ix * 3 + iz) % 11 === 0 ? size * 2 : 0;
        return {
            bound: { min: [ix * size - wide, 0, iz * size], max: [(ix + 1) * size + wide, 2, (iz + 1) * size] },
            lods
        };
    };
    const build = (x0, x1, z0, z1, splitX) => {
        if (x1 - x0 === 1 && z1 - z0 === 1) return leaf(x0, z0);
        if ((splitX && x1 - x0 > 1) || z1 - z0 === 1) {
            const m = (x0 + x1) >> 1;
            return { children: [build(x0, m, z0, z1, false), build(m, x1, z0, z1, false)] };
        }
        const m = (z0 + z1) >> 1;
        return { children: [build(x0, x1, z0, m, true), build(x0, x1, m, z1, true)] };
    };
    return {
        lodLevels: LEVELS,
        filenames: Array.from({ length: LEVELS }, (_, l) => `${l}.json`),
        tree: build(0, side, 0, side, true)
    };
};

const makeInstance = (octree) => {
    const placement = {
        node: new GraphNode(),
        lodRangeMin: 0,
        lodRangeMax: LEVELS - 1,
        lodBaseDistance: 5,
        lodMultiplier: 3,
        lodDirty: false
    };
    return new GSplatOctreeInstance({ on: () => ({ off() {} }) }, octree, placement);
};

// A camera near one corner of the grid, looking across it.
const makeCamera = () => {
    const node = new GraphNode();
    node.camera = { projection: PROJECTION_PERSPECTIVE, fov: 60, horizontalFov: false, aspectRatio: 16 / 9 };
    node.setPosition(-5, 8, -5);
    node.lookAt(100, 0, 100);
    return node;
};

// One LOD update's selection: per leaf level, and the instance for inspection.
const select = (octree, threshold, budget, limit = false) => {
    const inst = makeInstance(octree);
    inst.resolveLodRange();
    inst.evaluateNodeDistances(makeCamera(), {
        lodBehindPenalty: 1.5, lodDistanceShrink: 0.75, lodGroupThreshold: threshold, splatBudget: budget
    });
    new GSplatBudgetBalancer().balance(new Map([[inst.placement, inst]]), budget, limit);
    if (inst.lodUnits) inst._spreadLodUnits();
    return { inst, lods: inst.nodeInfos.map(info => info.optimalLod) };
};

const drawnCount = (octree, lods) => lods.reduce((sum, lod, i) => sum + (lod >= 0 ? octree.nodes[i].lods[lod].count : 0), 0);
const totalSplats = octree => octree.nodes.reduce((sum, node) => sum + node.lods[0].count, 0);

describe('GSplatOctree#tree', function () {

    it('packs the manifest tree depth-first with contiguous leaf ranges', function () {
        const octree = new GSplatOctree('/scene/lod-meta.json', makeGridManifest(4));
        const { tree } = octree;

        // 16 leaves under a full binary tree
        expect(tree.count).to.equal(31);
        expect(tree.leafStart[0]).to.equal(0);
        expect(tree.leafEnd[0]).to.equal(16);

        for (let n = 0; n < tree.count; n++) {
            const children = tree.childCount[n];
            if (children === 0) {
                expect(tree.leafEnd[n] - tree.leafStart[n]).to.equal(1);
                continue;
            }
            // a node's leaves are exactly its children's, in order
            const first = tree.children[tree.childStart[n]];
            const last = tree.children[tree.childStart[n] + children - 1];
            expect(tree.leafStart[n]).to.equal(tree.leafStart[first]);
            expect(tree.leafEnd[n]).to.equal(tree.leafEnd[last]);
        }
    });

    it('unites the bounds of each subtree', function () {
        const octree = new GSplatOctree('/scene/lod-meta.json', makeGridManifest(4));
        const { tree } = octree;
        for (let n = 0; n < tree.count; n++) {
            for (let a = 0; a < 3; a++) {
                let mn = Infinity;
                let mx = -Infinity;
                for (let leaf = tree.leafStart[n]; leaf < tree.leafEnd[n]; leaf++) {
                    mn = Math.min(mn, octree.nodeBoundsMinMax[leaf * 6 + a]);
                    mx = Math.max(mx, octree.nodeBoundsMinMax[leaf * 6 + 3 + a]);
                }
                expect(tree.boundsMinMax[n * 6 + a]).to.equal(mn);
                expect(tree.boundsMinMax[n * 6 + 3 + a]).to.equal(mx);
            }
        }
    });

    it('measures a leaf\'s distance to its shrunk bounds, and a group\'s to the union of its leaves\'', function () {
        const octree = new GSplatOctree('/scene/lod-meta.json', makeGridManifest(4));
        const { tree } = octree;
        const { boundsMinMax } = octree.getTreeDistanceBounds(0.75);
        for (let n = 0; n < tree.count; n++) {
            for (let a = 0; a < 3; a++) {
                let mn = Infinity;
                let mx = -Infinity;
                for (let leaf = tree.leafStart[n]; leaf < tree.leafEnd[n]; leaf++) {
                    const s = octree.nodeBoundsExcess[leaf * 3 + a] * 0.75;
                    mn = Math.min(mn, octree.nodeBoundsMinMax[leaf * 6 + a] + s);
                    mx = Math.max(mx, octree.nodeBoundsMinMax[leaf * 6 + 3 + a] - s);
                }
                expect(boundsMinMax[n * 6 + a]).to.equal(mn);
                expect(boundsMinMax[n * 6 + 3 + a]).to.equal(mx);
            }
        }
        expect(octree.getTreeDistanceBounds(0.75)).to.equal(octree.getTreeDistanceBounds(0.75));
        expect(octree.getTreeDistanceBounds(0).boundsMinMax[0]).to.equal(tree.boundsMinMax[0]);
    });

    it('sums each subtree\'s band splat counts from its leaves\' own rows', function () {
        const octree = new GSplatOctree('/scene/lod-meta.json', makeGridManifest(4));
        const { tree } = octree;
        const table = octree.acquireLodTable(0, LEVELS - 1);
        const { bandCount, renderable } = table.getGroupCounts(tree);
        const span = table.span;
        for (let n = 0; n < tree.count; n++) {
            expect(renderable[n]).to.equal(1);
            for (let b = 0; b < span; b++) {
                let sum = 0;
                for (let leaf = tree.leafStart[n]; leaf < tree.leafEnd[n]; leaf++) {
                    sum += table.bandCount[leaf * span + b];
                }
                expect(bandCount[n * span + b]).to.equal(sum);
            }
        }
        expect(table.getGroupCounts(tree)).to.equal(table.getGroupCounts(tree));
    });
});

describe('LOD grouping', function () {

    for (const limit of [false, true]) {
        it(`reproduces the per-leaf selection exactly when every node is split (${limit ? 'limit' : 'target'} budget)`, function () {
            const octree = new GSplatOctree('/scene/lod-meta.json', makeGridManifest(16));
            const total = totalSplats(octree);
            for (const budget of [total * 0.05, total * 0.2, total * 0.5, total * 2]) {
                const flat = select(octree, 0, budget, limit);
                const cut = select(octree, 1e-9, budget, limit);
                expect(cut.inst.lodUnitCount).to.equal(octree.nodes.length);
                expect(cut.lods).to.deep.equal(flat.lods);
            }
        });
    }

    it('evaluates distant subtrees as one unit and nearby leaves individually', function () {
        const octree = new GSplatOctree('/scene/lod-meta.json', makeGridManifest(16));
        const { inst } = select(octree, 0.1, totalSplats(octree) * 0.2);
        const { tree } = octree;
        expect(inst.lodUnitCount).to.be.below(octree.nodes.length / 2);

        let nearestLeafUnit = false;
        let largestUnit = 0;
        for (let u = 0; u < inst.lodUnitCount; u++) {
            const n = inst.lodUnits[u];
            const leaves = tree.leafEnd[n] - tree.leafStart[n];
            largestUnit = Math.max(largestUnit, leaves);
            // the leaf in the corner the camera is at
            if (tree.leafStart[n] === 0 && leaves === 1) nearestLeafUnit = true;
        }
        expect(nearestLeafUnit).to.equal(true);
        expect(largestUnit).to.be.above(1);
    });

    it('gives every leaf of a unit its own level for the unit\'s band, within the budget', function () {
        const octree = new GSplatOctree('/scene/lod-meta.json', makeGridManifest(16));
        const budget = totalSplats(octree) * 0.2;
        const { inst, lods } = select(octree, 0.1, budget);
        const { tree } = octree;
        const { bandLod, span } = inst.lodTable;
        for (let u = 0; u < inst.lodUnitCount; u++) {
            const n = inst.lodUnits[u];
            for (let leaf = tree.leafStart[n]; leaf < tree.leafEnd[n]; leaf++) {
                expect(lods[leaf]).to.equal(bandLod[leaf * span + inst.lodUnitBand[u]]);
            }
        }
        expect(drawnCount(octree, lods)).to.be.at.most(budget);
    });

    it('stays within one level of the per-leaf selection', function () {
        const octree = new GSplatOctree('/scene/lod-meta.json', makeGridManifest(16));
        const budget = totalSplats(octree) * 0.2;
        const flat = select(octree, 0, budget);
        const cut = select(octree, 0.05, budget);
        const offByMoreThanOne = cut.lods.filter((lod, i) => Math.abs(lod - flat.lods[i]) > 1).length;
        expect(offByMoreThanOne).to.equal(0);
    });

    it('evaluates every leaf when grouping is off', function () {
        const octree = new GSplatOctree('/scene/lod-meta.json', makeGridManifest(4));
        const inst = makeInstance(octree);
        inst.resolveLodRange();
        inst.evaluateNodeDistances(makeCamera(), { lodBehindPenalty: 1, lodGroupThreshold: 0.1, splatBudget: 1000 });
        expect(inst.lodUnits).to.not.equal(null);
        inst.evaluateNodeDistances(makeCamera(), { lodBehindPenalty: 1, lodGroupThreshold: 0, splatBudget: 1000 });
        expect(inst.lodUnits).to.equal(null);
    });
});

describe('GSplatOctreeInstance#applyLodChanges', function () {

    // An instance whose every file is loaded, so leaves settle as soon as they switch.
    const makeLoaded = (octree) => {
        const resource = { numSplats: 1, releaseTextureSources() {} };
        octree.assetLoader = { getResource: () => resource, load() {}, unload() {}, dequeue: () => true, destroy() {} };
        return makeInstance(octree);
    };
    // One frame as the world runs it: poll loads, then a LOD update.
    const update = (inst, camera, threshold) => {
        const params = { lodBehindPenalty: 1.5, lodDistanceShrink: 0.75, lodGroupThreshold: threshold, splatBudget: 20000, lodUnderfillLimit: 0 };
        inst.update();
        inst.resolveLodRange();
        inst.evaluateNodeDistances(camera, params);
        new GSplatBudgetBalancer().balance(new Map([[inst.placement, inst]]), params.splatBudget, false);
        inst.applyLodChanges(params);
    };
    const showsTargets = (octree, inst) => inst.nodeInfos.every((info, i) => {
        const target = info.optimalLod;
        const visible = target >= 0 && octree.nodes[i].lods[target].fileIndex !== -1;
        return info.currentLod === (visible ? target : -1);
    });
    const dirtyCount = inst => inst._leafDirty.reduce((sum, d) => sum + d, 0);

    for (const threshold of [0, 0.1]) {
        it(`only evaluates the leaves whose target changed (grouping ${threshold})`, function () {
            const octree = new GSplatOctree('/scene/lod-meta.json', makeGridManifest(8));
            const inst = makeLoaded(octree);
            const camera = makeCamera();

            // files arrive on the frame after they are first requested, and then every leaf settles
            update(inst, camera, threshold);
            update(inst, camera, threshold);
            expect(showsTargets(octree, inst)).to.equal(true);
            expect(dirtyCount(inst)).to.equal(0);

            // the same view evaluates nothing and changes nothing
            const before = inst.nodeInfos.map(info => info.currentLod);
            update(inst, camera, threshold);
            expect(dirtyCount(inst)).to.equal(0);
            expect(inst.nodeInfos.map(info => info.currentLod)).to.deep.equal(before);

            // a new view: the leaves settle on their new targets again
            camera.setPosition(60, 8, 60);
            update(inst, camera, threshold);
            update(inst, camera, threshold);
            expect(showsTargets(octree, inst)).to.equal(true);
            expect(dirtyCount(inst)).to.equal(0);
        });
    }
});

describe('GSplatInfo draw ranges', function () {

    // A file placement drawing the given leaves at `level`, laid out one after another in the file
    // in leaf order, with an optional gap after some leaves.
    const makeInfo = (octree, inst, leaves, level, rangeMerge, gapAfter = new Set()) => {
        const resource = { numSplats: 1e9, aabb: new BoundingBox() };
        const parent = new GSplatPlacement(null, inst.placement.node);
        const placement = new GSplatPlacement(resource, inst.placement.node, level, null, parent);
        let offset = 0;
        for (const leaf of leaves) {
            const count = octree.nodes[leaf].lods[level].count;
            placement.intervals.set(leaf, new Vec2(offset, offset + count - 1));
            offset += count + (gapAfter.has(leaf) ? 10 : 0);
        }
        return new GSplatInfo({}, resource, placement, octree.nodes, inst.nodeInfos, octree.tree, rangeMerge);
    };
    const allLeaves = octree => octree.nodes.map((_, i) => i);

    it('draws consecutive leaves of one file as whole subtrees of at most the merge size', function () {
        const octree = new GSplatOctree('/scene/lod-meta.json', makeGridManifest(16));
        const inst = makeInstance(octree);
        const { tree } = octree;

        for (const [merge, ranges] of [[1, 256], [16, 16], [64, 4], [1000, 1]]) {
            const info = makeInfo(octree, inst, allLeaves(octree), 0, merge);
            expect(info.intervals.length / 2).to.equal(ranges);
            expect(info.activeSplats).to.equal(totalSplats(octree));
            expect(info.numBoundsEntries).to.equal(tree.count);
            for (let r = 0; r < ranges; r++) {
                const n = info.intervalBoundsIndices[r];
                expect(tree.leafEnd[n] - tree.leafStart[n]).to.equal(256 / ranges);
            }
        }
    });

    it('splits ranges where the file layout breaks', function () {
        const octree = new GSplatOctree('/scene/lod-meta.json', makeGridManifest(4));
        const inst = makeInstance(octree);
        const { tree } = octree;
        const info = makeInfo(octree, inst, allLeaves(octree), 0, 16, new Set([5]));
        // no range spans leaves 5 and 6
        for (let r = 0; r < info.intervals.length / 2; r++) {
            const n = info.intervalBoundsIndices[r];
            expect(tree.leafStart[n] <= 5 && tree.leafEnd[n] > 6).to.equal(false);
        }
        expect(info.activeSplats).to.equal(totalSplats(octree));
    });

    it('keys a range by the leaf and level it starts at', function () {
        const octree = new GSplatOctree('/scene/lod-meta.json', makeGridManifest(4));
        const inst = makeInstance(octree);
        const leaves = allLeaves(octree).filter(i => octree.nodes[i].lods[2].count > 0);
        const first = makeInfo(octree, inst, leaves, 1, 4);
        const again = makeInfo(octree, inst, leaves, 1, 4);
        const otherLevel = makeInfo(octree, inst, leaves, 2, 4);

        expect(again.intervalAllocIds).to.deep.equal(first.intervalAllocIds);
        for (let r = 0; r < first.intervalAllocIds.length; r++) {
            expect(first.intervalAllocIds[r]).to.equal(inst.rangeAllocId(first.intervalNodeIndices[r], 1));
            expect(otherLevel.intervalAllocIds).to.not.include(first.intervalAllocIds[r]);
        }
        expect(new Set(first.intervalAllocIds).size).to.equal(first.intervalAllocIds.length);
    });

    it('culls each range against the bounds of the subtree it draws', function () {
        const octree = new GSplatOctree('/scene/lod-meta.json', makeGridManifest(4));
        const inst = makeInstance(octree);
        const { tree } = octree;
        const info = makeInfo(octree, inst, allLeaves(octree), 0, 4);
        info.boundsBaseIndex = 3;

        const spheres = new Float32Array((tree.count + 3) * 4);
        info.writeBoundsSpheres(spheres, info.boundsBaseIndex * 4);
        const sphere = n => spheres.subarray((3 + n) * 4, (3 + n) * 4 + 4);

        // every node's sphere encloses the bounds of all its leaves, and so every splat it draws
        for (let n = 0; n < tree.count; n++) {
            const [cx, cy, cz, r] = sphere(n);
            for (let leaf = tree.leafStart[n]; leaf < tree.leafEnd[n]; leaf++) {
                const b = octree.nodeBoundsMinMax.subarray(leaf * 6, leaf * 6 + 6);
                for (let corner = 0; corner < 8; corner++) {
                    const x = corner & 1 ? b[3] : b[0];
                    const y = corner & 2 ? b[4] : b[1];
                    const z = corner & 4 ? b[5] : b[2];
                    expect(Math.hypot(x - cx, y - cy, z - cz)).to.be.at.most(r + 1e-4);
                }
            }
        }

        // and the GPU interval data points each range at its subtree's entry
        info.intervalOffsets = info.intervalAllocIds.map((_, i) => i * 100);
        const data = buildGSplatIntervalData(/** @type {any} */ ({ splats: [info], totalIntervals: info.intervals.length / 2 }));
        for (let r = 0; r < info.intervals.length / 2; r++) {
            expect(data[r * INTERVAL_STRIDE + 2]).to.equal(3 + info.intervalBoundsIndices[r]);
        }
    });
});
