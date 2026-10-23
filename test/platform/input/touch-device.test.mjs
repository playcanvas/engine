import { expect } from 'chai';
import sinon from 'sinon';

import { MOUSEBUTTON_LEFT, MOUSEBUTTON_NONE } from '../../../src/platform/input/constants.js';
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
        const captured = new Set();
        canvas.setPointerCapture = sinon.spy(id => captured.add(id));
        canvas.releasePointerCapture = sinon.spy(id => captured.delete(id));
        canvas.hasPointerCapture = id => captured.has(id);

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
        expect(start.changedTouches[0].touch).to.equal(down);
        expect(start.changedTouches[0].target).to.equal(canvas);

        expect(summary(move.touches)).to.deep.equal([[1, 30, 40]]);
        expect(summary(move.changedTouches)).to.deep.equal([[1, 30, 40]]);

        expect(summary(end.touches)).to.deep.equal([]);
        expect(summary(end.changedTouches)).to.deep.equal([[1, 35, 45]]);
        expect(end.event).to.equal(up);
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
        expect(canvas.releasePointerCapture.calledOnceWith(1)).to.equal(true);
    });

    it('cancels a touch whose capture was lost, but not one that already ended', function () {
        pointer('pointerdown', { pointerId: 1 });
        pointer('lostpointercapture', { pointerId: 1 });
        pointer('pointerdown', { pointerId: 2 });
        pointer('pointerup', { pointerId: 2 });
        pointer('lostpointercapture', { pointerId: 2 });
        expect(log.map(e => e.name)).to.deep.equal(['touchstart', 'touchcancel', 'touchstart', 'touchend']);
    });

    it('tracks pen pointers', function () {
        pointer('pointerdown', { pointerType: 'pen' });
        pointer('pointerup', { pointerType: 'pen' });
        expect(log.map(e => e.name)).to.deep.equal(['touchstart', 'touchend']);
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

    it('captures the pointer on down and releases it on up', function () {
        pointer('pointerdown', { pointerId: 7 });
        expect(canvas.setPointerCapture.calledOnceWith(7)).to.equal(true);
        expect(canvas.releasePointerCapture.called).to.equal(false);
        pointer('pointerup', { pointerId: 7 });
        expect(canvas.releasePointerCapture.calledOnceWith(7)).to.equal(true);
    });

    it('still fires touch events when the capture throws', function () {
        canvas.setPointerCapture = sinon.stub().throws(new window.DOMException('no pointer', 'NotFoundError'));
        pointer('pointerdown');
        pointer('pointerup');
        expect(log.map(e => e.name)).to.deep.equal(['touchstart', 'touchend']);
        expect(canvas.releasePointerCapture.called).to.equal(false);
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
