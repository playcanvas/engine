import { expect } from 'chai';

import { Vec3 } from '../../../src/core/math/vec3.js';
import { GraphNode } from '../../../src/scene/graph-node.js';
import { GSplatBudgetBalancer } from '../../../src/scene/gsplat-unified/gsplat-budget-balancer.js';
import { buildLodTree } from '../../../src/scene/gsplat-unified/gsplat-lod-tree.js';
import { GSplatOctreeInstance } from '../../../src/scene/gsplat-unified/gsplat-octree-instance.js';
import { GSplatOctree } from '../../../src/scene/gsplat-unified/gsplat-octree.js';

// Three levels, every node in its own file, file index = node index, nodes listed breadth first:
//
//   level 2:      A(100)               B(50)
//   level 1:  A0(120)    A1(90)        B0(110)
//   level 0:  A00(200)  A10(150) A11(160)  B00(230)
const A = 0, B = 1, A0 = 2, A1 = 3, B0 = 4, A00 = 5, A10 = 6, A11 = 7, B00 = 8;
const COUNTS = [100, 50, 120, 90, 110, 200, 150, 160, 230];
const LEVELS = [2, 2, 1, 1, 1, 0, 0, 0, 0];
const CHILDREN = [[A0, A1], [B0], [A00], [A10, A11], [B00], [], [], [], []];

// Unit boxes along x, a parent's box the union of its children's, so a test can place the camera.
const boxOf = (n) => {
    const leaves = [];
    const collect = (m) => {
        if (CHILDREN[m].length) CHILDREN[m].forEach(collect);
        else leaves.push(m - A00);
    };
    collect(n);
    return { min: [Math.min(...leaves) * 2, 0, 0], max: [Math.max(...leaves) * 2 + 1, 1, 1] };
};

const makeOctree = () => {
    const node = n => ({
        bound: boxOf(n),
        level: LEVELS[n],
        lods: { [LEVELS[n]]: { file: n, offset: 0, count: COUNTS[n] } },
        children: CHILDREN[n].map(node)
    });
    return new GSplatOctree('/scene/lod-meta.json', {
        lodLevels: 3,
        filenames: [...COUNTS.map((_, i) => `${i}.sog`), 'env.sog'],
        environment: 'env.sog',
        hierarchical: true,
        tree: { bound: { min: [0, 0, 0], max: [7, 1, 1] }, children: [node(A), node(B)] }
    });
};

describe('GSplatOctree', function () {

    it('stores every node below the root breadth first, with its parent, children and level', function () {
        const octree = makeOctree();

        expect(octree.nodes).to.have.lengthOf(9);
        expect(Array.from(octree.parentIndex)).to.deep.equal([-1, -1, A, A, B, A0, A1, A1, B0]);
        expect(Array.from(octree.childCount)).to.deep.equal([2, 1, 1, 2, 1, 0, 0, 0, 0]);
        expect(octree.childStart[A]).to.equal(A0);
        expect(octree.childStart[A1]).to.equal(A10);
        expect(Array.from(octree.nodeLevel)).to.deep.equal(LEVELS);

        // each node holds its own level only
        expect(octree.nodes[A1].lods[1].count).to.equal(90);
        expect(octree.nodes[A1].lods[0].count).to.equal(0);
        expect(octree.files[octree.nodes[A].lods[2].fileIndex].lodLevel).to.equal(2);
        expect(Array.from(octree.childrenSplats.subarray(0, 2))).to.deep.equal([210, 110]);
    });

    it('counts the loaded nodes below each node as files load and unload', function () {
        const octree = makeOctree();
        const loaded = new Set();
        octree.assetLoader = { getResource: url => (loaded.has(url) ? {} : null), unload() {}, load() {} };

        expect(octree.loadedBelow[A]).to.equal(0);
        loaded.add('/scene/7.sog');
        octree.pollFileResource(A11);
        expect([octree.loadedBelow[A], octree.loadedBelow[A1], octree.loadedBelow[A11], octree.loadedBelow[A0]]).to.deep.equal([1, 1, 1, 0]);

        octree.unloadResource(A11);
        expect(octree.loadedBelow[A]).to.equal(0);
    });

    it('reorganizes a manifest holding its data in the leaves into a tree', function () {
        // two leaves in one file per level, next to each other: the root takes over both levels
        const octree = new GSplatOctree('/scene/lod-meta.json', {
            lodLevels: 2,
            filenames: ['0.json', '1.json'],
            tree: {
                children: [0, 1].map(i => ({
                    bound: { min: [i, 0, 0], max: [i + 1, 1, 1] },
                    lods: { 0: { file: 0, offset: i * 40, count: 40 }, 1: { file: 1, offset: i * 20, count: 20 } }
                }))
            }
        });
        expect(Array.from(octree.nodeLevel)).to.deep.equal([1, 0]);
        expect(octree.nodes[0].lods[1].count).to.equal(40);
        expect(octree.nodes[1].lods[0].count).to.equal(80);
    });
});

// An instance with what the LOD passes read, over an octree whose loader reports the node files in
// `loaded` (by node index) as loaded.
const makeInstance = (loaded = new Set()) => {
    const octree = makeOctree();
    octree.assetLoader = {
        getResource: url => (loaded.has(Number(url.match(/(\d+)\.sog$/)?.[1])) ? {} : null),
        load() {},
        unload() {},
        dequeue: () => true
    };

    // the octree polls every file it requested as it completes, so loaded files are known to it
    for (const n of loaded) {
        octree.pollFileResource(n);
    }

    const instance = Object.create(GSplatOctreeInstance.prototype);
    Object.assign(instance, {
        octree,
        rangeMin: 0,
        rangeMax: 2,
        placement: { node: new GraphNode(), lodBaseDistance: 1, lodMultiplier: 3 },
        nodeInfos: octree.nodes.map(() => ({ currentLod: -1, worldDistanceSq: 1 })),
        filePlacements: new Array(octree.files.length).fill(null),
        activePlacements: new Set(),
        pending: new Set(),
        removedCandidates: new Set(),
        prefetchPending: new Set(),
        _fileRequests: new Map(),
        _cameraPos: new Vec3(0, 0, 0),
        _cameraFwd: new Vec3(0, 0, -1),
        _distanceScaleSq: 1,
        _penalty: 0,
        treeStamp: 0,
        treeRefined: null,
        treePosition: null,
        treeStep: 1,
        treeOffset: 0,
        treeCutStop: Infinity,
        _drawn: null,
        _drawnCount: 0,
        _retainedCount: 0
    });
    return instance;
};

// Gives the cut the bands the allocator would: from the top down, a node is refined when its band
// is finer than its level, and each node's position records its band for the walk.
const setBands = (instance, bandOf) => {
    instance.beginTreeCut(1, 0);
    instance.treeCutStop = 0;
    const { parentIndex, childCount, nodeLevel } = instance.octree;
    for (let n = 0; n < parentIndex.length; n++) {
        const band = bandOf(n);
        instance.treePosition[n] = band - instance.rangeMin + 0.5;
        const reached = parentIndex[n] < 0 || instance.treeRefined[parentIndex[n]] === instance.treeStamp;
        if (reached && childCount[n] > 0 && band < nodeLevel[n]) {
            instance.treeRefined[n] = instance.treeStamp;
        }
    }
};

// Bands where the top level asks for `top` and every other node for `rest`, which is no finer.
const twoTier = (top, rest) => n => (n === A || n === B ? top : rest);

const drawnNodes = instance => Array.from(instance._drawn.subarray(0, instance._drawnCount)).sort((a, b) => a - b);
const requested = instance => Array.from(instance._fileRequests.keys()).sort((a, b) => a - b);

const cut = (loaded, bands, limit = 0) => {
    const instance = makeInstance(loaded);
    setBands(instance, bands);
    instance._applyTreeCut(limit);
    return instance;
};

describe('GSplatOctreeInstance#_applyTreeCut', function () {

    it('requests the top level first, and renders nothing until it loads', function () {
        const instance = cut(new Set(), () => 0);
        expect(drawnNodes(instance)).to.deep.equal([]);
        expect(requested(instance)).to.deep.equal([A, B]);
    });

    it('keeps a node until all its children are loaded, requesting the missing ones', function () {
        const instance = cut(new Set([A, B, A0]), () => 0);
        expect(drawnNodes(instance)).to.deep.equal([A, B]);
        expect(requested(instance)).to.deep.equal([A1, B0]);
    });

    it('refines to the finest loaded cut the bands ask for', function () {
        const instance = cut(new Set([A, B, A0, A1, B0, A10, A11]), () => 0);

        // A0 waits for A00, B0 for B00, A1 refines
        expect(drawnNodes(instance)).to.deep.equal([A0, B0, A10, A11]);
        expect(requested(instance)).to.deep.equal([A00, B00]);
    });

    it('renders a loaded coarser node within the underfill limit while the cut coarsens', function () {
        // the leaves rendered before, the cut now asks for level 1, which is not loaded, but the
        // top level is, one level coarser
        const loaded = new Set([A, B, A00, A10, A11, B00]);
        const within = cut(loaded, () => 1, 1);
        expect(drawnNodes(within)).to.deep.equal([A, B]);
        expect(requested(within)).to.deep.equal([A0, A1, B0]);

        // with no underfill allowed, the finer leaves keep rendering instead
        expect(drawnNodes(cut(loaded, () => 1, 0))).to.deep.equal([A00, A10, A11, B00]);
    });

    it('keeps the finer data when the loaded coarser node is beyond the underfill limit', function () {
        // the top level is two levels coarser than its distance asks for
        const loaded = new Set([A, B, A00, A10, A11, B00]);
        expect(drawnNodes(cut(loaded, twoTier(0, 1), 1))).to.deep.equal([A00, A10, A11, B00]);
        expect(drawnNodes(cut(loaded, twoTier(0, 1), 2))).to.deep.equal([A, B]);
    });

    it('measures the finer nodes it renders in place of the nodes still loading', function () {
        // the allocator reached A0, A1 and B0 only, the leaves render in their place
        const instance = cut(new Set([A, B, A00, A10, A11, B00]), twoTier(0, 1), 1);
        expect(drawnNodes(instance)).to.deep.equal([A00, A10, A11, B00]);
        expect([A10, A11, B00].map(n => instance.nodeInfos[n].worldDistanceSq)).to.deep.equal([4, 16, 36]);
    });

    it('holds the loaded children of a node rendering coarser until the rest of them load', function () {
        const loaded = new Set([A, B, A0]);
        const instance = cut(loaded, () => 1);
        const { octree } = instance;

        // A renders until A1 loads, holding A0, which loaded first, out of its cooldown
        expect(drawnNodes(instance)).to.deep.equal([A, B]);
        expect(octree.fileRefCounts[A0]).to.equal(1);
        expect(octree.cooldowns.has(A0)).to.be.false;

        // A1 loads and A refines: A0 renders, and the hold on it is released
        loaded.add(A1);
        octree.pollFileResource(A1);
        setBands(instance, () => 1);
        instance._applyTreeCut(0);
        expect(drawnNodes(instance)).to.deep.equal([B, A0, A1]);
        expect(octree.fileRefCounts[A0]).to.equal(1);
        expect(instance._retainedCount).to.equal(0);
    });

    it('holds a loaded child coarser than asked for, which renders once its siblings load', function () {
        // the cut asks for level 0 with no underfill allowed: A0 is a level too coarse, but A
        // renders until A1 loads, and then A0 renders until A00 loads
        const loaded = new Set([A, B, A0]);
        const instance = cut(loaded, () => 0);
        const { octree } = instance;
        expect(drawnNodes(instance)).to.deep.equal([A, B]);
        expect(octree.fileRefCounts[A0]).to.equal(1);
        expect(octree.cooldowns.has(A0)).to.be.false;

        loaded.add(A1);
        octree.pollFileResource(A1);
        setBands(instance, () => 0);
        instance._applyTreeCut(0);
        expect(drawnNodes(instance)).to.deep.equal([B, A0, A1]);
        expect(octree.fileRefCounts[A0]).to.equal(1);
        expect(instance._retainedCount).to.equal(0);
    });

    it('releases the held children into their cooldown when the cut no longer refines to them', function () {
        const instance = cut(new Set([A, B, A0]), () => 1);
        const { octree } = instance;
        expect(octree.fileRefCounts[A0]).to.equal(1);

        setBands(instance, () => 2);
        instance._applyTreeCut(0);
        expect(octree.fileRefCounts[A0]).to.equal(0);
        expect(octree.cooldowns.has(A0)).to.be.true;
    });

    it('mixes regions, each rendering coarser where that is loaded and finer where it is not', function () {
        // A is loaded and within the limit, B is not loaded, only its leaf is
        expect(drawnNodes(cut(new Set([A, A00, A10, A11, B00]), () => 1, 1))).to.deep.equal([A, B00]);
    });

    it('covers every loaded region exactly once, draws only loaded nodes, and stays within the limit', function () {
        const { parentIndex, childCount, nodeLevel } = makeOctree();
        for (let mask = 0; mask < 512; mask++) {
            const loaded = new Set([...Array(9).keys()].filter(n => mask & (1 << n)));
            for (let top = 0; top < 3; top++) {
                for (let rest = top; rest < 3; rest++) {
                    for (let limit = 0; limit < 4; limit++) {
                        const instance = cut(loaded, twoTier(top, rest), limit);
                        const drawn = new Set(drawnNodes(instance));
                        const label = `mask ${mask}, bands ${top}/${rest}, limit ${limit}`;

                        drawn.forEach(n => expect(loaded.has(n), `node ${n}, ${label}`).to.be.true);

                        for (let leaf = 0; leaf < 9; leaf++) {
                            if (childCount[leaf]) continue;
                            let covering = 0;
                            let anyLoaded = false;
                            for (let n = leaf; n >= 0; n = parentIndex[n]) {
                                if (drawn.has(n)) covering++;
                                if (loaded.has(n)) anyLoaded = true;
                            }
                            expect(covering, `leaf ${leaf}, ${label}`).to.be.at.most(1);
                            if (anyLoaded) expect(covering, `leaf ${leaf}, ${label}`).to.equal(1);
                        }

                        // with the top level loaded and any coarser node allowed, nothing is drawn
                        // finer than asked for: every ancestor of a drawn node is refined
                        if (limit >= 2 && loaded.has(A) && loaded.has(B)) {
                            drawn.forEach((n) => {
                                for (let a = parentIndex[n]; a >= 0; a = parentIndex[a]) {
                                    expect(twoTier(top, rest)(a) < nodeLevel[a], `node ${n} under ${a}, ${label}`).to.be.true;
                                }
                            });
                        }
                    }
                }
            }
        }
    });

    it('only touches the nodes whose state changes', function () {
        const instance = makeInstance(new Set([A, B, A0, A1, B0]));
        const balancer = new GSplatBudgetBalancer();
        const map = new Map([[{}, instance]]);
        balancer.balance(map, 400, false);
        instance._applyTreeCut(0);
        const first = drawnNodes(instance);
        expect(first.length).to.be.greaterThan(0);
        first.forEach(n => expect(instance.nodeInfos[n].currentLod).to.equal(LEVELS[n]));

        // the same cut again adds and removes nothing
        let changes = 0;
        instance.incrementFileRef = () => changes++;
        instance.decrementFileRef = () => changes++;
        balancer.balance(map, 400, false);
        instance._applyTreeCut(0);
        expect(changes).to.equal(0);
        expect(drawnNodes(instance)).to.deep.equal(first);
    });
});

describe('GSplatBudgetBalancer#balance (tree)', function () {

    // The nodes the cut renders: down from the top to the first node it does not refine.
    const cutOf = (instance) => {
        const { parentIndex, childStart, childCount, nodes } = instance.octree;
        const out = [];
        const stack = [];
        for (let n = 0; n < nodes.length && parentIndex[n] < 0; n++) stack.push(n);
        while (stack.length) {
            const n = stack.pop();
            if (instance.treeRefined[n] === instance.treeStamp) {
                for (let c = childStart[n]; c < childStart[n] + childCount[n]; c++) stack.push(c);
            } else {
                out.push(n);
            }
        }
        return out.sort((a, b) => a - b);
    };
    const splatsOf = nodesIn => nodesIn.reduce((s, n) => s + COUNTS[n], 0);

    it('chooses the cut that fills the budget, measuring only the nodes it reaches', function () {
        const instance = makeInstance();
        const visited = [];
        const measure = instance.measureTreeNode;
        instance.measureTreeNode = function (n) {
            visited.push(n);
            return measure.call(this, n);
        };

        // the camera at the start of A: A refines first, then A0
        new GSplatBudgetBalancer().balance(new Map([[{}, instance]]), 400, false);
        expect(cutOf(instance)).to.deep.equal([B, A1, A00]);
        expect(splatsOf(cutOf(instance))).to.be.at.most(400);

        // B and A1 did not refine, so their children were never measured
        expect(visited.sort((a, b) => a - b)).to.deep.equal([A, B, A0, A1, A00]);
    });

    it('refines the whole tree to the leaves with no budget', function () {
        const instance = makeInstance();
        new GSplatBudgetBalancer().balance(new Map([[{}, instance]]), Infinity, false);
        expect(cutOf(instance)).to.deep.equal([A00, A10, A11, B00]);
    });

    it('stops at the configured distances in limit mode', function () {
        const instance = makeInstance();
        instance._cameraPos.x = 100;
        new GSplatBudgetBalancer().balance(new Map([[{}, instance]]), Infinity, true);
        expect(cutOf(instance)).to.deep.equal([A, B]);
    });
});

describe('buildLodTree', function () {

    // A flat manifest: two inner nodes of two leaves each, three levels, every level of every
    // leaf in the file of that level, leaves in tree order.
    const makeFlat = (scatter = false) => {
        const counts = [[40, 20, 10], [40, 20, 10], [40, 20, 10], [40, 20, 10]];
        const offsets = [0, 0, 0];
        const leaves = counts.map((c, i) => ({
            bound: { min: [i, 0, 0], max: [i + 1, 1, 1] },
            lods: Object.fromEntries(c.map((count, level) => {
                // scatter puts the second leaf's coarsest level behind the fourth's
                const offset = scatter && level === 2 && i === 1 ? 100 : offsets[level];
                offsets[level] += count;
                return [level, { file: level, offset, count }];
            }))
        }));
        return {
            lodLevels: 3,
            filenames: ['0.json', '1.json', '2.json'],
            tree: { children: [{ children: [leaves[0], leaves[1]] }, { children: [leaves[2], leaves[3]] }] }
        };
    };

    // Per level, the [file, offset, count] ranges of the tree nodes holding it.
    const rangesOf = (octree, level) => octree.nodes.flatMap((node, n) => {
        if (octree.nodeLevel[n] !== level || node.lods[level].count === 0) return [];
        return [[node.lods[level].fileIndex, node.lods[level].offset, node.lods[level].count]];
    }).sort((a, b) => a[1] - b[1]);

    it('moves each level up to the highest node holding few enough splats in it', function () {
        const octree = new GSplatOctree('/scene/lod-meta.json', buildLodTree(makeFlat(), 40));

        // the coarsest level (40 splats in all) is held by the root, the middle one (2 x 40) by
        // the two inner nodes, the finest by the leaves
        expect(rangesOf(octree, 2)).to.deep.equal([[2, 0, 40]]);
        expect(rangesOf(octree, 1)).to.deep.equal([[1, 0, 40], [1, 40, 40]]);
        expect(rangesOf(octree, 0)).to.deep.equal([[0, 0, 40], [0, 40, 40], [0, 80, 40], [0, 120, 40]]);
    });

    it('keeps every level of every leaf exactly once, and nests each node in its parent one level coarser', function () {
        for (const nodeSplats of [1, 30, 40, 80, 1000]) {
            const octree = new GSplatOctree('/scene/lod-meta.json', buildLodTree(makeFlat(), nodeSplats));
            for (let level = 0; level < 3; level++) {
                const total = rangesOf(octree, level).reduce((s, r) => s + r[2], 0);
                expect(total, `level ${level}, nodeSplats ${nodeSplats}`).to.equal([160, 80, 40][level]);
            }
            const { parentIndex, nodeLevel } = octree;
            for (let n = 0; n < octree.nodes.length; n++) {
                if (parentIndex[n] >= 0) expect(nodeLevel[n]).to.equal(nodeLevel[parentIndex[n]] - 1);
            }
        }
    });

    it('leaves a level with the leaves when their data for it is not one contiguous range', function () {
        const octree = new GSplatOctree('/scene/lod-meta.json', buildLodTree(makeFlat(true), 1000));

        // the first inner node cannot take over the coarsest level, so neither can the root
        expect(rangesOf(octree, 2).length).to.be.greaterThan(1);
        expect(rangesOf(octree, 2).reduce((s, r) => s + r[2], 0)).to.equal(40);
    });
});
