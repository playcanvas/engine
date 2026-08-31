import { expect } from 'chai';

import { GSplatBudgetBalancer } from '../../../src/scene/gsplat-unified/gsplat-budget-balancer.js';
import { GSplatLodTable } from '../../../src/scene/gsplat-unified/gsplat-lod-table.js';

// Minimal stand-ins for the pieces the balancer touches: an octree exposing nodes and a table
// cache, and an instance exposing nodeInfos, its resolved LOD range and its placement's falloff.
const makeInstance = (nodes, coverage, rangeMin = 0, rangeMax = nodes[0].lods.length - 1, lodFalloff = 1) => {
    const tables = new Map();
    const octree = {
        nodes: nodes.map(node => ({ lods: node.lods })),
        acquireLodTable(min, max) {
            const key = min * 256 + max;
            if (!tables.has(key)) tables.set(key, new GSplatLodTable(this, min, max));
            const table = tables.get(key);
            table.refCount++;
            return table;
        }
    };
    return {
        octree,
        placement: { lodFalloff },
        nodeInfos: nodes.map((_, i) => ({ optimalLod: -1, lodCoverage: coverage?.[i] ?? 1 })),
        rangeMin,
        rangeMax,
        // resolveLodRange() supplies this in the engine; the balancer reads it rather than
        // resolving the range itself
        lodTable: octree.acquireLodTable(rangeMin, rangeMax)
    };
};

const singleWithFalloff = (nodes, coverage, lodFalloff) => {
    const inst = makeInstance(nodes, coverage, 0, nodes[0].lods.length - 1, lodFalloff);
    return { inst, instances: new Map([[{}, inst]]) };
};

const single = (nodes, coverage, rangeMin, rangeMax) => {
    const inst = makeInstance(nodes, coverage, rangeMin, rangeMax);
    return { inst, instances: new Map([[{}, inst]]) };
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

// Exact greedy over the same chains, used as an oracle: a max-heap keyed on the true
// coverage-weighted ratio rather than a bucketed approximation of it. Same early exit.
const exactGreedy = (inst, budget) => {
    const table = inst.lodTable;
    const chosen = [];
    const heap = [];
    let spent = 0;

    for (let n = 0; n < inst.nodeInfos.length; n++) {
        chosen.push(table.startLod[n]);
        if (table.startLod[n] < 0) continue;
        spent += table.startCount[n];
        const k = table.firstUpgrade[n];
        if (k < table.firstUpgrade[n + 1]) {
            heap.push({ n, k, value: inst.nodeInfos[n].lodCoverage * table.upgradeRatio[k] });
        }
    }

    for (;;) {
        if (heap.length === 0) break;
        heap.sort((a, b) => b.value - a.value);
        const top = heap.shift();
        const cost = table.upgradeCost[top.k];
        if (spent + cost > budget) break;
        spent += cost;
        chosen[top.n] = table.upgradeToLod[top.k];
        const k2 = top.k + 1;
        if (k2 < table.firstUpgrade[top.n + 1]) {
            heap.push({ n: top.n, k: k2, value: inst.nodeInfos[top.n].lodCoverage * table.upgradeRatio[k2] });
        }
    }
    return { lods: chosen, spent };
};

const residual = (inst, lods) => {
    let total = 0;
    for (let i = 0; i < lods.length; i++) {
        if (lods[i] >= 0) total += inst.octree.nodes[i].lods[lods[i]].error;
    }
    return total;
};

// Deterministic pseudo-random scene, shaped like a real capture: counts roughly halve per level,
// errors grow unevenly, coverage spans orders of magnitude.
const makeScene = (nodeCount, levels, seed = 1) => {
    let s = seed >>> 0;
    const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
    const nodes = [];
    const coverage = [];
    for (let n = 0; n < nodeCount; n++) {
        const lods = [];
        let count = 40 + Math.floor(rnd() * 200);
        let error = 0;
        lods.push({ count, error });
        for (let l = 1; l < levels; l++) {
            count = Math.max(1, Math.floor(count * (0.42 + rnd() * 0.12)));
            error += 0.3 + rnd() * 2.2;
            lods.push({ count, error });
        }
        nodes.push({ lods });
        const d = 2 + 5000 * Math.cbrt(rnd());
        const r = 3 + rnd() * 12;
        const pr = r / (r + d);
        coverage.push(pr * pr);
    }
    return { nodes, coverage };
};

describe('GSplatBudgetBalancer', function () {

    it('puts every node at its finest level when the whole scene fits', function () {
        const { inst, instances } = single([
            { lods: [{ count: 10, error: 0 }, { count: 5, error: 1 }] },
            { lods: [{ count: 10, error: 0 }, { count: 5, error: 1 }] }
        ]);

        new GSplatBudgetBalancer().balance(instances, 100);

        expect(lodsOf(inst)).to.deep.equal([0, 0]);
    });

    it('floors every node when even the cheapest scene is over budget', function () {
        const { inst, instances } = single([
            { lods: [{ count: 10, error: 0 }, { count: 5, error: 1 }] },
            { lods: [{ count: 10, error: 0 }, { count: 5, error: 1 }] }
        ]);

        new GSplatBudgetBalancer().balance(instances, 4);

        expect(lodsOf(inst)).to.deep.equal([1, 1]);
    });

    it('spends on the node whose error falls fastest per splat', function () {
        // identical costs, so the only difference is how much error each upgrade removes
        const { inst, instances } = single([
            { lods: [{ count: 10, error: 0 }, { count: 5, error: 100 }] },
            { lods: [{ count: 10, error: 0 }, { count: 5, error: 1 }] }
        ]);

        // floor is 5 + 5, and 15 affords exactly one cost-5 upgrade
        new GSplatBudgetBalancer().balance(instances, 15);

        expect(lodsOf(inst)).to.deep.equal([0, 1]);
    });

    it('weights that by how much screen the node covers', function () {
        // node 1 removes 10x the error, but node 0 covers 100x the screen
        const { inst, instances } = single([
            { lods: [{ count: 10, error: 0 }, { count: 5, error: 10 }] },
            { lods: [{ count: 10, error: 0 }, { count: 5, error: 100 }] }
        ], [1, 0.01]);

        new GSplatBudgetBalancer().balance(instances, 15);

        expect(lodsOf(inst)).to.deep.equal([0, 1]);
    });

    it('lets one node take several upgrades in a single pass', function () {
        const { inst, instances } = single([
            { lods: [{ count: 30, error: 0 }, { count: 20, error: 50 }, { count: 10, error: 100 }] },
            { lods: [{ count: 30, error: 0 }, { count: 20, error: 1 }, { count: 10, error: 2 }] }
        ]);

        // floor is 10 + 10; 40 affords node 0's two 10-splat upgrades and nothing else
        new GSplatBudgetBalancer().balance(instances, 40);

        expect(lodsOf(inst)).to.deep.equal([0, 2]);
    });

    it('stops at the first upgrade that does not fit', function () {
        // the best deal is node 0's, but it costs 40 and only 10 is spare. Node 1's cheap upgrade
        // would fit - stopping anyway is what keeps the result stable as the camera moves.
        const { inst, instances } = single([
            { lods: [{ count: 50, error: 0 }, { count: 10, error: 1000 }] },
            { lods: [{ count: 15, error: 0 }, { count: 10, error: 1 }] }
        ]);

        new GSplatBudgetBalancer().balance(instances, 30);

        expect(lodsOf(inst)).to.deep.equal([1, 1]);
    });

    it('pins the boundary behaviour when a ranked run only partly fits', function () {
        // Deliberate trade-off, not a target. Node 0's rank comes from the run to lod0 - 10 error
        // for 80 splats - but at this budget only its 70-splat first step fits, removing 2 error
        // where node 1's 40-splat step would have removed 4. An affordability-aware drain that
        // resolves this boundary (and the one below) optimally was built and measured: ~0.2%
        // better in aggregate across four captures, for a per-pop walk and a relaxed early exit -
        // traded away for a simpler drain and the hard early exit that keeps selection stable as
        // the camera moves.
        const { inst, instances } = single([
            { lods: [{ count: 100, error: 0 }, { count: 90, error: 8 }, { count: 20, error: 10 }] },
            { lods: [{ count: 60, error: 0 }, { count: 60, error: 0 }, { count: 20, error: 4 }] }
        ]);

        new GSplatBudgetBalancer().balance(instances, 110);

        expect(lodsOf(inst)).to.deep.equal([1, 2]);
        expect(splatsOf(inst)).to.equal(110);
    });

    it('pins the hard stop when the top-ranked step does not fit at all', function () {
        // Same nodes at budget 100: node 0 ranks first but its 70-splat first step exceeds the 60
        // spare, so the sweep stops - node 1's affordable step is deliberately left unbought rather
        // than letting cheaper upgrades reshuffle the outcome as the camera moves.
        const { inst, instances } = single([
            { lods: [{ count: 100, error: 0 }, { count: 90, error: 8 }, { count: 20, error: 10 }] },
            { lods: [{ count: 60, error: 0 }, { count: 60, error: 0 }, { count: 20, error: 4 }] }
        ]);

        new GSplatBudgetBalancer().balance(instances, 100);

        expect(lodsOf(inst)).to.deep.equal([2, 2]);
        expect(splatsOf(inst)).to.equal(40);
    });

    it('buys a compound upgrade that beats a cheaper rival outright', function () {
        // Node 0's middle level sits below the chord, so its levels pool into one 80-splat step
        // worth 10 error (0.125/splat). Node 1 offers 4 error for 40 splats (0.1/splat). Treating
        // node 0 as two steps would price both at 2/70, letting node 1 win and then leaving too
        // little budget for node 0's 70-splat first step - residual 10 instead of 4.
        const { inst, instances } = single([
            { lods: [{ count: 100, error: 0 }, { count: 90, error: 8 }, { count: 20, error: 10 }] },
            { lods: [{ count: 60, error: 0 }, { count: 60, error: 0 }, { count: 20, error: 4 }] }
        ]);

        // floors are 20 + 20, so 120 affords exactly node 0's compound step
        new GSplatBudgetBalancer().balance(instances, 120);

        expect(inst.nodeInfos[0].optimalLod).to.equal(0);
        expect(inst.nodeInfos[1].optimalLod).to.equal(2);
        expect(splatsOf(inst)).to.equal(120);
    });

    it('never exceeds the budget', function () {
        const { nodes, coverage } = makeScene(400, 5);
        const { inst, instances } = single(nodes, coverage);
        const balancer = new GSplatBudgetBalancer();

        for (const budget of [5000, 20000, 50000, 200000]) {
            balancer.balance(instances, budget);
            expect(splatsOf(inst)).to.be.at.most(budget);
        }
    });

    it('leaves a node with nothing renderable unassigned', function () {
        const { inst, instances } = single([
            { lods: [{ count: 0, error: 0 }, { count: 0, error: 0 }] },
            { lods: [{ count: 10, error: 0 }, { count: 5, error: 1 }] }
        ]);

        new GSplatBudgetBalancer().balance(instances, 12);

        expect(lodsOf(inst)).to.deep.equal([-1, 0]);
    });

    it('is deterministic across repeated runs', function () {
        const { nodes, coverage } = makeScene(300, 5, 7);
        const { inst, instances } = single(nodes, coverage);
        const balancer = new GSplatBudgetBalancer();

        balancer.balance(instances, 30000);
        const first = lodsOf(inst);
        balancer.balance(instances, 30000);
        expect(lodsOf(inst)).to.deep.equal(first);

        // and independent of the balancer instance, so scratch state cannot leak between runs
        const fresh = new GSplatBudgetBalancer();
        fresh.balance(instances, 30000);
        expect(lodsOf(inst)).to.deep.equal(first);
    });

    it('shares one budget across several instances', function () {
        const a = makeInstance([{ lods: [{ count: 10, error: 0 }, { count: 5, error: 100 }] }], [1]);
        const b = makeInstance([{ lods: [{ count: 10, error: 0 }, { count: 5, error: 1 }] }], [1]);
        const instances = new Map([[{}, a], [{}, b]]);

        // floor is 5 + 5, so 15 affords one upgrade and it should go to the instance that gains more
        new GSplatBudgetBalancer().balance(instances, 15);

        expect(lodsOf(a)).to.deep.equal([0]);
        expect(lodsOf(b)).to.deep.equal([1]);
    });

    it('honours each instance\'s own LOD range', function () {
        const a = makeInstance([{ lods: [{ count: 100, error: 0 }, { count: 50, error: 1 }, { count: 10, error: 4 }] }], [1], 0, 2);
        const b = makeInstance([{ lods: [{ count: 100, error: 0 }, { count: 50, error: 1 }, { count: 10, error: 4 }] }], [1], 2, 2);
        const instances = new Map([[{}, a], [{}, b]]);

        new GSplatBudgetBalancer().balance(instances, 1000);

        expect(lodsOf(a)).to.deep.equal([0]);
        expect(lodsOf(b)).to.deep.equal([2]);
    });

    it('lands within a few percent of an exact greedy allocation', function () {
        // Buckets resolve the greedy order approximately. This pins how much that costs, using an
        // exact max-heap over the same chains as the reference.
        //
        // Budgets are sampled part-way between the floored and the fully upgraded scene. Very high
        // fractions are deliberately not asserted on: almost everything gets bought, so the
        // residual error is near zero and the *ratio* against it turns noisy while the absolute
        // difference stays negligible.
        const { nodes, coverage } = makeScene(2000, 5, 11);
        const { inst, instances } = single(nodes, coverage);
        const table = inst.lodTable;
        const balancer = new GSplatBudgetBalancer();

        for (const fraction of [0.2, 0.5]) {
            const budget = Math.round(table.totalStartCount +
                (table.totalFinestCount - table.totalStartCount) * fraction);
            balancer.balance(instances, budget);
            const bucketed = residual(inst, lodsOf(inst));
            const exact = residual(inst, exactGreedy(inst, budget).lods);
            expect(bucketed).to.be.at.most(exact * 1.03);
        }
    });

    it('spends as much of the budget as an exact greedy allocation', function () {
        // The early exit means both stop at their first misfit. If bucketing shifted where that
        // lands, the two would diverge in how much they manage to spend.
        const { nodes, coverage } = makeScene(2000, 5, 29);
        const { inst, instances } = single(nodes, coverage);
        const table = inst.lodTable;
        const balancer = new GSplatBudgetBalancer();

        for (const fraction of [0.2, 0.5, 0.8]) {
            const budget = Math.round(table.totalStartCount +
                (table.totalFinestCount - table.totalStartCount) * fraction);
            balancer.balance(instances, budget);
            const exact = exactGreedy(inst, budget).spent;
            expect(splatsOf(inst)).to.be.at.least(exact * 0.99);
        }
    });

    it('tilts the budget towards the camera as lodFalloff rises', function () {
        // Two nodes compete for one 5-splat upgrade. The far node removes 16x the error, so at the
        // neutral falloff it wins despite its lower coverage; at falloff 2 the coverage difference
        // is amplified enough that the near node takes it. The pivot cancels in the comparison, so
        // the flip point is exact: falloff * log2(covNear/covFar) vs log2(ratioFar/ratioNear).
        const nodes = [
            { lods: [{ count: 10, error: 0 }, { count: 5, error: 1 }] },
            { lods: [{ count: 10, error: 0 }, { count: 5, error: 16 }] }
        ];

        const neutral = singleWithFalloff(nodes, [0.1, 0.01], 1);
        new GSplatBudgetBalancer().balance(neutral.instances, 15);
        expect(lodsOf(neutral.inst)).to.deep.equal([1, 0]);

        const steep = singleWithFalloff(nodes, [0.1, 0.01], 2);
        new GSplatBudgetBalancer().balance(steep.instances, 15);
        expect(lodsOf(steep.inst)).to.deep.equal([0, 1]);
    });

    it('ignores the view entirely at lodFalloff 0', function () {
        // With the exponent at 0 every node's coverage term is equal, so the far node's better
        // error-per-splat must win regardless of how much closer the other sits.
        const { inst, instances } = singleWithFalloff([
            { lods: [{ count: 10, error: 0 }, { count: 5, error: 1 }] },
            { lods: [{ count: 10, error: 0 }, { count: 5, error: 2 }] }
        ], [1, 1e-9], 0);

        new GSplatBudgetBalancer().balance(instances, 15);

        expect(lodsOf(inst)).to.deep.equal([1, 0]);
    });

    it('matches the exact path at the default falloff', function () {
        // falloff 1 must keep the exact value path, bit-identical to ranking without the feature
        const { nodes, coverage } = makeScene(300, 5, 21);
        const a = singleWithFalloff(nodes, coverage, 1);
        const b = single(nodes, coverage);

        const balancer = new GSplatBudgetBalancer();
        balancer.balance(a.instances, 20000);
        balancer.balance(b.instances, 20000);

        expect(lodsOf(a.inst)).to.deep.equal(lodsOf(b.inst));
    });

    it('moves few nodes when the camera moves slightly', function () {
        // Temporal stability is the point of the fixed bucket scale and the early exit, so a small
        // change in coverage must not reshuffle the scene.
        const { nodes, coverage } = makeScene(500, 5, 3);
        const { inst, instances } = single(nodes, coverage);
        const balancer = new GSplatBudgetBalancer();

        balancer.balance(instances, 40000);
        const before = lodsOf(inst);

        // 1% closer on every node, as a small forward step would give
        for (let i = 0; i < inst.nodeInfos.length; i++) {
            inst.nodeInfos[i].lodCoverage *= 1.01;
        }
        balancer.balance(instances, 40000);
        const after = lodsOf(inst);

        const changed = before.reduce((n, lod, i) => n + (lod === after[i] ? 0 : 1), 0);
        expect(changed).to.be.below(before.length * 0.1);
    });
});
