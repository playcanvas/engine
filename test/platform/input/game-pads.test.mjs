import { expect } from 'chai';

import { PAD_1, PAD_FACE_1, PAD_RIGHT } from '../../../src/platform/input/constants.js';
import { GamePad, GamePadButton, GamePads } from '../../../src/platform/input/game-pads.js';
import { jsdomSetup, jsdomTeardown } from '../../jsdom.mjs';

// Minimal stand-in for a Gamepad API device object.
const createDevice = (index = 0, axes = [0, 0, 0, 0]) => ({
    id: 'Test Gamepad (STANDARD GAMEPAD)',
    index,
    mapping: 'standard',
    connected: true,
    buttons: Array.from({ length: 17 }, () => ({ value: 0, pressed: false, touched: false })),
    axes
});

const press = (device, button) => {
    device.buttons[button] = { value: 1, pressed: true, touched: true };
};

const release = (device, button) => {
    device.buttons[button] = { value: 0, pressed: false, touched: false };
};

// Map a single synthesized button onto one axis so the previous-axes bookkeeping is
// observable through the public API.
const synthesizedMap = axis => ({
    buttons: [],
    axes: [],
    synthesizedButtons: {
        PAD_RIGHT: { axis, min: 0, max: 1 }
    }
});

describe('GamePads', function () {

    /** @type {GamePads} */
    let gamepads;

    /** @type {(object|null)[]} */
    let devices;

    /** @type {boolean} */
    let hadNavigator;

    beforeEach(function () {
        jsdomSetup();
        devices = [];

        // Older Node runtimes have no global navigator, so borrow JSDOM's before installing
        // the fake Gamepad API on it.
        hadNavigator = 'navigator' in globalThis;
        if (!hadNavigator) {
            globalThis.navigator = window.navigator;
        }
        globalThis.navigator.getGamepads = () => devices;

        gamepads = new GamePads();
    });

    afterEach(function () {
        gamepads.destroy();
        delete globalThis.navigator.getGamepads;
        if (!hadNavigator) {
            delete globalThis.navigator;
        }
        jsdomTeardown();
    });

    describe('#poll', function () {

        it('returns one GamePad per connected device and skips empty slots', function () {
            devices = [createDevice(0), null, createDevice(2)];

            const pads = gamepads.poll();

            expect(pads).to.have.lengthOf(2);
            expect(pads[0]).to.be.an.instanceOf(GamePad);
            expect(pads.map(pad => pad.index)).to.deep.equal([0, 2]);
            expect(gamepads.current).to.have.members(pads);
        });

        it('fills and returns the array passed in', function () {
            devices = [createDevice(0)];
            const target = ['stale'];

            const pads = gamepads.poll(target);

            expect(pads).to.equal(target);
            expect(target).to.have.lengthOf(1);
            expect(target[0].index).to.equal(0);
        });

        it('reuses the GamePad instance for a device seen before', function () {
            devices = [createDevice(0)];

            const first = gamepads.poll()[0];
            const second = gamepads.poll()[0];

            expect(second).to.equal(first);
            expect(gamepads.current).to.have.lengthOf(1);
        });

    });

    describe('#update', function () {

        it('adds a device the first time it is reported', function () {
            gamepads.update();
            expect(gamepads.current).to.have.lengthOf(0);

            devices.push(createDevice(0));
            gamepads.update();

            expect(gamepads.current).to.have.lengthOf(1);
            expect(gamepads.current[0].index).to.equal(0);
        });

        it('updates existing pads in place and tracks button edges across frames', function () {
            const device = createDevice(0);
            devices = [device];
            gamepads.update();
            const pad = gamepads.current[0];

            press(device, PAD_FACE_1);
            gamepads.update();

            expect(gamepads.current[0]).to.equal(pad);
            expect(gamepads.isPressed(PAD_1, PAD_FACE_1)).to.be.true;
            expect(gamepads.wasPressed(PAD_1, PAD_FACE_1)).to.be.true;

            gamepads.update();

            expect(gamepads.isPressed(PAD_1, PAD_FACE_1)).to.be.true;
            expect(gamepads.wasPressed(PAD_1, PAD_FACE_1)).to.be.false;

            release(device, PAD_FACE_1);
            gamepads.update();

            expect(gamepads.isPressed(PAD_1, PAD_FACE_1)).to.be.false;
            expect(gamepads.wasReleased(PAD_1, PAD_FACE_1)).to.be.true;
        });

        it('keeps the previous axes so synthesized buttons report edges', function () {
            const device = createDevice(0, [0, 0, 0, 0]);
            devices = [device];
            gamepads.update();
            const pad = gamepads.current[0];
            pad.updateMap(synthesizedMap(0));

            device.axes = [1, 0, 0, 0];
            gamepads.update();

            expect(pad.isPressed(PAD_RIGHT)).to.be.true;
            expect(pad.wasPressed(PAD_RIGHT)).to.be.true;

            gamepads.update();

            expect(pad.isPressed(PAD_RIGHT)).to.be.true;
            expect(pad.wasPressed(PAD_RIGHT)).to.be.false;
        });

    });

});

describe('GamePadButton', function () {

    describe('#constructor', function () {

        it('derives edge state from a numeric previous value of 0', function () {
            const button = new GamePadButton(1, 0);

            expect(button.pressed).to.be.true;
            expect(button.wasPressed).to.be.true;
            expect(button.wasTouched).to.be.true;
            expect(button.wasReleased).to.be.false;
        });

        it('reports a release from a numeric previous value of 1', function () {
            const button = new GamePadButton(0, 1);

            expect(button.pressed).to.be.false;
            expect(button.wasPressed).to.be.false;
            expect(button.wasReleased).to.be.true;
        });

        it('reports no edges when no previous value is given', function () {
            const button = new GamePadButton(1);

            expect(button.wasPressed).to.be.false;
            expect(button.wasReleased).to.be.false;
        });

    });

});

describe('GamePad', function () {

    describe('#update', function () {

        it('snapshots the previous axes before adopting a shorter axes array', function () {
            const pad = new GamePad(createDevice(0, [0, 0, 1]), synthesizedMap(2));

            pad.update(createDevice(0, [0, 0]));

            expect(pad.isPressed(PAD_RIGHT)).to.be.false;
            expect(pad.wasReleased(PAD_RIGHT)).to.be.true;
        });

        it('snapshots the previous axes before adopting a longer axes array', function () {
            const pad = new GamePad(createDevice(0, [0, 0]), synthesizedMap(2));

            pad.update(createDevice(0, [0, 0, 1]));

            expect(pad.isPressed(PAD_RIGHT)).to.be.true;
            expect(pad.wasPressed(PAD_RIGHT)).to.be.true;
        });

    });

});
