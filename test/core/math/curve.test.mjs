import { CURVE_LINEAR, CURVE_SMOOTHSTEP, CURVE_SPLINE, CURVE_STEP } from '../../../src/core/math/constants.js';
import { Curve } from '../../../src/core/math/curve.js';

import { expect } from 'chai';

describe('Curve', function () {

    describe('#constructor', function () {

        it('supports zero arguments', function () {
            const c = new Curve();
            expect(c.keys.length).to.equal(0);
        });

        it('supports array argument already sorted by time', function () {
            const c = new Curve([
                0, 0,        // At 0 time, value of 0
                0.33, 2,     // At 0.33 time, value of 2
                0.66, 2.6,   // At 0.66 time, value of 2.6
                1, 3         // At 1 time, value of 3
            ]);
            expect(c.type).to.equal(CURVE_SMOOTHSTEP);
            expect(c.tension).to.equal(0.5);
            expect(c.keys.length).to.equal(4);
            expect(c.keys[0][0]).to.equal(0);
            expect(c.keys[0][1]).to.equal(0);
            expect(c.keys[1][0]).to.equal(0.33);
            expect(c.keys[1][1]).to.equal(2);
            expect(c.keys[2][0]).to.equal(0.66);
            expect(c.keys[2][1]).to.equal(2.6);
            expect(c.keys[3][0]).to.equal(1);
            expect(c.keys[3][1]).to.equal(3);
        });

        it('supports array argument not sorted by time', function () {
            const c = new Curve([
                0, 0,        // At 0 time, value of 0
                0.33, 2,     // At 0.33 time, value of 2
                1, 3,        // At 1 time, value of 3
                0.66, 2.6    // At 0.66 time, value of 2.6
            ]);
            expect(c.type).to.equal(CURVE_SMOOTHSTEP);
            expect(c.tension).to.equal(0.5);
            expect(c.keys.length).to.equal(4);
            expect(c.keys[0][0]).to.equal(0);
            expect(c.keys[0][1]).to.equal(0);
            expect(c.keys[1][0]).to.equal(0.33);
            expect(c.keys[1][1]).to.equal(2);
            expect(c.keys[2][0]).to.equal(0.66);
            expect(c.keys[2][1]).to.equal(2.6);
            expect(c.keys[3][0]).to.equal(1);
            expect(c.keys[3][1]).to.equal(3);
        });

    });

    describe('#add', function () {

        it('adds a new key to an empty curve', function () {
            const c = new Curve();
            c.add(0.5, 1);
            expect(c.length).to.equal(1);
            expect(c.keys[0][0]).to.equal(0.5);
            expect(c.keys[0][1]).to.equal(1);
        });

        it('inserts a new key to a curve with existing keys at the correct index', function () {
            const c = new Curve([
                0, 0,        // At 0 time, value of 0
                0.33, 2,     // At 0.33 time, value of 2
                0.66, 2.6,   // At 0.66 time, value of 2.6
                1, 3         // At 1 time, value of 3
            ]);
            c.add(0.5, 1);
            expect(c.length).to.equal(5);
            expect(c.keys[0][0]).to.equal(0);
            expect(c.keys[0][1]).to.equal(0);
            expect(c.keys[1][0]).to.equal(0.33);
            expect(c.keys[1][1]).to.equal(2);
            expect(c.keys[2][0]).to.equal(0.5);
            expect(c.keys[2][1]).to.equal(1);
            expect(c.keys[3][0]).to.equal(0.66);
            expect(c.keys[3][1]).to.equal(2.6);
            expect(c.keys[4][0]).to.equal(1);
            expect(c.keys[4][1]).to.equal(3);
        });

    });

    describe('#clone', function () {

        it('clones an empty curve', function () {
            const c = new Curve();
            const clone = c.clone();
            expect(clone.length).to.equal(c.length);
            expect(clone.type).to.equal(c.type);
            expect(clone.tension).to.equal(c.tension);
        });

        it('clones a curve with keys', function () {
            const c = new Curve([
                0, 0,        // At 0 time, value of 0
                0.33, 2,     // At 0.33 time, value of 2
                0.66, 2.6,   // At 0.66 time, value of 2.6
                1, 3         // At 1 time, value of 3
            ]);
            const clone = c.clone();
            expect(clone.length).to.equal(c.length);
            expect(clone.type).to.equal(c.type);
            expect(clone.tension).to.equal(c.tension);
            for (let i = 0; i < c.length; i++) {
                expect(clone.get(i)).to.deep.equal(c.get(i));
            }
        });

        it('ensures that an instance of a subclass keeps its class prototype', function () {
            class UserCurve extends Curve {}
            const a = new UserCurve();
            const b = a.clone();
            expect(b).to.be.an.instanceof(UserCurve);
        });

    });

    describe('#get', function () {

        it('returns the key at the given index', function () {
            const c = new Curve([
                0, 0,        // At 0 time, value of 0
                0.33, 2,     // At 0.33 time, value of 2
                0.66, 2.6,   // At 0.66 time, value of 2.6
                1, 3         // At 1 time, value of 3
            ]);

            expect(c.get(0)).to.deep.equal([0, 0]);
            expect(c.get(1)).to.deep.equal([0.33, 2]);
            expect(c.get(2)).to.deep.equal([0.66, 2.6]);
            expect(c.get(3)).to.deep.equal([1, 3]);
        });

        it('returns undefined if the index is out of range', function () {
            const c = new Curve([
                0, 0,        // At 0 time, value of 0
                0.33, 2,     // At 0.33 time, value of 2
                0.66, 2.6,   // At 0.66 time, value of 2.6
                1, 3         // At 1 time, value of 3
            ]);

            expect(c.get(4)).to.be.undefined;
            expect(c.get(-1)).to.be.undefined;
        });

    });

    describe('#quantize', function () {

        it('returns the interpolated values at the given intervals (CURVE_LINEAR)', function () {
            const c = new Curve([
                0, 0,
                0.25, 1,
                0.5, 0.5,
                0.75, 1,
                1, 0
            ]);
            c.type = CURVE_LINEAR;
            const values = c.quantize(11);
            expect(values.length).to.equal(11);
            expect(values[0]).to.be.closeTo(0, 0.00001);
            expect(values[1]).to.be.closeTo(0.4, 0.00001);
            expect(values[2]).to.be.closeTo(0.8, 0.00001);
            expect(values[3]).to.be.closeTo(0.9, 0.00001);
            expect(values[4]).to.be.closeTo(0.7, 0.00001);
            expect(values[5]).to.be.closeTo(0.5, 0.00001);
            expect(values[6]).to.be.closeTo(0.7, 0.00001);
            expect(values[7]).to.be.closeTo(0.9, 0.00001);
            expect(values[8]).to.be.closeTo(0.8, 0.00001);
            expect(values[9]).to.be.closeTo(0.4, 0.00001);
            expect(values[10]).to.be.closeTo(0, 0.00001);
        });

        it('returns the interpolated values at the given intervals (CURVE_SMOOTHSTEP)', function () {
            const c = new Curve([
                0, 0,
                0.25, 1,
                0.5, 0.5,
                0.75, 1,
                1, 0
            ]);
            const values = c.quantize(11);
            expect(values.length).to.equal(11);
            expect(values[0]).to.be.closeTo(0, 0.00001);
            expect(values[1]).to.be.closeTo(0.352, 0.00001);
            expect(values[2]).to.be.closeTo(0.896, 0.00001);
            expect(values[3]).to.be.closeTo(0.948, 0.00001);
            expect(values[4]).to.be.closeTo(0.676, 0.00001);
            expect(values[5]).to.be.closeTo(0.5, 0.00001);
            expect(values[6]).to.be.closeTo(0.676, 0.00001);
            expect(values[7]).to.be.closeTo(0.948, 0.00001);
            expect(values[8]).to.be.closeTo(0.896, 0.00001);
            expect(values[9]).to.be.closeTo(0.352, 0.00001);
            expect(values[10]).to.be.closeTo(0, 0.00001);
        });

        it('returns the interpolated values at the given intervals (CURVE_SPLINE})', function () {
            const c = new Curve([
                0, 0,
                0.25, 1,
                0.5, 0.5,
                0.75, 1,
                1, 0
            ]);
            c.type = CURVE_SPLINE;
            const values = c.quantize(11);
            expect(values.length).to.equal(11);
            expect(values[0]).to.be.closeTo(0, 0.00001);
            expect(values[1]).to.be.closeTo(0.472, 0.00001);
            expect(values[2]).to.be.closeTo(0.896, 0.00001);
            expect(values[3]).to.be.closeTo(0.98, 0.00001);
            expect(values[4]).to.be.closeTo(0.7, 0.00001);
            expect(values[5]).to.be.closeTo(0.5, 0.00001);
            expect(values[6]).to.be.closeTo(0.7, 0.00001);
            expect(values[7]).to.be.closeTo(0.98, 0.00001);
            expect(values[8]).to.be.closeTo(0.896, 0.00001);
            expect(values[9]).to.be.closeTo(0.472, 0.00001);
            expect(values[10]).to.be.closeTo(0, 0.00001);
        });

        it('returns the interpolated values at the given intervals (CURVE_STEP)', function () {
            const c = new Curve([
                0, 0,
                0.25, 1,
                0.5, 0.5,
                0.75, 1,
                1, 0
            ]);
            c.type = CURVE_STEP;
            const values = c.quantize(11);
            expect(values.length).to.equal(11);
            expect(values[0]).to.equal(0);
            expect(values[1]).to.equal(0);
            expect(values[2]).to.equal(0);
            expect(values[3]).to.equal(1);
            expect(values[4]).to.equal(1);
            expect(values[5]).to.equal(0.5);
            expect(values[6]).to.equal(0.5);
            expect(values[7]).to.equal(0.5);
            expect(values[8]).to.equal(1);
            expect(values[9]).to.equal(1);
            expect(values[10]).to.equal(0);
        });

    });

    describe('#value', function () {

        it('returns the interpolated value at the given time (CURVE_LINEAR)', function () {
            const c = new Curve([
                0, 0,
                0.25, 1,
                0.5, 0.5,
                0.75, 1,
                1, 0
            ]);
            c.type = CURVE_LINEAR;
            expect(c.value(0)).to.be.closeTo(0, 0.00001);
            expect(c.value(0.1)).to.be.closeTo(0.4, 0.00001);
            expect(c.value(0.2)).to.be.closeTo(0.8, 0.00001);
            expect(c.value(0.3)).to.be.closeTo(0.9, 0.00001);
            expect(c.value(0.4)).to.be.closeTo(0.7, 0.00001);
            expect(c.value(0.5)).to.be.closeTo(0.5, 0.00001);
            expect(c.value(0.6)).to.be.closeTo(0.7, 0.00001);
            expect(c.value(0.7)).to.be.closeTo(0.9, 0.00001);
            expect(c.value(0.8)).to.be.closeTo(0.8, 0.00001);
            expect(c.value(0.9)).to.be.closeTo(0.4, 0.00001);
            expect(c.value(1)).to.be.closeTo(0, 0.00001);
        });

        it('returns the interpolated value at the given time (CURVE_SMOOTHSTEP)', function () {
            const c = new Curve([
                0, 0,
                0.25, 1,
                0.5, 0.5,
                0.75, 1,
                1, 0
            ]);
            expect(c.value(0)).to.be.closeTo(0, 0.00001);
            expect(c.value(0.1)).to.be.closeTo(0.352, 0.00001);
            expect(c.value(0.2)).to.be.closeTo(0.896, 0.00001);
            expect(c.value(0.3)).to.be.closeTo(0.948, 0.00001);
            expect(c.value(0.4)).to.be.closeTo(0.676, 0.00001);
            expect(c.value(0.5)).to.be.closeTo(0.5, 0.00001);
            expect(c.value(0.6)).to.be.closeTo(0.676, 0.00001);
            expect(c.value(0.7)).to.be.closeTo(0.948, 0.00001);
            expect(c.value(0.8)).to.be.closeTo(0.896, 0.00001);
            expect(c.value(0.9)).to.be.closeTo(0.352, 0.00001);
            expect(c.value(1)).to.be.closeTo(0, 0.00001);
        });

        it('returns the interpolated value at the given time (CURVE_SPLINE})', function () {
            const c = new Curve([
                0, 0,
                0.25, 1,
                0.5, 0.5,
                0.75, 1,
                1, 0
            ]);
            c.type = CURVE_SPLINE;
            expect(c.value(0)).to.be.closeTo(0, 0.00001);
            expect(c.value(0.1)).to.be.closeTo(0.472, 0.00001);
            expect(c.value(0.2)).to.be.closeTo(0.896, 0.00001);
            expect(c.value(0.3)).to.be.closeTo(0.98, 0.00001);
            expect(c.value(0.4)).to.be.closeTo(0.7, 0.00001);
            expect(c.value(0.5)).to.be.closeTo(0.5, 0.00001);
            expect(c.value(0.6)).to.be.closeTo(0.7, 0.00001);
            expect(c.value(0.7)).to.be.closeTo(0.98, 0.00001);
            expect(c.value(0.8)).to.be.closeTo(0.896, 0.00001);
            expect(c.value(0.9)).to.be.closeTo(0.472, 0.00001);
            expect(c.value(1)).to.be.closeTo(0, 0.00001);
        });

        it('returns the interpolated value at the given time (CURVE_STEP)', function () {
            const c = new Curve([
                0, 0,
                0.25, 1,
                0.5, 0.5,
                0.75, 1,
                1, 0
            ]);
            c.type = CURVE_STEP;
            expect(c.value(0)).to.equal(0);
            expect(c.value(0.1)).to.equal(0);
            expect(c.value(0.2)).to.equal(0);
            expect(c.value(0.3)).to.equal(1);
            expect(c.value(0.4)).to.equal(1);
            expect(c.value(0.5)).to.equal(0.5);
            expect(c.value(0.6)).to.equal(0.5);
            expect(c.value(0.7)).to.equal(0.5);
            expect(c.value(0.8)).to.equal(1);
            expect(c.value(0.9)).to.equal(1);
            expect(c.value(1)).to.equal(0);
        });

    });

});
