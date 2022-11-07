import { Vec4 } from '../../../src/core/math/vec4.js';

import { expect } from 'chai';

describe('Vec4', function () {

    describe('#constructor', function () {

        it('supports zero arguments', function () {
            const v = new Vec4();
            expect(v.x).to.equal(0);
            expect(v.y).to.equal(0);
            expect(v.z).to.equal(0);
            expect(v.w).to.equal(0);
        });

        it('supports number arguments', function () {
            const v = new Vec4(1, 2, 3, 4);
            expect(v.x).to.equal(1);
            expect(v.y).to.equal(2);
            expect(v.z).to.equal(3);
            expect(v.w).to.equal(4);
        });

        it('supports an array argument', function () {
            const v = new Vec4([1, 2, 3, 4]);
            expect(v.x).to.equal(1);
            expect(v.y).to.equal(2);
            expect(v.z).to.equal(3);
            expect(v.w).to.equal(4);
        });

    });

    describe('#add', function () {

        it('adds a vector to another in place', function () {
            const v1 = new Vec4(1, 2, 3, 4);
            const v2 = new Vec4(5, 6, 7, 8);
            v1.add(v2);
            expect(v1.x).to.equal(6);
            expect(v1.y).to.equal(8);
            expect(v1.z).to.equal(10);
            expect(v1.w).to.equal(12);
        });

        it('adds a vector to itself in place', function () {
            const v1 = new Vec4(1, 2, 3, 4);
            v1.add(v1);
            expect(v1.x).to.equal(2);
            expect(v1.y).to.equal(4);
            expect(v1.z).to.equal(6);
            expect(v1.w).to.equal(8);
        });

    });

    describe('#add2', function () {

        it('adds two vectors together and writes result to a third vector', function () {
            const v1 = new Vec4(1, 2, 3, 4);
            const v2 = new Vec4(5, 6, 7, 8);
            const v3 = new Vec4();
            v3.add2(v1, v2);
            expect(v3.x).to.equal(6);
            expect(v3.y).to.equal(8);
            expect(v3.z).to.equal(10);
            expect(v3.w).to.equal(12);
        });

        it('adds a vector to itself and writes result to itself', function () {
            const v1 = new Vec4(1, 2, 3, 4);
            v1.add2(v1, v1);
            expect(v1.x).to.equal(2);
            expect(v1.y).to.equal(4);
            expect(v1.z).to.equal(6);
            expect(v1.w).to.equal(8);
        });

    });

    describe('#addScalar', function () {

        it('adds a scalar in place', function () {
            const v = new Vec4(1, 2, 3, 4);
            v.addScalar(2);
            expect(v.x).to.equal(3);
            expect(v.y).to.equal(4);
            expect(v.z).to.equal(5);
            expect(v.w).to.equal(6);
        });

    });

    describe('#ceil', function () {

        it('leaves integers unchanged', function () {
            const v = new Vec4(1, 2, 3, 4);
            v.ceil();
            expect(v.x).to.equal(1);
            expect(v.y).to.equal(2);
            expect(v.z).to.equal(3);
            expect(v.w).to.equal(4);
        });

        it('calculates the ceil of all components', function () {
            const v = new Vec4(1.1, 2.2, 3.3, 4.4);
            v.ceil();
            expect(v.x).to.equal(2);
            expect(v.y).to.equal(3);
            expect(v.z).to.equal(4);
            expect(v.w).to.equal(5);
        });

    });

    describe('#clone', function () {

        it('clones a vector', function () {
            const v1 = new Vec4(1, 2, 3, 4);
            const v2 = v1.clone();
            expect(v2).to.be.instanceof(Vec4);
            expect(v2.x).to.equal(1);
            expect(v2.y).to.equal(2);
            expect(v2.z).to.equal(3);
            expect(v2.w).to.equal(4);
        });

        it('ensures that an instance of a subclass keeps its class prototype', function () {
            class UserVec4 extends Vec4 {}
            const a = new UserVec4();
            const b = a.clone();
            expect(b).to.be.an.instanceof(UserVec4);
        });

    });

    describe('#copy', function () {

        it('copies a vector', function () {
            const v1 = new Vec4(1, 2, 3, 4);
            const v2 = new Vec4();
            v2.copy(v1);
            expect(v2.x).to.equal(1);
            expect(v2.y).to.equal(2);
            expect(v2.z).to.equal(3);
            expect(v2.w).to.equal(4);
        });

    });

    describe('#div', function () {

        it('divides a vector by another in place', function () {
            const v1 = new Vec4(12, 12, 12, 12);
            const v2 = new Vec4(4, 3, 2, 1);
            v1.div(v2);
            expect(v1.x).to.equal(3);
            expect(v1.y).to.equal(4);
            expect(v1.z).to.equal(6);
            expect(v1.w).to.equal(12);
        });

        it('divides a vector by itself in place', function () {
            const v1 = new Vec4(12, 12, 12, 12);
            v1.div(v1);
            expect(v1.x).to.equal(1);
            expect(v1.y).to.equal(1);
            expect(v1.z).to.equal(1);
            expect(v1.w).to.equal(1);
        });

    });

    describe('#div2', function () {

        it('divides a vector by another vector and writes the result to a third vector', function () {
            const v1 = new Vec4(12, 12, 12, 12);
            const v2 = new Vec4(4, 3, 2, 1);
            const v3 = new Vec4();
            v3.div2(v1, v2);
            expect(v3.x).to.equal(3);
            expect(v3.y).to.equal(4);
            expect(v3.z).to.equal(6);
            expect(v3.w).to.equal(12);
        });

        it('divides a vector by itself and writes the result to itself', function () {
            const v1 = new Vec4(12, 12, 12, 12);
            v1.div2(v1, v1);
            expect(v1.x).to.equal(1);
            expect(v1.y).to.equal(1);
            expect(v1.z).to.equal(1);
            expect(v1.w).to.equal(1);
        });

    });

    describe('#divScalar', function () {

        it('divides a vector by a scalar in place', function () {
            const v = new Vec4(1, 2, 3, 4);
            v.divScalar(2);
            expect(v.x).to.equal(0.5);
            expect(v.y).to.equal(1);
            expect(v.z).to.equal(1.5);
            expect(v.w).to.equal(2);
        });

    });

    describe('#dot', function () {

        it('calculates dot product of two arbitrary non-unit vectors', function () {
            const v1 = new Vec4(1, 2, 3, 4);
            const v2 = new Vec4(5, 6, 7, 8);
            const dot = v1.dot(v2);
            expect(dot).to.equal(70);
        });

        it('calculates dot product of two parallel unit vectors', function () {
            const v1 = new Vec4(1, 0, 0, 0);
            const v2 = new Vec4(1, 0, 0, 0);
            const dot = v1.dot(v2);
            expect(dot).to.equal(1);
        });

        it('calculates dot product of two perpendicular unit vectors', function () {
            const v1 = new Vec4(0, 1, 0, 0);
            const v2 = new Vec4(0, 0, 1, 0);
            expect(v1.dot(v2)).to.equal(0);
        });

    });

    describe('#equals', function () {

        it('checks for equality of the same vector', function () {
            const v = new Vec4(1, 2, 3, 4);
            expect(v.equals(v)).to.be.true;
        });

        it('checks for equality of two different vectors with the same values', function () {
            const v1 = new Vec4(1, 2, 3, 4);
            const v2 = new Vec4(1, 2, 3, 4);
            expect(v1.equals(v2)).to.be.true;
        });

        it('checks for equality of two different vectors with different values', function () {
            const v1 = new Vec4(1, 2, 3, 4);
            const v2 = new Vec4(5, 6, 7, 8);
            expect(v1.equals(v2)).to.be.false;
        });

    });

    describe('#floor', function () {

        it('leaves integers unchanged', function () {
            const v = new Vec4(1, 2, 3, 4);
            v.floor();
            expect(v.x).to.equal(1);
            expect(v.y).to.equal(2);
            expect(v.z).to.equal(3);
            expect(v.w).to.equal(4);
        });

        it('rounds down floating point numbers', function () {
            const v = new Vec4(1.1, 2.2, 3.3, 4.4);
            v.floor();
            expect(v.x).to.equal(1);
            expect(v.y).to.equal(2);
            expect(v.z).to.equal(3);
            expect(v.w).to.equal(4);
        });

    });

    describe('#length', function () {

        it('calculates the length of a zero length vector', function () {
            const v = new Vec4();
            expect(v.length()).to.equal(0);
        });

        it('calculates the length of a vector', function () {
            const v = new Vec4(0, 3, 4, 0);
            expect(v.length()).to.equal(5);
        });

    });

    describe('#lengthSq', function () {

        it('calculates the length squared of a zero length vector', function () {
            const v = new Vec4();
            expect(v.length()).to.equal(0);
        });

        it('calculates the length squared of a vector', function () {
            const v = new Vec4(0, 3, 4, 0);
            expect(v.lengthSq()).to.equal(25);
        });

    });

    describe('#lerp', function () {

        it('linearly interpolates between two vectors with alpha of 0', function () {
            const v1 = new Vec4(1, 2, 3, 4);
            const v2 = new Vec4(5, 6, 7, 8);
            const v3 = new Vec4();
            v3.lerp(v1, v2, 0);
            expect(v3.x).to.equal(1);
            expect(v3.y).to.equal(2);
            expect(v3.z).to.equal(3);
            expect(v3.w).to.equal(4);
        });

        it('linearly interpolates between two vectors with alpha of 0.5', function () {
            const v1 = new Vec4(1, 2, 3, 4);
            const v2 = new Vec4(5, 6, 7, 8);
            const v3 = new Vec4();
            v3.lerp(v1, v2, 0.5);
            expect(v3.x).to.equal(3);
            expect(v3.y).to.equal(4);
            expect(v3.z).to.equal(5);
            expect(v3.w).to.equal(6);
        });

        it('linearly interpolates between two vectors with alpha of 1', function () {
            const v1 = new Vec4(1, 2, 3, 4);
            const v2 = new Vec4(5, 6, 7, 8);
            const v3 = new Vec4();
            v3.lerp(v1, v2, 1);
            expect(v3.x).to.equal(5);
            expect(v3.y).to.equal(6);
            expect(v3.z).to.equal(7);
            expect(v3.w).to.equal(8);
        });

    });

    describe('#max', function () {

        it('handles left hand larger than right hand', function () {
            const v1 = new Vec4(5, 6, 7, 8);
            const v2 = new Vec4(1, 2, 3, 4);
            v1.max(v2);
            expect(v1.x).to.equal(5);
            expect(v1.y).to.equal(6);
            expect(v1.z).to.equal(7);
            expect(v1.w).to.equal(8);
        });

        it('handles right hand larger than left hand', function () {
            const v1 = new Vec4(1, 2, 3, 4);
            const v2 = new Vec4(5, 6, 7, 8);
            v1.max(v2);
            expect(v1.x).to.equal(5);
            expect(v1.y).to.equal(6);
            expect(v1.z).to.equal(7);
            expect(v1.w).to.equal(8);
        });

    });

    describe('#min', function () {

        it('handles left hand larger than right hand', function () {
            const v1 = new Vec4(5, 6, 7, 8);
            const v2 = new Vec4(1, 2, 3, 4);
            v1.min(v2);
            expect(v1.x).to.equal(1);
            expect(v1.y).to.equal(2);
            expect(v1.z).to.equal(3);
            expect(v1.w).to.equal(4);
        });

        it('handles right hand larger than left hand', function () {
            const v1 = new Vec4(1, 2, 3, 4);
            const v2 = new Vec4(5, 6, 7, 8);
            v1.min(v2);
            expect(v1.x).to.equal(1);
            expect(v1.y).to.equal(2);
            expect(v1.z).to.equal(3);
            expect(v1.w).to.equal(4);
        });

    });

    describe('#mul', function () {

        it('multiplies a vector by another in place', function () {
            const v1 = new Vec4(1, 2, 3, 4);
            const v2 = new Vec4(5, 6, 7, 8);
            v1.mul(v2);
            expect(v1.x).to.equal(5);
            expect(v1.y).to.equal(12);
            expect(v1.z).to.equal(21);
            expect(v1.w).to.equal(32);
        });

        it('multiplies a vector by itself in place', function () {
            const v1 = new Vec4(1, 2, 3, 4);
            v1.mul(v1);
            expect(v1.x).to.equal(1);
            expect(v1.y).to.equal(4);
            expect(v1.z).to.equal(9);
            expect(v1.w).to.equal(16);
        });

    });

    describe('#mul2', function () {

        it('multiplies a vector by another vector and writes the result to a third vector', function () {
            const v1 = new Vec4(1, 2, 3, 4);
            const v2 = new Vec4(5, 6, 7, 8);
            const v3 = new Vec4();
            v3.mul2(v1, v2);
            expect(v3.x).to.equal(5);
            expect(v3.y).to.equal(12);
            expect(v3.z).to.equal(21);
            expect(v3.w).to.equal(32);
        });

        it('multiplies a vector by itself and writes the result to itself', function () {
            const v1 = new Vec4(1, 2, 3, 4);
            v1.mul2(v1, v1);
            expect(v1.x).to.equal(1);
            expect(v1.y).to.equal(4);
            expect(v1.z).to.equal(9);
            expect(v1.w).to.equal(16);
        });

    });

    describe('#mulScalar', function () {

        it('multiplies a vector by a scalar in place', function () {
            const v = new Vec4(1, 2, 3, 4);
            v.mulScalar(2);
            expect(v.x).to.equal(2);
            expect(v.y).to.equal(4);
            expect(v.z).to.equal(6);
            expect(v.w).to.equal(8);
        });

    });

    describe('#normalize', function () {

        it('handles a zero length vector', function () {
            const v = new Vec4();
            v.normalize();
            expect(v.x).to.equal(0);
            expect(v.y).to.equal(0);
            expect(v.z).to.equal(0);
            expect(v.w).to.equal(0);
        });

        it('handles a non-zero length vector', function () {
            const v = new Vec4(1, 2, 3, 4);
            v.normalize();
            expect(v.length()).to.be.closeTo(1, 0.00001);
        });

    });

    describe('#round', function () {

        it('leaves integers unchanged', function () {
            const v = new Vec4(1, 2, 3, 4);
            v.round();
            expect(v.x).to.equal(1);
            expect(v.y).to.equal(2);
            expect(v.z).to.equal(3);
            expect(v.w).to.equal(4);
        });

        it('rounds floating point numbers to the nearest integer', function () {
            const v = new Vec4(1.1, 2.2, 3.3, 4.4);
            v.round();
            expect(v.x).to.equal(1);
            expect(v.y).to.equal(2);
            expect(v.z).to.equal(3);
            expect(v.w).to.equal(4);
        });

    });

    describe('#set', function () {

        it('sets a vector to number values', function () {
            const v = new Vec4();
            v.set(1, 2, 3, 4);
            expect(v.x).to.equal(1);
            expect(v.y).to.equal(2);
            expect(v.z).to.equal(3);
            expect(v.w).to.equal(4);
        });

    });

    describe('#sub', function () {

        it('subtracts a vector from another in place', function () {
            const v1 = new Vec4(1, 2, 3, 4);
            const v2 = new Vec4(5, 6, 7, 8);
            v1.sub(v2);
            expect(v1.x).to.equal(-4);
            expect(v1.y).to.equal(-4);
            expect(v1.z).to.equal(-4);
            expect(v1.w).to.equal(-4);
        });

        it('subtracts a vector from itself in place', function () {
            const v1 = new Vec4(1, 2, 3, 4);
            v1.sub(v1);
            expect(v1.x).to.equal(0);
            expect(v1.y).to.equal(0);
            expect(v1.z).to.equal(0);
            expect(v1.w).to.equal(0);
        });

    });

    describe('#sub2', function () {

        it('subtracts a vector from another vector and writes the result to a third vector', function () {
            const v1 = new Vec4(1, 2, 3, 4);
            const v2 = new Vec4(5, 6, 7, 8);
            const v3 = new Vec4();
            v3.sub2(v1, v2);
            expect(v3.x).to.equal(-4);
            expect(v3.y).to.equal(-4);
            expect(v3.z).to.equal(-4);
            expect(v3.w).to.equal(-4);
        });

        it('subtracts a vector from itself and writes the result to itself', function () {
            const v1 = new Vec4(1, 2, 3, 4);
            v1.sub2(v1, v1);
            expect(v1.x).to.equal(0);
            expect(v1.y).to.equal(0);
            expect(v1.z).to.equal(0);
            expect(v1.w).to.equal(0);
        });

    });

    describe('#subScalar', function () {

        it('subtracts a scalar from a vector in place', function () {
            const v = new Vec4(1, 2, 3, 4);
            v.subScalar(2);
            expect(v.x).to.equal(-1);
            expect(v.y).to.equal(0);
            expect(v.z).to.equal(1);
            expect(v.w).to.equal(2);
        });

    });

    describe('#toString', function () {

        it('returns a string representation of a vector', function () {
            const v = new Vec4(1, 2, 3, 4);
            expect(v.toString()).to.equal('[1, 2, 3, 4]');
        });

    });

});
