import { Mat4 } from '../../../src/core/math/mat4.js';
import { Quat } from '../../../src/core/math/quat.js';
import { Vec3 } from '../../../src/core/math/vec3.js';
import { Vec4 } from '../../../src/core/math/vec4.js';

import { expect } from 'chai';

describe('Mat4', function () {

    describe('#data', function () {

        it('is a Float32Array of length 16', function () {
            const m = new Mat4();
            expect(m.data).to.be.an.instanceof(Float32Array);
            expect(m.data).to.have.length(16);
        });

    });

    describe('#constructor()', function () {

        it('creates an identity matrix', function () {
            const m = new Mat4();
            const identity = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
            expect(m.data).to.deep.equal(identity);
        });

    });

    describe('#add()', function () {

        it('adds one matrix to another in place', function () {
            const m1 = new Mat4();
            m1.set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
            const m2 = new Mat4();
            m2.set([16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31]);
            m1.add(m2);
            const result = new Float32Array([16, 18, 20, 22, 24, 26, 28, 30, 32, 34, 36, 38, 40, 42, 44, 46]);
            expect(m1.data).to.deep.equal(result);
        });

        it('returns this', function () {
            const m1 = new Mat4();
            const m2 = new Mat4();
            expect(m1.add(m2)).to.equal(m1);
        });

    });

    describe('#add2()', function () {

        it('adds two matrices together and writes result to a third matrix', function () {
            const m1 = new Mat4();
            m1.set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
            const m2 = new Mat4();
            m2.set([16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31]);
            const m3 = new Mat4();
            m3.add2(m1, m2);
            const result = new Float32Array([16, 18, 20, 22, 24, 26, 28, 30, 32, 34, 36, 38, 40, 42, 44, 46]);
            expect(m3.data).to.deep.equal(result);
        });

        it('returns this', function () {
            const m1 = new Mat4();
            const m2 = new Mat4();
            const m3 = new Mat4();
            expect(m1.add2(m2, m3)).to.equal(m1);
        });

    });

    describe('#clone()', function () {

        it('clones a matrix', function () {
            const m1 = new Mat4();
            m1.set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
            const m2 = m1.clone();
            expect(m2.data).to.deep.equal(m1.data);
        });

        it('ensures that an instance of a subclass keeps its class prototype', function () {
            class UserMat4 extends Mat4 {}
            const a = new UserMat4();
            const b = a.clone();
            expect(b).to.be.an.instanceof(UserMat4);
        });

    });

    describe('#copy()', function () {

        it('copies a matrix', function () {
            const m1 = new Mat4();
            m1.set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
            const m2 = new Mat4();
            m2.copy(m1);
            expect(m2.data).to.deep.equal(m1.data);
        });

        it('returns this', function () {
            const m1 = new Mat4();
            const m2 = new Mat4();
            expect(m2.copy(m1)).to.equal(m2);
        });

    });

    describe('#equals()', function () {

        it('checks for equality', function () {
            const m1 = new Mat4();
            m1.set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
            const m2 = new Mat4();
            m2.set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
            const m3 = new Mat4();
            expect(m1.equals(m1)).to.be.true;
            expect(m1.equals(m2)).to.be.true;
            expect(m1.equals(m3)).to.be.false;
        });

    });

    describe('#getEulerAngles()', function () {

        it('gets euler angles from an identity matrix', function () {
            const m = new Mat4();
            const angles = m.getEulerAngles();
            expect(angles.x).to.equal(0);
            expect(angles.y).to.equal(0);
            expect(angles.z).to.equal(0);
        });

        it('gets euler angles from an identity matrix (no allocation)', function () {
            const m = new Mat4();
            const angles = new Vec3();
            m.getEulerAngles(angles);
            expect(angles.x).to.equal(0);
            expect(angles.y).to.equal(0);
            expect(angles.z).to.equal(0);
        });

        it('gets a 90 rotation around x', function () {
            const m = new Mat4();
            m.set([1, 0, 0, 0, 0, 0, 1, 0, 0, -1, 0, 0, 0, 0, 0, 1]);
            const angles = m.getEulerAngles();
            expect(angles.x).to.equal(90);
            expect(angles.y).to.equal(0);
            expect(angles.z).to.equal(0);
        });

        it('gets a -45 rotation around x', function () {
            const m = new Mat4();
            m.set([1, 0, 0, 0, 0, 0.7071067811865476, -0.7071067811865476, 0, 0, 0.7071067811865476, 0.7071067811865476, 0, 0, 0, 0, 1]);
            const angles = m.getEulerAngles();
            expect(angles.x).to.be.closeTo(-45, 0.00001);
            expect(angles.y).to.be.closeTo(0, 0.00001);
            expect(angles.z).to.be.closeTo(0, 0.00001);
        });

        it('gets a -45 rotation around y', function () {
            const m = new Mat4();
            m.set([0.7071067811865476, 0, 0.7071067811865476, 0, 0, 1, 0, 0, -0.7071067811865476, 0, 0.7071067811865476, 0, 0, 0, 0, 1]);
            const angles = m.getEulerAngles();
            expect(angles.x).to.be.closeTo(0, 0.00001);
            expect(angles.y).to.be.closeTo(-45, 0.00001);
            expect(angles.z).to.be.closeTo(0, 0.00001);
        });

        it('gets a -45 rotation around z', function () {
            const m = new Mat4();
            m.set([0.7071067811865476, -0.7071067811865476, 0, 0, 0.7071067811865476, 0.7071067811865476, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
            const angles = m.getEulerAngles();
            expect(angles.x).to.be.closeTo(0, 0.00001);
            expect(angles.y).to.be.closeTo(0, 0.00001);
            expect(angles.z).to.be.closeTo(-45, 0.00001);
        });

    });

    describe('#getScale()', function () {

        it('gets scale from an identity matrix', function () {
            const m = new Mat4();
            const scale = m.getScale();
            expect(scale.x).to.equal(1);
            expect(scale.y).to.equal(1);
            expect(scale.z).to.equal(1);
        });

        it('gets scale from an identity matrix (no allocation)', function () {
            const m = new Mat4();
            const scale = new Vec3();
            m.getScale(scale);
            expect(scale.x).to.equal(1);
            expect(scale.y).to.equal(1);
            expect(scale.z).to.equal(1);
        });

        it('gets scale from a scaled matrix', function () {
            const m = new Mat4();
            m.set([2, 0, 0, 0, 0, 2, 0, 0, 0, 0, 2, 0, 0, 0, 0, 1]);
            const scale = m.getScale();
            expect(scale.x).to.equal(2);
            expect(scale.y).to.equal(2);
            expect(scale.z).to.equal(2);
        });

        it('gets scale from a scaled matrix (no allocation)', function () {
            const m = new Mat4();
            m.set([2, 0, 0, 0, 0, 2, 0, 0, 0, 0, 2, 0, 0, 0, 0, 1]);
            const scale = new Vec3();
            m.getScale(scale);
            expect(scale.x).to.equal(2);
            expect(scale.y).to.equal(2);
            expect(scale.z).to.equal(2);
        });

    });

    describe('#getTranslation()', function () {

        it('gets translation from an identity matrix', function () {
            const m = new Mat4();
            const translation = m.getTranslation();
            expect(translation.x).to.equal(0);
            expect(translation.y).to.equal(0);
            expect(translation.z).to.equal(0);
        });

        it('gets translation from an identity matrix (no allocation)', function () {
            const m = new Mat4();
            const translation = new Vec3();
            m.getTranslation(translation);
            expect(translation.x).to.equal(0);
            expect(translation.y).to.equal(0);
            expect(translation.z).to.equal(0);
        });

        it('gets translation from a translated matrix', function () {
            const m = new Mat4();
            m.set([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 10, 20, 30, 1]);
            const translation = m.getTranslation();
            expect(translation.x).to.equal(10);
            expect(translation.y).to.equal(20);
            expect(translation.z).to.equal(30);
        });

        it('gets translation from a translated matrix (no allocation)', function () {
            const m = new Mat4();
            m.set([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 10, 20, 30, 1]);
            const translation = new Vec3();
            m.getTranslation(translation);
            expect(translation.x).to.equal(10);
            expect(translation.y).to.equal(20);
            expect(translation.z).to.equal(30);
        });

    });

    describe('#getX()', function () {

        it('gets x axis from a matrix', function () {
            const m = new Mat4();
            m.set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
            const axis = m.getX();
            expect(axis.x).to.equal(0);
            expect(axis.y).to.equal(1);
            expect(axis.z).to.equal(2);
        });

        it('gets x axis from a matrix (no allocation)', function () {
            const m = new Mat4();
            m.set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
            const axis = new Vec3();
            m.getX(axis);
            expect(axis.x).to.equal(0);
            expect(axis.y).to.equal(1);
            expect(axis.z).to.equal(2);
        });

    });

    describe('#getY()', function () {

        it('gets y axis from a matrix', function () {
            const m = new Mat4();
            m.set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
            const axis = m.getY();
            expect(axis.x).to.equal(4);
            expect(axis.y).to.equal(5);
            expect(axis.z).to.equal(6);
        });

        it('gets y axis from a matrix (no allocation)', function () {
            const m = new Mat4();
            m.set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
            const axis = new Vec3();
            m.getY(axis);
            expect(axis.x).to.equal(4);
            expect(axis.y).to.equal(5);
            expect(axis.z).to.equal(6);
        });

    });

    describe('#getZ()', function () {

        it('gets z axis from a matrix', function () {
            const m = new Mat4();
            m.set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
            const axis = m.getZ();
            expect(axis.x).to.equal(8);
            expect(axis.y).to.equal(9);
            expect(axis.z).to.equal(10);
        });

        it('gets z axis from a matrix (no allocation)', function () {
            const m = new Mat4();
            m.set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
            const axis = new Vec3();
            m.getZ(axis);
            expect(axis.x).to.equal(8);
            expect(axis.y).to.equal(9);
            expect(axis.z).to.equal(10);
        });

    });

    describe('#invert()', function () {

        it('inverts an identity matrix to the identity matrix', function () {
            const m = new Mat4();
            m.invert();
            expect(m.isIdentity()).to.be.true;
        });

        it('inverts a translation matrix to the inverse translation matrix', function () {
            const m = new Mat4();
            m.set([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 10, 20, 30, 1]);
            m.invert();

            const result = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, -10, -20, -30, 1];
            expect(m.data).to.deep.equal(new Float32Array(result));
        });

        it('returns this', function () {
            const m = new Mat4();
            expect(m.invert()).to.equal(m);
        });

    });

    describe('#isIdentity()', function () {

        it('returns true for an identity matrix', function () {
            const m = new Mat4();
            expect(m.isIdentity()).to.be.true;
        });

        it('returns false for a non-identity matrix', function () {
            const m = new Mat4();
            m.set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);
            expect(m.isIdentity()).to.be.false;
        });

    });

    describe('#mul()', function () {

        it('sets the identity when multiplying the identity by the identity (I * I = I)', function () {
            const m1 = new Mat4();
            const m2 = new Mat4();
            m1.mul(m2);
            expect(m1.isIdentity()).to.be.true;
        });

        it('leaves matrix unchanged when multiplying by the identity ( A * I = A )', function () {
            const m1 = new Mat4();
            const data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16];
            m1.set(data);
            const m2 = new Mat4();
            m1.mul(m2);
            expect(m1.data).to.deep.equal(new Float32Array(data));
        });

        it('sets a matrix to the right hand side when left hand side is identity ( I * A = A )', function () {
            const m1 = new Mat4();
            const m2 = new Mat4();
            const data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16];
            m2.set(data);
            m1.mul(m2);
            expect(m1.data).to.deep.equal(new Float32Array(data));
        });

        it('multiplies an arbitrary matrix with another in place', function () {
            const m1 = new Mat4();
            m1.set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);
            const m2 = new Mat4();
            m2.set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);
            m1.mul(m2);
            const result = [90, 100, 110, 120, 202, 228, 254, 280, 314, 356, 398, 440, 426, 484, 542, 600];
            expect(m1.data).to.deep.equal(new Float32Array(result));
        });

        it('returns this', function () {
            const m1 = new Mat4();
            const m2 = new Mat4();
            expect(m1.mul(m2)).to.equal(m1);
        });

    });

    describe('#mul2()', function () {

        it('sets the identity when multiplying the identity by the identity (I * I = I)', function () {
            const m1 = new Mat4();
            const m2 = new Mat4();
            const m3 = new Mat4();
            m1.mul2(m2, m3);
            expect(m1.isIdentity()).to.be.true;
        });

        it('leaves matrix unchanged when multiplying by the identity ( A * I = A )', function () {
            const m1 = new Mat4();
            const m2 = new Mat4();
            const data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16];
            m2.set(data);
            const m3 = new Mat4();
            m1.mul2(m2, m3);
            expect(m1.data).to.deep.equal(new Float32Array(data));
        });

        it('sets a matrix to the right hand side when left hand side is identity ( I * A = A )', function () {
            const m1 = new Mat4();
            const m2 = new Mat4();
            const m3 = new Mat4();
            const data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16];
            m3.set(data);
            m1.mul2(m2, m3);
            expect(m1.data).to.deep.equal(new Float32Array(data));
        });

        it('multiplies two arbitrary matrices together and writes result to a third', function () {
            const m1 = new Mat4();
            const m2 = new Mat4();
            m2.set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);
            const m3 = new Mat4();
            m3.set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);
            m1.mul2(m2, m3);
            const result = [90, 100, 110, 120, 202, 228, 254, 280, 314, 356, 398, 440, 426, 484, 542, 600];
            expect(m1.data).to.deep.equal(new Float32Array(result));
        });

        it('returns this', function () {
            const m1 = new Mat4();
            const m2 = new Mat4();
            const m3 = new Mat4();
            expect(m1.mul2(m2, m3)).to.equal(m1);
        });

    });

    describe('#mulAffine2()', function () {

        it('sets the identity when multiplying the identity by the identity (I * I = I)', function () {
            const m1 = new Mat4();
            const m2 = new Mat4();
            const m3 = new Mat4();
            m1.mulAffine2(m2, m3);
            expect(m1.isIdentity()).to.be.true;
        });

        it('leaves matrix unchanged when multiplying by the identity ( A * I = A )', function () {
            const m1 = new Mat4();
            const m2 = new Mat4();
            const data = [1, 2, 3, 0, 5, 6, 7, 0, 9, 10, 11, 0, 13, 14, 15, 1];
            m2.set(data);
            const m3 = new Mat4();
            m1.mulAffine2(m2, m3);
            expect(m1.data).to.deep.equal(new Float32Array(data));
        });

        it('sets a matrix to the right hand side when left hand side is identity ( I * A = A )', function () {
            const m1 = new Mat4();
            const m2 = new Mat4();
            const m3 = new Mat4();
            const data = [1, 2, 3, 0, 5, 6, 7, 0, 9, 10, 11, 0, 13, 14, 15, 1];
            m3.set(data);
            m1.mulAffine2(m2, m3);
            expect(m1.data).to.deep.equal(new Float32Array(data));
        });

        it('multiplies two arbitrary matrices together and writes result to a third', function () {
            const m1 = new Mat4();
            const m2 = new Mat4();
            m2.set([1, 2, 3, 0, 5, 6, 7, 0, 9, 10, 11, 0, 13, 14, 15, 1]);
            const m3 = new Mat4();
            m3.set([1, 2, 3, 0, 5, 6, 7, 0, 9, 10, 11, 0, 13, 14, 15, 1]);
            m1.mul2(m2, m3);
            const result = [38, 44, 50, 0, 98, 116, 134, 0, 158, 188, 218, 0, 231, 274, 317, 1];
            expect(m1.data).to.deep.equal(new Float32Array(result));
        });

        it('returns this', function () {
            const m1 = new Mat4();
            const m2 = new Mat4();
            const m3 = new Mat4();
            expect(m1.mulAffine2(m2, m3)).to.equal(m1);
        });

    });

    describe('#set()', function () {

        it('sets a matrix', function () {
            const m = new Mat4();
            const data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16];
            m.set(data);
            expect(m.data).to.deep.equal(new Float32Array(data));
        });

        it('returns this', function () {
            const m = new Mat4();
            const data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16];
            expect(m.set(data)).to.equal(m);
        });

    });

    describe('#setFromAxisAngle()', function () {

        it('sets the identity matrix when passing a zero angle', function () {
            const m = new Mat4();
            m.setFromAxisAngle(Vec3.UP, 0);
            expect(m.isIdentity()).to.be.true;
        });

        it('sets an approximation of the identity matrix when passing a multiple of 360', function () {
            const m = new Mat4();
            m.setFromAxisAngle(Vec3.UP, 360);
            expect(m.data[0]).to.be.closeTo(1, 0.001);
            expect(m.data[1]).to.be.closeTo(0, 0.001);
            expect(m.data[2]).to.be.closeTo(0, 0.001);
            expect(m.data[3]).to.be.closeTo(0, 0.001);
            expect(m.data[4]).to.be.closeTo(0, 0.001);
            expect(m.data[5]).to.be.closeTo(1, 0.001);
            expect(m.data[6]).to.be.closeTo(0, 0.001);
            expect(m.data[7]).to.be.closeTo(0, 0.001);
            expect(m.data[8]).to.be.closeTo(0, 0.001);
            expect(m.data[9]).to.be.closeTo(0, 0.001);
            expect(m.data[10]).to.be.closeTo(1, 0.001);
            expect(m.data[11]).to.be.closeTo(0, 0.001);
            expect(m.data[12]).to.be.closeTo(0, 0.001);
            expect(m.data[13]).to.be.closeTo(0, 0.001);
            expect(m.data[14]).to.be.closeTo(0, 0.001);
            expect(m.data[15]).to.be.closeTo(1, 0.001);
        });

        it('set a rotation matrix of 90 around the x axis', function () {
            const m = new Mat4();
            m.setFromAxisAngle(Vec3.RIGHT, 90);
            expect(m.data[0]).to.be.closeTo(1, 0.001);
            expect(m.data[1]).to.be.closeTo(0, 0.001);
            expect(m.data[2]).to.be.closeTo(0, 0.001);
            expect(m.data[3]).to.be.closeTo(0, 0.001);
            expect(m.data[4]).to.be.closeTo(0, 0.001);
            expect(m.data[5]).to.be.closeTo(0, 0.001);
            expect(m.data[6]).to.be.closeTo(1, 0.001);
            expect(m.data[7]).to.be.closeTo(0, 0.001);
            expect(m.data[8]).to.be.closeTo(0, 0.001);
            expect(m.data[9]).to.be.closeTo(-1, 0.001);
            expect(m.data[10]).to.be.closeTo(0, 0.001);
            expect(m.data[11]).to.be.closeTo(0, 0.001);
            expect(m.data[12]).to.be.closeTo(0, 0.001);
            expect(m.data[13]).to.be.closeTo(0, 0.001);
            expect(m.data[14]).to.be.closeTo(0, 0.001);
            expect(m.data[15]).to.be.closeTo(1, 0.001);
        });

        it('returns this', function () {
            const m = new Mat4();
            expect(m.setFromAxisAngle(Vec3.UP, 0)).to.equal(m);
        });

    });

    describe('#setFromEulerAngles()', function () {

        it('sets the identity matrix when zeros are passed', function () {
            const m = new Mat4();
            m.setFromEulerAngles(0, 0, 0);
            expect(m.isIdentity()).to.be.true;
        });

        it('set a rotation matrix from arbitrary euler angles', function () {
            const m = new Mat4();
            m.setFromEulerAngles(10, 20, 30);
            expect(m.data[0]).to.be.closeTo(0.813797652721405, 0.00001);
            expect(m.data[1]).to.be.closeTo(0.46984630823135376, 0.00001);
            expect(m.data[2]).to.be.closeTo(-0.3420201539993286, 0.00001);
            expect(m.data[3]).to.equal(0);
            expect(m.data[4]).to.be.closeTo(-0.4409696161746979, 0.00001);
            expect(m.data[5]).to.be.closeTo(0.882564127445221, 0.00001);
            expect(m.data[6]).to.be.closeTo(0.16317591071128845, 0.00001);
            expect(m.data[7]).to.equal(0);
            expect(m.data[8]).to.be.closeTo(0.3785223066806793, 0.00001);
            expect(m.data[9]).to.be.closeTo(0.01802831143140793, 0.00001);
            expect(m.data[10]).to.be.closeTo(0.9254165887832642, 0.00001);
            expect(m.data[11]).to.equal(0);
            expect(m.data[12]).to.equal(0);
            expect(m.data[13]).to.equal(0);
            expect(m.data[14]).to.equal(0);
            expect(m.data[15]).to.equal(1);
        });

        it('returns this', function () {
            const m = new Mat4();
            expect(m.setFromEulerAngles(0, 0, 0)).to.equal(m);
        });

    });

    describe('#setIdentity()', function () {

        it('sets an identity matrix', function () {
            const m = new Mat4();
            m.setIdentity();

            const identity = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
            expect(m.data).to.deep.equal(identity);
        });

        it('returns this', function () {
            const m = new Mat4();
            expect(m.setIdentity()).to.equal(m);
        });

    });

    describe('#setLookAt()', function () {

        it('sets the identity matrix when eye is at origin looking down negative z', function () {
            const m = new Mat4();
            m.setLookAt(Vec3.ZERO, Vec3.FORWARD, Vec3.UP);
            expect(m.isIdentity()).to.be.true;
        });

        it('sets matrix translation to eye position', function () {
            const m = new Mat4();
            m.setLookAt(new Vec3(10, 20, 30), Vec3.FORWARD, Vec3.UP);
            expect(m.data[12]).to.equal(10);
            expect(m.data[13]).to.equal(20);
            expect(m.data[14]).to.equal(30);
        });

        it('sets matrix from arbitrary inputs', function () {
            const m = new Mat4();
            m.setLookAt(new Vec3(10, 20, 30), new Vec3(40, 50, 60), Vec3.RIGHT);
            expect(m.data[0]).to.equal(0);
            expect(m.data[1]).to.be.closeTo(0.7071067690849304, 0.00001);
            expect(m.data[2]).to.be.closeTo(-0.7071067690849304, 0.00001);
            expect(m.data[3]).to.equal(0);
            expect(m.data[4]).to.be.closeTo(0.8164966106414795, 0.00001);
            expect(m.data[5]).to.be.closeTo(-0.40824830532073975, 0.00001);
            expect(m.data[6]).to.be.closeTo(-0.40824830532073975, 0.00001);
            expect(m.data[7]).to.equal(0);
            expect(m.data[8]).to.be.closeTo(-0.5773502588272095, 0.00001);
            expect(m.data[9]).to.be.closeTo(-0.5773502588272095, 0.00001);
            expect(m.data[10]).to.be.closeTo(-0.5773502588272095, 0.00001);
            expect(m.data[11]).to.equal(0);
            expect(m.data[12]).to.equal(10);
            expect(m.data[13]).to.equal(20);
            expect(m.data[14]).to.equal(30);
            expect(m.data[15]).to.equal(1);
        });

        it('returns this', function () {
            const m = new Mat4();
            expect(m.setLookAt(Vec3.ZERO, Vec3.FORWARD, Vec3.UP)).to.equal(m);
        });

    });

    describe('#setOrtho()', function () {

        it('sets a normalized orthographic matrix', function () {
            const m = new Mat4();
            m.setOrtho(-1, 1, -1, 1, 1, -1);
            expect(m.isIdentity()).to.be.true;
        });

        it('sets a non-normalized orthographic matrix', function () {
            const m = new Mat4();
            m.setOrtho(-10, 10, -5, 5, 2, -2);
            expect(m.data[0]).to.be.closeTo(0.1, 0.001);
            expect(m.data[1]).to.equal(0);
            expect(m.data[2]).to.equal(0);
            expect(m.data[3]).to.equal(0);
            expect(m.data[4]).to.equal(0);
            expect(m.data[5]).to.be.closeTo(0.2, 0.001);
            expect(m.data[6]).to.equal(0);
            expect(m.data[7]).to.equal(0);
            expect(m.data[8]).to.equal(0);
            expect(m.data[9]).to.equal(0);
            expect(m.data[10]).to.be.closeTo(0.5, 0.001);
            expect(m.data[11]).to.equal(0);
            expect(m.data[12]).to.equal(0);
            expect(m.data[13]).to.equal(0);
            expect(m.data[14]).to.equal(0);
            expect(m.data[15]).to.equal(1);
        });

    });

    describe('#setPerspective()', function () {

        it('sets a perspective matrix', function () {
            const m = new Mat4();
            m.setPerspective(90, 1, 1, 10);
            expect(m.data[0]).to.equal(1);
            expect(m.data[1]).to.equal(0);
            expect(m.data[2]).to.equal(0);
            expect(m.data[3]).to.equal(0);
            expect(m.data[4]).to.equal(0);
            expect(m.data[5]).to.equal(1);
            expect(m.data[6]).to.equal(0);
            expect(m.data[7]).to.equal(0);
            expect(m.data[8]).to.equal(0);
            expect(m.data[9]).to.equal(0);
            expect(m.data[10]).to.be.closeTo(-1.2222222089767456, 0.001);
            expect(m.data[11]).to.equal(-1);
            expect(m.data[12]).to.equal(0);
            expect(m.data[13]).to.equal(0);
            expect(m.data[14]).to.be.closeTo(-2.222222328186035, 0.001);
            expect(m.data[15]).to.equal(0);
        });

    });

    describe('#setScale()', function () {

        it('sets an identity matrix when ones are passed in', function () {
            const m = new Mat4();
            m.setScale(1, 1, 1);
            expect(m.isIdentity()).to.be.true;
        });

        it('sets a scale matrix', function () {
            const m = new Mat4();
            m.setScale(10, 20, 30);

            const result = new Float32Array([10, 0, 0, 0, 0, 20, 0, 0, 0, 0, 30, 0, 0, 0, 0, 1]);
            expect(m.data).to.deep.equal(result);
        });

        it('returns this', function () {
            const m = new Mat4();
            expect(m.setScale(1, 2, 3)).to.equal(m);
        });

    });

    describe('#setTranslate()', function () {

        it('sets an identity matrix when zeros are passed in', function () {
            const m = new Mat4();
            m.setTranslate(0, 0, 0);
            expect(m.isIdentity()).to.be.true;
        });

        it('sets a translation matrix', function () {
            const m = new Mat4();
            m.setTranslate(1, 2, 3);

            const result = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 1, 2, 3, 1]);
            expect(m.data).to.deep.equal(result);
        });

        it('returns this', function () {
            const m = new Mat4();
            expect(m.setTranslate(1, 2, 3)).to.equal(m);
        });

    });

    describe('#setTRS()', function () {

        it('sets a matrix from identity translation, rotation and scale', function () {
            const m = new Mat4();
            m.setTRS(Vec3.ZERO, Quat.IDENTITY, Vec3.ONE);
            expect(m.equals(Mat4.IDENTITY)).to.be.true;
        });

        it('sets a matrix from translation, rotation and scale', function () {
            const m = new Mat4();
            const t = new Vec3(1, 2, 3);
            const r = new Quat().setFromEulerAngles(10, 20, 30);
            const s = new Vec3(4, 5, 6);
            m.setTRS(t, r, s);
            expect(m.data[0]).to.be.closeTo(3.25519061088562, 0.001);
            expect(m.data[1]).to.be.closeTo(1.879385232925415, 0.001);
            expect(m.data[2]).to.be.closeTo(-1.3680806159973145, 0.001);
            expect(m.data[3]).to.equal(0);
            expect(m.data[4]).to.be.closeTo(-2.204848051071167, 0.001);
            expect(m.data[5]).to.be.closeTo(4.412820816040039, 0.001);
            expect(m.data[6]).to.be.closeTo(0.8158795833587646, 0.001);
            expect(m.data[7]).to.equal(0);
            expect(m.data[8]).to.be.closeTo(2.2711338996887207, 0.001);
            expect(m.data[9]).to.be.closeTo(0.10816986858844757, 0.001);
            expect(m.data[10]).to.be.closeTo(5.552499294281006, 0.001);
            expect(m.data[11]).to.equal(0);
            expect(m.data[12]).to.equal(1);
            expect(m.data[13]).to.equal(2);
            expect(m.data[14]).to.equal(3);
            expect(m.data[15]).to.equal(1);
        });

        it('returns this', function () {
            const m = new Mat4();
            expect(m.setTRS(Vec3.ZERO, Quat.IDENTITY, Vec3.ONE)).to.equal(m);
        });

    });

    describe('#toString()', function () {

        it('returns a string representation of a matrix', function () {
            const m = new Mat4();
            expect(m.toString()).to.equal('[1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]');
        });

    });

    describe('#transformPoint()', function () {

        it('leaves point unchanged when transforming by the identity matrix', function () {
            const p = new Vec3(1, 2, 3);
            const m = new Mat4();
            const r = m.transformPoint(p);
            expect(p.equals(r)).to.be.true;
        });

        it('leaves point unchanged when transforming by the identity matrix (no allocation)', function () {
            const p = new Vec3(1, 2, 3);
            const m = new Mat4();
            const r = new Vec3();
            m.transformPoint(p, r);
            expect(p.equals(r)).to.be.true;
        });

        it('transforms a point by a 90 degree rotation around the z axis', function () {
            const p = new Vec3(1, 0, 0);
            const m = new Mat4();
            const r = new Vec3();

            m.setFromAxisAngle(Vec3.BACK, 90);
            m.transformPoint(p, r);

            expect(r.x).to.be.closeTo(0, 0.00001);
            expect(r.y).to.be.closeTo(1, 0.00001);
            expect(r.z).to.be.closeTo(0, 0.00001);
        });

        it('transforms a point by a 90 degree rotation around the z axis (input and output vectors are the same)', function () {
            const p = new Vec3(1, 0, 0);
            const m = new Mat4();

            m.setFromAxisAngle(Vec3.BACK, 90);
            m.transformPoint(p, p);

            expect(p.x).to.be.closeTo(0, 0.00001);
            expect(p.y).to.be.closeTo(1, 0.00001);
            expect(p.z).to.be.closeTo(0, 0.00001);
        });

        it('takes translation component of a matrix into account', function () {
            const p = new Vec3(1, 2, 3);
            const m = new Mat4();
            m.setTranslate(10, 20, 30);
            const r = m.transformPoint(p);
            expect(r.x).to.equal(11);
            expect(r.y).to.equal(22);
            expect(r.z).to.equal(33);
        });

    });

    describe('#transformVec4()', function () {

        it('leaves vector unchanged when transforming by the identity matrix', function () {
            const v = new Vec4(1, 2, 3, 4);
            const m = new Mat4();
            const r = m.transformVec4(v);
            expect(v.equals(r)).to.be.true;
        });

        it('leaves vector unchanged when transforming by the identity matrix (no allocation)', function () {
            const v = new Vec4(1, 2, 3, 4);
            const m = new Mat4();
            const r = new Vec4();
            m.transformVec4(v, r);
            expect(v.equals(r)).to.be.true;
        });

        it('transforms a vector by a 90 degree rotation around the z axis', function () {
            const v = new Vec4(1, 0, 0, 0);
            const m = new Mat4();
            const r = new Vec4();

            m.setFromAxisAngle(Vec3.BACK, 90);
            m.transformVec4(v, r);

            expect(r.x).to.be.closeTo(0, 0.00001);
            expect(r.y).to.be.closeTo(1, 0.00001);
            expect(r.z).to.be.closeTo(0, 0.00001);
            expect(r.w).to.equal(0);
        });

        it('transforms a vector by a 90 degree rotation around the z axis (input and output vectors are the same)', function () {
            const v = new Vec4(1, 0, 0, 0);
            const m = new Mat4();

            m.setFromAxisAngle(Vec3.BACK, 90);
            m.transformVec4(v, v);

            expect(v.x).to.be.closeTo(0, 0.00001);
            expect(v.y).to.be.closeTo(1, 0.00001);
            expect(v.z).to.be.closeTo(0, 0.00001);
            expect(v.w).to.equal(0);
        });

    });

    describe('#transformVector()', function () {

        it('leaves vector unchanged when transforming by the identity matrix', function () {
            const v = new Vec3(1, 2, 3);
            const m = new Mat4();
            const r = m.transformVector(v);
            expect(v.equals(r)).to.be.true;
        });

        it('leaves vector unchanged when transforming by the identity matrix (no allocation)', function () {
            const v = new Vec3(1, 2, 3);
            const m = new Mat4();
            const r = new Vec3();
            m.transformVector(v, r);
            expect(v.equals(r)).to.be.true;
        });

        it('transforms a vector by a 90 degree rotation around the z axis', function () {
            const v = new Vec3(1, 0, 0);
            const m = new Mat4();
            const r = new Vec3();

            m.setFromAxisAngle(Vec3.BACK, 90);
            m.transformVector(v, r);

            expect(r.x).to.be.closeTo(0, 0.00001);
            expect(r.y).to.be.closeTo(1, 0.00001);
            expect(r.z).to.be.closeTo(0, 0.00001);
        });

        it('transforms a vector by a 90 degree rotation around the z axis (input and output vectors are the same)', function () {
            const v = new Vec3(1, 0, 0);
            const m = new Mat4();

            m.setFromAxisAngle(Vec3.BACK, 90);
            m.transformVector(v, v);

            expect(v.x).to.be.closeTo(0, 0.00001);
            expect(v.y).to.be.closeTo(1, 0.00001);
            expect(v.z).to.be.closeTo(0, 0.00001);
        });

        it('ignores the translation component of a matrix', function () {
            const v = new Vec3(1, 2, 3);
            const m = new Mat4();
            m.setTranslate(10, 20, 30);
            const r = m.transformVector(v);
            expect(v.equals(r)).to.be.true;
        });

    });

    describe('#transpose()', function () {

        it('transposes the identity matrix to the identity matrix', function () {
            const m = new Mat4();
            m.transpose();
            expect(m.isIdentity()).to.be.true;
        });

        it('flips a matrix along its top-left to bottom-right diagonal', function () {
            const m = new Mat4();
            m.set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);
            m.transpose();
            const result = [1, 5, 9, 13, 2, 6, 10, 14, 3, 7, 11, 15, 4, 8, 12, 16];
            expect(m.data).to.deep.equal(new Float32Array(result));
        });

        it('returns this', function () {
            const m = new Mat4();
            expect(m.transpose()).to.equal(m);
        });

    });

});
