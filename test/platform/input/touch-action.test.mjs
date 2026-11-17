import { expect } from 'chai';

import { acquireTouchAction, releaseTouchAction } from '../../../src/platform/input/touch-action.js';
import { TouchDevice } from '../../../src/platform/input/touch-device.js';
import { jsdomSetup, jsdomTeardown } from '../../jsdom.mjs';

describe('touch-action', function () {

    /** @type {HTMLDivElement} */
    let element;

    beforeEach(function () {
        jsdomSetup();
        element = document.createElement('div');
        document.body.appendChild(element);
    });

    afterEach(function () {
        jsdomTeardown();
    });

    describe('#acquireTouchAction', function () {

        it('sets touch-action to none', function () {
            acquireTouchAction(element);
            expect(element.style.touchAction).to.equal('none');
            releaseTouchAction(element);
        });

    });

    describe('#releaseTouchAction', function () {

        it('restores the previous inline value once every acquire is released', function () {
            element.style.touchAction = 'pan-x';
            acquireTouchAction(element);
            acquireTouchAction(element);

            releaseTouchAction(element);
            expect(element.style.touchAction).to.equal('none');

            releaseTouchAction(element);
            expect(element.style.touchAction).to.equal('pan-x');
        });

        it('restores an important priority', function () {
            element.style.setProperty('touch-action', 'pan-y', 'important');
            acquireTouchAction(element);
            expect(element.style.touchAction).to.equal('none');

            releaseTouchAction(element);
            expect(element.style.touchAction).to.equal('pan-y');
            expect(element.style.getPropertyPriority('touch-action')).to.equal('important');
        });

        it('ignores a release without an acquire', function () {
            element.style.touchAction = 'pan-x';
            releaseTouchAction(element);
            expect(element.style.touchAction).to.equal('pan-x');
        });

    });

    it('is shared by a touch device and other handlers on the same element', function () {
        const touch = new TouchDevice(element);
        acquireTouchAction(element);

        touch.detach();
        expect(element.style.touchAction).to.equal('none');

        releaseTouchAction(element);
        expect(element.style.touchAction).to.equal('');
    });

});
