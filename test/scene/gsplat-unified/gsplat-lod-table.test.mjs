import { expect } from 'chai';

import { GSplatLodTable } from '../../../src/scene/gsplat-unified/gsplat-lod-table.js';
import { GSplatOctree } from '../../../src/scene/gsplat-unified/gsplat-octree.js';

// A single-leaf streamed SOG manifest with `levels` LOD levels, so a test only has to state the
// per-level counts and, optionally, the error table and its header flag.
const makeOctree = (counts, errors, lodErrors) => new GSplatOctree('/scene/lod-meta.json', {
    lodLevels: counts.length,
    lodErrors,
    filenames: counts.map((_, i) => `${i}/meta.json`),
    tree: {
        bound: { min: [0, 0, 0], max: [1, 1, 1] },
        errors,
        lods: Object.fromEntries(counts.map((count, i) => [i, { file: i, offset: 0, count }]))
    }
});

// The chain a node offers, coarsest first: [startLod, ...upgradeToLod].
const chainOf = (table, node = 0) => {
    const chain = [table.startLod[node]];
    for (let k = table.firstUpgrade[node]; k < table.firstUpgrade[node + 1]; k++) {
        chain.push(table.upgradeToLod[k]);
    }
    return chain;
};

const upgradesOf = (table, node = 0) => {
    const out = [];
    for (let k = table.firstUpgrade[node]; k < table.firstUpgrade[node + 1]; k++) {
        out.push({ toLod: table.upgradeToLod[k], cost: table.upgradeCost[k], ratio: table.upgradeRatio[k] });
    }
    return out;
};

describe('GSplatOctree LOD errors', function () {

    it('reads per-level errors from the manifest when it declares them', function () {
        const octree = makeOctree([10, 5], [0, 12.5], true);
        expect(octree.lodErrorSource).to.equal('file');
        expect(octree.nodes[0].lods.map(lod => lod.error)).to.deep.equal([0, 12.5]);
    });

    it('derives errors when the manifest does not declare them', function () {
        // pre-3.3 manifests carry no lodErrors header, so any values present are not trusted
        const octree = makeOctree([8, 1], [0, 12.5], undefined);
        expect(octree.lodErrorSource).to.equal('derived');
        // the derived measure is the log of the decimation factor, so 8 splats down to 1 is ln(8)
        expect(octree.nodes[0].lods[0].error).to.equal(0);
        expect(octree.nodes[0].lods[1].error).to.be.closeTo(Math.log(8), 1e-6);
    });

    it('derives equal error steps for equal decimation ratios', function () {
        // each level halves, so a log measure gives a constant step per level - which is what makes
        // it track how the levels were actually produced
        const octree = makeOctree([80, 40, 20, 10], undefined, undefined);
        const errors = octree.nodes[0].lods.map(lod => lod.error);
        for (let i = 1; i < errors.length; i++) {
            expect(errors[i] - errors[i - 1]).to.be.closeTo(Math.log(2), 1e-6);
        }
    });

    it('derives errors when a declared error is not finite', function () {
        expect(makeOctree([10, 5], [0, null], true).lodErrorSource).to.equal('derived');
        expect(makeOctree([10, 5], [0], true).lodErrorSource).to.equal('derived');
    });

    it('derives errors when a declared error is negative', function () {
        // errors are magnitudes relative to the finest level; a negative one would let a coarse
        // level dominate every finer level on the frontier and pin the node there at any budget
        expect(makeOctree([10, 5], [0, -3], true).lodErrorSource).to.equal('derived');
    });

    it('ignores declared errors on levels that hold no splats', function () {
        expect(makeOctree([10, 0], [0, null], true).lodErrorSource).to.equal('file');
    });

    it('clamps derived errors monotone across levels', function () {
        // level 3 holds fewer splats than level 4, so the raw ratio would rank the coarser level
        // as the better one
        const octree = makeOctree([78, 38, 19, 6, 7], undefined, undefined);
        const errors = octree.nodes[0].lods.map(lod => lod.error);
        for (let i = 1; i < errors.length; i++) {
            expect(errors[i]).to.be.at.least(errors[i - 1]);
        }
    });

    it('keeps a table per live range so differing instances do not rebuild each other', function () {
        // lodRangeMin/Max are per placement, so two instances of one octree can differ. Holding
        // only the most recent range would make each request rebuild the other's table.
        const octree = makeOctree([10, 5, 2], [0, 1, 2], true);
        const a = octree.acquireLodTable(0, 2);
        const b = octree.acquireLodTable(1, 2);

        expect(b).to.not.equal(a);
        expect(a.rangeMin).to.equal(0);
        expect(b.rangeMin).to.equal(1);

        // alternating between them returns the same objects, no rebuild, however many are live
        expect(octree.acquireLodTable(0, 2)).to.equal(a);
        expect(octree.acquireLodTable(1, 2)).to.equal(b);
        expect(a.refCount).to.equal(2);
    });

    it('keeps a table alive while any reference is held, then drops it', function () {
        const octree = makeOctree([10, 5, 2], [0, 1, 2], true);
        const a = octree.acquireLodTable(0, 2);
        const alsoA = octree.acquireLodTable(0, 2);
        expect(alsoA).to.equal(a);
        expect(a.refCount).to.equal(2);

        // one holder leaving must not drop a table the other is still using
        octree.releaseLodTable(a);
        expect(a.refCount).to.equal(1);
        expect(octree.acquireLodTable(0, 2)).to.equal(a);

        octree.releaseLodTable(a);
        octree.releaseLodTable(a);
        expect(a.refCount).to.equal(0);

        // with no holders left the next request rebuilds rather than returning the dropped table
        expect(octree.acquireLodTable(0, 2)).to.not.equal(a);
    });

    it('retains every live range however many there are', function () {
        // a fixed cap would evict a range still in use here, rebuilding all of them every pass
        const octree = makeOctree([100, 50, 20, 10, 5], [0, 1, 2, 3, 4], true);
        const ranges = [[0, 4], [1, 4], [2, 4], [3, 4], [0, 3], [1, 3]];
        const held = ranges.map(([lo, hi]) => octree.acquireLodTable(lo, hi));

        ranges.forEach(([lo, hi], i) => {
            expect(octree.acquireLodTable(lo, hi)).to.equal(held[i]);
        });
    });

    it('keeps ranges distinct beyond any packing base', function () {
        // nothing bounds lodLevels or the configured range, and a packed numeric key would alias
        // pairs like [0, 300] and [1, 44] - handing an instance a table for the wrong range
        const octree = makeOctree(Array.from({ length: 301 }, (_, i) => 301 - i), undefined, undefined);
        const a = octree.acquireLodTable(0, 300);
        const b = octree.acquireLodTable(1, 44);

        expect(b).to.not.equal(a);
        expect(a.rangeMin).to.equal(0);
        expect(a.rangeMax).to.equal(300);
        expect(b.rangeMin).to.equal(1);
        expect(b.rangeMax).to.equal(44);

        // and releasing one leaves the other untouched
        octree.releaseLodTable(b);
        expect(octree.acquireLodTable(0, 300)).to.equal(a);
    });

    it('tolerates releasing null', function () {
        const octree = makeOctree([10, 5], [0, 1], true);
        expect(() => octree.releaseLodTable(null)).to.not.throw();
    });
});

describe('GSplatLodTable', function () {

    it('orders a node chain cheapest level first', function () {
        const octree = makeOctree([100, 50, 20], [0, 1, 3], true);
        const table = new GSplatLodTable(octree, 0, 2);

        expect(chainOf(table)).to.deep.equal([2, 1, 0]);
        expect(table.startCount[0]).to.equal(20);
        expect(table.totalStartCount).to.equal(20);
        expect(table.totalFinestCount).to.equal(100);
        expect(upgradesOf(table).map(u => u.cost)).to.deep.equal([30, 50]);
    });

    it('drops levels dominated in both count and error', function () {
        // level 1 costs more than level 2 and looks worse - nothing would ever pick it
        const octree = makeOctree([100, 50, 20], [0, 4, 3], true);
        const table = new GSplatLodTable(octree, 0, 2);

        expect(chainOf(table)).to.deep.equal([2, 0]);
    });

    it('drops a level duplicated in both count and error, so no upgrade is free', function () {
        // a zero-cost upgrade would carry a 0/0 ratio, and because ratios accumulate through
        // Math.min that NaN would demote every later upgrade on the node
        const octree = makeOctree([100, 50, 50], [0, 5, 5], true);
        const table = new GSplatLodTable(octree, 0, 2);

        expect(chainOf(table)).to.deep.equal([2, 0]);
        for (const upgrade of upgradesOf(table)) {
            expect(upgrade.cost).to.be.above(0);
            expect(Number.isFinite(upgrade.ratio)).to.equal(true);
        }
    });

    it('prices a step by the best run it opens, keeping every level', function () {
        // 20 -> 90 is a poor step on its own - 2 error for 70 splats - but it opens the way to 100,
        // which removes 10 for 80 (0.125). Pricing it locally would make the node look worthless.
        // The middle level still has to survive: it is a real improvement, and both streaming and
        // underfill step through it.
        const octree = makeOctree([100, 90, 20], [0, 8, 10], true);
        const table = new GSplatLodTable(octree, 0, 2);

        expect(chainOf(table)).to.deep.equal([2, 1, 0]);
        const upgrades = upgradesOf(table);
        expect(upgrades.length).to.equal(2);

        expect(upgrades[0].cost).to.equal(70);
        expect(upgrades[0].ratio).to.be.closeTo(0.125, 1e-6);

        expect(upgrades[1].cost).to.equal(10);
        expect(upgrades[1].ratio).to.be.closeTo(0.8, 1e-6);
    });

    it('prices a step by its own slope when nothing further beats it', function () {
        // returns already fall towards the finest here, so each step is its own best deal
        const octree = makeOctree([100, 50, 20], [0, 1, 5], true);
        const table = new GSplatLodTable(octree, 0, 2);

        expect(chainOf(table)).to.deep.equal([2, 1, 0]);
        const ratios = upgradesOf(table).map(u => u.ratio);
        expect(ratios.length).to.equal(2);
        expect(ratios[0]).to.be.closeTo(4 / 30, 1e-6);
        expect(ratios[1]).to.be.closeTo(1 / 50, 1e-6);
    });

    it('skips levels with no splats', function () {
        const octree = makeOctree([100, 0, 20], [0, 0, 3], true);
        const table = new GSplatLodTable(octree, 0, 2);

        expect(chainOf(table)).to.deep.equal([2, 0]);
    });

    it('marks a node with nothing renderable as having no start level', function () {
        const octree = makeOctree([0, 0], [0, 0], true);
        const table = new GSplatLodTable(octree, 0, 1);

        expect(table.startLod[0]).to.equal(-1);
        expect(table.firstUpgrade[1]).to.equal(table.firstUpgrade[0]);
        expect(table.totalStartCount).to.equal(0);
    });

    it('honours the LOD range', function () {
        const octree = makeOctree([100, 50, 20, 8], [0, 1, 2, 3], true);
        const table = new GSplatLodTable(octree, 1, 2);

        expect(chainOf(table)).to.deep.equal([2, 1]);
        expect(table.totalStartCount).to.equal(20);
        expect(table.totalFinestCount).to.equal(50);
    });

    it('builds a sub-range frontier from that range alone, not the full one', function () {
        // Level 2 is dominated across the full range (level 3 is cheaper at equal error), but with
        // rangeMax 2 it is the cheapest level the node has - so filtering the full frontier down to
        // the sub-range would leave this node with nothing to start from.
        const octree = makeOctree([100, 50, 20, 20], [0, 1, 5, 5], true);

        expect(chainOf(new GSplatLodTable(octree, 0, 3))).to.deep.equal([3, 1, 0]);
        expect(chainOf(new GSplatLodTable(octree, 0, 2))).to.deep.equal([2, 1, 0]);
    });

    describe('chain navigation', function () {

        it('steps coarser and finer along the chain, not over raw LOD indices', function () {
            // level 1 is dominated, so the chain is 2 -> 0 and stepping must skip level 1
            const octree = makeOctree([100, 50, 20], [0, 4, 3], true);
            const table = new GSplatLodTable(octree, 0, 2);

            expect(table.coarserOnChain(0, 0)).to.equal(2);
            expect(table.coarserOnChain(0, 2)).to.equal(-1);
            expect(table.finerOnChain(0, 2)).to.equal(0);
            expect(table.finerOnChain(0, 0)).to.equal(-1);
        });

        it('finds the finest accepted level within a window of coarser chain steps', function () {
            const octree = makeOctree([100, 50, 20], [0, 1, 3], true);
            const table = new GSplatLodTable(octree, 0, 2);

            // nothing accepted
            expect(table.findCoarserAccepted(0, 0, 2, () => false)).to.equal(-1);
            // the target itself wins when it qualifies
            expect(table.findCoarserAccepted(0, 0, 2, () => true)).to.equal(0);
            // otherwise the finest qualifying level within the window
            expect(table.findCoarserAccepted(0, 0, 2, lod => lod >= 1)).to.equal(1);
            // and the window bounds how far coarser it may look
            expect(table.findCoarserAccepted(0, 0, 1, lod => lod === 2)).to.equal(-1);
            expect(table.findCoarserAccepted(0, 0, 2, lod => lod === 2)).to.equal(2);
        });

        it('never steps coarser to a level holding more splats', function () {
            // level 3 holds fewer splats than level 4, an inversion real captures do contain
            const octree = makeOctree([78, 38, 19, 6, 7], undefined, undefined);
            const table = new GSplatLodTable(octree, 0, 4);
            const lods = octree.nodes[0].lods;

            let lod = table.startLod[0];
            let previous = 0;
            while (lod >= 0) {
                expect(lods[lod].count).to.be.above(previous);
                previous = lods[lod].count;
                lod = table.finerOnChain(0, lod);
            }
        });
    });
});
