import { expect } from 'chai';

import { Vec3 } from '../../../src/core/math/vec3.js';
import { PROJECTION_ORTHOGRAPHIC, PROJECTION_PERSPECTIVE } from '../../../src/scene/constants.js';
import { GraphNode } from '../../../src/scene/graph-node.js';
import { GSplatWorld } from '../../../src/scene/gsplat-unified/gsplat-world.js';

describe('GSplatWorld#calculateColorCameraDeltas', function () {

    // A camera with only the properties the color update reads. Its orientation has a normalized
    // forward that does not dot with itself to exactly 1.
    const makeCamera = (projection) => {
        const camera = new GraphNode();
        camera.camera = { projection };
        camera.setEulerAngles(42, 17, 29);
        return camera;
    };

    // A world whose colors were last evaluated for the camera in its current pose.
    const makeWorld = (camera, colorUpdateAngle) => {
        const world = Object.create(GSplatWorld.prototype);
        world._gsplat = { colorUpdateAngle };
        world._colorViewForward = new Vec3();
        world._lastColorUpdateCameraPos = new Vec3();
        world._recordColorView(camera);
        world.updateColorCameraTracking(camera);
        return world;
    };

    describe('orthographic camera', function () {

        it('does not refresh a stationary camera when colorUpdateAngle is 0', function () {
            const camera = makeCamera(PROJECTION_ORTHOGRAPHIC);
            const world = makeWorld(camera, 0);
            expect(world.calculateColorCameraDeltas(camera).refreshAll).to.equal(false);
        });

        it('refreshes on any rotation when colorUpdateAngle is 0', function () {
            const camera = makeCamera(PROJECTION_ORTHOGRAPHIC);
            const world = makeWorld(camera, 0);
            camera.rotateLocal(0, 0.01, 0);
            expect(world.calculateColorCameraDeltas(camera).refreshAll).to.equal(true);
        });

        it('refreshes once the camera has rotated by colorUpdateAngle', function () {
            const camera = makeCamera(PROJECTION_ORTHOGRAPHIC);
            const world = makeWorld(camera, 10);
            camera.rotateLocal(0, 5, 0);
            expect(world.calculateColorCameraDeltas(camera).refreshAll).to.equal(false);
            camera.rotateLocal(0, 15, 0);
            expect(world.calculateColorCameraDeltas(camera).refreshAll).to.equal(true);
        });

        it('ignores camera translation', function () {
            const camera = makeCamera(PROJECTION_ORTHOGRAPHIC);
            const world = makeWorld(camera, 0);
            camera.translate(1, 2, 3);
            const deltas = world.calculateColorCameraDeltas(camera);
            expect(deltas.refreshAll).to.equal(false);
            expect(deltas.translationDelta).to.equal(0);
        });
    });

    describe('perspective camera', function () {

        it('reports translation without refreshing all colors', function () {
            const camera = makeCamera(PROJECTION_PERSPECTIVE);
            const world = makeWorld(camera, 10);
            camera.translate(0, 0, 2);
            const deltas = world.calculateColorCameraDeltas(camera);
            expect(deltas.refreshAll).to.equal(false);
            expect(deltas.translationDelta).to.be.closeTo(2, 1e-6);
        });
    });

    it('refreshes when the projection changes', function () {
        const camera = makeCamera(PROJECTION_ORTHOGRAPHIC);
        expect(makeWorld(camera, 10).calculateColorCameraDeltas(camera).refreshAll).to.equal(false);

        const orthoWorld = makeWorld(camera, 10);
        camera.camera.projection = PROJECTION_PERSPECTIVE;
        expect(orthoWorld.calculateColorCameraDeltas(camera).refreshAll).to.equal(true);

        const perspectiveWorld = makeWorld(camera, 10);
        camera.camera.projection = PROJECTION_ORTHOGRAPHIC;
        expect(perspectiveWorld.calculateColorCameraDeltas(camera).refreshAll).to.equal(true);
    });
});
