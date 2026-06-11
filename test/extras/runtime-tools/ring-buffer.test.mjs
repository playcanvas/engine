import { expect } from 'chai';

import { RingBuffer } from '../../../src/extras/runtime-tools/ring-buffer.js';

describe('RingBuffer', function () {

    it('stores pushed items oldest first', function () {
        const buf = new RingBuffer(3);
        buf.push(1);
        buf.push(2);
        expect(buf.toArray()).to.deep.equal([1, 2]);
        expect(buf.length).to.equal(2);
    });

    it('drops oldest items beyond capacity', function () {
        const buf = new RingBuffer(3);
        [1, 2, 3, 4, 5].forEach(n => buf.push(n));
        expect(buf.toArray()).to.deep.equal([3, 4, 5]);
        expect(buf.length).to.equal(3);
    });

    it('toArray returns a copy', function () {
        const buf = new RingBuffer(3);
        buf.push(1);
        buf.toArray().push(99);
        expect(buf.toArray()).to.deep.equal([1]);
    });
});
