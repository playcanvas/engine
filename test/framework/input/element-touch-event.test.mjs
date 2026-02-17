import { expect } from 'chai';

import { Entity } from '../../../src/framework/entity.js';
import { ElementTouchEvent } from '../../../src/framework/input/element-input.js';
import { Touch } from '../../../src/platform/input/touch-event.js';
import { createApp } from '../../app.mjs';
import { jsdomSetup, jsdomTeardown } from '../../jsdom.mjs';

describe('ElementTouchEvent', function () {
    let app;

    beforeEach(function () {
        jsdomSetup();
        app = createApp();
    });

    afterEach(function () {
        app?.destroy();
        app = null;
        jsdomTeardown();
    });

    it('should convert native Touch objects to PlayCanvas Touch objects', function () {
        // Ensure HTMLElement is defined in the global scope for jsdom
        if (typeof global !== 'undefined' && typeof global.HTMLElement === 'undefined') {
            global.HTMLElement = window.HTMLElement;
        }

        const screen = new Entity();
        screen.addComponent('screen');
        app.root.addChild(screen);

        const element = new Entity();
        element.addComponent('element');
        screen.addChild(element);

        const camera = new Entity();
        camera.addComponent('camera');
        app.root.addChild(camera);

        // Create mock target element
        const targetElement = document.createElement('div');
        document.body.appendChild(targetElement);

        // Create a mock native TouchEvent
        const nativeTouchEvent = {
            touches: [{
                identifier: 123,
                pageX: 100,
                pageY: 200,
                target: targetElement
            }],
            changedTouches: [{
                identifier: 456,
                pageX: 150,
                pageY: 250,
                target: targetElement
            }]
        };

        const mockTouch = {
            identifier: 123,
            pageX: 100,
            pageY: 200,
            target: targetElement
        };

        // Create ElementTouchEvent
        const elementTouchEvent = new ElementTouchEvent(
            nativeTouchEvent,
            element.element,
            camera.camera,
            100,
            200,
            mockTouch
        );

        // Verify that touches are converted to PlayCanvas Touch objects
        expect(elementTouchEvent.touches).to.be.an('array');
        expect(elementTouchEvent.touches.length).to.equal(1);
        expect(elementTouchEvent.touches[0]).to.be.instanceof(Touch);
        expect(elementTouchEvent.touches[0].id).to.equal(123);

        // Verify that changedTouches are converted to PlayCanvas Touch objects
        expect(elementTouchEvent.changedTouches).to.be.an('array');
        expect(elementTouchEvent.changedTouches.length).to.equal(1);
        expect(elementTouchEvent.changedTouches[0]).to.be.instanceof(Touch);
        expect(elementTouchEvent.changedTouches[0].id).to.equal(456);

        // Verify that the touch object is the same as passed in
        expect(elementTouchEvent.touch).to.equal(mockTouch);
    });
});
