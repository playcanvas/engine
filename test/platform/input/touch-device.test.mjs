import { expect } from 'chai';
import sinon from 'sinon';

import { TouchDevice } from '../../../src/platform/input/touch-device.js';
import { jsdomSetup, jsdomTeardown } from '../../jsdom.mjs';

/**
 * Creates a DOM event shaped like a touch event, with empty touch lists.
 *
 * @param {string} type - The event type.
 * @param {boolean} cancelable - Whether the event is cancelable.
 * @returns {Event} The event.
 */
const createTouchEvent = (type, cancelable) => {
    const event = new window.Event(type, { cancelable });
    Object.defineProperty(event, 'touches', { value: [] });
    Object.defineProperty(event, 'changedTouches', { value: [] });
    return event;
};

describe('TouchDevice', function () {

    /** @type {HTMLDivElement} */
    let element;

    /** @type {TouchDevice} */
    let touch;

    beforeEach(function () {
        jsdomSetup();
        element = document.createElement('div');
        document.body.appendChild(element);
    });

    afterEach(function () {
        touch?.detach();
        touch = null;
        sinon.restore();
        jsdomTeardown();
    });

    describe('#attach', function () {

        it('sets touch-action to none on the element', function () {
            touch = new TouchDevice(element);
            expect(element.style.touchAction).to.equal('none');
        });

    });

    describe('#detach', function () {

        it('restores the previous inline touch-action', function () {
            element.style.touchAction = 'pan-y';
            touch = new TouchDevice(element);
            touch.detach();
            expect(element.style.touchAction).to.equal('pan-y');
        });

        it('clears touch-action when the element had no inline value', function () {
            touch = new TouchDevice(element);
            touch.detach();
            expect(element.style.touchAction).to.equal('');
        });

        it('restores touch-action of the previous element when attached to another', function () {
            const other = document.createElement('div');
            touch = new TouchDevice(element);
            touch.attach(other);
            expect(element.style.touchAction).to.equal('');
            expect(other.style.touchAction).to.equal('none');
        });

    });

    describe('touchmove', function () {

        it('prevents default on a cancelable touchmove and fires the event', function () {
            touch = new TouchDevice(element);
            const handler = sinon.spy();
            touch.on('touchmove', handler);

            const event = createTouchEvent('touchmove', true);
            element.dispatchEvent(event);

            expect(event.defaultPrevented).to.be.true;
            expect(handler.calledOnce).to.be.true;
        });

        it('does not call preventDefault on a non-cancelable touchmove but still fires the event', function () {
            touch = new TouchDevice(element);
            const handler = sinon.spy();
            touch.on('touchmove', handler);

            const event = createTouchEvent('touchmove', false);
            const preventDefault = sinon.spy(event, 'preventDefault');
            element.dispatchEvent(event);

            expect(preventDefault.called).to.be.false;
            expect(handler.calledOnce).to.be.true;
        });

    });

});
