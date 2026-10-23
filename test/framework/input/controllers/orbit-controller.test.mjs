import { expect } from 'chai';

import { Vec3 } from '../../../../src/core/math/vec3.js';
import { OrbitController } from '../../../../src/framework/input/controllers/orbit-controller.js';
import { Pose } from '../../../../src/framework/input/pose.js';
import { InputFrame } from '../../../../src/platform/input/input-frame.js';

const snap = (input, dt = 1 / 60, isn = 1) => ({ isn, dt, ts: 0, input: { rotate: [0, 0], pan: [0, 0], zoom: 0, ...input } });

const expectStateClose = (actual, expected) => {
    expect(actual.distance).to.be.closeTo(expected.distance, 1e-9);
    for (const key of ['focus', 'angles']) {
        for (let i = 0; i < 3; i++) {
            expect(actual[key][i]).to.be.closeTo(expected[key][i], 1e-9);
        }
    }
};

describe('OrbitController', function () {

    /** @type {OrbitController} */
    let controller;

    beforeEach(function () {
        controller = new OrbitController();

        // camera at z = 10 looking at the origin
        controller.attach(new Pose(new Vec3(0, 0, 10), Vec3.ZERO, 10), false);
    });

    describe('#step', function () {

        it('starts from the attached pose', function () {
            expectStateClose(controller.state, { focus: [0, 0, 0], angles: [0, 0, 0], distance: 10 });
        });

        it('pans in world units from NDC independent of screen size', function () {
            const start = controller.state;
            const deltas = [100, 400].map((width) => {
                const frame = new InputFrame(OrbitController.fields);
                const mouse = { movement: [-width / 4, 0], wheel: 0, isPressed: button => button === 1 };
                controller.map({ element: { clientWidth: width, clientHeight: width }, mouse }, frame);
                const snapshot = frame.capture(1 / 60);
                expect(snapshot.input.pan).to.deep.equal([0.5, 0]);

                controller.state = start;
                controller.step(snapshot);
                return controller.state.focus;
            });

            // fov 90 at distance 10 gives a half height of 10
            expect(deltas[0][0]).to.be.closeTo(5, 1e-9);
            expect(deltas[1]).to.deep.equal(deltas[0]);
        });

        it('zooms by dist × (1 + zoom × zoomSpeed)', function () {
            controller.step(snap({ zoom: 100 }));
            expect(controller.state.distance).to.be.closeTo(11, 1e-9);
        });

        it('clamps zoom to zoomRange', function () {
            controller.step(snap({ zoom: -1e6 }));
            expect(controller.state.distance).to.equal(0.01);
        });

        it('ignores pan when enablePan is false', function () {
            controller.enablePan = false;
            controller.step(snap({ pan: [0.5, 0.5] }));
            expect(controller.state.focus).to.deep.equal([0, 0, 0]);
        });

        it('replays to the same state', function () {
            const snaps = [
                snap({ rotate: [10, 0] }, 1 / 60, 1),
                snap({ pan: [0.1, -0.2] }, 1 / 30, 2),
                snap({ zoom: 50 }, 1 / 60, 3),
                snap({ rotate: [-4, 8], zoom: -20 }, 1 / 90, 4),
                snap({ pan: [-0.3, 0.05], rotate: [2, 2] }, 1 / 60, 5),
                snap({ zoom: 120 }, 1 / 45, 6),
                snap({ rotate: [0, -15] }, 1 / 60, 7),
                snap({ pan: [0.2, 0.2], zoom: 10 }, 1 / 30, 8),
                snap({ rotate: [30, 5] }, 1 / 60, 9),
                snap({ pan: [-0.1, 0], zoom: -40 }, 1 / 120, 10)
            ];
            let saved;
            snaps.forEach((s, i) => {
                controller.step(s);
                if (i === 3) {
                    saved = controller.state;
                }
            });
            const expected = controller.state;

            controller.state = saved;
            snaps.slice(4).forEach(s => controller.step(s));
            expectStateClose(controller.state, expected);
        });

        it('sanitizes snapshot values', function () {
            controller.step(snap({ rotate: [NaN, Infinity], pan: [NaN, 0], zoom: NaN }));
            expectStateClose(controller.state, { focus: [0, 0, 0], angles: [0, 0, 0], distance: 10 });
            expect(() => controller.step({ isn: 1, dt: 1 / 60, ts: 0, input: {} })).to.not.throw();
        });

    });

    describe('#update', function () {

        it('separates display smoothing from state', function () {
            controller.step(snap({ zoom: 100 }));
            expect(controller.update(0).distance).to.equal(10);
            expect(controller.update(1).distance).to.be.greaterThan(10);
        });

    });

    describe('#map', function () {

        it('maps two-finger drag to pan and pinch to zoom', function () {
            const frame = new InputFrame(OrbitController.fields);
            const gestures = { count: 2, pan: [10, 0], pinch: 2 };
            controller.map({ element: { clientWidth: 100, clientHeight: 100 }, gestures }, frame);
            expect(frame.input.pan).to.deep.equal([-0.2, 0]);
            expect(frame.input.zoom).to.equal(-10);
            expect(frame.input.rotate).to.deep.equal([0, 0]);
        });

        it('maps one-finger drag to rotate', function () {
            const frame = new InputFrame(OrbitController.fields);
            const gestures = { count: 1, pan: [3, 4], pinch: 0 };
            controller.map({ gestures }, frame);
            expect(frame.input.rotate).to.deep.equal([3, 4]);
            expect(frame.input.pan).to.deep.equal([0, 0]);
        });

    });

});
