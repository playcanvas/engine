import { expect } from 'chai';
import { createSandbox } from 'sinon';

import { Gestures } from '../../../src/platform/input/gestures.js';
import { jsdomSetup, jsdomTeardown } from '../../jsdom.mjs';

describe('Gestures', function () {

    let element;
    let gestures;
    let sandbox;

    // jsdom has no PointerEvent, so its fields go on a plain event
    const pointer = (type, pointerId, x = 0, y = 0, pointerType = 'touch') => {
        const event = new window.Event(type, { bubbles: true, cancelable: true });
        Object.assign(event, { pointerId, pointerType, clientX: x, clientY: y, screenX: x, screenY: y });
        element.dispatchEvent(event);
    };

    const make = (layout) => {
        gestures = new Gestures(element, layout && { layout });
        return gestures;
    };

    beforeEach(function () {
        jsdomSetup();
        sandbox = createSandbox();
        element = document.createElement('div');
        element.setPointerCapture = () => {};
        element.releasePointerCapture = () => {};
    });

    afterEach(function () {
        gestures?.destroy();
        gestures = null;
        sandbox.restore();
        jsdomTeardown();
    });

    it('defaults to the touch-touch layout', function () {
        expect(make().layout).to.equal('touch-touch');
    });

    it('ends touches that leave the element with neither an up nor a cancel', function () {
        make();
        pointer('pointerdown', 1, 0, 0);
        pointer('pointerdown', 2, 100, 0);
        pointer('pointerleave', 1);
        pointer('pointerleave', 2);
        expect(gestures.count).to.equal(0);

        // so a later one-finger drag moves as one touch
        gestures.update();
        pointer('pointerdown', 3, 0, 0);
        pointer('pointermove', 3, 10, 5);
        expect(gestures.count).to.equal(1);
        expect(gestures.pan).to.deep.equal([10, 5]);
        expect(gestures.pinch).to.equal(0);
    });

    it('ends a touch once whatever ends it', function () {
        make();
        pointer('pointerdown', 1);
        pointer('pointerup', 1);
        pointer('pointerleave', 1);
        pointer('pointercancel', 1);
        expect(gestures.count).to.equal(0);
    });

    it('reports pinch as the change in two-touch distance', function () {
        make();
        pointer('pointerdown', 1, 0, 0);
        pointer('pointerdown', 2, 100, 0);
        pointer('pointermove', 2, 150, 0);
        expect(gestures.pinch).to.equal(50);
        expect(gestures.count).to.equal(2);
    });

    it('reports pan as the movement of the midpoint of two touches', function () {
        make();
        pointer('pointerdown', 1, 0, 0);
        pointer('pointerdown', 2, 100, 0);
        pointer('pointermove', 2, 120, 10);
        expect(gestures.pan).to.deep.equal([10, 5]);
    });

    it('reports a drag on a touch side', function () {
        sandbox.stub(window, 'innerWidth').value(200);
        make('touch-touch');
        pointer('pointerdown', 1, 20, 50);
        pointer('pointermove', 1, 25, 53);
        expect(gestures.left).to.deep.equal([5, 3]);
        expect(gestures.right).to.deep.equal([0, 0]);

        pointer('pointerdown', 2, 150, 50);
        pointer('pointermove', 2, 148, 50);
        expect(gestures.right).to.deep.equal([-2, 0]);
    });

    it('treats the whole element as the left control in a single layout', function () {
        sandbox.stub(window, 'innerWidth').value(200);
        make('touch');
        pointer('pointerdown', 1, 150, 50);
        pointer('pointermove', 1, 155, 50);
        expect(gestures.left).to.deep.equal([5, 0]);
    });

    it('drives the left joystick and fires its position', function () {
        sandbox.stub(window, 'innerWidth').value(200);
        make('joystick-touch');
        const events = [];
        gestures.on('joystick:position:left', p => events.push(p));
        pointer('pointerdown', 1, 20, 100);
        pointer('pointermove', 1, 90, 100);
        expect(gestures.leftJoystick.value.x).to.equal(1);
        expect(events.at(-1)).to.deep.equal([20, 100, 90, 100]);
        expect(gestures.left).to.deep.equal([0, 0]);

        pointer('pointerup', 1);
        expect(gestures.leftJoystick.value.x).to.equal(0);
        expect(events.at(-1)).to.deep.equal([-1, -1, -1, -1]);
    });

    it('drives the right joystick', function () {
        sandbox.stub(window, 'innerWidth').value(200);
        make('touch-joystick');
        const events = [];
        gestures.on('joystick:position:right', p => events.push(p));
        pointer('pointerdown', 1, 150, 100);
        pointer('pointermove', 1, 150, 30);
        expect(gestures.rightJoystick.value.y).to.equal(-1);
        expect(events.at(-1)).to.deep.equal([150, 100, 150, 30]);
    });

    it('counts a double tap', function () {
        const clock = sandbox.useFakeTimers();
        make();
        pointer('pointerdown', 1, 10, 10);
        pointer('pointerup', 1, 10, 10);
        expect(gestures.doubleTaps).to.equal(0);
        clock.tick(100);
        pointer('pointerdown', 1, 10, 10);
        pointer('pointerup', 1, 10, 10);
        expect(gestures.doubleTaps).to.equal(1);

        // too slow
        gestures.update();
        clock.tick(300);
        pointer('pointerdown', 1, 10, 10);
        expect(gestures.doubleTaps).to.equal(0);
    });

    it('clears totals on update()', function () {
        sandbox.stub(window, 'innerWidth').value(200);
        make();
        pointer('pointerdown', 1, 20, 0);
        pointer('pointerdown', 2, 120, 0);
        pointer('pointermove', 1, 30, 5);
        pointer('pointerdown', 3, 20, 0);
        expect(gestures.left).to.not.deep.equal([0, 0]);
        gestures.update();
        expect(gestures.left).to.deep.equal([0, 0]);
        expect(gestures.right).to.deep.equal([0, 0]);
        expect(gestures.pan).to.deep.equal([0, 0]);
        expect(gestures.pinch).to.equal(0);
        expect(gestures.doubleTaps).to.equal(0);
        expect(gestures.count).to.equal(3);
    });

    it('changing layout releases active touches', function () {
        sandbox.stub(window, 'innerWidth').value(200);
        make('joystick-touch');
        const events = [];
        gestures.on('joystick:position:left', p => events.push(p));
        pointer('pointerdown', 1, 20, 100);
        pointer('pointermove', 1, 90, 100);
        gestures.layout = 'touch-touch';
        expect(gestures.count).to.equal(0);
        expect(gestures.leftJoystick.value.x).to.equal(0);
        expect(gestures.leftJoystick.value.y).to.equal(0);
        expect(events.at(-1)).to.deep.equal([-1, -1, -1, -1]);
    });

    it('ignores mouse pointers', function () {
        make();
        pointer('pointerdown', 1, 0, 0, 'mouse');
        expect(gestures.count).to.equal(0);
    });

    it('tracks pen pointers', function () {
        make();
        pointer('pointerdown', 1, 0, 0, 'pen');
        expect(gestures.count).to.equal(1);
    });

    it('sets touch-action to none while attached and restores it on detach', function () {
        element.style.touchAction = 'pan-x';
        make();
        expect(element.style.touchAction).to.equal('none');

        const other = document.createElement('div');
        gestures.attach(other);
        expect(element.style.touchAction).to.equal('pan-x');
        expect(other.style.touchAction).to.equal('none');

        gestures.detach();
        expect(other.style.touchAction).to.equal('');
    });

    it('ignores events after detach', function () {
        make();
        gestures.detach();
        pointer('pointerdown', 1);
        expect(gestures.count).to.equal(0);
    });
});
