import { expect } from 'chai';

import { Vec3 } from '../../../src/core/math/vec3.js';
import { PROJECTION_ORTHOGRAPHIC, PROJECTION_PERSPECTIVE } from '../../../src/scene/constants.js';
import { GraphNode } from '../../../src/scene/graph-node.js';
import { GSplatOctreeInstance } from '../../../src/scene/gsplat-unified/gsplat-octree-instance.js';
import { GSplatOctree } from '../../../src/scene/gsplat-unified/gsplat-octree.js';

// A tree of top level nodes centered at the given positions, unit half-extent unless a fourth
// component gives one, so distance differences can only come from the camera model and stated
// sizes. Node `i` is the node of position `i`.
const makeOctree = centers => new GSplatOctree('/scene/lod-meta.json', {
    lodLevels: 1,
    filenames: ['0/meta.json'],
    hierarchical: true,
    tree: {
        children: centers.map(([x, y, z, he = 1]) => ({
            bound: { min: [x - he, y - he, z - he], max: [x + he, y + he, z + he] },
            level: 0,
            lods: { 0: { file: 0, offset: 0, count: 10 } }
        }))
    }
});

// The distance passes read only the octree, the placement's node transform and the nodeInfos
// array, so a focused test can supply exactly those rather than a fully constructed instance.
const makeInstance = (octree) => {
    const instance = Object.create(GSplatOctreeInstance.prototype);
    instance.octree = octree;
    instance.placement = { node: new GraphNode() };
    instance.nodeInfos = octree.nodes.map(() => ({ worldDistanceSq: 0 }));
    instance._cameraPos = new Vec3();
    instance._cameraFwd = new Vec3();
    return instance;
};

// Measures every node, parents first, as the cut does for the nodes it reaches.
const measure = (instance, camera, params) => {
    instance.prepareDistances(camera, params);
    for (let n = 0; n < instance.octree.nodes.length; n++) {
        instance.measureTreeNode(n);
    }
};

// The distance a node info records, which it stores squared.
const distanceOf = info => Math.sqrt(info.worldDistanceSq);

// A camera node at the origin looking down -z. Only the properties the distance pass reads.
const makeCamera = (projection, fov = 45) => {
    const node = new GraphNode();
    node.camera = { projection, fov, horizontalFov: false, aspectRatio: 1, orthoHeight: 5 };
    return node;
};

describe('GSplatOctreeInstance#measureTreeNode', function () {

    it('measures the distance to the nearest point of each node', function () {
        const instance = makeInstance(makeOctree([[0, 0, -10], [0, 0, -1000], [0, 0, 0]]));

        measure(instance, makeCamera(PROJECTION_PERSPECTIVE), { lodBehindPenalty: 1 });

        const [near, far, inside] = instance.nodeInfos;
        expect(distanceOf(near)).to.be.closeTo(9, 1e-6);
        expect(distanceOf(far)).to.be.closeTo(999, 1e-4);
        expect(distanceOf(inside)).to.equal(0);
    });

    it('measures equal distances for nodes whose nearest faces are equally far, whatever their size', function () {
        // both leaves have their nearest face 9 units from the camera, but very different sizes -
        // size must not reorder them, so the bands stay concentric
        const instance = makeInstance(makeOctree([[0, 0, -10, 1], [0, 0, -14, 5]]));

        measure(instance, makeCamera(PROJECTION_PERSPECTIVE), { lodBehindPenalty: 1 });

        const [small, big] = instance.nodeInfos;
        expect(distanceOf(big)).to.be.closeTo(distanceOf(small), 1e-6);
    });

    it('measures orthographic distance the same way, so depth still orders nodes', function () {
        // an orthographic footprint carries no depth term, so distance is what lets LOD mean
        // anything under that projection
        const instance = makeInstance(makeOctree([[0, 0, -10], [0, 0, -1000]]));

        measure(instance, makeCamera(PROJECTION_ORTHOGRAPHIC), { lodBehindPenalty: 1 });

        const [near, far] = instance.nodeInfos;
        expect(distanceOf(near)).to.be.closeTo(9, 1e-6);
        expect(distanceOf(far)).to.be.closeTo(999, 1e-4);
    });

    it('measures distance in world units across placement scales', function () {
        // one leaf placed at the same world position and world size two ways: directly, and half
        // sized under a doubled placement transform. A local-space measure would rank the scaled
        // instance twice as close - it must not, the two share one world and one budget.
        const camera = makeCamera(PROJECTION_PERSPECTIVE);

        const direct = makeInstance(makeOctree([[0, 0, -100, 1]]));
        measure(direct, camera, { lodBehindPenalty: 1 });

        const scaled = makeInstance(makeOctree([[0, 0, -50, 0.5]]));
        scaled.placement.node.setLocalScale(2, 2, 2);
        measure(scaled, camera, { lodBehindPenalty: 1 });

        expect(distanceOf(scaled.nodeInfos[0])).to.be.closeTo(distanceOf(direct.nodeInfos[0]), 1e-4);
    });

    it('compensates for the field of view', function () {
        // a wider field of view shows a node smaller, so it must read as farther away
        const instance = makeInstance(makeOctree([[0, 0, -100]]));

        measure(instance, makeCamera(PROJECTION_PERSPECTIVE, 45), { lodBehindPenalty: 1 });
        const reference = distanceOf(instance.nodeInfos[0]);

        measure(instance, makeCamera(PROJECTION_PERSPECTIVE, 90), { lodBehindPenalty: 1 });
        expect(distanceOf(instance.nodeInfos[0])).to.be.above(reference * 2);
    });

    it('keeps distances finite while the backbuffer has no size', function () {
        // a canvas with no width or height reports a 0, 0/0 or x/0 aspect ratio, and a horizontal
        // FOV divides by it
        const instance = makeInstance(makeOctree([[0, 0, -10], [0, 0, -1000]]));
        for (const aspectRatio of [0, NaN, Infinity]) {
            for (const horizontalFov of [false, true]) {
                const camera = makeCamera(PROJECTION_PERSPECTIVE);
                camera.camera.aspectRatio = aspectRatio;
                camera.camera.horizontalFov = horizontalFov;

                measure(instance, camera, { lodBehindPenalty: 1.5 });

                const [near, far] = instance.nodeInfos;
                expect(Number.isFinite(distanceOf(near)), `aspect ${aspectRatio}, horizontalFov ${horizontalFov}`).to.equal(true);
                expect(distanceOf(near)).to.be.below(distanceOf(far));
            }
        }
    });

    it('penalizes nodes behind the camera under both projections', function () {
        for (const projection of [PROJECTION_PERSPECTIVE, PROJECTION_ORTHOGRAPHIC]) {
            const instance = makeInstance(makeOctree([[0, 0, -10], [0, 0, 10]]));

            measure(instance, makeCamera(projection), { lodBehindPenalty: 3 });

            const [front, behind] = instance.nodeInfos;
            expect(distanceOf(behind)).to.be.above(distanceOf(front) * 2);
        }
    });

    it('never measures a node nearer than its parent', function () {
        // the behind-camera penalty depends on direction, so it can make a parent farther than its
        // child - which would make the child ask for more detail than its parent
        const octree = new GSplatOctree('/scene/lod-meta.json', {
            lodLevels: 2,
            filenames: ['0.json', '1.json'],
            hierarchical: true,
            tree: {
                children: [{
                    bound: { min: [-1, -1, -12], max: [1, 1, -8] },
                    level: 1,
                    lods: { 1: { file: 0, offset: 0, count: 10 } },
                    children: [{ bound: { min: [-1, -1, -12], max: [1, 1, -8] }, level: 0, lods: { 0: { file: 1, offset: 0, count: 20 } } }]
                }]
            }
        });
        const instance = makeInstance(octree);
        instance.prepareDistances(makeCamera(PROJECTION_PERSPECTIVE), { lodBehindPenalty: 1 });
        instance.measureTreeNode(0);
        expect(instance.measureTreeNode(1)).to.be.closeTo(64, 1e-6);

        // whatever made the parent farther, the child is recorded no nearer
        instance.nodeInfos[0].worldDistanceSq = 1e6;
        expect(instance.measureTreeNode(1)).to.equal(1e6);
        expect(instance.nodeInfos[1].worldDistanceSq).to.equal(1e6);
    });
});
