import { expect } from 'chai';
import sinon from 'sinon';

import { platform } from '../../../src/core/platform.js';
import { MOUSEBUTTON_LEFT, MOUSEBUTTON_NONE } from '../../../src/platform/input/constants.js';
import { Gestures } from '../../../src/platform/input/gestures.js';
import { Mouse } from '../../../src/platform/input/mouse.js';
import { TouchDevice } from '../../../src/platform/input/touch-device.js';
import { jsdomSetup, jsdomTeardown } from '../../jsdom.mjs';

const NAMES = ['touchstart', 'touchmove', 'touchend', 'touchcancel'];

describe('TouchDevice', function () {

    /** @type {HTMLCanvasElement} */
    let canvas;

    /** @type {TouchDevice} */
    let device;

    /** @type {{ name: string, event: object }[]} */
    let log;

    // jsdom has no PointerEvent, and does no layout so page coordinates are element coordinates
    const pointer = (type, props = {}, target = canvas) => {
        const event = new window.Event(type, { bubbles: true, cancelable: true });
        const { x = 0, y = 0, ...rest } = props;
        Object.assign(event, {
            pointerId: 1,
            pointerType: 'touch',
            isPrimary: true,
            button: 0,
            clientX: x,
            clientY: y,
            pageX: x,
            pageY: y,
            screenX: x,
            screenY: y
        }, rest);
        target.dispatchEvent(event);
        return event;
    };

    const summary = touches => touches.map(t => [t.id, t.x, t.y]);

    beforeEach(function () {
        jsdomSetup();

        // getTouchTargetCoords needs the HTMLElement global, which jsdomSetup does not copy
        global.HTMLElement = window.HTMLElement;

        canvas = document.createElement('canvas');
        document.body.appendChild(canvas);
        for (const el of [canvas, document.body]) {
            el.setPointerCapture = sinon.spy();
            el.releasePointerCapture = sinon.spy();
        }

        device = new TouchDevice(canvas);
        const entries = [];
        log = entries;
        for (const name of NAMES) {
            device.on(name, event => entries.push({ name, event }));
        }
    });

    afterEach(function () {
        device.detach();
        sinon.restore();
        delete global.HTMLElement;
        jsdomTeardown();
    });

    it('fires touchstart, touchmove and touchend for a single touch', function () {
        const down = pointer('pointerdown', { x: 10, y: 20 });
        pointer('pointermove', { x: 30, y: 40 });
        const up = pointer('pointerup', { x: 35, y: 45 });

        expect(log.map(e => e.name)).to.deep.equal(['touchstart', 'touchmove', 'touchend']);

        const [start, move, end] = log.map(e => e.event);
        expect(summary(start.touches)).to.deep.equal([[1, 10, 20]]);
        expect(summary(start.changedTouches)).to.deep.equal([[1, 10, 20]]);
        expect(start.event).to.equal(down);
        expect(start.element).to.equal(canvas);
        expect(start.changedTouches[0].target).to.equal(canvas);

        expect(summary(move.touches)).to.deep.equal([[1, 30, 40]]);
        expect(summary(move.changedTouches)).to.deep.equal([[1, 30, 40]]);

        expect(summary(end.touches)).to.deep.equal([]);
        expect(summary(end.changedTouches)).to.deep.equal([[1, 35, 45]]);
        expect(end.event).to.equal(up);
    });

    it('gives each touch a browser Touch shaped snapshot of its pointer', function () {
        const down = pointer('pointerdown', { pointerId: 7, x: 50, y: 60, screenX: 150, screenY: 160, width: 10, height: 6, pressure: 0.5 });
        pointer('pointermove', { pointerId: 7, x: 70, y: 80 });

        const [start, move] = log.map(e => e.event);
        const touch = start.changedTouches[0].touch;
        expect(touch).to.not.equal(down);
        expect(touch).to.include({
            identifier: 7,
            target: canvas,
            clientX: 50,
            clientY: 60,
            pageX: 50,
            pageY: 60,
            screenX: 150,
            screenY: 160,
            radiusX: 5,
            radiusY: 3,
            rotationAngle: 0,
            force: 0.5
        });

        // like a browser Touch, a touch from an earlier event keeps its values
        expect(start.touches[0].touch).to.include({ clientX: 50, pageX: 50 });
        expect(move.changedTouches[0].touch).to.include({ identifier: 7, clientX: 70, pageY: 80 });
    });

    it('does not end a touch on a mouse pointerup or pointerleave with the same pointer id', function () {
        pointer('pointerdown');
        pointer('pointerup', { pointerType: 'mouse' });
        pointer('pointerleave', { pointerType: 'mouse' });
        pointer('pointercancel', { pointerType: 'mouse' });
        pointer('pointermove', { x: 4 });
        expect(log.map(e => e.name)).to.deep.equal(['touchstart', 'touchmove']);
    });

    it('reports all active touches and the changed one for two touches', function () {
        pointer('pointerdown', { pointerId: 1, x: 0, y: 0 });
        pointer('pointerdown', { pointerId: 2, isPrimary: false, x: 100, y: 0 });
        pointer('pointermove', { pointerId: 2, isPrimary: false, x: 150, y: 10 });
        pointer('pointermove', { pointerId: 1, x: 5, y: 5 });
        pointer('pointerup', { pointerId: 1, x: 5, y: 5 });
        pointer('pointerup', { pointerId: 2, isPrimary: false, x: 150, y: 10 });

        expect(log.map(e => [e.name, summary(e.event.touches), summary(e.event.changedTouches)])).to.deep.equal([
            ['touchstart', [[1, 0, 0]], [[1, 0, 0]]],
            ['touchstart', [[1, 0, 0], [2, 100, 0]], [[2, 100, 0]]],
            ['touchmove', [[1, 0, 0], [2, 150, 10]], [[2, 150, 10]]],
            ['touchmove', [[1, 5, 5], [2, 150, 10]], [[1, 5, 5]]],
            ['touchend', [[2, 150, 10]], [[1, 5, 5]]],
            ['touchend', [], [[2, 150, 10]]]
        ]);
        expect(log[1].event.getTouchById(1, log[1].event.touches).x).to.equal(0);
        expect(log[1].event.getTouchById(3, log[1].event.touches)).to.equal(null);
    });

    it('fires touchcancel without the cancelled touch, then ignores its pointerup', function () {
        pointer('pointerdown', { pointerId: 1 });
        pointer('pointerdown', { pointerId: 2, isPrimary: false, x: 50 });
        pointer('pointercancel', { pointerId: 1 });
        pointer('pointerup', { pointerId: 1 });

        expect(log.map(e => [e.name, summary(e.event.touches), summary(e.event.changedTouches)]).slice(2)).to.deep.equal([
            ['touchcancel', [[2, 50, 0]], [[1, 0, 0]]]
        ]);
    });

    it('ends a touch that leaves without an up or a cancel with touchend, once', function () {
        pointer('pointerdown', { pointerId: 1 });
        pointer('pointerdown', { pointerId: 2, isPrimary: false, x: 50 });
        pointer('pointerleave', { pointerId: 1, x: 5 });
        pointer('pointerup', { pointerId: 1 });
        pointer('pointercancel', { pointerId: 1 });

        // browsers fire a leave after a touch lifts too
        pointer('pointerup', { pointerId: 2, x: 50 });
        pointer('pointerleave', { pointerId: 2, x: 50 });

        expect(log.map(e => [e.name, summary(e.event.touches), summary(e.event.changedTouches)]).slice(2)).to.deep.equal([
            ['touchend', [[2, 50, 0]], [[1, 5, 0]]],
            ['touchend', [], [[2, 50, 0]]]
        ]);
    });

    it('does not end a touch when its pointer capture is lost', function () {
        pointer('pointerdown');
        pointer('lostpointercapture');
        pointer('pointermove', { x: 4 });
        expect(log.map(e => e.name)).to.deep.equal(['touchstart', 'touchmove']);
    });

    it('tracks pen pointers on platforms with touch support', function () {
        sinon.stub(platform, 'touch').value(true);
        pointer('pointerdown', { pointerType: 'pen' });
        pointer('pointerup', { pointerType: 'pen' });
        expect(log.map(e => e.name)).to.deep.equal(['touchstart', 'touchend']);
    });

    it('ignores pen pointers on platforms without touch support', function () {
        sinon.stub(platform, 'touch').value(false);
        pointer('pointerdown', { pointerType: 'pen' });
        pointer('pointermove', { pointerType: 'pen' });
        pointer('pointerup', { pointerType: 'pen' });
        expect(log).to.deep.equal([]);
    });

    it('ignores mouse pointers', function () {
        pointer('pointerdown', { pointerType: 'mouse' });
        pointer('pointermove', { pointerType: 'mouse' });
        pointer('pointerup', { pointerType: 'mouse' });
        expect(log).to.deep.equal([]);
        expect(canvas.setPointerCapture.called).to.equal(false);
    });

    it('ignores DOM touch events', function () {
        for (const name of NAMES) {
            const event = new window.Event(name, { bubbles: true, cancelable: true });
            Object.assign(event, { touches: [], changedTouches: [] });
            canvas.dispatchEvent(event);
        }
        expect(log).to.deep.equal([]);
    });

    it('ignores moves and ends of untracked pointers and repeated downs', function () {
        pointer('pointermove', { pointerId: 3 });
        pointer('pointerup', { pointerId: 3 });
        pointer('pointercancel', { pointerId: 3 });
        pointer('pointerdown', { pointerId: 1 });
        pointer('pointerdown', { pointerId: 1 });
        expect(log.map(e => e.name)).to.deep.equal(['touchstart']);
    });

    it('fires for touches that start on a child of the element', function () {
        const child = document.createElement('div');
        canvas.appendChild(child);
        pointer('pointerdown', {}, child);
        expect(log.map(e => e.name)).to.deep.equal(['touchstart']);
        expect(log[0].event.changedTouches[0].target).to.equal(child);
    });

    it('keeps the start target and its coordinate frame for the whole touch', function () {
        const parent = document.createElement('div');
        const child = document.createElement('div');
        parent.appendChild(child);
        document.body.appendChild(parent);
        Object.defineProperty(child, 'offsetLeft', { value: 10 });
        Object.defineProperty(child, 'offsetTop', { value: 5 });
        device.attach(parent);

        pointer('pointerdown', { x: 30, y: 30 }, child);
        pointer('pointermove', { x: 40, y: 45 }, parent);
        pointer('pointerdown', { pointerId: 2, isPrimary: false, x: 60, y: 60 }, parent);
        pointer('pointerup', { x: 50, y: 50 }, parent);

        expect(log.map(e => [e.name, e.event.element, e.event.changedTouches[0].target, summary(e.event.changedTouches)])).to.deep.equal([
            ['touchstart', child, child, [[1, 20, 25]]],
            ['touchmove', child, child, [[1, 30, 40]]],
            ['touchstart', parent, parent, [[2, 60, 60]]],
            ['touchend', child, child, [[1, 40, 45]]]
        ]);
        expect(log[2].event.touches.map(t => t.target)).to.deep.equal([child, parent]);
        expect(summary(log[2].event.touches)).to.deep.equal([[1, 30, 40], [2, 60, 60]]);
    });

    it('never captures or releases the pointer', function () {
        pointer('pointerdown', { pointerId: 7 });
        pointer('pointermove', { pointerId: 7 });
        pointer('pointerup', { pointerId: 7 });
        pointer('pointerdown', { pointerId: 8 });
        pointer('pointercancel', { pointerId: 8 });
        expect(canvas.setPointerCapture.called).to.equal(false);
        expect(canvas.releasePointerCapture.called).to.equal(false);
    });

    it('leaves Gestures on a child canvas its capture and moves', function () {
        device.attach(document.body);
        const gestures = new Gestures(canvas);
        const touch = (type, x) => pointer(type, { x, y: 0 }, canvas);

        touch('pointerdown', 0);
        touch('pointermove', 10);
        touch('pointermove', 15);
        expect(gestures.pan).to.deep.equal([15, 0]);
        expect(gestures.count).to.equal(1);
        touch('pointerup', 15);
        gestures.destroy();

        expect(canvas.setPointerCapture.calledOnceWith(1)).to.equal(true);
        expect(canvas.releasePointerCapture.calledOnceWith(1)).to.equal(true);
        expect(document.body.setPointerCapture.called).to.equal(false);
        expect(document.body.releasePointerCapture.called).to.equal(false);
        expect(log.map(e => e.name)).to.deep.equal(['touchstart', 'touchmove', 'touchmove', 'touchend']);
    });

    it('attaches to the window without touch-action', function () {
        expect(() => device.attach(window)).to.not.throw();
        pointer('pointerdown', { x: 3 });
        pointer('pointerup', { x: 3 });
        expect(() => device.detach()).to.not.throw();
        expect(log.map(e => e.name)).to.deep.equal(['touchstart', 'touchend']);
        expect(log[0].event.element).to.equal(canvas);
    });

    it('does not prevent default', function () {
        expect(pointer('pointerdown').defaultPrevented).to.equal(false);
        expect(pointer('pointermove').defaultPrevented).to.equal(false);
        expect(pointer('pointerup').defaultPrevented).to.equal(false);
    });

    it('sets touch-action to none while attached and restores it on detach', function () {
        expect(canvas.style.touchAction).to.equal('none');
        device.detach();
        expect(canvas.style.touchAction).to.equal('');

        const other = document.createElement('div');
        other.style.touchAction = 'pan-y';
        device.attach(other);
        expect(other.style.touchAction).to.equal('none');
        device.attach(canvas);
        expect(other.style.touchAction).to.equal('pan-y');
        expect(canvas.style.touchAction).to.equal('none');
    });

    it('leaves touch-action alone on the body and the document element', function () {
        for (const page of [document.body, document.documentElement]) {
            page.style.touchAction = 'pan-y';
            device.attach(page);
            expect(page.style.touchAction).to.equal('pan-y');
            pointer('pointerdown', { x: 3 });
            device.detach();
            expect(page.style.touchAction).to.equal('pan-y');
        }
        expect(log.map(e => e.name)).to.deep.equal(['touchstart', 'touchstart']);
        expect(canvas.style.touchAction).to.equal('');
    });

    it('ignores events after detach and forgets active touches', function () {
        pointer('pointerdown', { pointerId: 1 });
        device.detach();
        pointer('pointerup', { pointerId: 1 });
        device.attach(canvas);
        pointer('pointerdown', { pointerId: 2 });
        expect(log.map(e => e.name)).to.deep.equal(['touchstart', 'touchstart']);
        expect(summary(log[1].event.touches)).to.deep.equal([[2, 0, 0]]);
    });

    it('lets a tap reach both the TouchDevice and a default-mode Mouse', function () {
        canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 100, height: 100 });
        Object.defineProperty(canvas, 'clientWidth', { value: 100 });
        Object.defineProperty(canvas, 'clientHeight', { value: 100 });

        // the mouse listens on the window, so this also proves the events bubble past the device
        const mouse = new Mouse(canvas);
        const mouseLog = [];
        for (const name of ['mousemove', 'mousedown', 'mouseup']) {
            mouse.on(name, e => mouseLog.push(`${name}${e.button} ${e.x},${e.y}`));
        }

        pointer('pointerdown', { x: 20, y: 30 });
        const up = pointer('pointerup', { x: 20, y: 30 });
        mouse.detach();

        expect(log.map(e => e.name)).to.deep.equal(['touchstart', 'touchend']);
        expect(mouseLog).to.deep.equal([
            `mousemove${MOUSEBUTTON_NONE} 20,30`,
            `mousedown${MOUSEBUTTON_LEFT} 20,30`,
            `mouseup${MOUSEBUTTON_LEFT} 20,30`
        ]);
        expect(up.defaultPrevented).to.equal(false);
    });

});
