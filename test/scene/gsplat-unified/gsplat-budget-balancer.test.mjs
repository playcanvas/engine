import { expect } from 'chai';

import { GSplatBudgetBalancer } from '../../../src/scene/gsplat-unified/gsplat-budget-balancer.js';
import { GSplatOctree } from '../../../src/scene/gsplat-unified/gsplat-octree.js';

const makeInstances = (nodes, rangeMin = 0, rangeMax = nodes[0].lods.length - 1) => {
    const inst = {
        octree: { nodes },
        nodeInfos: nodes.map(() => ({
            optimalLod: 0,
            budgetBucket: 0,
            lodCoverage: 1,
            inst: null,
            lods: null
        })),
        rangeMin,
        rangeMax
    };
    for (const nodeInfo of inst.nodeInfos) nodeInfo.inst = inst;
    return { inst, instances: new Map([[{}, inst]]) };
};

describe('GSplatBudgetBalancer', function () {
    it('preserves distance-bucket allocation when error metadata is absent', function () {
        const { inst, instances } = makeInstances([
            { lods: [{ count: 10 }, { count: 5 }] },
            { lods: [{ count: 10 }, { count: 5 }] }
        ]);
        inst.nodeInfos[0].budgetBucket = 0;
        inst.nodeInfos[1].budgetBucket = 63;

        new GSplatBudgetBalancer().balance(instances, 15);

        expect(inst.nodeInfos.map(info => info.optimalLod)).to.deep.equal([0, 1]);
    });

    it('prioritizes projected error reduction per additional splat', function () {
        const { inst, instances } = makeInstances([
            { lods: [{ count: 10, error: 0 }, { count: 5, error: 10 }] },
            { lods: [{ count: 10, error: 0 }, { count: 5, error: 1000 }] }
        ]);
        inst.nodeInfos[0].lodCoverage = 1;
        inst.nodeInfos[1].lodCoverage = 0.1;

        new GSplatBudgetBalancer().balance(instances, 15);

        expect(inst.nodeInfos.map(info => info.optimalLod)).to.deep.equal([1, 0]);
    });

    it('skips trained LODs dominated in both count and error', function () {
        const { inst, instances } = makeInstances([{
            lods: [
                { count: 10, error: 0 },
                { count: 8, error: 5 },
                { count: 5, error: 4 }
            ]
        }]);

        new GSplatBudgetBalancer().balance(instances, 15);

        expect(inst.nodeInfos[0].optimalLod).to.equal(0);
    });

    it('loads per-LOD errors from streamed SOG metadata', function () {
        const octree = new GSplatOctree('/scene/lod-meta.json', {
            lodLevels: 2,
            filenames: ['0/meta.json', '1/meta.json'],
            tree: {
                bound: { min: [0, 0, 0], max: [1, 1, 1] },
                errors: [0, 12.5],
                lods: {
                    0: { file: 0, offset: 0, count: 10 },
                    1: { file: 1, offset: 0, count: 5 }
                }
            }
        });

        expect(octree.nodes[0].lods.map(lod => lod.error)).to.deep.equal([0, 12.5]);
    });
});
