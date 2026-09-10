import { expect } from 'chai';

import { KEY_DOWN, KEY_UP } from '../../../src/platform/input/constants.js';
import { Keyboard } from '../../../src/platform/input/keyboard.js';
import { jsdomSetup, jsdomTeardown } from '../../jsdom.mjs';

describe('Keyboard', function () {

    /** @type { Keyboard } */
    let keyboard;

    beforeEach(function () {
        jsdomSetup();
        keyboard = new Keyboard();
        keyboard.attach(window);
    });

    afterEach(function () {
        keyboard.detach();
        jsdomTeardown();
    });

    describe('#constructor', function () {

        it('should create a new instance', function () {
            expect(keyboard).to.be.an.instanceOf(Keyboard);
        });

    });

    describe('#detach', function () {

        ['pressed', 'held', 'released'].forEach((state) => {
            it(`should clear all key states when detached with ${state} keys`, function () {
                const keys = [KEY_UP, KEY_DOWN];
                for (const keyCode of keys) {
                    window.dispatchEvent(new KeyboardEvent('keydown', { keyCode }));
                }
                if (state !== 'pressed') {
                    keyboard.update();
                }
                if (state === 'released') {
                    for (const keyCode of keys) {
                        window.dispatchEvent(new KeyboardEvent('keyup', { keyCode }));
                    }
                }

                keyboard.detach();

                for (const key of keys) {
                    expect(keyboard.isPressed(key)).to.be.false;
                    expect(keyboard.wasPressed(key)).to.be.false;
                    expect(keyboard.wasReleased(key)).to.be.false;
                }
                keyboard.attach(window);
            });
        });

        it('should detect a fresh press after a key is released while detached', function () {
            window.dispatchEvent(new KeyboardEvent('keydown', { keyCode: KEY_UP }));
            keyboard.update();
            let releases = 0;
            keyboard.on('keyup', () => releases++);

            keyboard.detach();
            window.dispatchEvent(new KeyboardEvent('keyup', { keyCode: KEY_UP }));
            keyboard.attach(window);

            expect(releases).to.equal(0);
            expect(keyboard.isPressed(KEY_UP)).to.be.false;
            expect(keyboard.wasPressed(KEY_UP)).to.be.false;
            expect(keyboard.wasReleased(KEY_UP)).to.be.false;

            window.dispatchEvent(new KeyboardEvent('keydown', { keyCode: KEY_UP }));
            expect(keyboard.isPressed(KEY_UP)).to.be.true;
            expect(keyboard.wasPressed(KEY_UP)).to.be.true;
            keyboard.update();
            window.dispatchEvent(new KeyboardEvent('keyup', { keyCode: KEY_UP }));
            expect(releases).to.equal(1);
            expect(keyboard.wasReleased(KEY_UP)).to.be.true;
        });

        it('should clear key states when attaching to another element', function () {
            window.dispatchEvent(new KeyboardEvent('keydown', { keyCode: KEY_UP }));
            keyboard.update();

            const element = document.createElement('div');
            keyboard.attach(element);

            expect(keyboard.isPressed(KEY_UP)).to.be.false;
            expect(keyboard.wasPressed(KEY_UP)).to.be.false;
            expect(keyboard.wasReleased(KEY_UP)).to.be.false;

            element.dispatchEvent(new KeyboardEvent('keydown', { keyCode: KEY_UP }));
            expect(keyboard.wasPressed(KEY_UP)).to.be.true;
        });

    });

    describe('#isPressed', function () {

        it('should return false for a key that is not pressed', function () {
            expect(keyboard.isPressed(KEY_UP)).to.be.false;
        });

        it('should return true for a key that is pressed', function () {
            const keyDownEvent = new KeyboardEvent('keydown', {
                keyCode: 38 // Up arrow
            });
            window.dispatchEvent(keyDownEvent);

            expect(keyboard.isPressed(KEY_UP)).to.be.true;

            keyboard.update();

            expect(keyboard.isPressed(KEY_UP)).to.be.true;

            const keyUpEvent = new KeyboardEvent('keyup', {
                keyCode: 38 // Up arrow
            });
            window.dispatchEvent(keyUpEvent);

            expect(keyboard.isPressed(KEY_UP)).to.be.false;
        });

    });

    describe('#on', function () {

        it('should handle keydown events', (done) => {
            keyboard.on('keydown', (event) => {
                expect(event.key).to.equal(KEY_UP);
                expect(event.element).to.equal(window);
                expect(event.event).to.be.an.instanceOf(KeyboardEvent);

                done();
            });

            const keyDownEvent = new KeyboardEvent('keydown', {
                keyCode: 38 // Up arrow
            });
            window.dispatchEvent(keyDownEvent);
        });

        it('should handle keyup events', (done) => {
            keyboard.on('keyup', (event) => {
                expect(event.key).to.equal(KEY_UP);
                expect(event.element).to.equal(window);
                expect(event.event).to.be.an.instanceOf(KeyboardEvent);

                done();
            });

            const keyUpEvent = new KeyboardEvent('keyup', {
                keyCode: 38 // Up arrow
            });
            window.dispatchEvent(keyUpEvent);
        });

    });

    describe('#wasPressed', function () {

        it('should return false for a key that was not pressed', function () {
            expect(keyboard.wasPressed(KEY_UP)).to.be.false;
        });

        it('should return true for a key that was pressed since the last update', function () {
            const keyDownEvent = new KeyboardEvent('keydown', {
                keyCode: 38 // Up arrow
            });
            window.dispatchEvent(keyDownEvent);

            expect(keyboard.wasPressed(KEY_UP)).to.be.true;

            keyboard.update();

            expect(keyboard.wasPressed(KEY_UP)).to.be.false;
        });

    });

    describe('#wasReleased', function () {

        it('should return false for a key that was not released', function () {
            expect(keyboard.wasReleased(KEY_UP)).to.be.false;
        });

        it('should return true for a key that was released since the last update', function () {
            const keyDownEvent = new KeyboardEvent('keydown', {
                keyCode: 38 // Up arrow
            });
            window.dispatchEvent(keyDownEvent);

            keyboard.update();

            const keyUpEvent = new KeyboardEvent('keyup', {
                keyCode: 38 // Up arrow
            });
            window.dispatchEvent(keyUpEvent);

            expect(keyboard.wasReleased(KEY_UP)).to.be.true;

            keyboard.update();

            expect(keyboard.wasReleased(KEY_UP)).to.be.false;
        });

    });

});
