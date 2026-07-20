import { expect } from 'chai';

import { injectInput } from '../../../src/extras/runtime-tools/input.js';
import { jsdomSetup, jsdomTeardown } from '../../jsdom.mjs';

describe('runtime-tools input injection', function () {
    let canvas;
    beforeEach(function () {
        jsdomSetup();
        canvas = document.createElement('canvas');
        document.body.appendChild(canvas);
    });
    afterEach(function () {
        jsdomTeardown();
    });

    it('stamps keyCode/which so pc.Keyboard (which reads keyCode) sees injected keys', function () {
        let ev = null;
        canvas.addEventListener('keydown', (e) => {
            ev = e;
        });
        injectInput(canvas, { kind: 'key', action: 'keydown', code: 'KeyW' });
        expect(ev.code).to.equal('KeyW');
        expect(ev.keyCode).to.equal(87); // KEY_W
        expect(ev.which).to.equal(87);
    });

    it('maps non-letter codes to their legacy keyCode', function () {
        const got = {};
        canvas.addEventListener('keydown', (e) => {
            got[e.code] = e.keyCode;
        });
        injectInput(canvas, { kind: 'key', action: 'keydown', code: 'Space' });
        injectInput(canvas, { kind: 'key', action: 'keydown', code: 'ArrowUp' });
        expect(got.Space).to.equal(32);
        expect(got.ArrowUp).to.equal(38);
    });

    it('dispatches mouse events with position and button', function () {
        let ev = null;
        canvas.addEventListener('mousedown', (e) => {
            ev = e;
        });
        injectInput(canvas, { kind: 'mouse', action: 'mousedown', x: 42, button: 2 });
        expect(ev.clientX).to.equal(42);
        expect(ev.button).to.equal(2);
    });

    it('dispatches touch events with a points list', function () {
        let ev = null;
        canvas.addEventListener('touchstart', (e) => {
            ev = e;
        });
        injectInput(canvas, { kind: 'touch', action: 'touchstart', touches: [{ id: 1, x: 30, y: 40 }] });
        expect(ev.touches.length).to.equal(1);
        expect(ev.touches[0].identifier).to.equal(1);
        expect(ev.touches[0].clientX).to.equal(30);
        expect(ev.changedTouches[0].clientY).to.equal(40);
    });

    it('accepts a single-point shorthand (x/y without a touches array)', function () {
        let ev = null;
        canvas.addEventListener('touchmove', (e) => {
            ev = e;
        });
        injectInput(canvas, { kind: 'touch', action: 'touchmove', x: 12, y: 9 });
        expect(ev.changedTouches[0].clientX).to.equal(12);
        expect(ev.changedTouches[0].clientY).to.equal(9);
    });

    it('empties touches on touchend but keeps the lifted point in changedTouches', function () {
        let ev = null;
        canvas.addEventListener('touchend', (e) => {
            ev = e;
        });
        injectInput(canvas, { kind: 'touch', action: 'touchend', touches: [{ id: 0, x: 5, y: 6 }] });
        expect(ev.touches.length).to.equal(0);
        expect(ev.changedTouches.length).to.equal(1);
        expect(ev.changedTouches[0].clientX).to.equal(5);
    });

    it('pointerlock enter shims document.pointerLockElement and fires pointerlockchange', function () {
        let changed = 0;
        canvas.ownerDocument.addEventListener('pointerlockchange', () => {
            changed++;
        });
        injectInput(canvas, { kind: 'pointerlock', action: 'enter' });
        expect(canvas.ownerDocument.pointerLockElement).to.equal(canvas);
        expect(changed).to.equal(1);
        // enter twice is idempotent
        injectInput(canvas, { kind: 'pointerlock', action: 'enter' });
        expect(canvas.ownerDocument.pointerLockElement).to.equal(canvas);
        expect(changed).to.equal(2);
    });

    it('pointerlock exit clears the shim, fires pointerlockchange, and no-ops without a prior enter', function () {
        injectInput(canvas, { kind: 'pointerlock', action: 'enter' });
        let changed = 0;
        canvas.ownerDocument.addEventListener('pointerlockchange', () => {
            changed++;
        });
        injectInput(canvas, { kind: 'pointerlock', action: 'exit' });
        expect(canvas.ownerDocument.pointerLockElement).to.not.equal(canvas);
        expect(changed).to.equal(1);
        // exit without a prior enter must not throw
        expect(() => injectInput(canvas, { kind: 'pointerlock', action: 'exit' })).to.not.throw();
    });
});
