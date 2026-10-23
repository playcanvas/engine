import { expect } from 'chai';
import sinon from 'sinon';

import { platform } from '../../../src/core/platform.js';
import { MOUSEBUTTON_LEFT, MOUSEBUTTON_MIDDLE, MOUSEBUTTON_NONE, MOUSEBUTTON_RIGHT } from '../../../src/platform/input/constants.js';
import { Mouse } from '../../../src/platform/input/mouse.js';
import { jsdomSetup, jsdomTeardown } from '../../jsdom.mjs';

const buttons = [MOUSEBUTTON_LEFT, MOUSEBUTTON_MIDDLE, MOUSEBUTTON_RIGHT];

// jsdom has no PointerEvent. Moves have no button unless a chord changes
const dispatch = (target, type, { timeStamp, ...props } = {}) => {
    const event = new window.Event(type, { bubbles: true, cancelable: true });

    // timeStamp is a read-only getter
    if (timeStamp !== undefined) Object.defineProperty(event, 'timeStamp', { value: timeStamp });
    Object.assign(event, {
        pointerId: 1,
        pointerType: 'mouse',
        isPrimary: true,
        button: type === 'pointermove' ? -1 : MOUSEBUTTON_LEFT,
        clientX: 50,
        clientY: 50,
        screenX: 50,
        screenY: 50
    }, props);
    target.dispatchEvent(event);
    return event;
};

const win = (type, props) => dispatch(window, type, props);

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
                    win('pointerdown', { button });
                }
                if (state !== 'pressed') {
                    mouse.update();
                }
                if (state === 'released') {
                    for (const button of buttons) {
                        win('pointerup', { button });
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
                win('pointerdown', { button });
            }
            mouse.update();
            let releases = 0;
            mouse.on('mouseup', () => releases++);

            mouse.detach();
            for (const button of buttons) {
                win('pointerup', { button });
            }
            mouse.attach(document.body);

            expect(releases).to.equal(0);
            for (const button of buttons) {
                expect(mouse.isPressed(button)).to.be.false;
                expect(mouse.wasPressed(button)).to.be.false;
                expect(mouse.wasReleased(button)).to.be.false;

                win('pointerdown', { button });
                expect(mouse.isPressed(button)).to.be.true;
                expect(mouse.wasPressed(button)).to.be.true;
            }
            mouse.update();
            for (const button of buttons) {
                win('pointerup', { button });
                expect(mouse.wasReleased(button)).to.be.true;
            }
            expect(releases).to.equal(buttons.length);
        });

    });

    describe('focus loss', function () {

        ['blur', 'hidden'].forEach((event) => {
            it(`should reset button states without firing mouseup on ${event}`, function () {
                // Cover a pending press, a held button and a pending release together.
                win('pointerdown', { button: MOUSEBUTTON_MIDDLE });
                win('pointerdown', { button: MOUSEBUTTON_RIGHT });
                mouse.update();
                win('pointerdown', { button: MOUSEBUTTON_LEFT });
                win('pointerup', { button: MOUSEBUTTON_RIGHT });
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

                win('pointerdown', { button: MOUSEBUTTON_MIDDLE });
                expect(mouse.wasPressed(MOUSEBUTTON_MIDDLE)).to.be.true;
                mouse.update();
                win('pointerup', { button: MOUSEBUTTON_MIDDLE });
                expect(mouse.wasReleased(MOUSEBUTTON_MIDDLE)).to.be.true;
                expect(onMouseUp.calledOnce).to.be.true;
            });
        });

        it('should preserve button states when the document becomes visible', function () {
            win('pointerdown', { button: MOUSEBUTTON_LEFT });
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
            win('pointerdown', { button: MOUSEBUTTON_LEFT });
            window.dispatchEvent(new window.Event('blur'));
            expect(mouse.isPressed(MOUSEBUTTON_LEFT)).to.be.false;
        });

    });

    describe('#attach', function () {

        it('should preserve button states when attaching to another element', function () {
            win('pointerdown', { button: MOUSEBUTTON_LEFT });
            mouse.update();

            mouse.attach(document.createElement('div'));

            expect(mouse.isPressed(MOUSEBUTTON_LEFT)).to.be.true;
            expect(mouse.wasPressed(MOUSEBUTTON_LEFT)).to.be.false;
            expect(mouse.wasReleased(MOUSEBUTTON_LEFT)).to.be.false;
            win('pointerup', { button: MOUSEBUTTON_LEFT });
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
                win('pointerdown', { button });

                expect(mouse.isPressed(button)).to.be.true;

                win('pointerup', { button });

                expect(mouse.isPressed(button)).to.be.false;
            }
        });

    });

    describe('#on', function () {

        it('should handle mousedown events', (done) => {
            mouse.on('mousedown', (event) => {
                expect(event.button).to.equal(MOUSEBUTTON_LEFT);
                expect(event.event.type).to.equal('pointerdown');

                done();
            });

            win('pointerdown', { button: 0 });
        });

        it('should handle mouseup events', (done) => {
            mouse.on('mouseup', (event) => {
                expect(event.button).to.equal(MOUSEBUTTON_LEFT);
                expect(event.event.type).to.equal('pointerup');

                done();
            });

            win('pointerdown', { button: 0 });
            win('pointerup', { button: 0 });
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
                win('pointerdown', { button });

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
                win('pointerdown', { button });

                mouse.update();

                win('pointerup', { button });

                expect(mouse.wasReleased(button)).to.be.true;

                mouse.update();

                expect(mouse.wasReleased(button)).to.be.false;
            }
        });

    });

    describe('per-tick totals, default and capture mode', function () {

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

        const dispatchWheel = (deltaY) => {
            window.dispatchEvent(new window.WheelEvent('wheel', { deltaY, cancelable: true }));
        };

        const pointer = (type, props, target = canvas) => dispatch(target, type, props);

        const record = (log) => {
            const m = mouse;
            for (const name of ['mousemove', 'mousedown', 'mouseup']) {
                m.on(name, e => log.push({ name, button: e.button, x: e.x, y: e.y, held: m.isPressed(MOUSEBUTTON_LEFT) }));
            }
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
                win('pointermove', { clientX: 10, clientY: 10 });
                win('pointermove', { clientX: 13, clientY: 14 });
                win('pointermove', { clientX: 15, clientY: 15 });
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

            it('is not in capture mode', function () {
                expect(mouse.capture).to.equal(false);
            });

            it('ignores DOM mouse events', function () {
                const log = [];
                record(log);
                window.dispatchEvent(new window.MouseEvent('mousemove', { clientX: 10, clientY: 10 }));
                window.dispatchEvent(new window.MouseEvent('mousedown', { button: MOUSEBUTTON_LEFT, clientX: 10, clientY: 10 }));
                expect(mouse.isPressed(MOUSEBUTTON_LEFT)).to.equal(false);
                window.dispatchEvent(new window.MouseEvent('mouseup', { button: MOUSEBUTTON_LEFT, clientX: 10, clientY: 10 }));
                expect(log).to.deep.equal([]);
            });

            it('handles mouse pointers bubbling from any element, filtered by the target rect', function () {
                const overlay = document.createElement('div');
                document.body.appendChild(overlay);
                const down = sinon.spy();
                mouse.on('mousedown', down);

                pointer('pointerdown', { clientX: 10, clientY: 20 }, overlay);
                expect(down.calledOnce).to.equal(true);
                expect(down.firstCall.args[0]).to.include({ x: 10, y: 20, element: overlay });
                win('pointerup');

                // outside the target the press is recorded without firing
                pointer('pointerdown', { clientX: 150, clientY: 50 }, overlay);
                expect(down.calledOnce).to.equal(true);
                expect(mouse.isPressed(MOUSEBUTTON_LEFT)).to.equal(true);
                expect(canvas.setPointerCapture.called).to.equal(false);
            });

            it('tracks buttons pressed and released mid-chord, without moves', function () {
                const log = [];
                record(log);
                const sequence = () => log.map(e => `${e.name}${e.button}`);
                win('pointerdown', { button: MOUSEBUTTON_LEFT, buttons: 1 });

                // chorded changes arrive as pointermove with the changed button
                win('pointermove', { button: MOUSEBUTTON_RIGHT, buttons: 3 });
                expect(mouse.isPressed(MOUSEBUTTON_RIGHT)).to.equal(true);
                win('pointermove', { button: MOUSEBUTTON_LEFT, buttons: 2 });
                expect(mouse.isPressed(MOUSEBUTTON_LEFT)).to.equal(false);
                win('pointerup', { button: MOUSEBUTTON_RIGHT, buttons: 0 });
                expect(mouse.isPressed(MOUSEBUTTON_RIGHT)).to.equal(false);
                expect(sequence()).to.deep.equal(['mousedown0', 'mousedown2', 'mouseup0', 'mouseup2']);

                // left down, right down, right up, left up
                log.length = 0;
                win('pointerdown', { button: MOUSEBUTTON_LEFT, buttons: 1 });
                win('pointermove', { button: MOUSEBUTTON_RIGHT, buttons: 3 });
                win('pointermove', { button: MOUSEBUTTON_RIGHT, buttons: 1 });
                win('pointerup', { button: MOUSEBUTTON_LEFT, buttons: 0 });
                expect(sequence()).to.deep.equal(['mousedown0', 'mousedown2', 'mouseup2', 'mouseup0']);
            });

            it('does not press a button whose pointerdown an earlier window listener stopped', function () {
                // stands in for ElementInput, attached first, whose element mousedown handler stops propagation
                mouse.detach();
                const shield = e => e.stopImmediatePropagation();
                window.addEventListener('pointerdown', shield);
                mouse = new Mouse(canvas);
                const log = [];
                record(log);

                win('pointerdown', { buttons: 1, clientX: 10, clientY: 10 });
                win('pointermove', { buttons: 1, clientX: 12, clientY: 10 });
                expect(mouse.isPressed(MOUSEBUTTON_LEFT)).to.equal(false);
                win('pointerup', { buttons: 0, clientX: 12, clientY: 10 });
                window.removeEventListener('pointerdown', shield);

                expect(log.map(e => e.name)).to.deep.equal(['mousemove']);
                expect(mouse.isPressed(MOUSEBUTTON_LEFT)).to.equal(false);
            });

            it('releases a held button whose bit a plain move no longer has', function () {
                const log = [];
                record(log);
                win('pointerdown', { buttons: 1 });

                // the pointerup was swallowed
                win('pointermove', { buttons: 0, clientX: 12, clientY: 10 });
                expect(mouse.isPressed(MOUSEBUTTON_LEFT)).to.equal(false);
                win('pointerup', { buttons: 0, clientX: 12, clientY: 10 });
                expect(log.map(e => `${e.name}${e.button}`)).to.deep.equal(['mousedown0', 'mouseup0', 'mousemove-1']);
            });

            it('ignores pointercancel for mouse pointers', function () {
                win('pointerdown', { buttons: 1 });
                win('pointercancel');
                expect(mouse.isPressed(MOUSEBUTTON_LEFT)).to.equal(true);
            });

            it('does not prevent default on wheel or contextmenu', function () {
                const wheel = new window.WheelEvent('wheel', { deltaY: 1, cancelable: true });
                canvas.dispatchEvent(wheel);
                expect(wheel.defaultPrevented).to.equal(false);
                expect(pointer('contextmenu').defaultPrevented).to.equal(false);
                mouse.disableContextMenu();
                expect(pointer('contextmenu').defaultPrevented).to.equal(true);
                mouse.enableContextMenu();
                expect(pointer('contextmenu').defaultPrevented).to.equal(false);
            });

            it('removes window listeners on detach', function () {
                const down = sinon.spy();
                mouse.on('mousedown', down);
                mouse.detach();
                win('pointerdown');
                expect(down.callCount).to.equal(0);
                expect(mouse.isPressed(MOUSEBUTTON_LEFT)).to.equal(false);
            });

            describe('taps', function () {

                const touch = (type, props) => pointer(type, { pointerType: 'touch', ...props });

                it('fires mousemove, mousedown and mouseup with the left button for a touch tap', function () {
                    const log = [];
                    record(log);
                    touch('pointerdown', { clientX: 20, clientY: 30 });
                    touch('pointermove', { clientX: 23, clientY: 34 });
                    expect(log).to.deep.equal([]);
                    expect(mouse.isPressed(MOUSEBUTTON_LEFT)).to.equal(false);

                    touch('pointerup', { clientX: 23, clientY: 34 });
                    expect(log).to.deep.equal([
                        { name: 'mousemove', button: MOUSEBUTTON_NONE, x: 23, y: 34, held: false },
                        { name: 'mousedown', button: MOUSEBUTTON_LEFT, x: 23, y: 34, held: true },
                        { name: 'mouseup', button: MOUSEBUTTON_LEFT, x: 23, y: 34, held: false }
                    ]);
                    expect(mouse.isPressed(MOUSEBUTTON_LEFT)).to.equal(false);
                });

                it('emulates a pen tap with the left button on platforms with touch support', function () {
                    sinon.stub(platform, 'touch').value(true);
                    const log = [];
                    record(log);
                    pointer('pointerdown', { pointerType: 'pen', button: 5 });
                    pointer('pointerup', { pointerType: 'pen', button: 5 });
                    expect(log.map(e => `${e.name}${e.button}`)).to.deep.equal(['mousemove-1', 'mousedown0', 'mouseup0']);
                });

                it('drives the mouse from a pen like a mouse pointer on platforms without touch support', function () {
                    sinon.stub(platform, 'touch').value(false);
                    const log = [];
                    record(log);
                    pointer('pointerdown', { pointerType: 'pen', clientX: 20, clientY: 20 });
                    expect(mouse.isPressed(MOUSEBUTTON_LEFT)).to.equal(true);
                    pointer('pointermove', { pointerType: 'pen', button: -1, clientX: 40, clientY: 20 });
                    pointer('pointerup', { pointerType: 'pen', clientX: 40, clientY: 20 });

                    // no tap follows the release
                    expect(log.map(e => `${e.name}${e.button}`)).to.deep.equal(['mousedown0', 'mousemove-1', 'mouseup0']);
                    expect(mouse.isPressed(MOUSEBUTTON_LEFT)).to.equal(false);
                });

                it('does not emulate a tap whose pointerdown was default-prevented', function () {
                    const log = [];
                    record(log);
                    canvas.addEventListener('pointerdown', e => e.preventDefault(), { once: true });
                    touch('pointerdown', { clientX: 20, clientY: 20 });
                    touch('pointerup', { clientX: 20, clientY: 20 });
                    expect(log).to.deep.equal([]);
                });

                it('ignores a touch that moved too far before lifting', function () {
                    const log = [];
                    record(log);
                    touch('pointerdown', { clientX: 20, clientY: 20 });
                    touch('pointermove', { clientX: 30, clientY: 20 });
                    touch('pointerup', { clientX: 20, clientY: 20 });

                    touch('pointerdown', { clientX: 20, clientY: 20 });
                    touch('pointerup', { clientX: 26, clientY: 28 });
                    expect(log).to.deep.equal([]);
                });

                it('ignores a long press', function () {
                    const log = [];
                    record(log);
                    touch('pointerdown', { timeStamp: 1000 });
                    touch('pointerup', { timeStamp: 1501 });
                    expect(log).to.deep.equal([]);

                    touch('pointerdown', { timeStamp: 2000 });
                    touch('pointerup', { timeStamp: 2500 });
                    expect(log.map(e => e.name)).to.deep.equal(['mousemove', 'mousedown', 'mouseup']);
                });

                it('ignores a touch that opened the context menu', function () {
                    const log = [];
                    record(log);
                    touch('pointerdown');
                    pointer('contextmenu');
                    touch('pointerup');
                    expect(log).to.deep.equal([]);
                });

                it('fires nothing for a tap outside the target and leaves no button held', function () {
                    const log = [];
                    record(log);
                    touch('pointerdown', { clientX: 150, clientY: 50 });
                    touch('pointerup', { clientX: 150, clientY: 50 });
                    expect(log).to.deep.equal([]);
                    expect(mouse.isPressed(MOUSEBUTTON_LEFT)).to.equal(false);
                });

                it('ignores a cancelled touch', function () {
                    const log = [];
                    record(log);
                    touch('pointerdown');
                    touch('pointercancel');
                    touch('pointerup');
                    expect(log).to.deep.equal([]);
                    expect(mouse.isPressed(MOUSEBUTTON_LEFT)).to.equal(false);
                });

                it('ignores a touch whose pointerup was default prevented', function () {
                    const log = [];
                    record(log);
                    canvas.addEventListener('pointerup', e => e.preventDefault());
                    touch('pointerdown');
                    touch('pointerup');
                    expect(log).to.deep.equal([]);
                });

                it('ignores non-primary touches and multi-touch taps', function () {
                    const log = [];
                    record(log);
                    touch('pointerdown', { pointerId: 2, isPrimary: false });
                    touch('pointerup', { pointerId: 2, isPrimary: false });

                    touch('pointerdown', { pointerId: 1 });
                    touch('pointerdown', { pointerId: 2, isPrimary: false });
                    touch('pointerup', { pointerId: 2, isPrimary: false });
                    touch('pointerup', { pointerId: 1 });
                    expect(log).to.deep.equal([]);
                });

                it('forgets a pending tap on blur', function () {
                    const log = [];
                    record(log);
                    touch('pointerdown');
                    window.dispatchEvent(new window.Event('blur'));
                    touch('pointerup');
                    expect(log).to.deep.equal([]);
                });

            });

        });

        describe('capture mode', function () {

            beforeEach(function () {
                mouse = new Mouse(canvas, { capture: true });
            });

            it('ignores window and DOM mouse events', function () {
                win('pointerdown', { clientX: 10, clientY: 10 });
                canvas.dispatchEvent(new window.MouseEvent('mousedown', { bubbles: true, clientX: 10, clientY: 10 }));
                expect(mouse.capture).to.equal(true);
                expect(mouse.isPressed(MOUSEBUTTON_LEFT)).to.equal(false);
            });

            it('never emulates taps', function () {
                const log = [];
                record(log);
                pointer('pointerdown', { pointerType: 'touch' });
                pointer('pointerup', { pointerType: 'touch' });
                expect(log).to.deep.equal([]);
            });

            [true, false].forEach((touch) => {
                it(`ignores touch and pen on platforms ${touch ? 'with' : 'without'} touch support`, function () {
                    sinon.stub(platform, 'touch').value(touch);
                    const down = sinon.spy();
                    mouse.on('mousedown', down);
                    pointer('pointerdown', { pointerType: 'touch' });
                    pointer('pointerdown', { pointerType: 'pen', pointerId: 2 });
                    expect(down.callCount).to.equal(0);
                    expect(mouse.isPressed(MOUSEBUTTON_LEFT)).to.equal(false);
                });
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

            it('clears buttons on lostpointercapture', function () {
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

            it('keeps the button held when pointer lock takes the capture', function () {
                const log = [];
                mouse.on('mousedown', e => log.push(`down${e.button}`));
                mouse.on('mouseup', e => log.push(`up${e.button}`));
                pointer('pointerdown', { buttons: 1 });
                expect(canvas.setPointerCapture.calledOnce).to.equal(true);

                // engaging the lock releases the capture
                Object.defineProperty(document, 'pointerLockElement', { configurable: true, value: canvas });
                pointer('lostpointercapture', { buttons: 1 });
                pointer('pointermove', { buttons: 1, movementX: 3 });
                expect(mouse.isPressed(MOUSEBUTTON_LEFT)).to.equal(true);
                expect(mouse.movement).to.deep.equal([3, 0]);

                pointer('pointerup', { buttons: 0 });
                expect(log).to.deep.equal(['down0', 'up0']);
                expect(mouse.isPressed(MOUSEBUTTON_LEFT)).to.equal(false);
            });

            it('clears buttons on pointercancel under pointer lock', function () {
                Object.defineProperty(document, 'pointerLockElement', { configurable: true, value: canvas });
                pointer('pointerdown', { buttons: 1 });
                pointer('pointercancel');
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

            it('does not press a button from a held move after a stopped pointerdown', function () {
                mouse.detach();
                const shield = e => e.stopImmediatePropagation();
                canvas.addEventListener('pointerdown', shield);
                mouse = new Mouse(canvas, { capture: true });
                const log = [];
                record(log);

                pointer('pointerdown', { buttons: 1 });
                pointer('pointermove', { buttons: 1, clientX: 12 });
                pointer('pointerup', { buttons: 0, clientX: 12 });
                canvas.removeEventListener('pointerdown', shield);

                expect(log.map(e => e.name)).to.deep.equal(['mousemove']);
                expect(mouse.isPressed(MOUSEBUTTON_LEFT)).to.equal(false);
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
