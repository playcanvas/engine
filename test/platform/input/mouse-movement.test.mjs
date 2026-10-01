import { expect } from 'chai';
import sinon from 'sinon';

import { Mouse } from '../../../src/platform/input/mouse.js';
import { jsdomSetup, jsdomTeardown } from '../../jsdom.mjs';

describe('Mouse movement', function () {

    let mouse;
    let moves;

    const move = (x, y, movementX = 0, movementY = 0) => {
        const event = new MouseEvent('mousemove', { clientX: x, clientY: y });
        Object.defineProperties(event, {
            movementX: { value: movementX },
            movementY: { value: movementY }
        });
        window.dispatchEvent(event);
    };

    beforeEach(function () {
        jsdomSetup();
        sinon.stub(document.body, 'clientWidth').get(() => 1000);
        sinon.stub(document.body, 'clientHeight').get(() => 800);
        sinon.stub(document.body, 'getBoundingClientRect').returns(new window.DOMRect(0, 0, 1000, 800));
        Object.defineProperty(document, 'pointerLockElement', { configurable: true, writable: true, value: null });
        mouse = new Mouse(document.body);
        moves = [];
        mouse.on('mousemove', event => moves.push({ x: event.x, y: event.y, dx: event.dx, dy: event.dy }));
    });

    afterEach(function () {
        mouse.detach();
        sinon.restore();
        jsdomTeardown();
    });

    it('should establish the initial position without reporting movement from the origin', function () {
        move(100, 100);
        move(110, 95);

        expect(moves).to.deep.equal([
            { x: 100, y: 100, dx: 0, dy: 0 },
            { x: 110, y: 95, dx: 10, dy: -5 }
        ]);
    });

    ['blur', 'hidden', 'detach'].forEach((reset) => {
        it(`should establish a new baseline after ${reset}`, function () {
            move(100, 100);
            if (reset === 'blur') {
                window.dispatchEvent(new window.Event('blur'));
                window.dispatchEvent(new window.Event('focus'));
            } else if (reset === 'hidden') {
                const visibility = sinon.stub(document, 'visibilityState');
                visibility.get(() => 'hidden');
                document.dispatchEvent(new window.Event('visibilitychange'));
                visibility.get(() => 'visible');
                document.dispatchEvent(new window.Event('visibilitychange'));
            } else {
                mouse.detach();
                move(500, 500);
                mouse.attach(document.body);
            }
            moves.length = 0;

            move(900, 700);
            move(905, 690);

            expect(moves).to.deep.equal([
                { x: 900, y: 700, dx: 0, dy: 0 },
                { x: 905, y: 690, dx: 5, dy: -10 }
            ]);
        });
    });

    it('should preserve the baseline when the document becomes visible without losing focus', function () {
        move(100, 100);
        sinon.stub(document, 'visibilityState').get(() => 'visible');
        document.dispatchEvent(new window.Event('visibilitychange'));
        move(120, 90);

        expect(moves[1]).to.deep.equal({ x: 120, y: 90, dx: 20, dy: -10 });
    });

    it('should establish a new baseline when the pointer re-enters the target', function () {
        move(100, 100);
        move(1200, 900);
        expect(moves).to.have.length(1);

        move(900, 700);
        move(905, 690);

        expect(moves[1]).to.deep.equal({ x: 900, y: 700, dx: 0, dy: 0 });
        expect(moves[2]).to.deep.equal({ x: 905, y: 690, dx: 5, dy: -10 });
    });

    it('should wait for a movement inside the target after focus loss', function () {
        move(100, 100);
        window.dispatchEvent(new window.Event('blur'));
        move(1100, 900);
        expect(moves).to.have.length(1);

        move(900, 700);
        move(905, 690);

        expect(moves[1]).to.deep.equal({ x: 900, y: 700, dx: 0, dy: 0 });
        expect(moves[2]).to.deep.equal({ x: 905, y: 690, dx: 5, dy: -10 });
    });

    it('should keep button and wheel events from consuming the first movement after blur', function () {
        move(100, 100);
        window.dispatchEvent(new window.Event('blur'));
        const events = [];
        const record = event => events.push({ dx: event.dx, dy: event.dy });
        mouse.on('mousedown', record);
        mouse.on('mouseup', record);
        mouse.on('mousewheel', record);

        window.dispatchEvent(new MouseEvent('mousedown', { clientX: 800, clientY: 600, button: 0 }));
        window.dispatchEvent(new MouseEvent('mouseup', { clientX: 800, clientY: 600, button: 0 }));
        window.dispatchEvent(new window.WheelEvent('wheel', { clientX: 800, clientY: 600, deltaY: 1 }));
        move(900, 700);

        expect(events).to.deep.equal([{ dx: 0, dy: 0 }, { dx: 0, dy: 0 }, { dx: 0, dy: 0 }]);
        expect(moves[1]).to.deep.equal({ x: 900, y: 700, dx: 0, dy: 0 });
    });

    it('should preserve pointer-locked movement before and after blur', function () {
        document.pointerLockElement = document.body;
        move(100, 100, 7, -3);
        window.dispatchEvent(new window.Event('blur'));
        move(900, 700, -4, 9);

        expect(moves).to.deep.equal([
            { x: 100, y: 100, dx: 7, dy: -3 },
            { x: 900, y: 700, dx: -4, dy: 9 }
        ]);
    });

    it('should not use pointer-locked coordinates as an unlocked movement baseline', function () {
        move(100, 100);
        document.pointerLockElement = document.body;
        move(1100, 900, 7, -3);
        document.pointerLockElement = null;
        move(900, 700);
        move(905, 690);

        expect(moves[1]).to.include({ dx: 7, dy: -3 });
        expect(moves[2]).to.deep.equal({ x: 900, y: 700, dx: 0, dy: 0 });
        expect(moves[3]).to.deep.equal({ x: 905, y: 690, dx: 5, dy: -10 });
    });

    it('should preserve a reset triggered by a mousemove listener', function () {
        mouse.once('mousemove', () => window.dispatchEvent(new window.Event('blur')));
        move(100, 100);
        move(900, 700);
        move(905, 690);

        expect(moves[1]).to.deep.equal({ x: 900, y: 700, dx: 0, dy: 0 });
        expect(moves[2]).to.deep.equal({ x: 905, y: 690, dx: 5, dy: -10 });
    });

});
