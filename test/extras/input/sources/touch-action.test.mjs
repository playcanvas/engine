import { expect } from 'chai';

import { DualGestureSource } from '../../../../src/extras/input/sources/dual-gesture-source.js';
import { KeyboardMouseSource } from '../../../../src/extras/input/sources/keyboard-mouse-source.js';
import { MultiTouchSource } from '../../../../src/extras/input/sources/multi-touch-source.js';
import { SingleGestureSource } from '../../../../src/extras/input/sources/single-gesture-source.js';
import { jsdomSetup, jsdomTeardown } from '../../../jsdom.mjs';

describe('InputSource touch-action', function () {

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

    [MultiTouchSource, SingleGestureSource, DualGestureSource].forEach((SourceClass) => {
        describe(SourceClass.name, function () {

            it('sets touch-action to none while attached', function () {
                const source = new SourceClass();
                source.attach(element);
                expect(element.style.touchAction).to.equal('none');
                source.destroy();
            });

            it('restores the previous inline touch-action on detach', function () {
                element.style.touchAction = 'pan-y';
                const source = new SourceClass();
                source.attach(element);
                source.detach();
                expect(element.style.touchAction).to.equal('pan-y');
                source.destroy();
            });

            it('restores touch-action of the previous element when attached to another', function () {
                const other = document.createElement('div');
                const source = new SourceClass();
                source.attach(element);
                source.attach(other);
                expect(element.style.touchAction).to.equal('');
                expect(other.style.touchAction).to.equal('none');
                source.destroy();
                expect(other.style.touchAction).to.equal('');
            });

        });
    });

    it('leaves touch-action alone for a source that does not read touch', function () {
        const source = new KeyboardMouseSource();
        source.attach(element);
        expect(element.style.touchAction).to.equal('');
        source.destroy();
    });

    it('keeps touch-action none until the last source on an element detaches', function () {
        element.style.touchAction = 'pan-y';
        const orbit = new MultiTouchSource();
        const fly = new DualGestureSource();
        orbit.attach(element);
        fly.attach(element);
        expect(element.style.touchAction).to.equal('none');

        // the first source to attach detaches first
        orbit.destroy();
        expect(element.style.touchAction).to.equal('none');

        fly.destroy();
        expect(element.style.touchAction).to.equal('pan-y');
    });

});
