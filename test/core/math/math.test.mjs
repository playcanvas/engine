import { math } from '../../../src/core/math/math.js';

import { expect } from 'chai';

describe('math', function () {

    describe('#DEG_TO_RAD', function () {

        it('converts degrees to radians', function () {
            const deg = 180;
            expect(deg * math.DEG_TO_RAD).to.equal(Math.PI);
        });

    });

    describe('#RAD_TO_DEG', function () {

        it('converts radians to degrees', function () {
            const rad = Math.PI;
            expect(rad * math.RAD_TO_DEG).to.equal(180);
        });

    });

    describe('#between', function () {

        it('returns true if value is between min and max inclusive', function () {
            expect(math.between(0, 0, 1, true)).to.be.true;
            expect(math.between(0.5, 0, 1, true)).to.be.true;
            expect(math.between(1, 0, 1, true)).to.be.true;
        });

        it('returns false if value is not between min and max inclusive', function () {
            expect(math.between(-1, 0, 1, true)).to.be.false;
            expect(math.between(2, 0, 1, true)).to.be.false;
        });

        it('returns false if value is between min and max exclusive', function () {
            expect(math.between(0, 0, 1, false)).to.be.false;
            expect(math.between(1, 0, 1, false)).to.be.false;
        });

        it('returns false if value is not between min and max exclusive', function () {
            expect(math.between(-1, 0, 1, false)).to.be.false;
            expect(math.between(2, 0, 1, false)).to.be.false;
        });

    });

    describe('#bytesToInt24', function () {

        it('packs 3 unsigned bytes into a 24-bit unsigned int', function () {
            const uint24 = math.bytesToInt24(0xaa, 0xbb, 0xcc);
            expect(uint24).to.equal(0xaabbcc);
        });

        it('packs an array of 3 unsigned bytes into a 24-bit unsigned int', function () {
            const uint24 = math.bytesToInt24([0xaa, 0xbb, 0xcc]);
            expect(uint24).to.equal(0xaabbcc);
        });

        it('returns 0 when all supplied bytes are 0', function () {
            const uint24 = math.bytesToInt24(0, 0, 0);
            expect(uint24).to.equal(0);
        });

        it('returns 2 ^ 24 - 1 when all supplied bytes are 255', function () {
            const uint24 = math.bytesToInt24(255, 255, 255);
            expect(uint24).to.equal(Math.pow(2, 24) - 1);
        });

    });

    describe('#bytesToInt32', function () {

        it('packs 4 unsigned bytes into a 32-bit unsigned int', function () {
            const uint32 = math.bytesToInt32(0xaa, 0xbb, 0xcc, 0xdd);
            expect(uint32).to.equal(0xaabbccdd);
        });

        it('packs an array of 4 unsigned bytes into a 32-bit unsigned int', function () {
            const uint32 = math.bytesToInt32([0xaa, 0xbb, 0xcc, 0xdd]);
            expect(uint32).to.equal(0xaabbccdd);
        });

        it('returns 0 when all supplied bytes are 0', function () {
            const uint32 = math.bytesToInt32(0, 0, 0, 0);
            expect(uint32).to.equal(0);
        });

        it('returns 2 ^ 32 - 1 when all supplied bytes are 255', function () {
            const uint32 = math.bytesToInt32(255, 255, 255, 255);
            expect(uint32).to.equal(Math.pow(2, 32) - 1);
        });

    });

    describe('#clamp', function () {

        it('returns the value when it is between min and max', function () {
            expect(math.clamp(5, 0, 10)).to.equal(5);
        });

        it('returns the minimum value when it is less than min', function () {
            expect(math.clamp(-5, 0, 10)).to.equal(0);
        });

        it('returns the maximum value when it is greater than max', function () {
            expect(math.clamp(15, 0, 10)).to.equal(10);
        });

    });

    describe('#intToBytes24', function () {

        it('converts an integer to a 3-element byte array', function () {
            const i = 0x112233;
            const b = math.intToBytes24(i);
            expect(b[0]).to.equal(0x11);
            expect(b[1]).to.equal(0x22);
            expect(b[2]).to.equal(0x33);
        });

    });

    describe('#intToBytes32', function () {

        it('converts an integer to a 4-element byte array', function () {
            const i = 0x11223344;
            const b = math.intToBytes32(i);
            expect(b[0]).to.equal(0x11);
            expect(b[1]).to.equal(0x22);
            expect(b[2]).to.equal(0x33);
            expect(b[3]).to.equal(0x44);
        });

    });

    describe('#lerp', function () {

        it('returns a when alpha is 0', function () {
            expect(math.lerp(0, 1, 0)).to.equal(0);
        });

        it('returns b when alpha is 1', function () {
            expect(math.lerp(0, 1, 1)).to.equal(1);
        });

        it('returns a + alpha * (b - a) when alpha is 0.5', function () {
            expect(math.lerp(0, 1, 0.5)).to.equal(0.5);
        });

    });

    describe('#lerpAngle', function () {

        it('returns 0 when a is 0 and b is 360 and alpha is 0', function () {
            expect(math.lerpAngle(0, 360, 0)).to.equal(0);
        });

        it('returns 0 when a is 0 and b is 360 and alpha is 0.5', function () {
            expect(math.lerpAngle(0, 360, 0.5)).to.equal(0);
        });

        it('returns 0 when a is 0 and b is 360 and alpha is 1', function () {
            expect(math.lerpAngle(0, 360, 1)).to.equal(0);
        });

        it('returns 0 when a is -90 and b is 90 and alpha is 0.5', function () {
            expect(math.lerpAngle(-90, 90, 0.5)).to.equal(0);
        });

        it('returns 180 when a is 90 and b is2790 and alpha is 0.5', function () {
            expect(math.lerpAngle(90, 270, 0.5)).to.equal(180);
        });

        it('crosses the 360 to 0 degree boundary correctly (anticlockwise)', function () {
            expect(math.lerpAngle(10, 350, 0.75)).to.equal(-5);
        });

        it('crosses the 360 to 0 degree boundary correctly (clockwise)', function () {
            expect(math.lerpAngle(350, 10, 0.75)).to.equal(365);
        });

    });

    describe('#nextPowerOfTwo', function () {

        it('returns the next power of two', function () {
            expect(math.nextPowerOfTwo(0)).to.equal(0);
            expect(math.nextPowerOfTwo(1)).to.equal(1);
            expect(math.nextPowerOfTwo(2)).to.equal(2);
            expect(math.nextPowerOfTwo(3)).to.equal(4);
            expect(math.nextPowerOfTwo(4)).to.equal(4);
            expect(math.nextPowerOfTwo(5)).to.equal(8);
            expect(math.nextPowerOfTwo(6)).to.equal(8);
            expect(math.nextPowerOfTwo(7)).to.equal(8);
            expect(math.nextPowerOfTwo(8)).to.equal(8);
            expect(math.nextPowerOfTwo(9)).to.equal(16);
        });

    });

    describe('#nearestPowerOfTwo', function () {

        it('returns the nearest power of two', function () {
            expect(math.nearestPowerOfTwo(0)).to.equal(0);
            expect(math.nearestPowerOfTwo(1)).to.equal(1);
            expect(math.nearestPowerOfTwo(2)).to.equal(2);
            expect(math.nearestPowerOfTwo(3)).to.equal(4);
            expect(math.nearestPowerOfTwo(4)).to.equal(4);
            expect(math.nearestPowerOfTwo(5)).to.equal(4);
            expect(math.nearestPowerOfTwo(6)).to.equal(8);
            expect(math.nearestPowerOfTwo(7)).to.equal(8);
            expect(math.nearestPowerOfTwo(8)).to.equal(8);
            expect(math.nearestPowerOfTwo(9)).to.equal(8);
        });

    });

    describe('#powerOfTwo', function () {

        it('returns true when the value is a power of two', function () {
            expect(math.powerOfTwo(1)).to.be.true;
            expect(math.powerOfTwo(2)).to.be.true;
            expect(math.powerOfTwo(4)).to.be.true;
            expect(math.powerOfTwo(8)).to.be.true;
            expect(math.powerOfTwo(16)).to.be.true;
            expect(math.powerOfTwo(32)).to.be.true;
            expect(math.powerOfTwo(64)).to.be.true;
            expect(math.powerOfTwo(128)).to.be.true;
            expect(math.powerOfTwo(256)).to.be.true;
            expect(math.powerOfTwo(512)).to.be.true;
        });

        it('returns false when the value is not a power of two', function () {
            expect(math.powerOfTwo(0)).to.be.false;
            expect(math.powerOfTwo(3)).to.be.false;
            expect(math.powerOfTwo(5)).to.be.false;
            expect(math.powerOfTwo(6)).to.be.false;
            expect(math.powerOfTwo(7)).to.be.false;
            expect(math.powerOfTwo(9)).to.be.false;
            expect(math.powerOfTwo(10)).to.be.false;
            expect(math.powerOfTwo(11)).to.be.false;
            expect(math.powerOfTwo(12)).to.be.false;
            expect(math.powerOfTwo(13)).to.be.false;
        });

    });

    describe('#random', function () {

        it('returns a random number between 0 and 1', function () {
            const r = math.random(100, 101);
            expect(r).to.be.at.least(100);
            expect(r).to.be.at.most(101);
        });

    });

    describe('#roundUp', function () {

        it('rounds a number up to the nearest multiple', function () {
            expect(math.roundUp(0, 2)).to.equal(0);
            expect(math.roundUp(0.5, 2)).to.equal(2);
            expect(math.roundUp(1, 2)).to.equal(2);
            expect(math.roundUp(1.5, 2)).to.equal(2);
            expect(math.roundUp(2, 2)).to.equal(2);
            expect(math.roundUp(2.5, 2)).to.equal(4);
            expect(math.roundUp(3, 2)).to.equal(4);
            expect(math.roundUp(3.5, 2)).to.equal(4);
            expect(math.roundUp(4, 2)).to.equal(4);
        });

        it('returns number unchanged for multiples of 0', function () {
            expect(math.roundUp(0, 0)).to.equal(0);
            expect(math.roundUp(0.5, 0)).to.equal(0.5);
            expect(math.roundUp(1, 0)).to.equal(1);
            expect(math.roundUp(1.5, 0)).to.equal(1.5);
            expect(math.roundUp(2, 0)).to.equal(2);
            expect(math.roundUp(2.5, 0)).to.equal(2.5);
            expect(math.roundUp(3, 0)).to.equal(3);
            expect(math.roundUp(3.5, 0)).to.equal(3.5);
            expect(math.roundUp(4, 0)).to.equal(4);
        });

    });

    describe('#smootherstep', function () {

        it('returns 0 when x equals min', function () {
            expect(math.smootherstep(0, 10, 0)).to.equal(0);
        });

        it('returns 0.5 when x is midway between min and max', function () {
            expect(math.smootherstep(0, 10, 5)).to.equal(0.5);
        });

        it('returns 1 when x equals max', function () {
            expect(math.smootherstep(0, 10, 10)).to.equal(1);
        });

    });

    describe('#smoothstep', function () {

        it('returns 0 when x equals a', function () {
            expect(math.smoothstep(0, 10, 0)).to.equal(0);
        });

        it('returns 0.5 when x is midway between a and b', function () {
            expect(math.smoothstep(0, 10, 5)).to.equal(0.5);
        });

        it('returns 1 when x equals b', function () {
            expect(math.smoothstep(0, 10, 10)).to.equal(1);
        });

    });

});
