import { expect } from 'chai';

import {
    GSPLAT_LODMODE_DISTANCE,
    GSPLAT_LODMODE_ERROR,
    PROJECTION_ORTHOGRAPHIC,
    PROJECTION_PERSPECTIVE
} from '../../../src/scene/constants.js';
import { GraphNode } from '../../../src/scene/graph-node.js';
import { GSplatOctreeInstance } from '../../../src/scene/gsplat-unified/gsplat-octree-instance.js';
import { GSplatOctree } from '../../../src/scene/gsplat-unified/gsplat-octree.js';

// An octree of leaves centred at the given positions, unit half-extent unless a fourth component
// gives one, so coverage differences can only come from the camera model and stated sizes.
const makeOctree = centers => new GSplatOctree('/scene/lod-meta.json', {
    lodLevels: 1,
    filenames: ['0/meta.json'],
    tree: {
        children: centers.map(([x, y, z, he = 1]) => ({
            bound: { min: [x - he, y - he, z - he], max: [x + he, y + he, z + he] },
            lods: { 0: { file: 0, offset: 0, count: 10 } }
        }))
    }
});

// evaluateNodeCoverage reads only the octree, the placement's node transform, the nodeInfos
// array and the resolved table's mode, so a focused test can supply exactly those rather than a
// fully constructed instance.
const makeInstance = (octree, lodMode = GSPLAT_LODMODE_ERROR) => {
    const instance = Object.create(GSplatOctreeInstance.prototype);
    instance.octree = octree;
    instance.placement = { node: new GraphNode() };
    instance.nodeInfos = octree.nodes.map(() => ({ lodCoverage: 0, worldDistance: 0 }));
    instance.lodTable = { lodMode };
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

    it('scales orthographic coverage with the placement transform', function () {
        // Node radii are octree-local, orthoHeight is world-space: a scaled placement doubles the
        // projected radius, so coverage must quadruple - the same octree at different scales must
        // not rank identically under the shared budget.
        const octree = makeOctree([[0, 0, -100]]);
        const camera = makeCamera(PROJECTION_ORTHOGRAPHIC, 1000);

        const instance = makeInstance(octree);
        instance.evaluateNodeCoverage(camera, { lodBehindPenalty: 1 });
        const atUnitScale = instance.nodeInfos[0].lodCoverage;

        instance.placement.node.setLocalScale(2, 2, 2);
        instance.evaluateNodeCoverage(camera, { lodBehindPenalty: 1 });

        expect(instance.nodeInfos[0].lodCoverage).to.be.closeTo(atUnitScale * 4, atUnitScale * 1e-5);
    });

    it('ranks equal-distance nodes equally in distance mode, whatever their size', function () {
        // both leaves have their nearest face 9 units from the camera, but very different sizes -
        // distance mode exists to give clean concentric bands, so size must not reorder them the
        // way it deliberately does in error mode
        const octree = makeOctree([[0, 0, -10, 1], [0, 0, -14, 5]]);
        const camera = makeCamera(PROJECTION_PERSPECTIVE);

        const errorInstance = makeInstance(octree, GSPLAT_LODMODE_ERROR);
        errorInstance.evaluateNodeCoverage(camera, { lodBehindPenalty: 1 });
        const [errSmall, errBig] = errorInstance.nodeInfos;
        expect(errBig.lodCoverage).to.be.above(errSmall.lodCoverage * 1.5);

        const instance = makeInstance(octree, GSPLAT_LODMODE_DISTANCE);
        instance.evaluateNodeCoverage(camera, { lodBehindPenalty: 1 });
        const [small, big] = instance.nodeInfos;
        expect(small.lodCoverage).to.be.above(1e-12);
        expect(big.lodCoverage).to.be.closeTo(small.lodCoverage, small.lodCoverage * 1e-6);
    });

    it('attenuates orthographic coverage with distance in distance mode', function () {
        // an orthographic footprint carries no depth term, so this ranking is what lets distance
        // mode mean anything under that projection
        const instance = makeInstance(makeOctree([[0, 0, -10], [0, 0, -1000]]), GSPLAT_LODMODE_DISTANCE);

        instance.evaluateNodeCoverage(makeCamera(PROJECTION_ORTHOGRAPHIC), { lodBehindPenalty: 1 });

        const [near, far] = instance.nodeInfos;
        expect(near.lodCoverage).to.be.above(far.lodCoverage * 100);
    });

    it('measures distance-mode coverage in world units across placement scales', function () {
        // one leaf placed at the same world position and world size two ways: directly, and half
        // sized under a doubled placement transform. A local-space measure would rank the scaled
        // instance twice as close - it must not, the two share one world and one budget.
        const camera = makeCamera(PROJECTION_PERSPECTIVE);

        const direct = makeInstance(makeOctree([[0, 0, -100, 1]]), GSPLAT_LODMODE_DISTANCE);
        direct.evaluateNodeCoverage(camera, { lodBehindPenalty: 1 });

        const scaled = makeInstance(makeOctree([[0, 0, -50, 0.5]]), GSPLAT_LODMODE_DISTANCE);
        scaled.placement.node.setLocalScale(2, 2, 2);
        scaled.evaluateNodeCoverage(camera, { lodBehindPenalty: 1 });

        const reference = direct.nodeInfos[0].lodCoverage;
        expect(scaled.nodeInfos[0].lodCoverage).to.be.closeTo(reference, reference * 1e-6);
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
