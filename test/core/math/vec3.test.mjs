import { Vec3 } from '../../../src/core/math/vec3.js';

import { expect } from 'chai';

describe('Vec3', () => {

    describe('#constructor', () => {

        it('supports zero arguments', () => {
            const v = new Vec3();
            expect(v.x).to.equal(0);
            expect(v.y).to.equal(0);
            expect(v.z).to.equal(0);
        });

        it('supports number arguments', () => {
            const v = new Vec3(1, 2, 3);
            expect(v.x).to.equal(1);
            expect(v.y).to.equal(2);
            expect(v.z).to.equal(3);
        });

        it('supports an array argument', () => {
            const v = new Vec3([1, 2, 3]);
            expect(v.x).to.equal(1);
            expect(v.y).to.equal(2);
            expect(v.z).to.equal(3);
        });

    });

    describe('#add', () => {

        it('adds a vector to another in place', () => {
            const v1 = new Vec3(1, 2, 3);
            const v2 = new Vec3(4, 5, 6);
            v1.add(v2);
            expect(v1.x).to.equal(5);
            expect(v1.y).to.equal(7);
            expect(v1.z).to.equal(9);
        });

        it('adds a vector to itself in place', () => {
            const v1 = new Vec3(1, 2, 3);
            v1.add(v1);
            expect(v1.x).to.equal(2);
            expect(v1.y).to.equal(4);
            expect(v1.z).to.equal(6);
        });

    });

    describe('#add2', () => {

        it('adds two vectors together and writes result to a third vector', () => {
            const v1 = new Vec3(1, 2, 3);
            const v2 = new Vec3(4, 5, 6);
            const v3 = new Vec3();
            v3.add2(v1, v2);
            expect(v3.x).to.equal(5);
            expect(v3.y).to.equal(7);
            expect(v3.z).to.equal(9);
        });

        it('adds a vector to itself and writes result to itself', () => {
            const v1 = new Vec3(1, 2, 3);
            v1.add2(v1, v1);
            expect(v1.x).to.equal(2);
            expect(v1.y).to.equal(4);
            expect(v1.z).to.equal(6);
        });

    });

    describe('#addScalar', () => {

        it('adds a scalar in place', () => {
            const v = new Vec3(1, 2, 3);
            v.addScalar(2);
            expect(v.x).to.equal(3);
            expect(v.y).to.equal(4);
            expect(v.z).to.equal(5);
        });

    });

    describe('#addScaled', () => {

        it('adds a scaled vector', () => {
            const v = new Vec3(1, 2, 3);
            v.addScaled(Vec3.UP, 2);
            expect(v.x).to.equal(1);
            expect(v.y).to.equal(4);
            expect(v.z).to.equal(3);
        });

    });

    describe('#ceil', () => {

        it('leaves integers unchanged', () => {
            const v = new Vec3(1, 2, 3);
            v.ceil();
            expect(v.x).to.equal(1);
            expect(v.y).to.equal(2);
            expect(v.z).to.equal(3);
        });

        it('calculates the ceil of all components', () => {
            const v = new Vec3(1.1, 2.2, 3.3);
            v.ceil();
            expect(v.x).to.equal(2);
            expect(v.y).to.equal(3);
            expect(v.z).to.equal(4);
        });

    });

    describe('#clone', () => {

        it('clones a vector', () => {
            const v1 = new Vec3(1, 2, 3);
            const v2 = v1.clone();
            expect(v2).to.be.instanceof(Vec3);
            expect(v2.x).to.equal(1);
            expect(v2.y).to.equal(2);
            expect(v2.z).to.equal(3);
        });

        it('ensures that an instance of a subclass keeps its class prototype', () => {
            class UserVec3 extends Vec3 {}
            const a = new UserVec3();
            const b = a.clone();
            expect(b).to.be.an.instanceof(UserVec3);
        });

    });

    describe('#copy', () => {

        it('copies a vector', () => {
            const v1 = new Vec3(1, 2, 3);
            const v2 = new Vec3();
            v2.copy(v1);
            expect(v2.x).to.equal(1);
            expect(v2.y).to.equal(2);
            expect(v2.z).to.equal(3);
        });

    });

    describe('#cross', () => {

        it('calculates cross product of two vectors', () => {
            const v1 = new Vec3(1, 0, 0);
            const v2 = new Vec3(0, 1, 0);
            const v3 = new Vec3();
            v3.cross(v1, v2);
            expect(v3.x).to.equal(0);
            expect(v3.y).to.equal(0);
            expect(v3.z).to.equal(1);
        });

        it('handles first vector also as the result', () => {
            const v1 = new Vec3(1, 0, 0);
            const v2 = new Vec3(0, 1, 0);
            v1.cross(v1, v2);
            expect(v1.x).to.equal(0);
            expect(v1.y).to.equal(0);
            expect(v1.z).to.equal(1);
        });

        it('handles second vector also as the result', () => {
            const v1 = new Vec3(1, 0, 0);
            const v2 = new Vec3(0, 1, 0);
            v2.cross(v1, v2);
            expect(v2.x).to.equal(0);
            expect(v2.y).to.equal(0);
            expect(v2.z).to.equal(1);
        });

    });

    describe('#distance', () => {

        it('calculates the distance between two vectors', () => {
            const v1 = new Vec3();
            const v2 = new Vec3(10, 0, 0);
            const distance = v1.distance(v2);
            expect(distance).to.equal(10);
        });

        it('returns zero for the distance between the same vector', () => {
            const v1 = new Vec3(10, 0, 0);
            const distance = v1.distance(v1);
            expect(distance).to.equal(0);
        });

    });

    describe('#div', () => {

        it('divides a vector by another in place', () => {
            const v1 = new Vec3(1, 2, 3);
            const v2 = new Vec3(4, 5, 6);
            v1.div(v2);
            expect(v1.x).to.equal(0.25);
            expect(v1.y).to.equal(0.4);
            expect(v1.z).to.equal(0.5);
        });

        it('divides a vector by itself in place', () => {
            const v1 = new Vec3(1, 2, 3);
            v1.div(v1);
            expect(v1.x).to.equal(1);
            expect(v1.y).to.equal(1);
            expect(v1.z).to.equal(1);
        });

    });

    describe('#div2', () => {

        it('divides a vector by another vector and writes the result to a third vector', () => {
            const v1 = new Vec3(1, 2, 3);
            const v2 = new Vec3(4, 5, 6);
            const v3 = new Vec3();
            v3.div2(v1, v2);
            expect(v3.x).to.equal(0.25);
            expect(v3.y).to.equal(0.4);
            expect(v3.z).to.equal(0.5);
        });

        it('divides a vector by itself and writes the result to itself', () => {
            const v1 = new Vec3(1, 2, 3);
            v1.div2(v1, v1);
            expect(v1.x).to.equal(1);
            expect(v1.y).to.equal(1);
            expect(v1.z).to.equal(1);
        });

    });

    describe('#divScalar', () => {

        it('divides a vector by a scalar in place', () => {
            const v = new Vec3(1, 2, 3);
            v.divScalar(2);
            expect(v.x).to.equal(0.5);
            expect(v.y).to.equal(1);
            expect(v.z).to.equal(1.5);
        });

    });

    describe('#dot', () => {

        it('calculates dot product of two arbitrary non-unit vectors', () => {
            const v1 = new Vec3(1, 2, 3);
            const v2 = new Vec3(4, 5, 6);
            expect(v1.dot(v2)).to.equal(32);
        });

        it('calculates dot product of two parallel unit vectors', () => {
            const v1 = new Vec3(1, 0, 0);
            const v2 = new Vec3(1, 0, 0);
            expect(v1.dot(v2)).to.equal(1);
        });

        it('calculates dot product of two perpendicular unit vectors', () => {
            const v1 = new Vec3(0, 1, 0);
            const v2 = new Vec3(0, 0, 1);
            expect(v1.dot(v2)).to.equal(0);
        });

    });

    describe('#equals', () => {

        it('checks for equality of the same vector', () => {
            const v = new Vec3(1, 2, 3);
            expect(v.equals(v)).to.be.true;
        });

        it('checks for equality of two different vectors with the same values', () => {
            const v1 = new Vec3(1, 2, 3);
            const v2 = new Vec3(1, 2, 3);
            expect(v1.equals(v2)).to.be.true;
        });

        it('checks for equality of two different vectors with different values', () => {
            const v1 = new Vec3(1, 2, 3);
            const v2 = new Vec3(4, 5, 6);
            expect(v1.equals(v2)).to.be.false;
        });

        it('checks for equality of different vectors that are close enough', () => {
            const v1 = new Vec3(0.1, 0.2, 0.3);
            const v2 = new Vec3(0.10000000000000001, 0.2, 0.3);
            const epsilon = 0.000001;
            expect(v1.equalsApprox(v2, epsilon)).to.be.true;
            expect(v1.equalsApprox(v2)).to.be.true;

            const v3 = new Vec3(0.1 + epsilon - Number.EPSILON, 0.2, 0.3);
            expect(v1.equalsApprox(v3, epsilon)).to.be.true;

            const v4 = new Vec3(0.1 + epsilon + Number.EPSILON, 0.2, 0.3);
            expect(v1.equalsApprox(v4, epsilon)).to.be.false;
        });

    });

    describe('#floor', () => {

        it('leaves integers unchanged', () => {
            const v = new Vec3(1, 2, 3);
            v.floor();
            expect(v.x).to.equal(1);
            expect(v.y).to.equal(2);
            expect(v.z).to.equal(3);
        });

        it('rounds down floating point numbers', () => {
            const v = new Vec3(1.1, 2.2, 3.3);
            v.floor();
            expect(v.x).to.equal(1);
            expect(v.y).to.equal(2);
            expect(v.z).to.equal(3);
        });

    });

    describe('#length', () => {

        it('calculates the length of a zero length vector', () => {
            const v = new Vec3();
            expect(v.length()).to.equal(0);
        });

        it('calculates the length of a vector', () => {
            const v = new Vec3(0, 3, 4);
            expect(v.length()).to.equal(5);
        });

    });

    describe('#lengthSq', () => {

        it('calculates the length squared of a zero length vector', () => {
            const v = new Vec3();
            expect(v.lengthSq()).to.equal(0);
        });

        it('calculates the length squared of a vector', () => {
            const v = new Vec3(0, 3, 4);
            expect(v.lengthSq()).to.equal(25);
        });

    });

    describe('#lerp', () => {

        it('linearly interpolates between two vectors with alpha of 0', () => {
            const v1 = new Vec3(1, 2, 3);
            const v2 = new Vec3(4, 5, 6);
            const v3 = new Vec3();
            v3.lerp(v1, v2, 0);
            expect(v3.x).to.equal(1);
            expect(v3.y).to.equal(2);
            expect(v3.z).to.equal(3);
        });

        it('linearly interpolates between two vectors with alpha of 0.5', () => {
            const v1 = new Vec3(1, 2, 3);
            const v2 = new Vec3(4, 5, 6);
            const v3 = new Vec3();
            v3.lerp(v1, v2, 0.5);
            expect(v3.x).to.equal(2.5);
            expect(v3.y).to.equal(3.5);
            expect(v3.z).to.equal(4.5);
        });

        it('linearly interpolates between two vectors with alpha of 1', () => {
            const v1 = new Vec3(1, 2, 3);
            const v2 = new Vec3(4, 5, 6);
            const v3 = new Vec3();
            v3.lerp(v1, v2, 1);
            expect(v3.x).to.equal(4);
            expect(v3.y).to.equal(5);
            expect(v3.z).to.equal(6);
        });

    });

    describe('#max', () => {

        it('handles left hand larger than right hand', () => {
            const v1 = new Vec3(4, 5, 6);
            const v2 = new Vec3(1, 2, 3);
            v1.max(v2);
            expect(v1.x).to.equal(4);
            expect(v1.y).to.equal(5);
            expect(v1.z).to.equal(6);
        });

        it('handles right hand larger than left hand', () => {
            const v1 = new Vec3(1, 2, 3);
            const v2 = new Vec3(4, 5, 6);
            v1.max(v2);
            expect(v1.x).to.equal(4);
            expect(v1.y).to.equal(5);
            expect(v1.z).to.equal(6);
        });

    });

    describe('#min', () => {

        it('handles left hand larger than right hand', () => {
            const v1 = new Vec3(4, 5, 6);
            const v2 = new Vec3(1, 2, 3);
            v1.min(v2);
            expect(v1.x).to.equal(1);
            expect(v1.y).to.equal(2);
            expect(v1.z).to.equal(3);
        });

        it('handles right hand larger than left hand', () => {
            const v1 = new Vec3(1, 2, 3);
            const v2 = new Vec3(4, 5, 6);
            v1.min(v2);
            expect(v1.x).to.equal(1);
            expect(v1.y).to.equal(2);
            expect(v1.z).to.equal(3);
        });

    });

    describe('#mul', () => {

        it('multiplies a vector by another in place', () => {
            const v1 = new Vec3(1, 2, 3);
            const v2 = new Vec3(4, 5, 6);
            v1.mul(v2);
            expect(v1.x).to.equal(4);
            expect(v1.y).to.equal(10);
            expect(v1.z).to.equal(18);
        });

        it('multiplies a vector by itself in place', () => {
            const v1 = new Vec3(1, 2, 3);
            v1.mul(v1);
            expect(v1.x).to.equal(1);
            expect(v1.y).to.equal(4);
            expect(v1.z).to.equal(9);
        });

    });

    describe('#mul2', () => {

        it('multiplies a vector by another vector and writes the result to a third vector', () => {
            const v1 = new Vec3(1, 2, 3);
            const v2 = new Vec3(4, 5, 6);
            const v3 = new Vec3();
            v3.mul2(v1, v2);
            expect(v3.x).to.equal(4);
            expect(v3.y).to.equal(10);
            expect(v3.z).to.equal(18);
        });

        it('multiplies a vector by itself and writes the result to itself', () => {
            const v1 = new Vec3(1, 2, 3);
            v1.mul2(v1, v1);
            expect(v1.x).to.equal(1);
            expect(v1.y).to.equal(4);
            expect(v1.z).to.equal(9);
        });

    });

    describe('#mulScalar', () => {

        it('multiplies a vector by a scalar in place', () => {
            const v = new Vec3(1, 2, 3);
            v.mulScalar(2);
            expect(v.x).to.equal(2);
            expect(v.y).to.equal(4);
            expect(v.z).to.equal(6);
        });

    });

    describe('#normalize', () => {

        it('handles a zero length vector', () => {
            const v = new Vec3();
            v.normalize();
            expect(v.x).to.equal(0);
            expect(v.y).to.equal(0);
            expect(v.z).to.equal(0);
        });

        it('handles a non-zero length vector', () => {
            const v = new Vec3(1, 2, 3);
            v.normalize();
            expect(v.length()).to.equal(1);
        });

    });

    describe('#project', () => {

        it('projects a vector onto another vector', () => {
            const v1 = new Vec3(5, 5, 5);
            const v2 = new Vec3(1, 0, 0);
            v1.project(v2);
            expect(v1.x).to.equal(5);
            expect(v1.y).to.equal(0);
            expect(v1.z).to.equal(0);
        });

    });

    describe('#round', () => {

        it('leaves integers unchanged', () => {
            const v = new Vec3(1, 2, 3);
            v.round();
            expect(v.x).to.equal(1);
            expect(v.y).to.equal(2);
            expect(v.z).to.equal(3);
        });

        it('rounds floating point numbers to the nearest integer', () => {
            const v = new Vec3(1.1, 2.2, 3.3);
            v.round();
            expect(v.x).to.equal(1);
            expect(v.y).to.equal(2);
            expect(v.z).to.equal(3);
        });

    });

    describe('#set', () => {

        it('sets a vector to number values', () => {
            const v = new Vec3();
            v.set(1, 2, 3);
            expect(v.x).to.equal(1);
            expect(v.y).to.equal(2);
            expect(v.z).to.equal(3);
        });

    });

    describe('#sub', () => {

        it('subtracts a vector from another in place', () => {
            const v1 = new Vec3(1, 2, 3);
            const v2 = new Vec3(4, 5, 6);
            v1.sub(v2);
            expect(v1.x).to.equal(-3);
            expect(v1.y).to.equal(-3);
            expect(v1.z).to.equal(-3);
        });

        it('subtracts a vector from itself in place', () => {
            const v1 = new Vec3(1, 2, 3);
            v1.sub(v1);
            expect(v1.x).to.equal(0);
            expect(v1.y).to.equal(0);
            expect(v1.z).to.equal(0);
        });

    });

    describe('#sub2', () => {

        it('subtracts a vector from another vector and writes the result to a third vector', () => {
            const v1 = new Vec3(1, 2, 3);
            const v2 = new Vec3(4, 5, 6);
            const v3 = new Vec3();
            v3.sub2(v1, v2);
            expect(v3.x).to.equal(-3);
            expect(v3.y).to.equal(-3);
            expect(v3.z).to.equal(-3);
        });

        it('subtracts a vector from itself and writes the result to itself', () => {
            const v1 = new Vec3(1, 2, 3);
            v1.sub2(v1, v1);
            expect(v1.x).to.equal(0);
            expect(v1.y).to.equal(0);
            expect(v1.z).to.equal(0);
        });

    });

    describe('#subScalar', () => {

        it('subtracts a scalar from a vector in place', () => {
            const v = new Vec3(1, 2, 3);
            v.subScalar(2);
            expect(v.x).to.equal(-1);
            expect(v.y).to.equal(0);
            expect(v.z).to.equal(1);
        });

    });

    describe('#toString', () => {

        it('returns a string representation of a vector', () => {
            const v = new Vec3(1, 2, 3);
            expect(v.toString()).to.equal('[1, 2, 3]');
        });

    });

});
