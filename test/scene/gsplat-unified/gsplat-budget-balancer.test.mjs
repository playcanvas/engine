import { expect } from 'chai';

import { GSplatBudgetBalancer } from '../../../src/scene/gsplat-unified/gsplat-budget-balancer.js';
import { GSplatLodTable } from '../../../src/scene/gsplat-unified/gsplat-lod-table.js';

// Minimal stand-ins for the pieces the balancer touches: an octree exposing its nodes, and an
// instance exposing nodeInfos, its resolved LOD range, its table and its placement's distances.
const makeInstance = (nodes, distances, { rangeMin = 0, rangeMax = nodes[0].lods.length - 1, lodBaseDistance = 5, lodMultiplier = 3 } = {}) => {
    const octree = { nodes: nodes.map(node => ({ lods: node.lods })) };
    return {
        octree,
        placement: { lodBaseDistance, lodMultiplier },
        nodeInfos: nodes.map((_, i) => ({ optimalLod: -1, worldDistanceSq: distances[i] * distances[i] })),
        rangeMin,
        rangeMax,
        lodTable: new GSplatLodTable(octree, rangeMin, rangeMax)
    };
};

const run = (instances, budget, limit) => {
    const map = new Map(instances.map(inst => [{}, inst]));
    new GSplatBudgetBalancer().balance(map, budget, limit);
};

const lodsOf = inst => inst.nodeInfos.map(info => info.optimalLod);

const splatsOf = (inst) => {
    let total = 0;
    for (let i = 0; i < inst.nodeInfos.length; i++) {
        const lod = inst.nodeInfos[i].optimalLod;
        if (lod >= 0) total += inst.octree.nodes[i].lods[lod].count;
    }
    return total;
};

// A node whose levels each hold a fixed fraction of the finer one.
const decimated = (levels, finest = 1000, ratio = 0.5) => ({
    lods: Array.from({ length: levels }, (_, i) => ({ count: Math.round(finest * ratio ** i), fileIndex: i }))
});

// The 2.21 distance bands: level k from `base * multiplier^(k - 1)` on, clamped to the range.
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
            limited.nodeInfos.forEach((info, i) => {
                expect(info.optimalLod).to.be.at.least(unlimited.nodeInfos[i].optimalLod);
            });
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
            // a far camera: every node within a few percent of the same distance, so a single bin
            // of the scale axis holds most of the scene
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
            const order = distances.map((d, i) => i).sort((a, b) => distances[a] - distances[b]);
            for (let i = 1; i < order.length; i++) {
                expect(inst.nodeInfos[order[i]].optimalLod).to.be.at.least(inst.nodeInfos[order[i - 1]].optimalLod);
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

            expect(splatsOf(inst)).to.be.at.most(budget);
            expect(splatsOf(inst)).to.be.at.least(total * 0.99);
        });

        it('divides one budget between instances by their base distances', function () {
            const distances = distancesFor(200, 1, 500);
            const nodes = distances.map(() => decimated(5));
            const plain = makeInstance(nodes, distances);
            const favored = makeInstance(nodes, distances, { lodBaseDistance: 15 });
            run([plain, favored], 200000, false);

            expect(splatsOf(plain) + splatsOf(favored)).to.be.at.most(200000);
            expect(splatsOf(favored)).to.be.above(splatsOf(plain));
            favored.nodeInfos.forEach((info, i) => {
                expect(info.optimalLod).to.be.at.most(plain.nodeInfos[i].optimalLod);
            });
        });
    });

    it('keeps a barely decimated node on the level its distance calls for', function () {
        // levels that barely differ in splat count, one even growing, still follow the band, so the
        // node shares files with its neighbors instead of pulling in a finer one
        const wobbly = { lods: [930, 926, 926, 925, 926].map((count, fileIndex) => ({ count, fileIndex })) };
        const distances = [5 * 3 ** 3 * 1.5];
        const inst = makeInstance([wobbly], distances);
        run([inst], Infinity, true);
        expect(lodsOf(inst)).to.deep.equal([4]);
        run([inst], 1e9, false);
        expect(lodsOf(inst)).to.deep.equal([0]);
    });

    it('gives a node with nothing renderable in range no level', function () {
        const empty = { lods: [{ count: 0, fileIndex: -1 }, { count: 0, fileIndex: -1 }] };
        const inst = makeInstance([decimated(2), empty], [1, 1]);
        run([inst], 1e9, false);
        expect(lodsOf(inst)).to.deep.equal([0, -1]);
    });

    it('does nothing without instances', function () {
        expect(() => new GSplatBudgetBalancer().balance(new Map(), 1000, false)).to.not.throw();
    });
});
