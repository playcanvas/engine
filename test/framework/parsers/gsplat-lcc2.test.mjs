import { expect } from 'chai';

import { GSplatLcc2Parser } from '../../../src/framework/parsers/gsplat-lcc2.js';
import { GSplatOctree } from '../../../src/scene/gsplat-unified/gsplat-octree.js';

// A two-level scene: a coarse node over two leaves, the coarse level in one file, both leaves
// in ranges of another, and an environment file.
const makeLcc = (withEnvironment = true) => ({
    version: '0.0.3',
    totalLevels: 2,
    offset: [0, 0, 0],
    shift: [0, 0, 0],
    scale: [1, 1, 1],
    root: {
        id: '0',
        boundingBox: { min: [0, 0, 0], max: [2, 1, 1] },
        splatFiles: ['data/3dgs/0_0.sog', 'data/3dgs/0_1_0.sog', 'data/3dgs/env.sog'],
        data: withEnvironment ? { env: { name: 2 } } : {},
        child: {
            0: {
                id: '0_0',
                boundingBox: { min: [0, 0, 0], max: [2, 1, 1] },
                data: { '3dgs': { name: 0, start: 0, count: 50 }, mesh: { name: 0 }, bvh: { name: 0 } },
                child: {
                    0: { id: '0_0_0', boundingBox: { min: [0, 0, 0], max: [1, 1, 1] }, data: { '3dgs': { name: 1, start: 0, count: 60 } }, child: null },
                    1: { id: '0_0_1', boundingBox: { min: [1, 0, 0], max: [2, 1, 1] }, data: { '3dgs': { name: 1, start: 60, count: 40 } }, child: null }
                }
            }
        }
    }
});

describe('GSplatLcc2Parser', function () {

    it('parses .lcc2 files only', function () {
        const parser = new GSplatLcc2Parser({});
        expect(parser.canParse({ ext: 'lcc2' })).to.be.true;
        expect(parser.canParse({ ext: 'json', basename: 'lod-meta.json' })).to.be.false;
    });

    it('loads the tree as a hierarchical octree, each node one level finer than its parent', function () {
        const octree = new GSplatOctree('/scene/office.lcc2', GSplatLcc2Parser.convert(makeLcc()));

        expect(octree.lodLevels).to.equal(2);
        expect(Array.from(octree.parentIndex)).to.deep.equal([-1, 0, 0]);
        expect(Array.from(octree.nodeLevel)).to.deep.equal([1, 0, 0]);

        // each node references its range of a file, as the LCC2 node does
        const ranges = octree.nodes.map((node, n) => {
            const lod = node.lods[octree.nodeLevel[n]];
            return [lod.fileIndex, lod.offset, lod.count];
        });
        expect(ranges).to.deep.equal([[0, 0, 50], [1, 0, 60], [1, 60, 40]]);
        expect(octree.files[1].url).to.equal('/scene/data/3dgs/0_1_0.sog');
        expect(octree.files.map(f => f.lodLevel)).to.deep.equal([1, 0, -1]);

        expect(octree.nodes[2].bounds.getMin().toString()).to.equal('[1, 0, 0]');
    });

    it('streams the environment from the file the root names, if any', function () {
        expect(new GSplatOctree('/scene/office.lcc2', GSplatLcc2Parser.convert(makeLcc())).environmentUrl).to.equal('/scene/data/3dgs/env.sog');
        expect(new GSplatOctree('/scene/office.lcc2', GSplatLcc2Parser.convert(makeLcc(false))).environmentUrl).to.equal(null);
    });
});
