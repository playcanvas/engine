import { expect } from 'chai';

import { Vec3 } from '../../../src/core/math/vec3.js';
import { GSplatBudgetBalancer } from '../../../src/scene/gsplat-unified/gsplat-budget-balancer.js';
import { GSplatOctreeInstance } from '../../../src/scene/gsplat-unified/gsplat-octree-instance.js';
import { GSplatOctree } from '../../../src/scene/gsplat-unified/gsplat-octree.js';

// An instance of an octree of leaves, each with its own LOD levels in files of its own, so the
// tree built from them keeps every leaf as a chain of its levels, and the level the cut stops a
// chain at is the level the allocator gives that leaf. Leaf `i` sits `distances[i]` from the
// camera along x.
const makeInstance = (nodes, distances, { rangeMin = 0, rangeMax = nodes[0].lods.length - 1, lodBaseDistance = 5, lodMultiplier = 3 } = {}) => {
    const levels = nodes[0].lods.length;
    const octree = new GSplatOctree('/scene/lod-meta.json', {
        lodLevels: levels,
        filenames: nodes.flatMap((_, i) => Array.from({ length: levels }, (__, l) => `${i}_${l}.json`)),
        tree: {
            children: nodes.map((node, i) => ({
                bound: { min: [distances[i], 0, 0], max: [distances[i] + 1, 1, 1] },
                lods: Object.fromEntries(node.lods.map(({ count }, l) => [l, { file: i * levels + l, offset: 0, count }]))
            }))
        }
    });

    const inst = Object.create(GSplatOctreeInstance.prototype);
    Object.assign(inst, {
        octree,
        rangeMin,
        rangeMax,
        placement: { lodBaseDistance, lodMultiplier },
        nodeInfos: octree.nodes.map(() => ({ worldDistanceSq: 0 })),
        _cameraPos: new Vec3(0, 0.5, 0.5),
        _cameraFwd: new Vec3(1, 0, 0),
        _distanceScaleSq: 1,
        _penalty: 0,
        treeStamp: 0,
        treeRefined: null,
        treePosition: null,
        treeStep: 1,
        treeOffset: 0,
        treeCutStop: Infinity
    });
    return inst;
};

const run = (instances, budget, limit) => {
    const map = new Map(instances.map(inst => [{}, inst]));
    new GSplatBudgetBalancer().balance(map, budget, limit);
};

// The level the cut gives each leaf: down its chain from the top level node to the first node the
// cut does not refine.
const levelNodes = (inst) => {
    const { parentIndex, childStart } = inst.octree;
    const result = [];
    for (let n = 0; n < parentIndex.length && parentIndex[n] < 0; n++) {
        let node = n;
        while (inst.treeRefined[node] === inst.treeStamp) node = childStart[node];
        result.push(node);
    }
    return result;
};
const lodsOf = inst => levelNodes(inst).map(n => inst.octree.nodeLevel[n]);
const splatsOf = inst => levelNodes(inst).reduce((sum, n) => sum + inst.octree.nodeSplats[n], 0);

// A node whose levels each hold a fixed fraction of the finer one.
const decimated = (levels, finest = 1000, ratio = 0.5) => ({
    lods: Array.from({ length: levels }, (_, i) => ({ count: Math.round(finest * ratio ** i) }))
});

// The distance bands: level k from `base * multiplier^(k - 1)` on, clamped to the range.
const bandOf = (d, base, multiplier, rangeMin, rangeMax) => {
    const lod = d < base ? 0 : Math.floor(1 + Math.log(d / base) / Math.log(multiplier));
    return Math.min(Math.max(lod, rangeMin), rangeMax);
};

// Deterministic pseudo random distances.
const distancesFor = (count, near, far, seed = 1) => {
    let s = seed;
    return Array.from({ length: count }, () => {
        s = (s * 16807) % 2147483647;
        return near * (far / near) ** (s / 2147483647);
    });
};

describe('GSplatBudgetBalancer', function () {

    describe('limit mode', function () {

        it('reproduces the configured distance bands exactly when the budget does not bind', function () {
            for (const [base, multiplier] of [[5, 3], [0.5, 2], [40, 1.2], [3, 10]]) {
                const distances = distancesFor(500, 0.01, 1e5, base * 7);
                const inst = makeInstance(distances.map(() => decimated(6)), distances, { lodBaseDistance: base, lodMultiplier: multiplier });
                run([inst], Infinity, true);
                expect(lodsOf(inst)).to.deep.equal(distances.map(d => bandOf(d, base, multiplier, 0, 5)));
            }
        });

        it('clamps the bands to the LOD range', function () {
            const distances = [0.1, 6, 20, 80, 1e6];
            const inst = makeInstance(distances.map(() => decimated(6)), distances, { rangeMin: 1, rangeMax: 3 });
            run([inst], Infinity, true);
            expect(lodsOf(inst)).to.deep.equal([1, 1, 2, 3, 3]);
        });

        it('uses only what the distances call for when the camera is far away', function () {
            const distances = distancesFor(200, 1e4, 2e4);
            const inst = makeInstance(distances.map(() => decimated(4)), distances);
            run([inst], 1e9, true);
            expect(lodsOf(inst).every(lod => lod === 3)).to.equal(true);
            expect(splatsOf(inst)).to.equal(200 * 125);
        });

        it('only ever coarsens the distance bands to fit the budget', function () {
            const distances = distancesFor(300, 0.5, 200);
            const nodes = distances.map(() => decimated(5));
            const unlimited = makeInstance(nodes, distances);
            run([unlimited], Infinity, true);

            const budget = Math.round(splatsOf(unlimited) * 0.6);
            const limited = makeInstance(nodes, distances);
            run([limited], budget, true);

            expect(splatsOf(limited)).to.be.at.most(budget);
            expect(splatsOf(limited)).to.be.above(budget * 0.95);
            const fine = lodsOf(unlimited);
            lodsOf(limited).forEach((lod, i) => expect(lod).to.be.at.least(fine[i]));
        });

        it('never raises detail above the distance bands, however large the budget', function () {
            const distances = distancesFor(100, 1, 1000);
            const inst = makeInstance(distances.map(() => decimated(5)), distances);
            run([inst], 1e12, true);
            expect(lodsOf(inst)).to.deep.equal(distances.map(d => bandOf(d, 5, 3, 0, 4)));
        });
    });

    describe('target mode', function () {

        it('puts everything at its finest when the whole scene fits', function () {
            const distances = distancesFor(50, 100, 1e5);
            const inst = makeInstance(distances.map(() => decimated(4)), distances);
            run([inst], 1e9, false);
            expect(lodsOf(inst).every(lod => lod === 0)).to.equal(true);
        });

        it('puts everything at its coarsest when not even that fits', function () {
            const distances = distancesFor(50, 1, 10);
            const inst = makeInstance(distances.map(() => decimated(4)), distances);
            run([inst], 10, false);
            expect(lodsOf(inst).every(lod => lod === 3)).to.equal(true);
        });

        it('fills the budget, even when many nodes sit at nearly the same distance', function () {
            const distances = distancesFor(2000, 3e4, 3.1e4);
            const nodes = distances.map(() => decimated(5));
            for (const budget of [200000, 400000, 1000000]) {
                const inst = makeInstance(nodes, distances);
                run([inst], budget, false);
                expect(splatsOf(inst)).to.be.at.most(budget);
                expect(splatsOf(inst)).to.be.above(budget * 0.99);
            }
        });

        it('keeps nearer nodes at least as fine as farther ones', function () {
            const distances = distancesFor(400, 0.5, 5000);
            const inst = makeInstance(distances.map(() => decimated(5)), distances);
            run([inst], 150000, false);
            const lods = lodsOf(inst);
            const order = distances.map((d, i) => i).sort((a, b) => distances[a] - distances[b]);
            for (let i = 1; i < order.length; i++) {
                expect(lods[order[i]]).to.be.at.least(lods[order[i - 1]]);
            }
        });

        it('matches an exact greedy walk along the scale axis', function () {
            const distances = distancesFor(300, 1, 3000, 7);
            const nodes = distances.map((_, i) => decimated(5, 500 + (i * 37) % 900, 0.4 + (i % 5) * 0.05));
            const budget = 120000;
            const inst = makeInstance(nodes, distances);
            run([inst], budget, false);

            // take every switch point in order of the scale at which it happens until one does not fit
            const events = [];
            const logM = Math.log(3);
            nodes.forEach((node, n) => {
                for (let lod = 1; lod < 5; lod++) {
                    events.push({ t: Math.log(distances[n] / 5) - (lod - 1) * logM, delta: node.lods[lod - 1].count - node.lods[lod].count });
                }
            });
            events.sort((a, b) => a.t - b.t);
            let total = nodes.reduce((sum, node) => sum + node.lods[4].count, 0);
            for (const e of events) {
                if (total + e.delta > budget) break;
                total += e.delta;
            }

            expect(splatsOf(inst)).to.equal(total);
        });

        it('divides one budget between instances by their base distances', function () {
            const distances = distancesFor(200, 1, 500);
            const nodes = distances.map(() => decimated(5));
            const plain = makeInstance(nodes, distances);
            const favored = makeInstance(nodes, distances, { lodBaseDistance: 15 });
            run([plain, favored], 200000, false);

            expect(splatsOf(plain) + splatsOf(favored)).to.be.at.most(200000);
            expect(splatsOf(favored)).to.be.above(splatsOf(plain));
            const plainLods = lodsOf(plain);
            lodsOf(favored).forEach((lod, i) => expect(lod).to.be.at.most(plainLods[i]));
        });
    });

    it('keeps a barely decimated node on the level its distance calls for', function () {
        // levels that barely differ in splat count, one even growing, still follow the band
        const wobbly = { lods: [930, 926, 926, 925, 926].map(count => ({ count })) };
        const distances = [5 * 3 ** 3 * 1.5];
        const inst = makeInstance([wobbly], distances);
        run([inst], Infinity, true);
        expect(lodsOf(inst)).to.deep.equal([4]);
        run([inst], 1e9, false);
        expect(lodsOf(inst)).to.deep.equal([0]);
    });

    it('counts no splats for a node with nothing in range', function () {
        const empty = { lods: [{ count: 0 }, { count: 0 }] };
        const inst = makeInstance([decimated(2), empty], [1, 1]);
        run([inst], 1e9, false);
        expect(splatsOf(inst)).to.equal(1000);
    });

    it('does nothing without instances', function () {
        expect(() => new GSplatBudgetBalancer().balance(new Map(), 1000, false)).to.not.throw();
    });
});
