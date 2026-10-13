import { expect } from 'chai';

import { MultiTouchSource } from '../../../../src/extras/input/sources/multi-touch-source.js';
import { jsdomSetup, jsdomTeardown } from '../../../jsdom.mjs';

describe('MultiTouchSource', function () {

    let element;
    let source;

    // dispatches a touch pointer event on the element; jsdom has no PointerEvent, so its fields go
    // on a plain event
    const pointer = (type, pointerId, x = 0, y = 0) => {
        const event = new window.Event(type, { bubbles: true, cancelable: true });
        Object.assign(event, { pointerId, pointerType: 'touch', clientX: x, clientY: y, screenX: x, screenY: y });
        element.dispatchEvent(event);
    };

    beforeEach(function () {
        jsdomSetup();
        element = document.createElement('div');
        element.setPointerCapture = () => {};
        element.releasePointerCapture = () => {};
        source = new MultiTouchSource();
        source.attach(element);
    });

    afterEach(function () {
        source.detach();
        jsdomTeardown();
    });

    it('ends touches that leave the element with neither an up nor a cancel', function () {
        // as the two touches of a two-handed pinch in Safari on Apple Vision Pro do
        pointer('pointerdown', 1, 0, 0);
        pointer('pointerdown', 2, 100, 0);
        pointer('pointerleave', 1);
        pointer('pointerleave', 2);
        expect(source.read().count).to.deep.equal([0]);

        // so a later one-finger drag moves as one touch
        pointer('pointerdown', 3, 0, 0);
        pointer('pointermove', 3, 10, 5);
        const { touch, count, pinch } = source.read();
        expect(count).to.deep.equal([1]);
        expect(touch).to.deep.equal([10, 5]);
        expect(pinch).to.deep.equal([0]);
    });

    it('ends a touch once whatever ends it', function () {
        pointer('pointerdown', 1);
        pointer('pointerup', 1);
        pointer('pointerleave', 1);
        pointer('pointercancel', 1);
        expect(source.read().count).to.deep.equal([0]);
    });
});
