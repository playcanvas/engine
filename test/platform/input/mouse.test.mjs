import { expect } from 'chai';
import sinon from 'sinon';

import { MOUSEBUTTON_LEFT, MOUSEBUTTON_MIDDLE, MOUSEBUTTON_RIGHT } from '../../../src/platform/input/constants.js';
import { Mouse } from '../../../src/platform/input/mouse.js';
import { jsdomSetup, jsdomTeardown } from '../../jsdom.mjs';

const buttons = [MOUSEBUTTON_LEFT, MOUSEBUTTON_MIDDLE, MOUSEBUTTON_RIGHT];

describe('Mouse', function () {

    /** @type { Mouse } */
    let mouse;

    beforeEach(function () {
        jsdomSetup();
        mouse = new Mouse(document.body);
        sinon.stub(mouse, '_getTargetCoords').returns({ x: 0, y: 0 });
    });

    afterEach(function () {
        mouse.detach();
        sinon.restore();
        jsdomTeardown();
    });

    describe('#constructor', function () {

        it('should create a new instance', function () {
            expect(mouse).to.be.an.instanceOf(Mouse);
        });

    });

    describe('#detach', function () {

        ['pressed', 'held', 'released'].forEach((state) => {
            it(`should clear all button states when detached with ${state} buttons`, function () {
                for (const button of buttons) {
                    window.dispatchEvent(new MouseEvent('mousedown', { button }));
                }
                if (state !== 'pressed') {
                    mouse.update();
                }
                if (state === 'released') {
                    for (const button of buttons) {
                        window.dispatchEvent(new MouseEvent('mouseup', { button }));
                    }
                }

                mouse.detach();

                for (const button of buttons) {
                    expect(mouse.isPressed(button)).to.be.false;
                    expect(mouse.wasPressed(button)).to.be.false;
                    expect(mouse.wasReleased(button)).to.be.false;
                }
            });
        });

        it('should detect fresh presses after buttons are released while detached', function () {
            for (const button of buttons) {
                window.dispatchEvent(new MouseEvent('mousedown', { button }));
            }
            mouse.update();
            let releases = 0;
            mouse.on('mouseup', () => releases++);

            mouse.detach();
            for (const button of buttons) {
                window.dispatchEvent(new MouseEvent('mouseup', { button }));
            }
            mouse.attach(document.body);

            expect(releases).to.equal(0);
            for (const button of buttons) {
                expect(mouse.isPressed(button)).to.be.false;
                expect(mouse.wasPressed(button)).to.be.false;
                expect(mouse.wasReleased(button)).to.be.false;

                window.dispatchEvent(new MouseEvent('mousedown', { button }));
                expect(mouse.isPressed(button)).to.be.true;
                expect(mouse.wasPressed(button)).to.be.true;
            }
            mouse.update();
            for (const button of buttons) {
                window.dispatchEvent(new MouseEvent('mouseup', { button }));
                expect(mouse.wasReleased(button)).to.be.true;
            }
            expect(releases).to.equal(buttons.length);
        });

    });

    describe('focus loss', function () {

        ['blur', 'hidden'].forEach((event) => {
            it(`should reset button states without firing mouseup on ${event}`, function () {
                // Cover a pending press, a held button and a pending release together.
                window.dispatchEvent(new MouseEvent('mousedown', { button: MOUSEBUTTON_MIDDLE }));
                window.dispatchEvent(new MouseEvent('mousedown', { button: MOUSEBUTTON_RIGHT }));
                mouse.update();
                window.dispatchEvent(new MouseEvent('mousedown', { button: MOUSEBUTTON_LEFT }));
                window.dispatchEvent(new MouseEvent('mouseup', { button: MOUSEBUTTON_RIGHT }));
                const onMouseUp = sinon.spy();
                mouse.on('mouseup', onMouseUp);

                if (event === 'blur') {
                    window.dispatchEvent(new window.Event('blur'));
                } else {
                    sinon.stub(document, 'visibilityState').get(() => 'hidden');
                    document.dispatchEvent(new window.Event('visibilitychange'));
                }

                expect(onMouseUp.called).to.be.false;
                for (const button of buttons) {
                    expect(mouse.isPressed(button)).to.be.false;
                    expect(mouse.wasPressed(button)).to.be.false;
                    expect(mouse.wasReleased(button)).to.be.false;
                }

                window.dispatchEvent(new MouseEvent('mousedown', { button: MOUSEBUTTON_MIDDLE }));
                expect(mouse.wasPressed(MOUSEBUTTON_MIDDLE)).to.be.true;
                mouse.update();
                window.dispatchEvent(new MouseEvent('mouseup', { button: MOUSEBUTTON_MIDDLE }));
                expect(mouse.wasReleased(MOUSEBUTTON_MIDDLE)).to.be.true;
                expect(onMouseUp.calledOnce).to.be.true;
            });
        });

        it('should preserve button states when the document becomes visible', function () {
            window.dispatchEvent(new MouseEvent('mousedown', { button: MOUSEBUTTON_LEFT }));
            mouse.update();
            sinon.stub(document, 'visibilityState').get(() => 'visible');

            document.dispatchEvent(new window.Event('visibilitychange'));

            expect(mouse.isPressed(MOUSEBUTTON_LEFT)).to.be.true;
            expect(mouse.wasPressed(MOUSEBUTTON_LEFT)).to.be.false;
            expect(mouse.wasReleased(MOUSEBUTTON_LEFT)).to.be.false;
        });

        it('should remove focus listeners on detach and restore them on reattachment', function () {
            mouse.detach();
            const windowAdd = sinon.spy(window, 'addEventListener');
            const documentAdd = sinon.spy(document, 'addEventListener');
            const windowRemove = sinon.spy(window, 'removeEventListener');
            const documentRemove = sinon.spy(document, 'removeEventListener');
            mouse.attach(document.body);
            const blurListener = windowAdd.getCalls().find(call => call.args[0] === 'blur')?.args[1];
            const visibilityListener = documentAdd.getCalls().find(call => call.args[0] === 'visibilitychange')?.args[1];
            expect(blurListener).to.be.a('function');
            expect(visibilityListener).to.be.a('function');

            mouse.detach();

            expect(windowRemove.calledWith('blur', blurListener)).to.be.true;
            expect(documentRemove.calledWith('visibilitychange', visibilityListener)).to.be.true;

            mouse.attach(document.body);
            window.dispatchEvent(new MouseEvent('mousedown', { button: MOUSEBUTTON_LEFT }));
            window.dispatchEvent(new window.Event('blur'));
            expect(mouse.isPressed(MOUSEBUTTON_LEFT)).to.be.false;
        });

    });

    describe('#attach', function () {

        it('should preserve button states when attaching to another element', function () {
            window.dispatchEvent(new MouseEvent('mousedown', { button: MOUSEBUTTON_LEFT }));
            mouse.update();

            mouse.attach(document.createElement('div'));

            expect(mouse.isPressed(MOUSEBUTTON_LEFT)).to.be.true;
            expect(mouse.wasPressed(MOUSEBUTTON_LEFT)).to.be.false;
            expect(mouse.wasReleased(MOUSEBUTTON_LEFT)).to.be.false;
            window.dispatchEvent(new MouseEvent('mouseup', { button: MOUSEBUTTON_LEFT }));
            expect(mouse.wasReleased(MOUSEBUTTON_LEFT)).to.be.true;
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

        it('should handle mousedown events', (done) => {
            mouse.on('mousedown', (event) => {
                expect(event.button).to.equal(MOUSEBUTTON_LEFT);
                expect(event.event).to.be.an.instanceOf(MouseEvent);

                done();
            });

            const mouseDownEvent = new MouseEvent('mousedown', { button: 0 });
            window.dispatchEvent(mouseDownEvent);
        });

        it('should handle mouseup events', (done) => {
            mouse.on('mouseup', (event) => {
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
