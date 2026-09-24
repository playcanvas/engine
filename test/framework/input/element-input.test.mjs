import { expect } from 'chai';

import { platform } from '../../../src/core/platform.js';
import { Application } from '../../../src/framework/application.js';
import { Entity } from '../../../src/framework/entity.js';
import { ElementInput } from '../../../src/framework/input/element-input.js';
import { createGraphicsDevice } from '../../device.mjs';
import { jsdomSetup, jsdomTeardown } from '../../jsdom.mjs';

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

    // dispatches a browser TouchEvent for one touch at a page position on the canvas
    const dispatchTouch = (type, pageX, pageY) => {
        const touch = { identifier: 7, target: canvas, pageX, pageY };
        const lifted = type === 'touchend' || type === 'touchcancel';
        canvas.dispatchEvent(new window.TouchEvent(type, {
            touches: lifted ? [] : [touch],
            changedTouches: [touch]
        }));
    };

    // records the name and position of each of the given events the element receives
    const recordEvents = (names) => {
        const events = [];
        for (const name of names) {
            element.on(name, event => events.push([name, event.x, event.y]));
        }
        return events;
    };

    describe('touch positions', function () {
        it('reports where the touch was released on touchend and click', function () {
            const events = recordEvents(['touchstart', 'touchmove', 'touchend', 'click']);

            dispatchTouch('touchstart', 50, 60);
            dispatchTouch('touchmove', 70, 80);
            dispatchTouch('touchend', 90, 100);

            expect(events).to.deep.equal([
                ['touchstart', 50, 60],
                ['touchmove', 70, 80],
                ['click', 90, 100],
                ['touchend', 90, 100]
            ]);
        });

        it('reports a release outside the element on touchend, without a click', function () {
            const events = recordEvents(['touchstart', 'touchend', 'click']);

            // the touch started on the element, so touchend still fires on it
            dispatchTouch('touchstart', 50, 60);
            dispatchTouch('touchend', 350, 100);

            expect(events).to.deep.equal([
                ['touchstart', 50, 60],
                ['touchend', 350, 100]
            ]);
        });

        it('reports the last touch position on touchcancel', function () {
            const events = recordEvents(['touchstart', 'touchcancel']);

            dispatchTouch('touchstart', 50, 60);
            dispatchTouch('touchcancel', 90, 100);

            expect(events).to.deep.equal([
                ['touchstart', 50, 60],
                ['touchcancel', 90, 100]
            ]);
        });
    });
});
