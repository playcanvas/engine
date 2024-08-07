import { Mat3 } from '../../../src/core/math/mat3.js';
import { Mat4 } from '../../../src/core/math/mat4.js';
import { Vec3 } from '../../../src/core/math/vec3.js';

import { expect } from 'chai';

const identity =   [1, 0, 0, 0, 1, 0, 0, 0, 1];
const increasing = [1, 2, 3, 4, 5, 6, 7, 8, 9];
const decreasing = [9, 8, 7, 6, 5, 4, 3, 2, 1];
const increasingTransposed = [1, 4, 7, 2, 5, 8, 3, 6, 9];

const increasingMat4 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16];

describe('Mat3', () => {

    describe('#data', () => {
        it('is a Float32Array of length 9', () => {
            const m = new Mat3();
            expect(m.data).to.be.an.instanceof(Float32Array);
            expect(m.data).to.have.length(9);
        });

        it('is initialized to the identity matrix', () => {
            const m = new Mat3();
            expect(m.data).to.deep.equal(new Float32Array(identity));
        });
    });

    describe('#equals', () => {

        it('returns true for the same matrix', () => {
            const m = new Mat3();
            m.data.set(increasing);
            const n = new Mat3();
            n.data.set(increasing);
            expect(m.equals(n)).to.be.true;
        });

        it('returns false for different matrices', () => {
            const m = new Mat3();
            m.data.set(increasing);
            const n = new Mat3();
            n.data.set(decreasing);
            expect(m.equals(n)).to.be.false;
        });

    });

    describe('#clone', () => {
        it('clones correctly', () => {
            const m = new Mat3();
            m.data.set(increasing);
            const n = m.clone();
            expect(m.equals(n)).to.be.true;
        });
    });

    describe('#copy', () => {
        it('copies correctly', () => {
            const m = new Mat3();
            m.data.set(increasing);
            const n = new Mat3();
            n.copy(m);
            expect(m.equals(n)).to.be.true;
        });
    });

    describe('#set', () => {
        it('sets the matrix correctly', () => {
            const m = new Mat3();
            m.set(increasing);
            const n = new Mat3();
            n.set(increasing);
            expect(m.equals(n)).to.be.true;
        });
    });

    describe('#isIdentity', () => {
        it('is true for the identity matrix', () => {
            const m = new Mat3();
            expect(m.isIdentity()).to.be.true;
        });

        it('is false for a non-identity matrix', () => {
            const m = new Mat3();
            m.data.set([1, 2, 3, 4, 5, 6, 7, 8, 9]);
            expect(m.isIdentity()).to.be.false;
        });
    });

    describe('#setIdentity', () => {
        it('sets the matrix to the identity matrix', () => {
            const m = new Mat3();
            m.set(increasing);
            expect(m.isIdentity()).to.be.false;
            m.setIdentity();
            expect(m.isIdentity()).to.be.true;
        });
    });

    describe('#transpose', () => {

        it('transposes the identity matrix to the identity matrix', () => {
            const m = new Mat3();
            m.transpose();
            expect(m.isIdentity()).to.be.true;
        });

        it('transposes a non-identity matrix correctly', () => {
            const m = new Mat3();
            m.set(increasing);
            m.transpose();
            console.log(JSON.stringify(m.data));
            expect(m.data).to.deep.equal(new Float32Array(increasingTransposed));
        });

        it('transposes a non-identity matrix correctly given a source matrix', () => {
            const m = new Mat3();
            m.set(increasing);
            const n = new Mat3();
            n.transpose(m);
            expect(n.data).to.deep.equal(new Float32Array(increasingTransposed));
        });
    });

    describe('#setFromMat4', () => {
        it('sets the matrix correctly', () => {
            const m = new Mat4();
            m.set(increasingMat4);

            const n = new Mat3();
            n.setFromMat4(m);

            expect(n.data).to.deep.equal(new Float32Array([1, 2, 3, 5, 6, 7, 9, 10, 11]));
        });
    });

    describe('#invertMat4', () => {
        it('inverts the matrix correctly', () => {
            const m = new Mat4();
            m.set([2, 0, 0, 0, 0, 2, 0, 0, 0, 0, 2, 0, 0, 0, 0, 1]);

            const n = new Mat3();
            n.invertMat4(m);

            expect(n.data).to.deep.equal(new Float32Array([0.5, 0, 0, 0, 0.5, 0, 0, 0, 0.5]));
        });
    });

    describe('#transformVector', () => {
        it('transforms a vector correctly', () => {
            const m = new Mat4();
            m.setScale(2, 2, 2);

            const v = new Vec3(2, 2, 2);
            const result = m.transformVector(v);

            expect(result.equals(new Vec3(4, 4, 4))).to.be.true;
        });
    });
});
