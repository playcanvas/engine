import { Keyboard } from '../../../src/platform/input/keyboard.js';
import { EVENT_KEYDOWN, EVENT_KEYUP, KEY_UP } from '../../../src/platform/input/constants.js';

import { expect } from 'chai';

describe('Keyboard', function () {

    /** @type { Keyboard } */
    let keyboard;

    beforeEach(function () {
        keyboard = new Keyboard();
        keyboard.attach(window);
    });

    afterEach(function () {
        keyboard.detach();
    });

    describe('#constructor', function () {

        it('should create a new instance', function () {
            expect(keyboard).to.be.an.instanceOf(Keyboard);
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

        it('should handle keydown events', function (done) {
            keyboard.on(EVENT_KEYDOWN, function (event) {
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

        it('should handle keyup events', function (done) {
            keyboard.on(EVENT_KEYUP, function (event) {
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
