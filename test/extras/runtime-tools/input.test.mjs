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
});
