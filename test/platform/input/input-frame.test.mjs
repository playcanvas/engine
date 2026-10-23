import { expect } from 'chai';
import sinon from 'sinon';

import { InputFrame } from '../../../src/platform/input/input-frame.js';

describe('InputFrame', function () {

    const fields = {
        move: { type: 'vec3' },
        jump: { type: 'bool' },
        look: { type: 'vec2', kind: 'delta' },
        zoom: { type: 'number', kind: 'delta' }
    };

    it('starts zeroed', function () {
        expect(new InputFrame(fields).input).to.deep.equal({ move: [0, 0, 0], jump: false, look: [0, 0], zoom: 0 });
    });

    it('stamps isn, dt and ts', function () {
        const frame = new InputFrame(fields);
        expect(frame.isn).to.equal(0);
        expect(frame.capture(0.016, 5)).to.deep.include({ isn: 1, dt: 0.016, ts: 5 });
        expect(frame.capture(0.016, 6)).to.deep.include({ isn: 2, dt: 0.016, ts: 6 });
    });

    it('copies input so later writes do not change a snapshot', function () {
        const frame = new InputFrame(fields);
        const snapshot = frame.capture();
        frame.input.move[0] = 1;
        expect(snapshot.input.move[0]).to.equal(0);
    });

    it('keeps held fields across captures', function () {
        const frame = new InputFrame(fields);
        frame.input.jump = true;
        frame.input.move[2] = -1;
        const first = frame.capture();
        const second = frame.capture();
        expect(first.input.jump).to.equal(true);
        expect(second.input.jump).to.equal(true);
        expect(second.input.move[2]).to.equal(-1);
    });

    it('zeroes delta fields after capture', function () {
        const frame = new InputFrame(fields);
        frame.input.look[0] += 3;
        frame.input.zoom += 2;
        const first = frame.capture();
        const second = frame.capture();
        expect(first.input.look).to.deep.equal([3, 0]);
        expect(first.input.zoom).to.equal(2);
        expect(second.input.look).to.deep.equal([0, 0]);
        expect(second.input.zoom).to.equal(0);
    });

    it('keeps key order', function () {
        expect(Object.keys(new InputFrame(fields).capture().input)).to.deep.equal(['move', 'jump', 'look', 'zoom']);
    });

    it('reset zeroes everything', function () {
        const frame = new InputFrame(fields);
        frame.input.move[1] = 4;
        frame.input.jump = true;
        frame.input.look[1] = 2;
        frame.input.zoom = 9;
        frame.reset();
        expect(frame.input).to.deep.equal({ move: [0, 0, 0], jump: false, look: [0, 0], zoom: 0 });
    });

    it('exposes the frozen field description', function () {
        const frame = new InputFrame(fields);
        expect(frame.fields).to.equal(fields);
        expect(Object.isFrozen(frame.fields)).to.equal(true);
    });

    it('asserts unknown field types and kinds', function () {
        const error = sinon.stub(console, 'error');
        const frame = new InputFrame({ a: { type: 'vec4' }, b: { type: 'number', kind: 'pulse' } });
        const messages = error.getCalls().map(call => call.args.join(' '));
        error.restore();
        expect(messages.some(m => m.includes('unknown type') && m.includes('vec4'))).to.equal(true);
        expect(messages.some(m => m.includes('unknown kind') && m.includes('pulse'))).to.equal(true);
        expect(frame.input).to.deep.equal({ a: 0, b: 0 });
    });
});
