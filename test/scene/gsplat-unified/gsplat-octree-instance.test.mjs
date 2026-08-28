import { expect } from 'chai';

import { PROJECTION_ORTHOGRAPHIC, PROJECTION_PERSPECTIVE } from '../../../src/scene/constants.js';
import { GraphNode } from '../../../src/scene/graph-node.js';
import { GSplatOctreeInstance } from '../../../src/scene/gsplat-unified/gsplat-octree-instance.js';
import { GSplatOctree } from '../../../src/scene/gsplat-unified/gsplat-octree.js';

// An octree of unit leaves centred at the given positions, all the same size, so coverage
// differences can only come from the camera model.
const makeOctree = centers => new GSplatOctree('/scene/lod-meta.json', {
    lodLevels: 1,
    filenames: ['0/meta.json'],
    tree: {
        children: centers.map(([x, y, z]) => ({
            bound: { min: [x - 1, y - 1, z - 1], max: [x + 1, y + 1, z + 1] },
            lods: { 0: { file: 0, offset: 0, count: 10 } }
        }))
    }
});

// evaluateNodeCoverage reads only the octree, the placement's node transform and the nodeInfos
// array, so a focused test can supply exactly those rather than a fully constructed instance.
const makeInstance = (octree) => {
    const instance = Object.create(GSplatOctreeInstance.prototype);
    instance.octree = octree;
    instance.placement = { node: new GraphNode() };
    instance.nodeInfos = octree.nodes.map(() => ({ lodCoverage: 0, worldDistance: 0 }));
    return instance;
};

// A camera node at the origin looking down -z. Only the properties the coverage pass reads.
const makeCamera = (projection, orthoHeight = 5) => {
    const node = new GraphNode();
    node.camera = { projection, fov: 45, horizontalFov: false, aspectRatio: 1, orthoHeight };
    return node;
};

describe('GSplatOctreeInstance#evaluateNodeCoverage', function () {

    it('attenuates perspective coverage with distance', function () {
        const instance = makeInstance(makeOctree([[0, 0, -10], [0, 0, -1000]]));

        instance.evaluateNodeCoverage(makeCamera(PROJECTION_PERSPECTIVE), { lodBehindPenalty: 1 });

        const [near, far] = instance.nodeInfos;
        expect(near.lodCoverage).to.be.above(far.lodCoverage * 100);
    });

    it('gives equal-size nodes equal orthographic coverage regardless of depth', function () {
        // An orthographic footprint does not depend on depth - two equal nodes fill the same screen
        // area wherever they sit along the view axis, and must receive the same LOD budget.
        const instance = makeInstance(makeOctree([[0, 0, -10], [0, 0, -1000]]));

        instance.evaluateNodeCoverage(makeCamera(PROJECTION_ORTHOGRAPHIC), { lodBehindPenalty: 1 });

        const [near, far] = instance.nodeInfos;
        expect(near.lodCoverage).to.be.above(1e-12);
        expect(far.lodCoverage).to.be.closeTo(near.lodCoverage, near.lodCoverage * 1e-6);
    });

    it('keeps orthographic coverage constant as the camera moves along its view axis', function () {
        const octree = makeOctree([[0, 0, -100]]);
        const camera = makeCamera(PROJECTION_ORTHOGRAPHIC);

        const instance = makeInstance(octree);
        instance.evaluateNodeCoverage(camera, { lodBehindPenalty: 1 });
        const before = instance.nodeInfos[0].lodCoverage;

        camera.setPosition(0, 0, 50);
        instance.evaluateNodeCoverage(camera, { lodBehindPenalty: 1 });

        expect(instance.nodeInfos[0].lodCoverage).to.be.closeTo(before, before * 1e-6);
    });

    it('sizes orthographic coverage by the ortho window', function () {
        const octree = makeOctree([[0, 0, -100]]);
        const instance = makeInstance(octree);

        instance.evaluateNodeCoverage(makeCamera(PROJECTION_ORTHOGRAPHIC, 5), { lodBehindPenalty: 1 });
        const zoomedOut = instance.nodeInfos[0].lodCoverage;

        instance.evaluateNodeCoverage(makeCamera(PROJECTION_ORTHOGRAPHIC, 50), { lodBehindPenalty: 1 });
        const zoomedFurtherOut = instance.nodeInfos[0].lodCoverage;

        expect(zoomedOut).to.be.above(zoomedFurtherOut * 50);
    });

    it('still penalises nodes behind an orthographic camera', function () {
        // Behind-camera content is invisible under any projection, so it must not win budget just
        // because orthographic coverage carries no distance term.
        const instance = makeInstance(makeOctree([[0, 0, -10], [0, 0, 10]]));

        instance.evaluateNodeCoverage(makeCamera(PROJECTION_ORTHOGRAPHIC), { lodBehindPenalty: 3 });

        const [front, behind] = instance.nodeInfos;
        expect(behind.lodCoverage).to.be.below(front.lodCoverage);
    });
});
