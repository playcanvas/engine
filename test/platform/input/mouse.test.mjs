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

describe('Mouse', () => {

    /** @type { Mouse } */
    let mouse;

    beforeEach(() => {
        mouse = new Mouse(document.body);
    });

    afterEach(() => {
        mouse.detach();
    });

    describe('#constructor', () => {

        it('should create a new instance', () => {
            expect(mouse).to.be.an.instanceOf(Mouse);
        });

    });

    describe('#isPressed', () => {

        it('should return false for all buttons by default', () => {
            for (const button of buttons) {
                expect(mouse.isPressed(button)).to.be.false;
            }
        });

        it('should return true for a mouse button that is pressed', () => {
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

    describe('#on', () => {

        it('should handle mousedown events', (done) => {
            mouse.on(EVENT_MOUSEDOWN, (event) => {
                expect(event.button).to.equal(MOUSEBUTTON_LEFT);
                expect(event.event).to.be.an.instanceOf(MouseEvent);

                done();
            });

            const mouseDownEvent = new MouseEvent('mousedown', { button: 0 });
            window.dispatchEvent(mouseDownEvent);
        });

        it('should handle mouseup events', (done) => {
            mouse.on(EVENT_MOUSEUP, (event) => {
                expect(event.button).to.equal(MOUSEBUTTON_LEFT);
                expect(event.event).to.be.an.instanceOf(MouseEvent);

                done();
            });

            const mouseUpEvent = new MouseEvent('mouseup', { button: 0 });
            window.dispatchEvent(mouseUpEvent);
        });

    });

    describe('#wasPressed', () => {

        it('should return false for all buttons by default', () => {
            for (const button of buttons) {
                expect(mouse.wasPressed(button)).to.be.false;
            }
        });

        it('should return true for a mouse button that was pressed', () => {
            for (const button of buttons) {
                const mouseDownEvent = new MouseEvent('mousedown', { button });
                window.dispatchEvent(mouseDownEvent);

                expect(mouse.wasPressed(button)).to.be.true;

                mouse.update();

                expect(mouse.wasPressed(button)).to.be.false;
            }
        });

    });

    describe('#wasReleased', () => {

        it('should return false for all buttons by default', () => {
            for (const button of buttons) {
                expect(mouse.wasReleased(button)).to.be.false;
            }
        });

        it('should return true for a mouse button that was released', () => {
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
