import { expect } from 'chai';

import { PROJECTION_ORTHOGRAPHIC, PROJECTION_PERSPECTIVE } from '../../../src/scene/constants.js';
import { GraphNode } from '../../../src/scene/graph-node.js';
import { GSplatOctreeInstance } from '../../../src/scene/gsplat-unified/gsplat-octree-instance.js';
import { GSplatOctree } from '../../../src/scene/gsplat-unified/gsplat-octree.js';

// An octree of leaves centered at the given positions, unit half-extent unless a fourth component
// gives one, so distance differences can only come from the camera model and stated sizes.
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

// evaluateNodeDistances reads only the octree, the placement's node transform and the nodeInfos
// array, so a focused test can supply exactly those rather than a fully constructed instance.
const makeInstance = (octree) => {
    const instance = Object.create(GSplatOctreeInstance.prototype);
    instance.octree = octree;
    instance.placement = { node: new GraphNode() };
    instance.nodeInfos = octree.nodes.map(() => ({ worldDistanceSq: 0 }));
    return instance;
};

// The distance a node info records, which it stores squared.
const distanceOf = info => Math.sqrt(info.worldDistanceSq);

// A camera node at the origin looking down -z. Only the properties the distance pass reads.
const makeCamera = (projection, fov = 45) => {
    const node = new GraphNode();
    node.camera = { projection, fov, horizontalFov: false, aspectRatio: 1, orthoHeight: 5 };
    return node;
};

describe('GSplatOctreeInstance#evaluateNodeDistances', function () {

    it('measures the distance to the nearest point of each node', function () {
        const instance = makeInstance(makeOctree([[0, 0, -10], [0, 0, -1000], [0, 0, 0]]));

        instance.evaluateNodeDistances(makeCamera(PROJECTION_PERSPECTIVE), { lodBehindPenalty: 1 });

        const [near, far, inside] = instance.nodeInfos;
        expect(distanceOf(near)).to.be.closeTo(9, 1e-6);
        expect(distanceOf(far)).to.be.closeTo(999, 1e-4);
        expect(distanceOf(inside)).to.equal(0);
    });

    it('measures equal distances for nodes whose nearest faces are equally far, whatever their size', function () {
        // both leaves have their nearest face 9 units from the camera, but very different sizes -
        // size must not reorder them, so the bands stay concentric
        const instance = makeInstance(makeOctree([[0, 0, -10, 1], [0, 0, -14, 5]]));

        instance.evaluateNodeDistances(makeCamera(PROJECTION_PERSPECTIVE), { lodBehindPenalty: 1 });

        const [small, big] = instance.nodeInfos;
        expect(distanceOf(big)).to.be.closeTo(distanceOf(small), 1e-6);
    });

    it('measures orthographic distance the same way, so depth still orders nodes', function () {
        // an orthographic footprint carries no depth term, so distance is what lets LOD mean
        // anything under that projection
        const instance = makeInstance(makeOctree([[0, 0, -10], [0, 0, -1000]]));

        instance.evaluateNodeDistances(makeCamera(PROJECTION_ORTHOGRAPHIC), { lodBehindPenalty: 1 });

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
        direct.evaluateNodeDistances(camera, { lodBehindPenalty: 1 });

        const scaled = makeInstance(makeOctree([[0, 0, -50, 0.5]]));
        scaled.placement.node.setLocalScale(2, 2, 2);
        scaled.evaluateNodeDistances(camera, { lodBehindPenalty: 1 });

        expect(distanceOf(scaled.nodeInfos[0])).to.be.closeTo(distanceOf(direct.nodeInfos[0]), 1e-4);
    });

    it('compensates for the field of view', function () {
        // a wider field of view shows a node smaller, so it must read as farther away
        const instance = makeInstance(makeOctree([[0, 0, -100]]));

        instance.evaluateNodeDistances(makeCamera(PROJECTION_PERSPECTIVE, 45), { lodBehindPenalty: 1 });
        const reference = distanceOf(instance.nodeInfos[0]);

        instance.evaluateNodeDistances(makeCamera(PROJECTION_PERSPECTIVE, 90), { lodBehindPenalty: 1 });
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

                instance.evaluateNodeDistances(camera, { lodBehindPenalty: 1.5 });

                const [near, far] = instance.nodeInfos;
                expect(Number.isFinite(distanceOf(near)), `aspect ${aspectRatio}, horizontalFov ${horizontalFov}`).to.equal(true);
                expect(distanceOf(near)).to.be.below(distanceOf(far));
            }
        }
    });

    it('measures to bounds shrunk towards their center by lodDistanceShrink', function () {
        // a long node reaching towards the camera: its nearest face is 1 unit away, its center 50
        const instance = makeInstance(makeOctree([[0, 0, -50, 49]]));
        const camera = makeCamera(PROJECTION_PERSPECTIVE);

        instance.evaluateNodeDistances(camera, { lodBehindPenalty: 1, lodDistanceShrink: 0 });
        expect(distanceOf(instance.nodeInfos[0])).to.be.closeTo(1, 1e-4);

        instance.evaluateNodeDistances(camera, { lodBehindPenalty: 1, lodDistanceShrink: 0.5 });
        expect(distanceOf(instance.nodeInfos[0])).to.be.closeTo(50 - 24.5, 1e-4);

        instance.evaluateNodeDistances(camera, { lodBehindPenalty: 1, lodDistanceShrink: 1 });
        expect(distanceOf(instance.nodeInfos[0])).to.be.closeTo(50, 1e-4);
    });

    it('penalizes nodes behind the camera under both projections', function () {
        for (const projection of [PROJECTION_PERSPECTIVE, PROJECTION_ORTHOGRAPHIC]) {
            const instance = makeInstance(makeOctree([[0, 0, -10], [0, 0, 10]]));

            instance.evaluateNodeDistances(makeCamera(projection), { lodBehindPenalty: 3 });

            const [front, behind] = instance.nodeInfos;
            expect(distanceOf(behind)).to.be.above(distanceOf(front) * 2);
        }
    });
});
