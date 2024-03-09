import { Mouse } from '../../../src/platform/input/mouse.js';
import {
    EVENT_MOUSEDOWN, EVENT_MOUSEUP,
    MOUSEBUTTON_LEFT, MOUSEBUTTON_MIDDLE, MOUSEBUTTON_RIGHT
} from '../../../src/platform/input/constants.js';

import { expect } from 'chai';

const buttons = [MOUSEBUTTON_LEFT, MOUSEBUTTON_MIDDLE, MOUSEBUTTON_RIGHT];

// Mock the _getTargetCoords method, otherwise it returns null
Mouse.prototype._getTargetCoords = function (event) {
    return { x: 0, y: 0 };
};

describe('Mouse', function () {

    /** @type { Mouse } */
    let mouse;

    beforeEach(function () {
        mouse = new Mouse(document.body);
    });

    afterEach(function () {
        mouse.detach();
    });

    describe('#constructor', function () {

        it('should create a new instance', function () {
            expect(mouse).to.be.an.instanceOf(Mouse);
        });

    });

    describe('#isPressed', function () {

        it('should return false for all buttons by default', function () {
            for (const button of buttons) {
                expect(mouse.isPressed(button)).to.be.false;
            }
        });

        it('should return true for a mouse button that is pressed', function () {
            for (const button of buttons) {
                const mouseDownEvent = new MouseEvent('mousedown', { button });
                window.dispatchEvent(mouseDownEvent);

                expect(mouse.isPressed(button)).to.be.true;

                const mouseUpEvent = new MouseEvent('mouseup', { button });
                window.dispatchEvent(mouseUpEvent);

                expect(mouse.isPressed(button)).to.be.false;
            }
        });

    });

    describe('#on', function () {

        it('should handle mousedown events', function (done) {
            mouse.on(EVENT_MOUSEDOWN, function (event) {
                expect(event.button).to.equal(MOUSEBUTTON_LEFT);
                expect(event.event).to.be.an.instanceOf(MouseEvent);

                done();
            });

            const mouseDownEvent = new MouseEvent('mousedown', { button: 0 });
            window.dispatchEvent(mouseDownEvent);
        });

        it('should handle mouseup events', function (done) {
            mouse.on(EVENT_MOUSEUP, function (event) {
                expect(event.button).to.equal(MOUSEBUTTON_LEFT);
                expect(event.event).to.be.an.instanceOf(MouseEvent);

                done();
            });

            const mouseUpEvent = new MouseEvent('mouseup', { button: 0 });
            window.dispatchEvent(mouseUpEvent);
        });

    });

    describe('#wasPressed', function () {

        it('should return false for all buttons by default', function () {
            for (const button of buttons) {
                expect(mouse.wasPressed(button)).to.be.false;
            }
        });

        it('should return true for a mouse button that was pressed', function () {
            for (const button of buttons) {
                const mouseDownEvent = new MouseEvent('mousedown', { button });
                window.dispatchEvent(mouseDownEvent);

                expect(mouse.wasPressed(button)).to.be.true;

                mouse.update();

                expect(mouse.wasPressed(button)).to.be.false;
            }
        });

    });

    describe('#wasReleased', function () {

        it('should return false for all buttons by default', function () {
            for (const button of buttons) {
                expect(mouse.wasReleased(button)).to.be.false;
            }
        });

        it('should return true for a mouse button that was released', function () {
            for (const button of buttons) {
                const mouseDownEvent = new MouseEvent('mousedown', { button });
                window.dispatchEvent(mouseDownEvent);

                mouse.update();

                const mouseUpEvent = new MouseEvent('mouseup', { button });
                window.dispatchEvent(mouseUpEvent);

                expect(mouse.wasReleased(button)).to.be.true;

                mouse.update();

                expect(mouse.wasReleased(button)).to.be.false;
            }
        });

    });

});
