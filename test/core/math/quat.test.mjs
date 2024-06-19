import { Mat4 } from '../../../src/core/math/mat4.js';
import { Quat } from '../../../src/core/math/quat.js';
import { Vec3 } from '../../../src/core/math/vec3.js';

import { expect } from 'chai';

describe('Quat', function () {

    describe('#constructor()', function () {

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

    describe('#clone()', function () {

        it('clones a quaternion', function () {
            const q1 = new Quat(0.1, 0.2, 0.3, 0.4);
            const q2 = q1.clone();
            expect(q2).to.not.equal(q1);
            expect(q2.x).to.equal(0.1);
            expect(q2.y).to.equal(0.2);
            expect(q2.z).to.equal(0.3);
            expect(q2.w).to.equal(0.4);
        });

        it('ensures that an instance of a subclass keeps its class prototype', function () {
            class UserQuat extends Quat {}
            const a = new UserQuat();
            const b = a.clone();
            expect(b).to.be.an.instanceof(UserQuat);
        });

    });

    describe('#copy()', function () {

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

        it('returns this', function () {
            const q1 = new Quat();
            const q2 = new Quat();
            expect(q1.copy(q2)).to.equal(q1);
        });

    });

    describe('#equals()', function () {

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

        it('checks for equality of different quaternions that are close enough', function () {
            const q1 = new Quat(0.1, 0.2, 0.3, 0.4);
            const q2 = new Quat(0.10000000000000001, 0.2, 0.3, 0.4);
            const epsilon = 0.000001;
            expect(q1.equalsApprox(q2, epsilon)).to.be.true;
            expect(q1.equalsApprox(q2)).to.be.true;

            const q3 = new Quat(0.1 + epsilon - Number.EPSILON, 0.2, 0.3, 0.4);
            expect(q1.equalsApprox(q3, epsilon)).to.be.true;

            const q4 = new Quat(0.1 + epsilon + Number.EPSILON, 0.2, 0.3, 0.4);
            expect(q1.equalsApprox(q4, epsilon)).to.be.false;
        });

    });

    describe('#getAxisAngle()', function () {

        it('returns the x axis and 0 angle for an identity quaternion', function () {
            const q = new Quat();
            const axis = new Vec3();
            const angle = q.getAxisAngle(axis);
            expect(angle).to.equal(0);
            expect(axis.x).to.equal(1);
            expect(axis.y).to.equal(0);
            expect(axis.z).to.equal(0);
        });

        it('returns what is set with setFromAxisAngle', function () {
            const q = new Quat();
            q.setFromAxisAngle(Vec3.UP, Math.PI / 2);
            const axis = new Vec3();
            const angle = q.getAxisAngle(axis);
            expect(angle).to.be.closeTo(Math.PI / 2, 0.00001);
            expect(axis.x).to.be.closeTo(0, 0.00001);
            expect(axis.y).to.be.closeTo(1, 0.00001);
            expect(axis.z).to.be.closeTo(0, 0.00001);
        });

    });

    describe('#getEulerAngles()', function () {

        it('returns zeroes for an identity quaternion', function () {
            const q = new Quat();
            const eulers = q.getEulerAngles();
            expect(eulers.x).to.equal(0);
            expect(eulers.y).to.equal(0);
            expect(eulers.z).to.equal(0);
        });

        it('returns zeroes for an identity quaternion (no allocation)', function () {
            const q = new Quat();
            const eulers = new Vec3();
            q.getEulerAngles(eulers);
            expect(eulers.x).to.equal(0);
            expect(eulers.y).to.equal(0);
            expect(eulers.z).to.equal(0);
        });

        it('extracts a 180° turn around x axis', function () {
            const q = new Quat(1, 0, 0, 0);
            const eulers = new Vec3();
            q.getEulerAngles(eulers);
            expect(eulers.x).to.equal(180);
            expect(eulers.y).to.equal(0);
            expect(eulers.z).to.equal(0);
        });

        it('extracts a 180° turn around y axis', function () {
            const q = new Quat(0, 1, 0, 0);
            const eulers = new Vec3();
            q.getEulerAngles(eulers);
            // note that 0, 180, 0 is equivalent to 180, 0, 180
            expect(eulers.x).to.equal(180);
            expect(eulers.y).to.equal(0);
            expect(eulers.z).to.equal(180);
        });

        it('extracts a 180° turn around z axis', function () {
            const q = new Quat(0, 0, 1, 0);
            const eulers = new Vec3();
            q.getEulerAngles(eulers);
            expect(eulers.x).to.equal(0);
            expect(eulers.y).to.equal(0);
            expect(eulers.z).to.equal(180);
        });

        it('extracts a 90° turn around z axis', function () {
            const q = new Quat(Math.sqrt(0.5), 0, 0, Math.sqrt(0.5));
            const eulers = new Vec3();
            q.getEulerAngles(eulers);
            expect(eulers.x).to.be.closeTo(90, 0.00001);
            expect(eulers.y).to.equal(0);
            expect(eulers.z).to.equal(0);
        });

        it('extracts a 90° turn around y axis', function () {
            const q = new Quat(0, Math.sqrt(0.5), 0, Math.sqrt(0.5));
            const eulers = new Vec3();
            q.getEulerAngles(eulers);
            expect(eulers.x).to.equal(0);
            expect(eulers.y).to.equal(90);
            expect(eulers.z).to.equal(0);
        });

        it('extracts a 90° turn around z axis', function () {
            const q = new Quat(0, 0, Math.sqrt(0.5), Math.sqrt(0.5));
            const eulers = new Vec3();
            q.getEulerAngles(eulers);
            expect(eulers.x).to.equal(0);
            expect(eulers.y).to.equal(0);
            expect(eulers.z).to.be.closeTo(90, 0.00001);
        });

        it('extracts a -90° turn around x axis', function () {
            const q = new Quat(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5));
            const eulers = new Vec3();
            q.getEulerAngles(eulers);
            expect(eulers.x).to.be.closeTo(-90, 0.00001);
            expect(eulers.y).to.equal(0);
            expect(eulers.z).to.equal(0);
        });

        it('extracts a -90° turn around y axis', function () {
            const q = new Quat(0, -Math.sqrt(0.5), 0, Math.sqrt(0.5));
            const eulers = new Vec3();
            q.getEulerAngles(eulers);
            expect(eulers.x).to.equal(0);
            expect(eulers.y).to.equal(-90);
            expect(eulers.z).to.equal(0);
        });

        it('extracts a -90° turn around z axis', function () {
            const q = new Quat(0, 0, -Math.sqrt(0.5), Math.sqrt(0.5));
            const eulers = new Vec3();
            q.getEulerAngles(eulers);
            expect(eulers.x).to.equal(0);
            expect(eulers.y).to.equal(0);
            expect(eulers.z).to.be.closeTo(-90, 0.00001);
        });

    });

    describe('#invert()', function () {

        it('leaves the identity quaternion unchanged', function () {
            const q = new Quat();
            q.invert();
            expect(q.equals(Quat.IDENTITY)).to.be.true;
        });

        it('leaves the quaternion unchanged if applied twice', function () {
            const q = new Quat();
            q.setFromEulerAngles(10, 20, 30);
            const original = q.clone();
            q.invert();
            q.invert();
            expect(q.equals(original)).to.be.true;
        });

        it('returns this', function () {
            const q = new Quat();
            expect(q.invert()).to.equal(q);
        });

    });

    describe('#length()', function () {

        it('returns 1 for the identity quaternion', function () {
            const q = new Quat();
            expect(q.length()).to.equal(1);
        });

        it('returns the correct length for a non-identity quaternion', function () {
            const q = new Quat(1, 2, 3, 4);
            expect(q.length()).to.equal(Math.sqrt(30));
        });

    });

    describe('#lengthSq()', function () {

        it('returns 1 for the identity quaternion', function () {
            const q = new Quat();
            expect(q.lengthSq()).to.equal(1);
        });

        it('returns the correct squared length for a non-identity quaternion', function () {
            const q = new Quat(1, 2, 3, 4);
            expect(q.lengthSq()).to.equal(30);
        });

    });

    describe('#mul()', function () {

        it('sets the identity when multiplying the identity by the identity (I * I = I)', function () {
            const q1 = new Quat();
            const q2 = new Quat();
            q1.mul(q2);
            expect(q1.equals(Quat.IDENTITY)).to.be.true;
        });

        it('leaves matrix unchanged when multiplying by the identity ( A * I = A )', function () {
            const q1 = new Quat();
            q1.setFromEulerAngles(10, 20, 30);
            const q2 = new Quat();
            q1.mul(q2);
            const eulers = q1.getEulerAngles();
            expect(eulers.x).to.be.closeTo(10, 0.00001);
            expect(eulers.y).to.be.closeTo(20, 0.00001);
            expect(eulers.z).to.be.closeTo(30, 0.00001);
        });

        it('sets a quaternion to the right hand side when left hand side is identity ( I * A = A )', function () {
            const q1 = new Quat();
            const q2 = new Quat();
            q2.setFromEulerAngles(10, 20, 30);
            q1.mul(q2);
            const eulers = q1.getEulerAngles();
            expect(eulers.x).to.be.closeTo(10, 0.00001);
            expect(eulers.y).to.be.closeTo(20, 0.00001);
            expect(eulers.z).to.be.closeTo(30, 0.00001);
        });

        it('multiplies an arbitrary quaternion with another in place', function () {
            const q1 = new Quat();
            q1.setFromEulerAngles(10, 20, 30);
            const q2 = new Quat();
            q2.setFromEulerAngles(40, 50, 60);
            q1.mul(q2);
            const eulers = q1.getEulerAngles();
            expect(eulers.x).to.be.closeTo(73.43885168602242, 0.00001);
            expect(eulers.y).to.be.closeTo(46.71883614850924, 0.00001);
            expect(eulers.z).to.be.closeTo(113.547040698283, 0.00001);
        });

        it('sets the identity quaternion when multiplying by the inverse', function () {
            const q1 = new Quat();
            q1.setFromEulerAngles(10, 20, 30);
            const q2 = q1.clone().invert();
            q1.mul(q2);
            expect(q1.x).to.be.closeTo(0, 0.00001);
            expect(q1.y).to.be.closeTo(0, 0.00001);
            expect(q1.z).to.be.closeTo(0, 0.00001);
            expect(q1.w).to.be.closeTo(1, 0.00001);
        });

        it('returns this', function () {
            const q1 = new Quat();
            const q2 = new Quat();
            expect(q1.mul(q2)).to.equal(q1);
        });

    });

    describe('#mul2()', function () {

        it('sets the identity when multiplying the identity by the identity (I * I = I)', function () {
            const q1 = new Quat();
            const q2 = new Quat();
            const q3 = new Quat();
            q1.mul2(q2, q3);
            expect(q1.equals(Quat.IDENTITY)).to.be.true;
        });

        it('leaves matrix unchanged when multiplying by the identity ( A * I = A )', function () {
            const q1 = new Quat();
            const q2 = new Quat();
            q2.setFromEulerAngles(10, 20, 30);
            const q3 = new Quat();
            q1.mul2(q2, q3);
            const eulers = q1.getEulerAngles();
            expect(eulers.x).to.be.closeTo(10, 0.00001);
            expect(eulers.y).to.be.closeTo(20, 0.00001);
            expect(eulers.z).to.be.closeTo(30, 0.00001);
        });

        it('sets a quaternion to the right hand side when left hand side is identity ( I * A = A )', function () {
            const q1 = new Quat();
            const q2 = new Quat();
            const q3 = new Quat();
            q3.setFromEulerAngles(10, 20, 30);
            q1.mul2(q2, q3);
            const eulers = q1.getEulerAngles();
            expect(eulers.x).to.be.closeTo(10, 0.00001);
            expect(eulers.y).to.be.closeTo(20, 0.00001);
            expect(eulers.z).to.be.closeTo(30, 0.00001);
        });

        it('multiplies an arbitrary quaternion with another in place', function () {
            const q1 = new Quat();
            const q2 = new Quat();
            q2.setFromEulerAngles(10, 20, 30);
            const q3 = new Quat();
            q3.setFromEulerAngles(40, 50, 60);
            q1.mul2(q2, q3);
            const eulers = q1.getEulerAngles();
            expect(eulers.x).to.be.closeTo(73.43885168602242, 0.00001);
            expect(eulers.y).to.be.closeTo(46.71883614850924, 0.00001);
            expect(eulers.z).to.be.closeTo(113.547040698283, 0.00001);
        });

        it('sets the identity quaternion when multiplying by the inverse', function () {
            const q1 = new Quat();
            const q2 = new Quat();
            q2.setFromEulerAngles(10, 20, 30);
            const q3 = q2.clone().invert();
            q1.mul2(q2, q3);
            expect(q1.x).to.be.closeTo(0, 0.00001);
            expect(q1.y).to.be.closeTo(0, 0.00001);
            expect(q1.z).to.be.closeTo(0, 0.00001);
            expect(q1.w).to.be.closeTo(1, 0.00001);
        });

        it('returns this', function () {
            const q1 = new Quat();
            const q2 = new Quat();
            const q3 = new Quat();
            expect(q1.mul2(q2, q3)).to.equal(q1);
        });

    });

    describe('#normalize()', function () {

        it('leaves the identity quaternion unchanged', function () {
            const q = new Quat();
            q.normalize();
            expect(q.equals(Quat.IDENTITY)).to.be.true;
        });

        it('makes an arbitrary quaternion have length 1', function () {
            const q = new Quat(1, 2, 3, 4);
            q.normalize();
            expect(q.length()).to.be.closeTo(1, 0.00001);
        });

        it('returns this', function () {
            const q = new Quat();
            expect(q.normalize()).to.equal(q);
        });

    });

    describe('#set()', function () {

        it('sets the quaternion', function () {
            const q = new Quat();
            q.set(0.1, 0.2, 0.3, 0.4);
            expect(q.x).to.equal(0.1);
            expect(q.y).to.equal(0.2);
            expect(q.z).to.equal(0.3);
            expect(q.w).to.equal(0.4);
        });

        it('returns this', function () {
            const q = new Quat();
            expect(q.set(0.1, 0.2, 0.3, 0.4)).to.equal(q);
        });

    });

    describe('#setFromAxisAngle()', function () {

        it('sets the identity quaternion when passing a zero angle', function () {
            const q = new Quat();
            q.setFromAxisAngle(Vec3.UP, 0);
            expect(q.equals(Quat.IDENTITY)).to.be.true;
        });

        it('sets an approximation of the identity quaternion when passing a multiple of 360', function () {
            const q = new Quat();
            q.setFromAxisAngle(Vec3.UP, 720);
            expect(q.x).to.be.closeTo(0, 0.00001);
            expect(q.y).to.be.closeTo(0, 0.00001);
            expect(q.z).to.be.closeTo(0, 0.00001);
            expect(q.w).to.be.closeTo(1, 0.00001);
        });

        it('set a quaternion of 90 around the x axis', function () {
            const q = new Quat();
            q.setFromAxisAngle(Vec3.RIGHT, 90);
            expect(q.x).to.be.closeTo(0.7071067811865475, 0.00001);
            expect(q.y).to.be.closeTo(0, 0.00001);
            expect(q.z).to.be.closeTo(0, 0.00001);
            expect(q.w).to.be.closeTo(0.7071067811865476, 0.00001);
        });

        it('returns this', function () {
            const q = new Quat();
            expect(q.setFromAxisAngle(Vec3.UP, 0)).to.equal(q);
        });

    });

    describe('#setFromEulerAngles()', function () {

        [
            [0, 0, 0],
            [90, 0, 0],
            [0.1, 0, 0],
            [0, 0.2, 0],
            [0, 0, 0.3],
            [1, 2, 3],
            [10, 10, 0]
        ].forEach(function ([x, y, z]) {
            it('sets the quaternion from ' + x + '°, ' + y + '°, ' + z + '°', function () {
                const q1 = new Quat();
                const q2 = new Quat();
                const q3 = new Quat();
                const m = new Mat4();

                q1.setFromEulerAngles(x, y, z);
                m.setFromEulerAngles(x, y, z);
                q2.setFromMat4(m);
                q3.setFromEulerAngles(new Vec3(x, y, z));

                expect(q1.x).to.be.closeTo(q2.x, 0.0001);
                expect(q1.y).to.be.closeTo(q2.y, 0.0001);
                expect(q1.z).to.be.closeTo(q2.z, 0.0001);
                expect(q1.w).to.be.closeTo(q2.w, 0.0001);

                expect(q3.x).to.be.closeTo(q2.x, 0.0001);
                expect(q3.y).to.be.closeTo(q2.y, 0.0001);
                expect(q3.z).to.be.closeTo(q2.z, 0.0001);
                expect(q3.w).to.be.closeTo(q2.w, 0.0001);
            });
        });

        it('returns this', function () {
            const q = new Quat();
            expect(q.setFromEulerAngles(0, 0, 0)).to.equal(q);
        });

    });

    describe('#setFromMat4()', function () {

        it('set the identity quaternion from an identity matrix', function () {
            const q = new Quat();
            const m = new Mat4();
            q.setFromMat4(m);
            expect(q.equals(Quat.IDENTITY)).to.be.true;
        });

        const nq = new Quat();
        const q = new Quat();
        const m = new Mat4();

        const quatToMatToQuat = (w, x, y, z, epsilon = 1e-6) => {
            nq.set(x, y, z, w).normalize();
            m.setTRS(Vec3.ZERO, nq, Vec3.ONE);
            q.setFromMat4(m);
            const result =
                (Math.abs(nq.x - q.x) < epsilon &&
                 Math.abs(nq.y - q.y) < epsilon &&
                 Math.abs(nq.z - q.z) < epsilon &&
                 Math.abs(nq.w - q.w) < epsilon) ||
                (Math.abs(nq.x + q.x) < epsilon &&
                 Math.abs(nq.y + q.y) < epsilon &&
                 Math.abs(nq.z + q.z) < epsilon &&
                 Math.abs(nq.w + q.w) < epsilon);

            if (!result) {
                // helpful for debugging
                console.log(`Failed Quat [${x}, ${y}, ${z}, ${w}] -> [${nq.x}, ${nq.y}, ${nq.z}, ${nq.w}] != [${q.x}, ${q.y}, ${q.z}, ${q.w}]`);
            }

            return result;
        };

        it('set the quaternion from a non-identity matrix', function () {
            const q = new Quat();
            const m = new Mat4();
            m.setFromEulerAngles(10, 20, 30);
            q.setFromMat4(m);
            const eulers = q.getEulerAngles();
            expect(eulers.x).to.be.closeTo(10, 0.00001);
            expect(eulers.y).to.be.closeTo(20, 0.00001);
            expect(eulers.z).to.be.closeTo(30, 0.00001);
        });

        it('converts rot180', function () {
            expect(quatToMatToQuat(1, 0, 0, 0)).to.be.true;
            expect(quatToMatToQuat(0, 1, 0, 0)).to.be.true;
            expect(quatToMatToQuat(0, 0, 1, 0)).to.be.true;
            expect(quatToMatToQuat(0, 0, 0, 1)).to.be.true;
        });

        it('converts rot180n', function () {
            expect(quatToMatToQuat(-1, 0, 0, 0)).to.be.true;
            expect(quatToMatToQuat(-1e-20, -1, 0, 0)).to.be.true;
            expect(quatToMatToQuat(-1e-20, 0, -1, 0)).to.be.true;
            expect(quatToMatToQuat(-1e-20, 0, 0, -1)).to.be.true;
        });

        const s2 = 1 / Math.sqrt(2);

        it('converts rot90', function () {
            expect(quatToMatToQuat(s2, s2, 0, 0)).to.be.true;
            expect(quatToMatToQuat(s2, -s2, 0, 0)).to.be.true;
            expect(quatToMatToQuat(s2, 0, s2, 0)).to.be.true;
            expect(quatToMatToQuat(s2, 0, -s2, 0)).to.be.true;
            expect(quatToMatToQuat(s2, 0, 0, s2)).to.be.true;
            expect(quatToMatToQuat(s2, 0, 0, -s2)).to.be.true;
        });

        it('converts rot90n', function () {
            expect(quatToMatToQuat(-s2, s2, 0, 0)).to.be.true;
            expect(quatToMatToQuat(-s2, -s2, 0, 0)).to.be.true;
            expect(quatToMatToQuat(-s2, 0, s2, 0)).to.be.true;
            expect(quatToMatToQuat(-s2, 0, -s2, 0)).to.be.true;
            expect(quatToMatToQuat(-s2, 0, 0, s2)).to.be.true;
            expect(quatToMatToQuat(-s2, 0, 0, -s2)).to.be.true;
        });

        it('converts suit', function () {
            const vals = [0.9999, -0.002, -0.999, 0.01, 0, 1];

            vals.forEach((x) => {
                vals.forEach((y) => {
                    vals.forEach((z) => {
                        vals.forEach((w) => {
                            expect(quatToMatToQuat(w, x, y, z)).to.be.true;
                        });
                    });
                });
            });
        });

        it('returns this', function () {
            const q = new Quat();
            const m = new Mat4();
            expect(q.setFromMat4(m)).to.equal(q);
        });

    });

    describe('#setFromDirections()', function () {

        it('set the identity quaternion from equal directions', function () {
            const v1 = new Vec3(1, 0, 0);
            const v2 = new Vec3(1, 0, 0);

            const q1 = new Quat().setFromDirections(v1, v2);
            expect(q1.equals(Quat.IDENTITY)).to.be.true;


            const v3 = new Vec3(0, 0, 0);
            const v4 = new Vec3(0, 0, 0);

            const q2 = new Quat().setFromDirections(v3, v4);
            expect(q2.equals(Quat.IDENTITY)).to.be.true;
        });

        it('set a quaternion from different directions', function () {
            const v1 = new Vec3(1, 0, 0);
            const v2 = new Vec3(0, 1, 0);

            const q1 = new Quat().setFromDirections(v1, v2);
            const q2 = new Quat().setFromEulerAngles(0, 0, 90);

            expect(q1.equalsApprox(q2)).to.be.true;

            const v3 = new Vec3(1, 0, 0);
            const v4 = new Vec3(1, 1, 0).normalize();

            const q3 = new Quat().setFromDirections(v3, v4);
            const q4 = new Quat().setFromEulerAngles(0, 0, 45);

            expect(q3.equalsApprox(q4)).to.be.true;

            const q5 = new Quat().setFromEulerAngles(0, 0, 44);
            expect(q3.equalsApprox(q5)).to.be.false;

        });

        it('returns this', function () {
            const q = new Quat();
            const v1 = new Vec3();
            const v2 = new Vec3();
            expect(q.setFromDirections(v1, v2)).to.equal(q);
        });

    });

    describe('#slerp()', function () {

        it('return first quaternion when alpha is 0', function () {
            const q1 = new Quat();
            q1.setFromEulerAngles(10, 20, 30);
            const q2 = new Quat();
            q2.setFromEulerAngles(40, 50, 60);
            const q = new Quat();
            q.slerp(q1, q2, 0);
            expect(q.x).to.be.closeTo(q1.x, 0.00001);
            expect(q.y).to.be.closeTo(q1.y, 0.00001);
            expect(q.z).to.be.closeTo(q1.z, 0.00001);
            expect(q.w).to.be.closeTo(q1.w, 0.00001);
        });

        it('return second quaternion when alpha is 1', function () {
            const q1 = new Quat();
            q1.setFromEulerAngles(10, 20, 30);
            const q2 = new Quat();
            q2.setFromEulerAngles(40, 50, 60);
            const q = new Quat();
            q.slerp(q1, q2, 1);
            expect(q.x).to.be.closeTo(q2.x, 0.00001);
            expect(q.y).to.be.closeTo(q2.y, 0.00001);
            expect(q.z).to.be.closeTo(q2.z, 0.00001);
            expect(q.w).to.be.closeTo(q2.w, 0.00001);
        });

        it('returns the correct quaternion when alpha is 0.5', function () {
            const q1 = new Quat();
            q1.setFromEulerAngles(0, 0, 10);
            const q2 = new Quat();
            q2.setFromEulerAngles(0, 0, 20);
            const q = new Quat();
            q.slerp(q1, q2, 0.5);
            const eulers = q.getEulerAngles();
            expect(eulers.x).to.equal(0);
            expect(eulers.y).to.equal(0);
            expect(eulers.z).to.be.closeTo(15, 0.00001);
        });

        it('returns this', function () {
            const q1 = new Quat();
            const q2 = new Quat();
            const q = new Quat();
            expect(q.slerp(q1, q2, 0.5)).to.equal(q);
        });

    });

    describe('#toString()', function () {

        it('returns a string representation of the quaternion', function () {
            const q = new Quat(0.1, 0.2, 0.3, 0.4);
            expect(q.toString()).to.equal('[0.1, 0.2, 0.3, 0.4]');
        });

    });

    describe('#transformVector()', function () {

        it('leaves vector unchanged when transforming by the identity quaternion', function () {
            const v = new Vec3(1, 2, 3);
            const q = new Quat();
            const r = q.transformVector(v);
            expect(v.equals(r)).to.be.true;
        });

        it('leaves vector unchanged when transforming by the identity quaternion (no allocation)', function () {
            const v = new Vec3(1, 2, 3);
            const q = new Quat();
            const r = new Vec3();
            q.transformVector(v, r);
            expect(v.equals(r)).to.be.true;
        });

        it('transforms a vector by a 90 degree rotation around the z axis', function () {
            const v = new Vec3(1, 0, 0);
            const q = new Quat();
            const r = new Vec3();

            q.setFromAxisAngle(Vec3.BACK, 90);
            q.transformVector(v, r);

            expect(r.x).to.be.closeTo(0, 0.00001);
            expect(r.y).to.be.closeTo(1, 0.00001);
            expect(r.z).to.be.closeTo(0, 0.00001);
        });

        it('transforms a vector by a 90 degree rotation around the z axis (input and output vectors are the same)', function () {
            const v = new Vec3(1, 0, 0);
            const q = new Quat();

            q.setFromAxisAngle(Vec3.BACK, 90);
            q.transformVector(v, v);

            expect(v.x).to.be.closeTo(0, 0.00001);
            expect(v.y).to.be.closeTo(1, 0.00001);
            expect(v.z).to.be.closeTo(0, 0.00001);
        });

    });

});
