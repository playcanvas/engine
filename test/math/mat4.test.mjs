import { Mat4 } from '../../src/math/mat4.js';
import { Quat } from '../../src/math/quat.js';
import { Vec3 } from '../../src/math/vec3.js';

import { expect } from 'chai';

describe("Mat4", function () {

    describe('#constructor', function () {

        it('supports constructor with zero arguments', function () {
            const m = new Mat4();
            expect(m.data).to.be.instanceof(Float32Array);
            expect(m.data.length).to.equal(16);
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
            expect(m.data[10]).to.equal(1);
            expect(m.data[11]).to.equal(0);
            expect(m.data[12]).to.equal(0);
            expect(m.data[13]).to.equal(0);
            expect(m.data[14]).to.equal(0);
            expect(m.data[15]).to.equal(1);
        });

    });

    describe('#add', function () {

        it('adds one matrix to another in place', function () {
            const m1 = new Mat4();
            m1.set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
            const m2 = new Mat4();
            m2.set([16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31]);
            m1.add(m2);
            expect(m1.data[0]).to.equal(16);
            expect(m1.data[1]).to.equal(18);
            expect(m1.data[2]).to.equal(20);
            expect(m1.data[3]).to.equal(22);
            expect(m1.data[4]).to.equal(24);
            expect(m1.data[5]).to.equal(26);
            expect(m1.data[6]).to.equal(28);
            expect(m1.data[7]).to.equal(30);
            expect(m1.data[8]).to.equal(32);
            expect(m1.data[9]).to.equal(34);
            expect(m1.data[10]).to.equal(36);
            expect(m1.data[11]).to.equal(38);
            expect(m1.data[12]).to.equal(40);
            expect(m1.data[13]).to.equal(42);
            expect(m1.data[14]).to.equal(44);
            expect(m1.data[15]).to.equal(46);
        });

    });

    describe('#add2', function () {

        it('adds two matrices together and writes result to a third matrix', function () {
            const m1 = new Mat4();
            m1.set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
            const m2 = new Mat4();
            m2.set([16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31]);
            const m3 = new Mat4();
            m3.add2(m1, m2);
            expect(m3.data[0]).to.equal(16);
            expect(m3.data[1]).to.equal(18);
            expect(m3.data[2]).to.equal(20);
            expect(m3.data[3]).to.equal(22);
            expect(m3.data[4]).to.equal(24);
            expect(m3.data[5]).to.equal(26);
            expect(m3.data[6]).to.equal(28);
            expect(m3.data[7]).to.equal(30);
            expect(m3.data[8]).to.equal(32);
            expect(m3.data[9]).to.equal(34);
            expect(m3.data[10]).to.equal(36);
            expect(m3.data[11]).to.equal(38);
            expect(m3.data[12]).to.equal(40);
            expect(m3.data[13]).to.equal(42);
            expect(m3.data[14]).to.equal(44);
            expect(m3.data[15]).to.equal(46);
        });

    });

    describe('#clone', function () {

        it('clones a matrix', function () {
            const m1 = new Mat4();
            m1.set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
            const m2 = m1.clone();
            expect(m2.data[0]).to.equal(0);
            expect(m2.data[1]).to.equal(1);
            expect(m2.data[2]).to.equal(2);
            expect(m2.data[3]).to.equal(3);
            expect(m2.data[4]).to.equal(4);
            expect(m2.data[5]).to.equal(5);
            expect(m2.data[6]).to.equal(6);
            expect(m2.data[7]).to.equal(7);
            expect(m2.data[8]).to.equal(8);
            expect(m2.data[9]).to.equal(9);
            expect(m2.data[10]).to.equal(10);
            expect(m2.data[11]).to.equal(11);
            expect(m2.data[12]).to.equal(12);
            expect(m2.data[13]).to.equal(13);
            expect(m2.data[14]).to.equal(14);
            expect(m2.data[15]).to.equal(15);
        });

    });

    describe('#copy', function () {

        it('copies a matrix', function () {
            const m1 = new Mat4();
            m1.set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
            const m2 = new Mat4();
            m2.copy(m1);
            expect(m2.data[0]).to.equal(0);
            expect(m2.data[1]).to.equal(1);
            expect(m2.data[2]).to.equal(2);
            expect(m2.data[3]).to.equal(3);
            expect(m2.data[4]).to.equal(4);
            expect(m2.data[5]).to.equal(5);
            expect(m2.data[6]).to.equal(6);
            expect(m2.data[7]).to.equal(7);
            expect(m2.data[8]).to.equal(8);
            expect(m2.data[9]).to.equal(9);
            expect(m2.data[10]).to.equal(10);
            expect(m2.data[11]).to.equal(11);
            expect(m2.data[12]).to.equal(12);
            expect(m2.data[13]).to.equal(13);
            expect(m2.data[14]).to.equal(14);
            expect(m2.data[15]).to.equal(15);
        });

    });

    describe('#equals', function () {

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

    describe('#getEulerAngles', function () {

        it('gets euler angles from a matrix', function () {
            let m, angles;

            // no rotation
            m = new Mat4();
            angles = m.getEulerAngles();
            expect(angles.x).to.equal(0);
            expect(angles.y).to.equal(0);
            expect(angles.z).to.equal(0);

            // 90 rotation around x
            m = new Mat4();
            m.set([1, 0, 0, 0, 0, 0, 1, 0, 0, -1, 0, 0, 0, 0, 0, 1]);
            angles = m.getEulerAngles();
            expect(angles.x).to.equal(90);

            // -45 rotation around x
            m = new Mat4();
            m.set([1, 0, 0, 0, 0, 0.7071067811865476, -0.7071067811865476, 0, 0, 0.7071067811865476, 0.7071067811865476, 0, 0, 0, 0, 1]);
            angles = m.getEulerAngles();
            expect(angles.x).to.closeTo(-45, 0.00001);
            expect(angles.y).to.closeTo(0, 0.00001);
            expect(angles.z).to.closeTo(0, 0.00001);

            // -45 rotation around y
            m = new Mat4();
            m.set([0.7071067811865476, 0, 0.7071067811865476, 0, 0, 1, 0, 0, -0.7071067811865476, 0, 0.7071067811865476, 0, 0, 0, 0, 1]);
            angles = m.getEulerAngles();
            expect(angles.x).to.closeTo(0, 0.00001);
            expect(angles.y).to.closeTo(-45, 0.00001);
            expect(angles.z).to.closeTo(0, 0.00001);

            // -45 rotation around z
            m = new Mat4();
            m.set([0.7071067811865476, -0.7071067811865476, 0, 0, 0.7071067811865476, 0.7071067811865476, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
            angles = m.getEulerAngles();
            expect(angles.x).to.closeTo(0, 0.00001);
            expect(angles.y).to.closeTo(0, 0.00001);
            expect(angles.z).to.closeTo(-45, 0.00001);
        });

    });

    describe('#getScale', function () {

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

    describe('#getTranslation', function () {

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

    describe('#getX', function () {

        it('gets x axis from an identity matrix', function () {
            const m = new Mat4();
            const axis = m.getX();
            expect(axis.x).to.equal(1);
            expect(axis.y).to.equal(0);
            expect(axis.z).to.equal(0);
        });

        it('gets x axis from an identity matrix (no allocation)', function () {
            const m = new Mat4();
            const axis = new Vec3();
            m.getX(axis);
            expect(axis.x).to.equal(1);
            expect(axis.y).to.equal(0);
            expect(axis.z).to.equal(0);
        });

    });

    describe('#getY', function () {

        it('gets y axis from an identity matrix', function () {
            const m = new Mat4();
            const axis = m.getY();
            expect(axis.x).to.equal(0);
            expect(axis.y).to.equal(1);
            expect(axis.z).to.equal(0);
        });

        it('gets y axis from an identity matrix (no allocation)', function () {
            const m = new Mat4();
            const axis = new Vec3();
            m.getY(axis);
            expect(axis.x).to.equal(0);
            expect(axis.y).to.equal(1);
            expect(axis.z).to.equal(0);
        });

    });

    describe('#getZ', function () {

        it('gets z axis from an identity matrix', function () {
            const m = new Mat4();
            const axis = m.getZ();
            expect(axis.x).to.equal(0);
            expect(axis.y).to.equal(0);
            expect(axis.z).to.equal(1);
        });

        it('gets z axis from an identity matrix (no allocation)', function () {
            const m = new Mat4();
            const axis = new Vec3();
            m.getZ(axis);
            expect(axis.x).to.equal(0);
            expect(axis.y).to.equal(0);
            expect(axis.z).to.equal(1);
        });

    });

    describe('#set', function () {

        it('sets a matrix', function () {
            const m = new Mat4();
            m.set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);
            expect(m.data[0]).to.equal(1);
            expect(m.data[1]).to.equal(2);
            expect(m.data[2]).to.equal(3);
            expect(m.data[3]).to.equal(4);
            expect(m.data[4]).to.equal(5);
            expect(m.data[5]).to.equal(6);
            expect(m.data[6]).to.equal(7);
            expect(m.data[7]).to.equal(8);
            expect(m.data[8]).to.equal(9);
            expect(m.data[9]).to.equal(10);
            expect(m.data[10]).to.equal(11);
            expect(m.data[11]).to.equal(12);
            expect(m.data[12]).to.equal(13);
            expect(m.data[13]).to.equal(14);
            expect(m.data[14]).to.equal(15);
            expect(m.data[15]).to.equal(16);
        });

        describe('#setIdentity', function () {

            it('sets an identity matrix', function () {
                const m = new Mat4();
                m.setIdentity();
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
                expect(m.data[10]).to.equal(1);
                expect(m.data[11]).to.equal(0);
                expect(m.data[12]).to.equal(0);
                expect(m.data[13]).to.equal(0);
                expect(m.data[14]).to.equal(0);
                expect(m.data[15]).to.equal(1);
            });

        });

    });

    describe('#setOrtho', function () {

        it('sets a normalized orthographic matrix', function () {
            const m = new Mat4();
            m.setOrtho(-1, 1, -1, 1, 1, -1);
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
            expect(m.data[10]).to.equal(1);
            expect(m.data[11]).to.equal(0);
            expect(m.data[12]).to.equal(0);
            expect(m.data[13]).to.equal(0);
            expect(m.data[14]).to.equal(0);
            expect(m.data[15]).to.equal(1);
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

    describe('#setPerspective', function () {

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

    describe('#setTRS', function () {

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

    });

    describe('#toString', function () {

        it('returns a string representation of a matrix', function () {
            const m = new Mat4();
            expect(m.toString()).to.equal('[1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]');
        });

    });

});
