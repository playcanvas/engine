import { expect } from 'chai';

import { KeyboardMouseSource } from '../../../../src/extras/input/sources/keyboard-mouse-source.js';
import { jsdomSetup, jsdomTeardown } from '../../../jsdom.mjs';

const { SHIFT } = KeyboardMouseSource.keyCode;

describe('KeyboardMouseSource', function () {

    let source;

    const key = (type, code) => {
        window.dispatchEvent(new window.KeyboardEvent(type, { code }));
    };

    beforeEach(function () {
        jsdomSetup();
        source = new KeyboardMouseSource();
        source.attach(document.createElement('div'));
    });

    afterEach(function () {
        source.detach();
        jsdomTeardown();
    });

    it('releases held keys when the window loses focus', function () {
        key('keydown', 'ShiftLeft');
        expect(source.read().key[SHIFT]).to.equal(1);

        // the keyup lands in another window, so it never arrives
        window.dispatchEvent(new window.Event('blur'));
        expect(source.read().key[SHIFT]).to.equal(-1);

        // a late keyup does not release it twice
        key('keyup', 'ShiftLeft');
        expect(source.read().key[SHIFT]).to.equal(0);
    });
});
