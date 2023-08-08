import { Vec2 } from '../../../src/core/math/vec2.js';

import { expect } from 'chai';

describe('Vec2', function () {

    describe('#constructor', function () {

        it('supports zero arguments', function () {
            const v = new Vec2();
            expect(v.x).to.equal(0);
            expect(v.y).to.equal(0);
        });

        it('supports number arguments', function () {
            const v = new Vec2(1, 2);
            expect(v.x).to.equal(1);
            expect(v.y).to.equal(2);
        });

        it('supports an array argument', function () {
            const v = new Vec2([1, 2]);
            expect(v.x).to.equal(1);
            expect(v.y).to.equal(2);
        });

    });

    describe('#add', function () {

        it('adds a vector to another in place', function () {
            const v1 = new Vec2(1, 2);
            const v2 = new Vec2(3, 4);
            v1.add(v2);
            expect(v1.x).to.equal(4);
            expect(v1.y).to.equal(6);
        });

        it('adds a vector to itself in place', function () {
            const v1 = new Vec2(1, 2);
            v1.add(v1);
            expect(v1.x).to.equal(2);
            expect(v1.y).to.equal(4);
        });

    });

    describe('#add2', function () {

        it('adds two vectors together and writes result to a third vector', function () {
            const v1 = new Vec2(1, 2);
            const v2 = new Vec2(3, 4);
            const v3 = new Vec2();
            v3.add2(v1, v2);
            expect(v3.x).to.equal(4);
            expect(v3.y).to.equal(6);
        });

        it('adds a vector to itself and writes result to itself', function () {
            const v1 = new Vec2(1, 2);
            v1.add2(v1, v1);
            expect(v1.x).to.equal(2);
            expect(v1.y).to.equal(4);
        });

    });

    describe('#addScalar', function () {

        it('adds a scalar in place', function () {
            const v = new Vec2(1, 2);
            v.addScalar(2);
            expect(v.x).to.equal(3);
            expect(v.y).to.equal(4);
        });

    });

    describe('#ceil', function () {

        it('leaves integers unchanged', function () {
            const v = new Vec2(1, 2);
            v.ceil();
            expect(v.x).to.equal(1);
            expect(v.y).to.equal(2);
        });

        it('calculates the ceil of all components', function () {
            const v = new Vec2(1.1, 2.2);
            v.ceil();
            expect(v.x).to.equal(2);
            expect(v.y).to.equal(3);
        });

    });

    describe('#clone', function () {

        it('clones a vector', function () {
            const v1 = new Vec2(1, 2);
            const v2 = v1.clone();
            expect(v2).to.be.instanceof(Vec2);
            expect(v2.x).to.equal(1);
            expect(v2.y).to.equal(2);
        });

        it('ensures that an instance of a subclass keeps its class prototype', function () {
            class UserVec2 extends Vec2 {}
            const a = new UserVec2();
            const b = a.clone();
            expect(b).to.be.an.instanceof(UserVec2);
        });

    });

    describe('#copy', function () {

        it('copies a vector', function () {
            const v1 = new Vec2(1, 2);
            const v2 = new Vec2();
            v2.copy(v1);
            expect(v2.x).to.equal(1);
            expect(v2.y).to.equal(2);
        });

    });

    describe('#cross', function () {

        it('calculates cross product of two vectors', function () {
            const v1 = new Vec2(1, 0);
            const v2 = new Vec2(0, 1);
            expect(v1.cross(v2)).to.equal(1);
        });

    });

    describe('#distance', function () {

        it('calculates the distance between two vectors', function () {
            const v1 = new Vec2();
            const v2 = new Vec2(10, 0);
            const distance = v1.distance(v2);
            expect(distance).to.equal(10);
        });

        it('returns zero for the distance between the same vector', function () {
            const v1 = new Vec2(10, 0);
            const distance = v1.distance(v1);
            expect(distance).to.equal(0);
        });

    });

    describe('#div', function () {

        it('divides a vector by another in place', function () {
            const v1 = new Vec2(1, 2);
            const v2 = new Vec2(3, 4);
            v1.div(v2);
            expect(v1.x).to.equal(1 / 3);
            expect(v1.y).to.equal(0.5);
        });

        it('divides a vector by itself in place', function () {
            const v1 = new Vec2(1, 2);
            v1.div(v1);
            expect(v1.x).to.equal(1);
            expect(v1.y).to.equal(1);
        });

    });

    describe('#div2', function () {

        it('divides a vector by another vector and writes the result to a third vector', function () {
            const v1 = new Vec2(1, 2);
            const v2 = new Vec2(3, 4);
            const v3 = new Vec2();
            v3.div2(v1, v2);
            expect(v3.x).to.equal(1 / 3);
            expect(v3.y).to.equal(0.5);
        });

        it('divides a vector by itself and writes the result to itself', function () {
            const v1 = new Vec2(1, 2);
            v1.div2(v1, v1);
            expect(v1.x).to.equal(1);
            expect(v1.y).to.equal(1);
        });

    });

    describe('#divScalar', function () {

        it('divides a vector by a scalar in place', function () {
            const v = new Vec2(1, 2);
            v.divScalar(2);
            expect(v.x).to.equal(0.5);
            expect(v.y).to.equal(1);
        });

    });

    describe('#dot', function () {

        it('calculates dot product of two arbitrary non-unit vectors', function () {
            const v1 = new Vec2(1, 2);
            const v2 = new Vec2(3, 4);
            expect(v1.dot(v2)).to.equal(11);
        });

        it('calculates dot product of two parallel unit vectors', function () {
            const v1 = new Vec2(1, 0);
            const v2 = new Vec2(1, 0);
            expect(v1.dot(v2)).to.equal(1);
        });

        it('calculates dot product of two perpendicular unit vectors', function () {
            const v1 = new Vec2(1, 0);
            const v2 = new Vec2(0, 1);
            expect(v1.dot(v2)).to.equal(0);
        });

    });

    describe('#equals', function () {

        it('checks for equality of the same vector', function () {
            const v = new Vec2(1, 2);
            expect(v.equals(v)).to.be.true;
        });

        it('checks for equality of two different vectors with the same values', function () {
            const v1 = new Vec2(1, 2);
            const v2 = new Vec2(1, 2);
            expect(v1.equals(v2)).to.be.true;
        });

        it('checks for equality of two different vectors with different values', function () {
            const v1 = new Vec2(1, 2);
            const v2 = new Vec2(3, 4);
            expect(v1.equals(v2)).to.be.false;
        });

    });

    describe('#floor', function () {

        it('leaves integers unchanged', function () {
            const v = new Vec2(1, 2);
            v.floor();
            expect(v.x).to.equal(1);
            expect(v.y).to.equal(2);
        });

        it('rounds down floating point numbers', function () {
            const v = new Vec2(1.1, 2.2);
            v.floor();
            expect(v.x).to.equal(1);
            expect(v.y).to.equal(2);
        });

    });

    describe('#length', function () {

        it('calculates the length of a zero length vector', function () {
            const v = new Vec2();
            expect(v.length()).to.equal(0);
        });

        it('calculates the length of a vector', function () {
            const v = new Vec2(3, 4);
            expect(v.length()).to.equal(5);
        });

    });

    describe('#lengthSq', function () {

        it('calculates the length squared of a zero length vector', function () {
            const v = new Vec2();
            expect(v.length()).to.equal(0);
        });

        it('calculates the length squared of a vector', function () {
            const v = new Vec2(3, 4);
            expect(v.lengthSq()).to.equal(25);
        });

    });

    describe('#lerp', function () {

        it('linearly interpolates between two vectors with alpha of 0', function () {
            const v1 = new Vec2(1, 2);
            const v2 = new Vec2(3, 4);
            const v3 = new Vec2();
            v3.lerp(v1, v2, 0);
            expect(v3.x).to.equal(1);
            expect(v3.y).to.equal(2);
        });

        it('linearly interpolates between two vectors with alpha of 0.5', function () {
            const v1 = new Vec2(1, 2);
            const v2 = new Vec2(3, 4);
            const v3 = new Vec2();
            v3.lerp(v1, v2, 0.5);
            expect(v3.x).to.equal(2);
            expect(v3.y).to.equal(3);
        });

        it('linearly interpolates between two vectors with alpha of 1', function () {
            const v1 = new Vec2(1, 2);
            const v2 = new Vec2(3, 4);
            const v3 = new Vec2();
            v3.lerp(v1, v2, 1);
            expect(v3.x).to.equal(3);
            expect(v3.y).to.equal(4);
        });

    });

    describe('#max', function () {

        it('handles left hand larger than right hand', function () {
            const v1 = new Vec2(3, 4);
            const v2 = new Vec2(1, 2);
            v1.max(v2);
            expect(v1.x).to.equal(3);
            expect(v1.y).to.equal(4);
        });

        it('handles right hand larger than left hand', function () {
            const v1 = new Vec2(1, 2);
            const v2 = new Vec2(3, 4);
            v1.max(v2);
            expect(v1.x).to.equal(3);
            expect(v1.y).to.equal(4);
        });

    });

    describe('#min', function () {

        it('handles left hand larger than right hand', function () {
            const v1 = new Vec2(3, 4);
            const v2 = new Vec2(1, 2);
            v1.min(v2);
            expect(v1.x).to.equal(1);
            expect(v1.y).to.equal(2);
        });

        it('handles right hand larger than left hand', function () {
            const v1 = new Vec2(1, 2);
            const v2 = new Vec2(3, 4);
            v1.min(v2);
            expect(v1.x).to.equal(1);
            expect(v1.y).to.equal(2);
        });

    });

    describe('#mul', function () {

        it('multiplies a vector by another in place', function () {
            const v1 = new Vec2(1, 2);
            const v2 = new Vec2(3, 4);
            v1.mul(v2);
            expect(v1.x).to.equal(3);
            expect(v1.y).to.equal(8);
        });

        it('multiplies a vector by itself in place', function () {
            const v1 = new Vec2(1, 2);
            v1.mul(v1);
            expect(v1.x).to.equal(1);
            expect(v1.y).to.equal(4);
        });

    });

    describe('#mul2', function () {

        it('multiplies a vector by another vector and writes the result to a third vector', function () {
            const v1 = new Vec2(1, 2);
            const v2 = new Vec2(3, 4);
            const v3 = new Vec2();
            v3.mul2(v1, v2);
            expect(v3.x).to.equal(3);
            expect(v3.y).to.equal(8);
        });

        it('multiplies a vector by itself and writes the result to itself', function () {
            const v1 = new Vec2(1, 2);
            v1.mul2(v1, v1);
            expect(v1.x).to.equal(1);
            expect(v1.y).to.equal(4);
        });

    });

    describe('#mulScalar', function () {

        it('multiplies a vector by a scalar in place', function () {
            const v = new Vec2(1, 2);
            v.mulScalar(2);
            expect(v.x).to.equal(2);
            expect(v.y).to.equal(4);
        });

    });

    describe('#normalize', function () {

        it('handles a zero length vector', function () {
            const v = new Vec2();
            v.normalize();
            expect(v.x).to.equal(0);
            expect(v.y).to.equal(0);
        });

        it('handles a non-zero length vector', function () {
            const v = new Vec2(1, 2);
            v.normalize();
            expect(v.length()).to.be.closeTo(1, 0.00001);
        });

    });

    describe('#round', function () {

        it('leaves integers unchanged', function () {
            const v = new Vec2(1, 2);
            v.round();
            expect(v.x).to.equal(1);
            expect(v.y).to.equal(2);
        });

        it('rounds floating point numbers to the nearest integer', function () {
            const v = new Vec2(1.1, 2.2);
            v.round();
            expect(v.x).to.equal(1);
            expect(v.y).to.equal(2);
        });

    });

    describe('#set', function () {

        it('sets a vector to number values', function () {
            const v = new Vec2();
            v.set(1, 2);
            expect(v.x).to.equal(1);
            expect(v.y).to.equal(2);
        });

    });

    describe('#sub', function () {

        it('subtracts a vector from another in place', function () {
            const v1 = new Vec2(1, 2);
            const v2 = new Vec2(3, 4);
            v1.sub(v2);
            expect(v1.x).to.equal(-2);
            expect(v1.y).to.equal(-2);
        });

        it('subtracts a vector from itself in place', function () {
            const v1 = new Vec2(1, 2);
            v1.sub(v1);
            expect(v1.x).to.equal(0);
            expect(v1.y).to.equal(0);
        });

    });

    describe('#sub2', function () {

        it('subtracts a vector from another vector and writes the result to a third vector', function () {
            const v1 = new Vec2(1, 2);
            const v2 = new Vec2(3, 4);
            const v3 = new Vec2();
            v3.sub2(v1, v2);
            expect(v3.x).to.equal(-2);
            expect(v3.y).to.equal(-2);
        });

        it('subtracts a vector from itself and writes the result to itself', function () {
            const v1 = new Vec2(1, 2);
            v1.sub2(v1, v1);
            expect(v1.x).to.equal(0);
            expect(v1.y).to.equal(0);
        });

    });

    describe('#subScalar', function () {

        it('subtracts a scalar from a vector in place', function () {
            const v = new Vec2(1, 2);
            v.subScalar(2);
            expect(v.x).to.equal(-1);
            expect(v.y).to.equal(0);
        });

    });

    describe('#toString', function () {

        it('returns a string representation of a vector', function () {
            const v = new Vec2(1, 2);
            expect(v.toString()).to.equal('[1, 2]');
        });

    });

});
