import { expect } from 'chai';
import { restore, spy, stub } from 'sinon';

import { platform } from '../../../src/core/platform.js';
import { Application } from '../../../src/framework/application.js';
import { ElementDragHelper } from '../../../src/framework/components/element/element-drag-helper.js';
import { Entity } from '../../../src/framework/entity.js';
import {
    ElementInput, ElementMouseEvent, ElementTouchEvent
} from '../../../src/framework/input/element-input.js';
import { XRSPACE_LOCALFLOOR, XRTYPE_VR } from '../../../src/framework/xr/constants.js';
import { Mouse } from '../../../src/platform/input/mouse.js';
import { createGraphicsDevice } from '../../device.mjs';
import { jsdomSetup, jsdomTeardown } from '../../jsdom.mjs';
import { FakeXRSystem } from '../xr/fake-webxr.mjs';

const NAMES = [
    'mousedown', 'mouseup', 'mouseenter', 'mouseleave', 'mousemove', 'mousewheel', 'click',
    'touchstart', 'touchend', 'touchmove', 'touchcancel', 'touchleave'
];

describe('ElementInput', function () {
    let app;
    let canvas;
    let element;

    /** @type {{ name: string, event: object }[]} */
    let log;

    // jsdom has no PointerEvent, and does no layout so page coordinates are canvas coordinates
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
            pageY: y
        }, rest);
        target.dispatchEvent(event);
        return event;
    };

    const mouse = (type, props = {}) => pointer(type, { pointerType: 'mouse', ...props }, window);

    const names = () => log.map(e => e.name);

    const createApp = (options, appOptions) => {
        app = new Application(canvas, {
            graphicsDevice: createGraphicsDevice(canvas),
            elementInput: new ElementInput(canvas, options),
            ...appOptions
        });

        const camera = new Entity('camera', app);
        camera.addComponent('camera');
        app.root.addChild(camera);

        // a screen-space element that covers the whole canvas
        const screen = new Entity('screen', app);
        screen.addComponent('screen', { screenSpace: true, referenceResolution: [300, 400] });
        app.root.addChild(screen);

        const entity = new Entity('element', app);
        element = entity.addComponent('element', {
            type: 'group',
            anchor: [0, 0, 1, 1],
            margin: [0, 0, 0, 0],
            useInput: true
        });
        screen.addChild(entity);

        const entries = [];
        log = entries;
        for (const name of NAMES) {
            element.on(name, event => entries.push({ name, event }));
        }
    };

    beforeEach(function () {
        jsdomSetup();

        // touch coordinates need the HTMLElement global, which jsdomSetup does not copy
        global.HTMLElement = window.HTMLElement;

        // jsdom does no layout, so give the canvas the client size that hit testing scales by. It
        // is in the document so its pointer events bubble to the window
        canvas = document.createElement('canvas');
        canvas.width = 300;
        canvas.height = 400;
        Object.defineProperty(canvas, 'clientWidth', { value: 300 });
        Object.defineProperty(canvas, 'clientHeight', { value: 400 });
        document.body.appendChild(canvas);
    });

    afterEach(function () {
        app.destroy();
        restore();
        delete global.HTMLElement;
        jsdomTeardown();
    });

    describe('with mouse and touch', function () {
        beforeEach(function () {
            createApp();
        });

        it('passes the PointerEvent and DOM Touch shaped touches to touch handlers', function () {
            const down = pointer('pointerdown', {
                pointerId: 7, x: 50, y: 60, screenX: 150, screenY: 160, width: 10, height: 6, pressure: 0.5
            });

            const [{ event }] = log;
            expect(event).to.be.an.instanceof(ElementTouchEvent);
            expect(event.event).to.equal(down);
            expect(event.touch).to.include({
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
            expect(event.changedTouches.length).to.equal(1);
            expect(event.changedTouches.item(0)).to.equal(event.touch);
            expect(event.changedTouches.item(1)).to.equal(null);
            expect(event.touches.item(0)).to.equal(event.touch);
            expect([event.x, event.y]).to.deep.equal([50, 60]);
        });

        it('snapshots touches per event, keeping each on its start target', function () {
            pointer('pointerdown', { x: 50, y: 60 });
            pointer('pointerdown', { pointerId: 2, x: 100, y: 100, isPrimary: false });
            pointer('pointermove', { x: 70, y: 80 });
            const stored = log[2].event.touch;
            const storedOther = log[2].event.touches.item(1);
            expect(log[2].event.touches.item(0)).to.equal(stored);

            pointer('pointermove', { x: 90, y: 95 });
            pointer('pointermove', { pointerId: 2, x: 120, y: 130, isPrimary: false });

            // like a browser Touch, a touch from an earlier event keeps its values
            expect(stored).to.include({ target: canvas, clientX: 70, clientY: 80, pageX: 70, pageY: 80 });
            expect(storedOther).to.include({ identifier: 2, clientX: 100, pageX: 100 });
            expect(log[3].event.touch).to.not.equal(stored);
            expect(log[3].event.touch).to.include({ target: canvas, clientX: 90, pageX: 90 });
            expect([log[3].event.x, log[3].event.y]).to.deep.equal([90, 95]);
        });

        it('passes the PointerEvent to mouse handlers', function () {
            const down = mouse('pointerdown', { x: 50, y: 60 });

            const [{ event }] = log;
            expect(event).to.be.an.instanceof(ElementMouseEvent);
            expect(event.event).to.equal(down);
            expect([event.x, event.y, event.button]).to.deep.equal([50, 60, 0]);
        });

        it('fires the mouse button events of chords, with the click on the first release', function () {
            const sequence = () => log.map(e => `${e.name}${e.event.button}`);

            mouse('pointermove', { x: 50, y: 60, button: -1, buttons: 0 });
            expect(log.map(e => e.event.button)).to.deep.equal([0, 0]);

            // left down, right down, right up, left up
            log.length = 0;
            mouse('pointerdown', { x: 50, y: 60, button: 0, buttons: 1 });
            mouse('pointermove', { x: 50, y: 60, button: 2, buttons: 3 });
            mouse('pointermove', { x: 50, y: 60, button: 2, buttons: 1 });
            mouse('pointerup', { x: 50, y: 60, button: 0, buttons: 0 });
            expect(sequence()).to.deep.equal(['mousedown0', 'mousedown2', 'mouseup2', 'click2', 'mouseup0']);

            // left down, right down, left up, right up
            log.length = 0;
            mouse('pointerdown', { x: 50, y: 60, button: 0, buttons: 1 });
            mouse('pointermove', { x: 50, y: 60, button: 2, buttons: 3 });
            mouse('pointermove', { x: 50, y: 60, button: 0, buttons: 2 });
            mouse('pointerup', { x: 50, y: 60, button: 2, buttons: 0 });
            expect(sequence()).to.deep.equal(['mousedown0', 'mousedown2', 'mouseup0', 'click0', 'mouseup2']);
        });

        it('reports the left button on mouse moves', function () {
            mouse('pointermove', { x: 50, y: 60, button: -1 });
            mouse('pointermove', { x: 350, y: 60, button: -1 });
            expect(log.map(e => `${e.name}${e.event.button}`)).to.deep.equal(['mousemove0', 'mouseenter0', 'mouseleave0']);
        });

        it('fires enter, down, up, click and leave for a mouse click on a button', function () {
            const button = element.entity.addComponent('button', { imageEntity: element.entity });
            const clicks = spy();
            button.on('click', clicks);

            mouse('pointermove', { x: 50, y: 60, button: -1 });
            expect(names()).to.deep.equal(['mousemove', 'mouseenter']);

            log.length = 0;
            mouse('pointerdown', { x: 50, y: 60 });
            mouse('pointerup', { x: 52, y: 62 });
            expect(names()).to.deep.equal(['mousedown', 'mouseup', 'click']);
            expect(clicks.calledOnce).to.be.true;

            log.length = 0;
            mouse('pointermove', { x: 350, y: 60, button: -1 });
            expect(names()).to.deep.equal(['mouseleave']);
        });

        it('fires touchstart, click and touchend for a tap on a button, which keeps it from Mouse', function () {
            const button = element.entity.addComponent('button', { imageEntity: element.entity });
            const clicks = spy();
            button.on('click', clicks);
            const mouseDevice = new Mouse(canvas);
            const mouseEvents = spy();
            ['mousemove', 'mousedown', 'mouseup'].forEach(name => mouseDevice.on(name, mouseEvents));

            pointer('pointerdown', { x: 50, y: 60 });
            const up = pointer('pointerup', { x: 52, y: 61 });

            expect(names()).to.deep.equal(['touchstart', 'click', 'touchend']);
            expect(clicks.calledOnce).to.be.true;
            expect(up.defaultPrevented).to.be.true;
            expect(mouseEvents.called).to.be.false;

            mouseDevice.detach();
        });

        it('follows a tap on a plain element with emulated mouse events, without a second click', function () {
            const mouseDevice = new Mouse(canvas);
            const mouseEvents = [];
            ['mousemove', 'mousedown', 'mouseup'].forEach(name => mouseDevice.on(name, () => mouseEvents.push(name)));

            pointer('pointerdown', { x: 50, y: 60 });
            const up = pointer('pointerup', { x: 52, y: 61 });

            expect(names()).to.deep.equal([
                'touchstart', 'click', 'touchend', 'mousemove', 'mouseenter', 'mousedown', 'mouseup'
            ]);
            expect(log[1].event).to.be.an.instanceof(ElementTouchEvent);
            expect(log.slice(3).every(e => e.event instanceof ElementMouseEvent && e.event.event === up)).to.be.true;
            expect(mouseEvents).to.deep.equal(['mousemove', 'mousedown', 'mouseup']);

            mouseDevice.detach();
        });

        it('does not emulate mouse events for a tap whose pointerdown was default-prevented', function () {
            canvas.addEventListener('pointerdown', e => e.preventDefault(), { once: true });
            pointer('pointerdown', { x: 50, y: 60 });
            pointer('pointerup', { x: 50, y: 60 });

            expect(names()).to.deep.equal(['touchstart', 'click', 'touchend']);
        });

        it('does not end a touch on a mouse pointerleave with the same pointer id', function () {
            pointer('pointerdown', { x: 50, y: 60 });
            pointer('pointerleave', { pointerType: 'mouse', x: 50, y: 60 });
            pointer('pointermove', { x: 70, y: 60 });
            pointer('pointerup', { x: 70, y: 60 });

            expect(names()).to.deep.equal(['touchstart', 'touchmove', 'click', 'touchend']);
        });

        it('forgets touches on detach', function () {
            pointer('pointerdown', { x: 50, y: 60 });
            app.elementInput.detach();
            app.elementInput.attach(canvas);
            pointer('pointerdown', { x: 50, y: 60 });

            expect(names()).to.deep.equal(['touchstart', 'touchstart']);
        });

        it('treats a pen as a touch on platforms with touch support', function () {
            stub(platform, 'touch').value(true);
            pointer('pointermove', { pointerType: 'pen', x: 50, y: 60, button: -1 });
            pointer('pointerdown', { pointerType: 'pen', x: 50, y: 60 });
            pointer('pointerup', { pointerType: 'pen', x: 50, y: 60 });

            expect(names()).to.deep.equal([
                'touchstart', 'click', 'touchend', 'mousemove', 'mouseenter', 'mousedown', 'mouseup'
            ]);
        });

        it('treats a pen as a mouse on platforms without touch support', function () {
            stub(platform, 'touch').value(false);
            pointer('pointermove', { pointerType: 'pen', x: 50, y: 60, button: -1 });
            pointer('pointerdown', { pointerType: 'pen', x: 50, y: 60 });
            pointer('pointerup', { pointerType: 'pen', x: 50, y: 60 });
            pointer('pointermove', { pointerType: 'pen', x: 350, y: 60, button: -1 });

            expect(names()).to.deep.equal([
                'mousemove', 'mouseenter', 'mousedown', 'mouseup', 'click', 'mouseleave'
            ]);
        });

        it('does not emulate mouse events for a touch that moves too far to be a tap', function () {
            pointer('pointerdown', { x: 50, y: 60 });
            pointer('pointermove', { x: 80, y: 60 });
            pointer('pointerup', { x: 80, y: 60 });

            expect(names()).to.deep.equal(['touchstart', 'touchmove', 'click', 'touchend']);
        });

        it('tracks several touches at once', function () {
            pointer('pointerdown', { pointerId: 1, x: 10, y: 10 });
            pointer('pointerdown', { pointerId: 2, x: 100, y: 100, isPrimary: false });
            pointer('pointermove', { pointerId: 2, x: 110, y: 100, isPrimary: false });
            pointer('pointerup', { pointerId: 1, x: 10, y: 10 });
            pointer('pointerup', { pointerId: 2, x: 110, y: 100, isPrimary: false });

            // a second finger means neither is a tap
            expect(names()).to.deep.equal([
                'touchstart', 'touchstart', 'touchmove', 'click', 'touchend', 'click', 'touchend'
            ]);

            const events = log.map(e => e.event);
            const ids = event => [event.touch.identifier, Array.from(event.touches, t => t.identifier)];
            expect(ids(events[1])).to.deep.equal([2, [1, 2]]);
            expect(ids(events[2])).to.deep.equal([2, [1, 2]]);
            expect([events[2].x, events[2].y]).to.deep.equal([110, 100]);
            expect(ids(events[4])).to.deep.equal([1, [2]]);
            expect(ids(events[6])).to.deep.equal([2, []]);
        });

        it('fires touchleave once when a touch leaves its element, and no click when it ends there', function () {
            pointer('pointerdown', { x: 50, y: 60 });
            pointer('pointermove', { x: 350, y: 60 });
            pointer('pointermove', { x: 360, y: 60 });
            pointer('pointerup', { x: 360, y: 60 });

            expect(names()).to.deep.equal(['touchstart', 'touchleave', 'touchmove', 'touchmove', 'touchend']);

            // touch coordinates stay relative to the start target, and the end reports the start
            expect(log[1].event.x).to.equal(350);
            expect(log[4].event.x).to.equal(50);
        });

        it('fires touchcancel for a cancelled touch, without emulated mouse events', function () {
            pointer('pointerdown', { x: 50, y: 60 });
            pointer('pointercancel', { x: 50, y: 60 });

            expect(names()).to.include('touchcancel');
            expect(names()).to.not.include('mousedown');
        });

        it('fires mousewheel for the wheel', function () {
            window.dispatchEvent(new window.WheelEvent('wheel', { deltaY: 100, clientX: 50, clientY: 60 }));

            expect(names()).to.deep.equal(['mousewheel', 'mouseenter']);
            expect(log[0].event.wheelDelta).to.equal(1);
        });

        it('ignores mouse and touch DOM events', function () {
            for (const type of ['mousemove', 'mousedown', 'mouseup']) {
                window.dispatchEvent(new window.MouseEvent(type, { clientX: 50, clientY: 60, bubbles: true }));
            }
            const touch = { identifier: 7, target: canvas, pageX: 50, pageY: 60 };
            for (const type of ['touchstart', 'touchmove', 'touchend']) {
                canvas.dispatchEvent(new window.TouchEvent(type, {
                    touches: [touch],
                    changedTouches: [touch],
                    bubbles: true
                }));
            }

            expect(log).to.be.empty;
        });

        it('sets touch-action to none while attached', function () {
            const other = document.createElement('div');
            other.style.touchAction = 'pan-y';
            const input = new ElementInput(other);
            expect(other.style.touchAction).to.equal('none');

            input.detach();
            expect(other.style.touchAction).to.equal('pan-y');
        });

        it('leaves the previous element when attached to another', function () {
            const other = document.createElement('div');
            document.body.appendChild(other);
            app.elementInput.attach(other);

            expect(canvas.style.touchAction).to.equal('');
            expect(other.style.touchAction).to.equal('none');

            pointer('pointerdown', { x: 50, y: 60 });
            expect(log).to.be.empty;
        });

        it('fires nothing once detached', function () {
            app.elementInput.detach();

            pointer('pointerdown', { x: 50, y: 60 });
            mouse('pointerdown', { x: 50, y: 60 });
            expect(log).to.be.empty;
        });
    });

    it('drags an element with a pen on platforms without touch support', function () {
        stub(platform, 'touch').value(false);
        createApp(undefined, { mouse: new Mouse(canvas) });
        const drag = new ElementDragHelper(element);
        const events = [];
        for (const name of ['drag:start', 'drag:move', 'drag:end']) {
            drag.on(name, () => events.push(name));
        }

        pointer('pointerdown', { pointerType: 'pen', x: 50, y: 60 });
        pointer('pointermove', { pointerType: 'pen', x: 80, y: 60, button: -1 });
        pointer('pointerup', { pointerType: 'pen', x: 80, y: 60 });

        expect(events).to.deep.equal(['drag:start', 'drag:move', 'drag:end']);
        expect(drag.isDragging).to.equal(false);
        drag.destroy();
    });

    it('fires mouse events and a click for a tap when touch is not used', function () {
        createApp({ useTouch: false });

        pointer('pointerdown', { x: 50, y: 60 });
        pointer('pointerup', { x: 50, y: 60 });

        expect(names()).to.deep.equal(['mousemove', 'mouseenter', 'mousedown', 'mouseup', 'click']);
    });

    describe('in XR sessions', function () {
        let xr;

        beforeEach(function () {
            createApp();

            xr = new FakeXRSystem();
            Object.defineProperty(navigator, 'xr', { value: xr, configurable: true });

            // XR is only supported and available in a browser, and the null graphics device has no
            // XR presentation backend, so provide one that presents nothing
            app.xr._supported = true;
            app.xr._available[XRTYPE_VR] = true;
            app.graphicsDevice.createXrBridgeImpl = () => ({
                attachPresentation: () => {},
                releasePresentation: () => {},
                endFrame: () => {},
                destroy: () => {}
            });

            // the element input listens for XR sessions once XR is supported
            app.elementInput.attachSelectEvents();
        });

        afterEach(async function () {
            restore();

            // end any session a test left running, so its end event fires before teardown
            if (app.xr.active) {
                app.xr.end();
            }
            await Promise.all(xr.sessions.map(session => session.endEventFired));

            delete navigator.xr;
        });

        /**
         * Starts an immersive VR session on the test camera, then ends it.
         *
         * @returns {Promise<void>} Resolves once the end event of the session has fired.
         */
        const runSession = async () => {
            const camera = app.root.findByName('camera');
            await new Promise((resolve) => {
                app.xr.start(camera.camera, XRTYPE_VR, XRSPACE_LOCALFLOOR, { callback: resolve });
            });

            const session = app.xr.session;
            app.xr.end();
            await session.endEventFired;
        };

        it('stops listening for the end of a session once it has ended', async function () {
            const onXrEnd = spy(app.elementInput, '_onXrEnd');

            await runSession();
            await runSession();
            await runSession();

            // once per session, rather than once more for every session before it
            expect(onXrEnd.callCount).to.equal(3);
        });
    });
});
