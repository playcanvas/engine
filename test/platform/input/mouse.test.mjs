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

    describe('per-tick totals and pointer mode', function () {

        /** @type {HTMLCanvasElement} */
        let canvas;

        const makeCanvas = () => {
            const el = document.createElement('canvas');
            document.body.appendChild(el);
            el.getBoundingClientRect = () => ({ left: 0, top: 0, width: 100, height: 100 });
            Object.defineProperty(el, 'clientWidth', { value: 100 });
            Object.defineProperty(el, 'clientHeight', { value: 100 });
            el.setPointerCapture = sinon.stub();
            el.releasePointerCapture = sinon.stub();
            return el;
        };

        const dispatchMouse = (type, x, y) => {
            window.dispatchEvent(new MouseEvent(type, { clientX: x, clientY: y }));
        };

        const dispatchWheel = (deltaY) => {
            window.dispatchEvent(new window.WheelEvent('wheel', { deltaY }));
        };

        // jsdom has no PointerEvent
        const pointer = (type, props = {}, target = canvas) => {
            const event = new window.Event(type, { bubbles: true, cancelable: true });
            Object.assign(event, {
                pointerId: 1,
                pointerType: 'mouse',
                button: MOUSEBUTTON_LEFT,
                clientX: 50,
                clientY: 50,
                screenX: 50,
                screenY: 50
            }, props);
            target.dispatchEvent(event);
            return event;
        };

        beforeEach(function () {
            mouse.detach();
            canvas = makeCanvas();
        });

        describe('default mode', function () {

            beforeEach(function () {
                mouse = new Mouse(canvas);
            });

            it('sums movement until update()', function () {
                dispatchMouse('mousemove', 10, 10);
                dispatchMouse('mousemove', 13, 14);
                dispatchMouse('mousemove', 15, 15);
                expect(mouse.movement).to.deep.equal([5, 5]);
                mouse.update();
                expect(mouse.movement).to.deep.equal([0, 0]);
            });

            it('sums raw wheel deltaY until update()', function () {
                dispatchWheel(120);
                dispatchWheel(-40);
                expect(mouse.wheel).to.equal(80);
                mouse.update();
                expect(mouse.wheel).to.equal(0);
            });

            it('is not in pointer mode and ignores pointer events', function () {
                const down = sinon.spy();
                mouse.on('mousedown', down);
                pointer('pointerdown');
                expect(mouse.pointer).to.equal(false);
                expect(down.callCount).to.equal(0);
            });

        });

        describe('pointer mode', function () {

            beforeEach(function () {
                mouse = new Mouse(canvas, { pointer: true });
            });

            it('ignores window mouse events', function () {
                dispatchMouse('mousedown', 10, 10);
                expect(mouse.pointer).to.equal(true);
                expect(mouse.isPressed(MOUSEBUTTON_LEFT)).to.equal(false);
            });

            it('ignores touch and pen in pointer mode', function () {
                const down = sinon.spy();
                mouse.on('mousedown', down);
                pointer('pointerdown', { pointerType: 'touch' });
                pointer('pointerdown', { pointerType: 'pen' });
                expect(down.callCount).to.equal(0);
                expect(mouse.isPressed(MOUSEBUTTON_LEFT)).to.equal(false);
            });

            it('ignores events targeting other elements', function () {
                const overlay = document.createElement('div');
                canvas.appendChild(overlay);
                const down = sinon.spy();
                mouse.on('mousedown', down);
                pointer('pointerdown', {}, overlay);
                expect(down.callCount).to.equal(0);
                expect(canvas.setPointerCapture.called).to.equal(false);
            });

            it('captures the pointer and fires mousedown with the button', function () {
                const down = sinon.spy();
                mouse.on('mousedown', down);
                pointer('pointerdown', { button: MOUSEBUTTON_RIGHT });
                expect(canvas.setPointerCapture.calledOnceWith(1)).to.equal(true);
                expect(down.calledOnce).to.equal(true);
                expect(down.firstCall.args[0].button).to.equal(MOUSEBUTTON_RIGHT);
                expect(mouse.isPressed(MOUSEBUTTON_RIGHT)).to.equal(true);
            });

            it('releases capture and fires mouseup', function () {
                const up = sinon.spy();
                mouse.on('mouseup', up);
                pointer('pointerdown');
                pointer('pointerup');
                expect(canvas.releasePointerCapture.calledOnceWith(1)).to.equal(true);
                expect(up.firstCall.args[0].button).to.equal(MOUSEBUTTON_LEFT);
                expect(mouse.isPressed(MOUSEBUTTON_LEFT)).to.equal(false);
            });

            it('fires mouseup for a drag released outside the element', function () {
                const up = sinon.spy();
                mouse.on('mouseup', up);
                pointer('pointerdown');
                pointer('pointerup', { clientX: 150, clientY: 50 });
                expect(up.calledOnce).to.equal(true);
                expect(up.firstCall.args[0].button).to.equal(MOUSEBUTTON_LEFT);
                expect(mouse.isPressed(MOUSEBUTTON_LEFT)).to.equal(false);
            });

            it('keeps counting moves outside the element while captured', function () {
                pointer('pointerdown');
                pointer('pointermove', { clientX: 150, clientY: 50 });
                expect(mouse.movement).to.deep.equal([100, 0]);
            });

            it('drops moves outside the element when not captured', function () {
                pointer('pointermove', { clientX: 150, clientY: 50 });
                expect(mouse.movement).to.deep.equal([0, 0]);
            });

            it('sums movement and wheel until update()', function () {
                pointer('pointermove', { clientX: 10, clientY: 10 });
                pointer('pointermove', { clientX: 13, clientY: 14 });
                const wheel = new window.Event('wheel', { cancelable: true });
                wheel.deltaY = 120;
                canvas.dispatchEvent(wheel);
                expect(mouse.movement).to.deep.equal([3, 4]);
                expect(mouse.wheel).to.equal(120);
                mouse.update();
                expect(mouse.movement).to.deep.equal([0, 0]);
                expect(mouse.wheel).to.equal(0);
            });

            it('prevents default on wheel and contextmenu', function () {
                const wheel = new window.Event('wheel', { cancelable: true });
                wheel.deltaY = 1;
                canvas.dispatchEvent(wheel);
                expect(wheel.defaultPrevented).to.equal(true);
                expect(pointer('contextmenu').defaultPrevented).to.equal(true);
            });

            it('keeps preventing contextmenu after enableContextMenu', function () {
                mouse.enableContextMenu();
                expect(pointer('contextmenu').defaultPrevented).to.equal(true);
            });

            it('clears buttons on lostpointercapture in pointer mode', function () {
                pointer('pointerdown');
                pointer('lostpointercapture');
                expect(mouse.isPressed(MOUSEBUTTON_LEFT)).to.equal(false);
                pointer('pointermove', { clientX: 90, clientY: 90 });
                expect(mouse.movement).to.deep.equal([0, 0]);
            });

            it('moves element listeners when attached to another element', function () {
                const other = makeCanvas();
                mouse.attach(other);
                pointer('pointerdown');
                expect(mouse.isPressed(MOUSEBUTTON_LEFT)).to.equal(false);
                pointer('pointerdown', {}, other);
                expect(mouse.isPressed(MOUSEBUTTON_LEFT)).to.equal(true);
            });

            it('removes element listeners on detach', function () {
                const down = sinon.spy();
                mouse.on('mousedown', down);
                mouse.detach();
                pointer('pointerdown');
                expect(down.callCount).to.equal(0);
            });

            it('records a press without capturing while the pointer is locked', function () {
                Object.defineProperty(document, 'pointerLockElement', { configurable: true, value: canvas });

                // browsers throw InvalidStateError on capture under pointer lock
                canvas.setPointerCapture = sinon.stub().throws(new window.DOMException('locked', 'InvalidStateError'));
                const errors = sinon.spy();
                window.addEventListener('error', errors);
                const down = sinon.spy();
                const up = sinon.spy();
                mouse.on('mousedown', down);
                mouse.on('mouseup', up);
                pointer('pointerdown', { buttons: 1 });
                expect(errors.callCount).to.equal(0);
                expect(canvas.setPointerCapture.called).to.equal(false);
                expect(down.calledOnce).to.equal(true);
                expect(mouse.isPressed(MOUSEBUTTON_LEFT)).to.equal(true);
                pointer('pointerup', { buttons: 0 });
                window.removeEventListener('error', errors);
                expect(errors.callCount).to.equal(0);
                expect(canvas.releasePointerCapture.called).to.equal(false);
                expect(up.calledOnce).to.equal(true);
                expect(mouse.isPressed(MOUSEBUTTON_LEFT)).to.equal(false);
            });

            it('tracks buttons pressed and released mid-chord', function () {
                const down = sinon.spy();
                const up = sinon.spy();
                mouse.on('mousedown', down);
                mouse.on('mouseup', up);
                pointer('pointerdown', { button: MOUSEBUTTON_LEFT, buttons: 1 });

                // chorded changes arrive as pointermove with the changed button
                pointer('pointermove', { button: MOUSEBUTTON_RIGHT, buttons: 3 });
                expect(mouse.isPressed(MOUSEBUTTON_RIGHT)).to.equal(true);
                expect(down.callCount).to.equal(2);
                expect(down.secondCall.args[0].button).to.equal(MOUSEBUTTON_RIGHT);
                pointer('pointermove', { button: MOUSEBUTTON_MIDDLE, buttons: 7 });
                expect(mouse.isPressed(MOUSEBUTTON_MIDDLE)).to.equal(true);
                pointer('pointermove', { button: MOUSEBUTTON_RIGHT, buttons: 5 });
                expect(mouse.isPressed(MOUSEBUTTON_RIGHT)).to.equal(false);
                expect(mouse.isPressed(MOUSEBUTTON_LEFT)).to.equal(true);
                expect(up.firstCall.args[0].button).to.equal(MOUSEBUTTON_RIGHT);
                pointer('pointermove', { button: MOUSEBUTTON_LEFT, buttons: 4 });
                expect(mouse.isPressed(MOUSEBUTTON_LEFT)).to.equal(false);
                pointer('pointerup', { button: MOUSEBUTTON_MIDDLE, buttons: 0 });
                expect(mouse.isPressed(MOUSEBUTTON_MIDDLE)).to.equal(false);
                expect(down.callCount).to.equal(3);
                expect(up.callCount).to.equal(3);
            });

            it('clears buttons and capture when attached to another element', function () {
                const other = makeCanvas();
                pointer('pointerdown');
                mouse.attach(other);
                expect(mouse.isPressed(MOUSEBUTTON_LEFT)).to.equal(false);

                // no capture carried over, so moves outside the new element are dropped
                pointer('pointermove', { clientX: 150, clientY: 50 }, other);
                expect(mouse.movement).to.deep.equal([0, 0]);
            });

        });

    });

});
