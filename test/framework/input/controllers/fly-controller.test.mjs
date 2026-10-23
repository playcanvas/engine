import { expect } from 'chai';
import sinon from 'sinon';

import { Vec3 } from '../../../../src/core/math/vec3.js';
import { FlyController } from '../../../../src/framework/input/controllers/fly-controller.js';
import { Pose } from '../../../../src/framework/input/pose.js';
import { InputFrame } from '../../../../src/platform/input/input-frame.js';
import { Keyboard } from '../../../../src/platform/input/keyboard.js';
import { Mouse } from '../../../../src/platform/input/mouse.js';
import { jsdomSetup, jsdomTeardown } from '../../../jsdom.mjs';

const snap = (input, dt = 1 / 60, isn = 1) => ({ isn, dt, ts: 0, input: { move: [0, 0, 0], fast: false, slow: false, look: [0, 0], lookRate: [0, 0], ...input } });

const expectStateClose = (actual, expected) => {
    for (const key of Object.keys(expected)) {
        for (let i = 0; i < expected[key].length; i++) {
            expect(actual[key][i]).to.be.closeTo(expected[key][i], 1e-9);
        }
    }
};

describe('FlyController', function () {

    /** @type {FlyController} */
    let controller;

    beforeEach(function () {
        controller = new FlyController();
        controller.attach(new Pose(Vec3.ZERO, Vec3.ZERO), false);
    });

    describe('#step', function () {

        it('moves forward at moveSpeed per second', function () {
            for (let i = 0; i < 60; i++) {
                controller.step(snap({ move: [0, 0, 1] }));
            }
            const { position } = controller.state;
            expect(position[0]).to.be.closeTo(0, 1e-6);
            expect(position[1]).to.be.closeTo(0, 1e-6);
            expect(position[2]).to.be.closeTo(-10, 1e-6);
        });

        it('does not scale look by dt', function () {
            const start = controller.state;
            controller.step(snap({ look: [10, 0] }, 1 / 30));
            const a = controller.state.angles;
            controller.state = start;
            controller.step(snap({ look: [10, 0] }, 1 / 120));
            const b = controller.state.angles;
            expect(a).to.deep.equal(b);
            expect(a[1]).to.be.closeTo(-2, 1e-9);
        });

        it('replays to the same state', function () {
            const snaps = [
                snap({ move: [0, 0, 1] }, 1 / 60, 1),
                snap({ move: [1, 0, 1], look: [3, -2] }, 1 / 30, 2),
                snap({ fast: true, move: [0, 1, 0], lookRate: [0.5, 0] }, 1 / 60, 3),
                snap({ slow: true, move: [-1, 0, 0], look: [-7, 4] }, 1 / 90, 4),
                snap({ move: [0, -1, -1], lookRate: [0, -1] }, 1 / 60, 5),
                snap({ look: [20, 10] }, 1 / 45, 6),
                snap({ fast: true, move: [0.5, 0, 0.5] }, 1 / 60, 7),
                snap({ lookRate: [1, 1], move: [0, 0, -1] }, 1 / 30, 8),
                snap({ move: [1, 1, 1], look: [-1, -1] }, 1 / 60, 9),
                snap({ slow: true, move: [0, 0, 1], lookRate: [-0.3, 0.7] }, 1 / 120, 10)
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
            controller.step(snap({ move: [5, NaN, 0] }));
            const { position, angles } = controller.state;
            const dist = Math.hypot(...position);
            expect(dist).to.be.at.most(controller.moveSpeed / 60 + 1e-9);
            expect([...position, ...angles].every(Number.isFinite)).to.equal(true);

            expect(() => controller.step({ isn: 1, dt: 1 / 60, ts: 0, input: {} })).to.not.throw();
            expect(controller.state.position).to.deep.equal(position);
        });

        it('clamps dt to MAX_STEP_DT', function () {
            controller.step(snap({ move: [0, 0, 1] }, 10));
            expect(controller.state.position[2]).to.be.closeTo(-controller.moveSpeed * 0.1, 1e-9);
        });

    });

    describe('#update', function () {

        it('separates display smoothing from state', function () {
            controller.step(snap({ move: [0, 0, 1] }));
            expect(controller.state.position[2]).to.be.lessThan(0);
            expect(controller.update(0).position.z).to.equal(0);
            expect(controller.update(1).position.z).to.be.lessThan(0);
        });

    });

    describe('#map', function () {

        /** @type {HTMLCanvasElement} */
        let canvas;
        let keyboard;
        let mouse;

        // jsdom has no PointerEvent
        const pointer = (type, props = {}) => {
            const event = new window.Event(type, { bubbles: true, cancelable: true });
            Object.assign(event, {
                pointerId: 1,
                pointerType: 'mouse',
                button: 0,
                clientX: 50,
                clientY: 50
            }, props);
            canvas.dispatchEvent(event);
        };

        beforeEach(function () {
            jsdomSetup();
            canvas = document.createElement('canvas');
            document.body.appendChild(canvas);
            canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 100, height: 100 });
            Object.defineProperty(canvas, 'clientWidth', { value: 100 });
            Object.defineProperty(canvas, 'clientHeight', { value: 100 });
            canvas.setPointerCapture = sinon.stub();
            canvas.releasePointerCapture = sinon.stub();
            keyboard = new Keyboard(window);
            mouse = new Mouse(canvas, { pointer: true });
        });

        afterEach(function () {
            keyboard.detach();
            mouse.detach();
            sinon.restore();
            jsdomTeardown();
        });

        it('maps WASD and mouse into intent', function () {
            const frame = new InputFrame(FlyController.fields);
            window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW', keyCode: 87 }));
            pointer('pointerdown');
            pointer('pointermove', { clientX: 54, clientY: 52 });

            controller.map({ element: canvas, keyboard, mouse }, frame);

            expect(frame.input.move).to.deep.equal([0, 0, 1]);
            expect(frame.input.look).to.deep.equal([4, 2]);
        });

        it('ignores mouse movement while no button is held', function () {
            const frame = new InputFrame(FlyController.fields);
            pointer('pointermove', { clientX: 40, clientY: 40 });
            pointer('pointermove', { clientX: 44, clientY: 42 });
            expect(mouse.movement).to.deep.equal([4, 2]);

            controller.map({ mouse }, frame);

            expect(frame.input.look).to.deep.equal([0, 0]);
        });

        it('maps modifiers into fast and slow', function () {
            const frame = new InputFrame(FlyController.fields);
            window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ShiftLeft', keyCode: 16 }));
            window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ControlRight', keyCode: 17 }));

            controller.map({ keyboard }, frame);

            expect(frame.input.fast).to.equal(true);
            expect(frame.input.slow).to.equal(true);
        });

    });

});
