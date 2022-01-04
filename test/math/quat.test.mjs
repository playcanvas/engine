import { Quat } from '../../src/math/quat.js';

import { expect } from 'chai';

describe('Quat', function () {

    describe('#constructor', function () {

        it('supports zero arguments', function () {
            const q = new Quat();
            expect(q.x).to.equal(0);
            expect(q.y).to.equal(0);
            expect(q.z).to.equal(0);
            expect(q.w).to.equal(1);
        });

        it('supports number arguments', function () {
            const q = new Quat(0.1, 0.2, 0.3, 0.4);
            expect(q.x).to.equal(0.1);
            expect(q.y).to.equal(0.2);
            expect(q.z).to.equal(0.3);
            expect(q.w).to.equal(0.4);
        });

        it('supports a 4 element array argument', function () {
            const q = new Quat([0.1, 0.2, 0.3, 0.4]);
            expect(q.x).to.equal(0.1);
            expect(q.y).to.equal(0.2);
            expect(q.z).to.equal(0.3);
            expect(q.w).to.equal(0.4);
        });

    });

    describe('#clone', function () {

        it('clones a quaternion', function () {
            const q1 = new Quat(0.1, 0.2, 0.3, 0.4);
            const q2 = q1.clone();
            expect(q2).to.not.equal(q1);
            expect(q2.x).to.equal(0.1);
            expect(q2.y).to.equal(0.2);
            expect(q2.z).to.equal(0.3);
            expect(q2.w).to.equal(0.4);
        });

    });

    describe('#copy', function () {

        it('copies a quaternion', function () {
            const q1 = new Quat(0.1, 0.2, 0.3, 0.4);
            const q2 = new Quat();
            q2.copy(q1);
            expect(q2).to.not.equal(q1);
            expect(q2.x).to.equal(0.1);
            expect(q2.y).to.equal(0.2);
            expect(q2.z).to.equal(0.3);
            expect(q2.w).to.equal(0.4);
        });

    });

    describe('#equals', function () {

        it('checks for equality of the same quaternion', function () {
            const q = new Quat(0.1, 0.2, 0.3, 0.4);
            expect(q.equals(q)).to.be.true;
        });

        it('checks for equality of two different quaternions with the same values', function () {
            const q1 = new Quat(0.1, 0.2, 0.3, 0.4);
            const q2 = new Quat(0.1, 0.2, 0.3, 0.4);
            expect(q1.equals(q2)).to.be.true;
        });

        it('checks for equality of two different quaternions with different values', function () {
            const q1 = new Quat(0.1, 0.2, 0.3, 0.4);
            const q2 = new Quat(0.5, 0.6, 0.7, 0.8);
            expect(q1.equals(q2)).to.be.false;
        });

    });

    describe('#set', function () {

        it('sets the quaternion', function () {
            const q = new Quat();
            q.set(0.1, 0.2, 0.3, 0.4);
            expect(q.x).to.equal(0.1);
            expect(q.y).to.equal(0.2);
            expect(q.z).to.equal(0.3);
            expect(q.w).to.equal(0.4);
        });

    });

    describe('#toString', function () {

        it('returns a string representation of the quaternion', function () {
            const q = new Quat(0.1, 0.2, 0.3, 0.4);
            expect(q.toString()).to.equal('[0.1, 0.2, 0.3, 0.4]');
        });

    });

});
