import { Vec3 } from '../../../src/core/math/vec3.js';

import { expect } from 'chai';

describe('Vec3', function () {

    describe('#constructor', function () {

        it('supports zero arguments', function () {
            const v = new Vec3();
            expect(v.x).to.equal(0);
            expect(v.y).to.equal(0);
            expect(v.z).to.equal(0);
        });

        it('supports number arguments', function () {
            const v = new Vec3(1, 2, 3);
            expect(v.x).to.equal(1);
            expect(v.y).to.equal(2);
            expect(v.z).to.equal(3);
        });

        it('supports an array argument', function () {
            const v = new Vec3([1, 2, 3]);
            expect(v.x).to.equal(1);
            expect(v.y).to.equal(2);
            expect(v.z).to.equal(3);
        });

    });

    describe('#add', function () {

        it('adds a vector to another in place', function () {
            const v1 = new Vec3(1, 2, 3);
            const v2 = new Vec3(4, 5, 6);
            v1.add(v2);
            expect(v1.x).to.equal(5);
            expect(v1.y).to.equal(7);
            expect(v1.z).to.equal(9);
        });

        it('adds a vector to itself in place', function () {
            const v1 = new Vec3(1, 2, 3);
            v1.add(v1);
            expect(v1.x).to.equal(2);
            expect(v1.y).to.equal(4);
            expect(v1.z).to.equal(6);
        });

    });

    describe('#add2', function () {

        it('adds two vectors together and writes result to a third vector', function () {
            const v1 = new Vec3(1, 2, 3);
            const v2 = new Vec3(4, 5, 6);
            const v3 = new Vec3();
            v3.add2(v1, v2);
            expect(v3.x).to.equal(5);
            expect(v3.y).to.equal(7);
            expect(v3.z).to.equal(9);
        });

        it('adds a vector to itself and writes result to itself', function () {
            const v1 = new Vec3(1, 2, 3);
            v1.add2(v1, v1);
            expect(v1.x).to.equal(2);
            expect(v1.y).to.equal(4);
            expect(v1.z).to.equal(6);
        });

    });

    describe('#addScalar', function () {

        it('adds a scalar in place', function () {
            const v = new Vec3(1, 2, 3);
            v.addScalar(2);
            expect(v.x).to.equal(3);
            expect(v.y).to.equal(4);
            expect(v.z).to.equal(5);
        });

    });

    describe('#ceil', function () {

        it('leaves integers unchanged', function () {
            const v = new Vec3(1, 2, 3);
            v.ceil();
            expect(v.x).to.equal(1);
            expect(v.y).to.equal(2);
            expect(v.z).to.equal(3);
        });

        it('calculates the ceil of all components', function () {
            const v = new Vec3(1.1, 2.2, 3.3);
            v.ceil();
            expect(v.x).to.equal(2);
            expect(v.y).to.equal(3);
            expect(v.z).to.equal(4);
        });

    });

    describe('#clone', function () {

        it('clones a vector', function () {
            const v1 = new Vec3(1, 2, 3);
            const v2 = v1.clone();
            expect(v2).to.be.instanceof(Vec3);
            expect(v2.x).to.equal(1);
            expect(v2.y).to.equal(2);
            expect(v2.z).to.equal(3);
        });

        it('ensures that an instance of a subclass keeps its class prototype', function () {
            class UserVec3 extends Vec3 {}
            const a = new UserVec3();
            const b = a.clone();
            expect(b).to.be.an.instanceof(UserVec3);
        });

    });

    describe('#copy', function () {

        it('copies a vector', function () {
            const v1 = new Vec3(1, 2, 3);
            const v2 = new Vec3();
            v2.copy(v1);
            expect(v2.x).to.equal(1);
            expect(v2.y).to.equal(2);
            expect(v2.z).to.equal(3);
        });

    });

    describe('#cross', function () {

        it('calculates cross product of two vectors', function () {
            const v1 = new Vec3(1, 0, 0);
            const v2 = new Vec3(0, 1, 0);
            const v3 = new Vec3();
            v3.cross(v1, v2);
            expect(v3.x).to.equal(0);
            expect(v3.y).to.equal(0);
            expect(v3.z).to.equal(1);
        });

        it('handles first vector also as the result', function () {
            const v1 = new Vec3(1, 0, 0);
            const v2 = new Vec3(0, 1, 0);
            v1.cross(v1, v2);
            expect(v1.x).to.equal(0);
            expect(v1.y).to.equal(0);
            expect(v1.z).to.equal(1);
        });

        it('handles second vector also as the result', function () {
            const v1 = new Vec3(1, 0, 0);
            const v2 = new Vec3(0, 1, 0);
            v2.cross(v1, v2);
            expect(v2.x).to.equal(0);
            expect(v2.y).to.equal(0);
            expect(v2.z).to.equal(1);
        });

    });

    describe('#distance', function () {

        it('calculates the distance between two vectors', function () {
            const v1 = new Vec3();
            const v2 = new Vec3(10, 0, 0);
            const distance = v1.distance(v2);
            expect(distance).to.equal(10);
        });

        it('returns zero for the distance between the same vector', function () {
            const v1 = new Vec3(10, 0, 0);
            const distance = v1.distance(v1);
            expect(distance).to.equal(0);
        });

    });

    describe('#div', function () {

        it('divides a vector by another in place', function () {
            const v1 = new Vec3(1, 2, 3);
            const v2 = new Vec3(4, 5, 6);
            v1.div(v2);
            expect(v1.x).to.equal(0.25);
            expect(v1.y).to.equal(0.4);
            expect(v1.z).to.equal(0.5);
        });

        it('divides a vector by itself in place', function () {
            const v1 = new Vec3(1, 2, 3);
            v1.div(v1);
            expect(v1.x).to.equal(1);
            expect(v1.y).to.equal(1);
            expect(v1.z).to.equal(1);
        });

    });

    describe('#div2', function () {

        it('divides a vector by another vector and writes the result to a third vector', function () {
            const v1 = new Vec3(1, 2, 3);
            const v2 = new Vec3(4, 5, 6);
            const v3 = new Vec3();
            v3.div2(v1, v2);
            expect(v3.x).to.equal(0.25);
            expect(v3.y).to.equal(0.4);
            expect(v3.z).to.equal(0.5);
        });

        it('divides a vector by itself and writes the result to itself', function () {
            const v1 = new Vec3(1, 2, 3);
            v1.div2(v1, v1);
            expect(v1.x).to.equal(1);
            expect(v1.y).to.equal(1);
            expect(v1.z).to.equal(1);
        });

    });

    describe('#divScalar', function () {

        it('divides a vector by a scalar in place', function () {
            const v = new Vec3(1, 2, 3);
            v.divScalar(2);
            expect(v.x).to.equal(0.5);
            expect(v.y).to.equal(1);
            expect(v.z).to.equal(1.5);
        });

    });

    describe('#dot', function () {

        it('calculates dot product of two arbitrary non-unit vectors', function () {
            const v1 = new Vec3(1, 2, 3);
            const v2 = new Vec3(4, 5, 6);
            expect(v1.dot(v2)).to.equal(32);
        });

        it('calculates dot product of two parallel unit vectors', function () {
            const v1 = new Vec3(1, 0, 0);
            const v2 = new Vec3(1, 0, 0);
            expect(v1.dot(v2)).to.equal(1);
        });

        it('calculates dot product of two perpendicular unit vectors', function () {
            const v1 = new Vec3(0, 1, 0);
            const v2 = new Vec3(0, 0, 1);
            expect(v1.dot(v2)).to.equal(0);
        });

    });

    describe('#equals', function () {

        it('checks for equality of the same vector', function () {
            const v = new Vec3(1, 2, 3);
            expect(v.equals(v)).to.be.true;
        });

        it('checks for equality of two different vectors with the same values', function () {
            const v1 = new Vec3(1, 2, 3);
            const v2 = new Vec3(1, 2, 3);
            expect(v1.equals(v2)).to.be.true;
        });

        it('checks for equality of two different vectors with different values', function () {
            const v1 = new Vec3(1, 2, 3);
            const v2 = new Vec3(4, 5, 6);
            expect(v1.equals(v2)).to.be.false;
        });

    });

    describe('#floor', function () {

        it('leaves integers unchanged', function () {
            const v = new Vec3(1, 2, 3);
            v.floor();
            expect(v.x).to.equal(1);
            expect(v.y).to.equal(2);
            expect(v.z).to.equal(3);
        });

        it('rounds down floating point numbers', function () {
            const v = new Vec3(1.1, 2.2, 3.3);
            v.floor();
            expect(v.x).to.equal(1);
            expect(v.y).to.equal(2);
            expect(v.z).to.equal(3);
        });

    });

    describe('#length', function () {

        it('calculates the length of a zero length vector', function () {
            const v = new Vec3();
            expect(v.length()).to.equal(0);
        });

        it('calculates the length of a vector', function () {
            const v = new Vec3(0, 3, 4);
            expect(v.length()).to.equal(5);
        });

    });

    describe('#lengthSq', function () {

        it('calculates the length squared of a zero length vector', function () {
            const v = new Vec3();
            expect(v.length()).to.equal(0);
        });

        it('calculates the length squared of a vector', function () {
            const v = new Vec3(0, 3, 4);
            expect(v.lengthSq()).to.equal(25);
        });

    });

    describe('#lerp', function () {

        it('linearly interpolates between two vectors with alpha of 0', function () {
            const v1 = new Vec3(1, 2, 3);
            const v2 = new Vec3(4, 5, 6);
            const v3 = new Vec3();
            v3.lerp(v1, v2, 0);
            expect(v3.x).to.equal(1);
            expect(v3.y).to.equal(2);
            expect(v3.z).to.equal(3);
        });

        it('linearly interpolates between two vectors with alpha of 0.5', function () {
            const v1 = new Vec3(1, 2, 3);
            const v2 = new Vec3(4, 5, 6);
            const v3 = new Vec3();
            v3.lerp(v1, v2, 0.5);
            expect(v3.x).to.equal(2.5);
            expect(v3.y).to.equal(3.5);
            expect(v3.z).to.equal(4.5);
        });

        it('linearly interpolates between two vectors with alpha of 1', function () {
            const v1 = new Vec3(1, 2, 3);
            const v2 = new Vec3(4, 5, 6);
            const v3 = new Vec3();
            v3.lerp(v1, v2, 1);
            expect(v3.x).to.equal(4);
            expect(v3.y).to.equal(5);
            expect(v3.z).to.equal(6);
        });

    });

    describe('#max', function () {

        it('handles left hand larger than right hand', function () {
            const v1 = new Vec3(4, 5, 6);
            const v2 = new Vec3(1, 2, 3);
            v1.max(v2);
            expect(v1.x).to.equal(4);
            expect(v1.y).to.equal(5);
            expect(v1.z).to.equal(6);
        });

        it('handles right hand larger than left hand', function () {
            const v1 = new Vec3(1, 2, 3);
            const v2 = new Vec3(4, 5, 6);
            v1.max(v2);
            expect(v1.x).to.equal(4);
            expect(v1.y).to.equal(5);
            expect(v1.z).to.equal(6);
        });

    });

    describe('#min', function () {

        it('handles left hand larger than right hand', function () {
            const v1 = new Vec3(4, 5, 6);
            const v2 = new Vec3(1, 2, 3);
            v1.min(v2);
            expect(v1.x).to.equal(1);
            expect(v1.y).to.equal(2);
            expect(v1.z).to.equal(3);
        });

        it('handles right hand larger than left hand', function () {
            const v1 = new Vec3(1, 2, 3);
            const v2 = new Vec3(4, 5, 6);
            v1.min(v2);
            expect(v1.x).to.equal(1);
            expect(v1.y).to.equal(2);
            expect(v1.z).to.equal(3);
        });

    });

    describe('#mul', function () {

        it('multiplies a vector by another in place', function () {
            const v1 = new Vec3(1, 2, 3);
            const v2 = new Vec3(4, 5, 6);
            v1.mul(v2);
            expect(v1.x).to.equal(4);
            expect(v1.y).to.equal(10);
            expect(v1.z).to.equal(18);
        });

        it('multiplies a vector by itself in place', function () {
            const v1 = new Vec3(1, 2, 3);
            v1.mul(v1);
            expect(v1.x).to.equal(1);
            expect(v1.y).to.equal(4);
            expect(v1.z).to.equal(9);
        });

    });

    describe('#mul2', function () {

        it('multiplies a vector by another vector and writes the result to a third vector', function () {
            const v1 = new Vec3(1, 2, 3);
            const v2 = new Vec3(4, 5, 6);
            const v3 = new Vec3();
            v3.mul2(v1, v2);
            expect(v3.x).to.equal(4);
            expect(v3.y).to.equal(10);
            expect(v3.z).to.equal(18);
        });

        it('multiplies a vector by itself and writes the result to itself', function () {
            const v1 = new Vec3(1, 2, 3);
            v1.mul2(v1, v1);
            expect(v1.x).to.equal(1);
            expect(v1.y).to.equal(4);
            expect(v1.z).to.equal(9);
        });

    });

    describe('#mulScalar', function () {

        it('multiplies a vector by a scalar in place', function () {
            const v = new Vec3(1, 2, 3);
            v.mulScalar(2);
            expect(v.x).to.equal(2);
            expect(v.y).to.equal(4);
            expect(v.z).to.equal(6);
        });

    });

    describe('#normalize', function () {

        it('handles a zero length vector', function () {
            const v = new Vec3();
            v.normalize();
            expect(v.x).to.equal(0);
            expect(v.y).to.equal(0);
            expect(v.z).to.equal(0);
        });

        it('handles a non-zero length vector', function () {
            const v = new Vec3(1, 2, 3);
            v.normalize();
            expect(v.length()).to.equal(1);
        });

    });

    describe('#project', function () {

        it('projects a vector onto another vector', function () {
            const v1 = new Vec3(5, 5, 5);
            const v2 = new Vec3(1, 0, 0);
            v1.project(v2);
            expect(v1.x).to.equal(5);
            expect(v1.y).to.equal(0);
            expect(v1.z).to.equal(0);
        });

    });

    describe('#round', function () {

        it('leaves integers unchanged', function () {
            const v = new Vec3(1, 2, 3);
            v.round();
            expect(v.x).to.equal(1);
            expect(v.y).to.equal(2);
            expect(v.z).to.equal(3);
        });

        it('rounds floating point numbers to the nearest integer', function () {
            const v = new Vec3(1.1, 2.2, 3.3);
            v.round();
            expect(v.x).to.equal(1);
            expect(v.y).to.equal(2);
            expect(v.z).to.equal(3);
        });

    });

    describe('#set', function () {

        it('sets a vector to number values', function () {
            const v = new Vec3();
            v.set(1, 2, 3);
            expect(v.x).to.equal(1);
            expect(v.y).to.equal(2);
            expect(v.z).to.equal(3);
        });

    });

    describe('#sub', function () {

        it('subtracts a vector from another in place', function () {
            const v1 = new Vec3(1, 2, 3);
            const v2 = new Vec3(4, 5, 6);
            v1.sub(v2);
            expect(v1.x).to.equal(-3);
            expect(v1.y).to.equal(-3);
            expect(v1.z).to.equal(-3);
        });

        it('subtracts a vector from itself in place', function () {
            const v1 = new Vec3(1, 2, 3);
            v1.sub(v1);
            expect(v1.x).to.equal(0);
            expect(v1.y).to.equal(0);
            expect(v1.z).to.equal(0);
        });

    });

    describe('#sub2', function () {

        it('subtracts a vector from another vector and writes the result to a third vector', function () {
            const v1 = new Vec3(1, 2, 3);
            const v2 = new Vec3(4, 5, 6);
            const v3 = new Vec3();
            v3.sub2(v1, v2);
            expect(v3.x).to.equal(-3);
            expect(v3.y).to.equal(-3);
            expect(v3.z).to.equal(-3);
        });

        it('subtracts a vector from itself and writes the result to itself', function () {
            const v1 = new Vec3(1, 2, 3);
            v1.sub2(v1, v1);
            expect(v1.x).to.equal(0);
            expect(v1.y).to.equal(0);
            expect(v1.z).to.equal(0);
        });

    });

    describe('#subScalar', function () {

        it('subtracts a scalar from a vector in place', function () {
            const v = new Vec3(1, 2, 3);
            v.subScalar(2);
            expect(v.x).to.equal(-1);
            expect(v.y).to.equal(0);
            expect(v.z).to.equal(1);
        });

    });

    describe('#toString', function () {

        it('returns a string representation of a vector', function () {
            const v = new Vec3(1, 2, 3);
            expect(v.toString()).to.equal('[1, 2, 3]');
        });

    });

});
