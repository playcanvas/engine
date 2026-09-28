import { expect } from 'chai';

import { GSplatLodTable } from '../../../src/scene/gsplat-unified/gsplat-lod-table.js';
import { GSplatOctree } from '../../../src/scene/gsplat-unified/gsplat-octree.js';

// A single-leaf streamed SOG manifest with one LOD level per count, so a test only has to state
// the per-level counts. A count of 0 lists the level with no splats.
const makeOctree = counts => new GSplatOctree('/scene/lod-meta.json', {
    lodLevels: counts.length,
    filenames: counts.map((_, i) => `${i}/meta.json`),
    tree: {
        bound: { min: [0, 0, 0], max: [1, 1, 1] },
        lods: Object.fromEntries(counts.map((count, i) => [i, { file: i, offset: 0, count }]))
    }
});

// The level a node renders for each band of the table, finest band first.
const bandsOf = (table, node = 0) => Array.from(table.bandLod.subarray(node * table.span, (node + 1) * table.span));
const countsOf = (table, node = 0) => Array.from(table.bandCount.subarray(node * table.span, (node + 1) * table.span));

describe('GSplatOctree LOD tables', function () {

    it('keeps a table per live range so differing instances do not rebuild each other', function () {
        // lodRangeMin/Max are per placement, so two instances of one octree can differ. Holding
        // only the most recent range would make each request rebuild the other's table.
        const octree = makeOctree([10, 5, 2]);
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
        const octree = makeOctree([10, 5, 2]);
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

    it('keeps ranges distinct beyond any packing base', function () {
        // nothing bounds lodLevels or the configured range, and a packed numeric key would alias
        // pairs like [0, 300] and [1, 44] - handing an instance a table for the wrong range
        const octree = makeOctree(Array.from({ length: 301 }, (_, i) => 301 - i));
        const a = octree.acquireLodTable(0, 300);
        const b = octree.acquireLodTable(1, 44);

        expect(b).to.not.equal(a);
        expect(a.rangeMax).to.equal(300);
        expect(b.rangeMax).to.equal(44);

        // and releasing one leaves the other untouched
        octree.releaseLodTable(b);
        expect(octree.acquireLodTable(0, 300)).to.equal(a);
    });

    it('tolerates releasing null', function () {
        const octree = makeOctree([10, 5]);
        expect(() => octree.releaseLodTable(null)).to.not.throw();
    });
});

describe('GSplatLodTable', function () {

    it('renders each band at its own level', function () {
        const table = new GSplatLodTable(makeOctree([100, 50, 20]), 0, 2);
        expect(bandsOf(table)).to.deep.equal([0, 1, 2]);
        expect(countsOf(table)).to.deep.equal([100, 50, 20]);
        expect(table.totalFinestCount).to.equal(100);
        expect(table.totalCoarsestCount).to.equal(20);
    });

    it('keeps levels that barely differ, or grow, in splat count', function () {
        // a region the decimator left alone: every level stays, so the node follows its band and
        // shares files with its neighbors rather than being pinned to one level
        const table = new GSplatLodTable(makeOctree([930, 926, 926, 925, 926]), 0, 4);
        expect(bandsOf(table)).to.deep.equal([0, 1, 2, 3, 4]);
        expect(countsOf(table)).to.deep.equal([930, 926, 926, 925, 926]);
    });

    it('fills a gap with the next finer level holding data', function () {
        const table = new GSplatLodTable(makeOctree([100, 0, 20, 10]), 0, 3);
        expect(bandsOf(table)).to.deep.equal([0, 0, 2, 3]);
    });

    it('fills a gap at the finest end with the next coarser level holding data', function () {
        const table = new GSplatLodTable(makeOctree([0, 0, 20, 10]), 0, 3);
        expect(bandsOf(table)).to.deep.equal([2, 2, 2, 3]);
    });

    it('gives the bands past a node\'s coarsest data its empty level', function () {
        // data stops at level 1, so level 2 is the empty level: no splats and no file, and every
        // band from there on draws nothing rather than pinning the node to finer data
        const octree = makeOctree([100, 40, 0, 0]);
        const table = new GSplatLodTable(octree, 0, 3);
        expect(bandsOf(table)).to.deep.equal([0, 1, 2, 2]);
        expect(countsOf(table)).to.deep.equal([100, 40, 0, 0]);
        expect(octree.nodes[0].lods[2].fileIndex).to.equal(-1);
    });

    it('adds no empty level when the coarsest data already sits at rangeMax', function () {
        const table = new GSplatLodTable(makeOctree([100, 40, 0, 0]), 0, 1);
        expect(bandsOf(table)).to.deep.equal([0, 1]);
    });

    it('marks a node with nothing renderable in range', function () {
        const table = new GSplatLodTable(makeOctree([100, 0, 0]), 1, 2);
        expect(bandsOf(table)).to.deep.equal([-1, -1]);
        expect(table.totalFinestCount).to.equal(0);
    });

    it('honors the LOD range', function () {
        const table = new GSplatLodTable(makeOctree([100, 50, 20, 10]), 1, 2);
        expect(table.span).to.equal(2);
        expect(bandsOf(table)).to.deep.equal([1, 2]);
        expect(table.totalFinestCount).to.equal(50);
        expect(table.totalCoarsestCount).to.equal(20);
    });

    describe('chain navigation', function () {

        it('steps coarser and finer along the chain, skipping levels without data', function () {
            const table = new GSplatLodTable(makeOctree([100, 0, 20]), 0, 2);

            expect(table.coarserOnChain(0, 0)).to.equal(2);
            expect(table.coarserOnChain(0, 2)).to.equal(-1);
            expect(table.finerOnChain(0, 2)).to.equal(0);
            expect(table.finerOnChain(0, 0)).to.equal(-1);
        });

        it('steps onto and off the empty level', function () {
            const table = new GSplatLodTable(makeOctree([100, 40, 0]), 0, 2);

            expect(table.coarserOnChain(0, 1)).to.equal(2);
            expect(table.finerOnChain(0, 2)).to.equal(1);
        });

        it('finds the finest accepted level within a window of coarser chain steps', function () {
            const table = new GSplatLodTable(makeOctree([100, 50, 20]), 0, 2);

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

        it('counts window steps over distinct chain entries, not bands', function () {
            // bands 0 and 1 both render level 0, so one step coarser from 0 is level 2
            const table = new GSplatLodTable(makeOctree([100, 0, 20, 10]), 0, 3);
            expect(table.findCoarserAccepted(0, 0, 1, lod => lod === 2)).to.equal(2);
            expect(table.findCoarserAccepted(0, 0, 1, lod => lod === 3)).to.equal(-1);
        });
    });
});
