import { expect } from 'chai';
import { restore, spy } from 'sinon';

import { platform } from '../../../src/core/platform.js';
import { Application } from '../../../src/framework/application.js';
import { Entity } from '../../../src/framework/entity.js';
import {
    ElementInput, ElementMouseEvent, ElementTouchEvent
} from '../../../src/framework/input/element-input.js';
import { XRSPACE_LOCALFLOOR, XRTYPE_VR } from '../../../src/framework/xr/constants.js';
import { createGraphicsDevice } from '../../device.mjs';
import { jsdomSetup, jsdomTeardown } from '../../jsdom.mjs';
import { FakeXRSystem } from '../xr/fake-webxr.mjs';

describe('ElementInput', function () {
    let app;
    let canvas;
    let element;
    let platformTouch;

    beforeEach(function () {
        jsdomSetup();

        // ElementInput only listens for touches on a touch platform, and getTouchTargetCoords
        // needs the HTMLElement global, which jsdomSetup does not copy
        platformTouch = platform.touch;
        platform.touch = true;
        global.HTMLElement = window.HTMLElement;

        // jsdom does no layout, so give the canvas the client size that hit testing scales by
        canvas = document.createElement('canvas');
        canvas.width = 300;
        canvas.height = 400;
        Object.defineProperty(canvas, 'clientWidth', { value: 300 });
        Object.defineProperty(canvas, 'clientHeight', { value: 400 });

        app = new Application(canvas, {
            graphicsDevice: createGraphicsDevice(canvas),
            elementInput: new ElementInput(canvas)
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
    });

    afterEach(function () {
        app.destroy();
        platform.touch = platformTouch;
        delete global.HTMLElement;
        jsdomTeardown();
    });

    it('passes the browser TouchEvent and Touch to touch handlers', function () {
        let received = null;
        element.on('touchstart', (event) => {
            received = event;
        });

        const touch = { identifier: 7, target: canvas, pageX: 50, pageY: 60 };
        const touchEvent = new window.TouchEvent('touchstart', {
            touches: [touch],
            changedTouches: [touch]
        });
        canvas.dispatchEvent(touchEvent);

        expect(received).to.be.an.instanceof(ElementTouchEvent);
        expect(received.event).to.equal(touchEvent);
        expect(received.touches).to.equal(touchEvent.touches);
        expect(received.changedTouches).to.equal(touchEvent.changedTouches);
        expect(received.touch).to.equal(touch);
    });

    it('passes the browser MouseEvent to mouse handlers', function () {
        let received = null;
        element.on('mousedown', (event) => {
            received = event;
        });

        const mouseEvent = new window.MouseEvent('mousedown', { clientX: 50, clientY: 60 });
        window.dispatchEvent(mouseEvent);

        expect(received).to.be.an.instanceof(ElementMouseEvent);
        expect(received.event).to.equal(mouseEvent);
    });

    describe('in XR sessions', function () {
        let xr;

        beforeEach(function () {
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
