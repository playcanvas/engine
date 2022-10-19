import { CURVE_LINEAR, CURVE_SMOOTHSTEP, CURVE_SPLINE, CURVE_STEP } from '../../../src/core/math/constants.js';
import { CurveSet } from '../../../src/core/math/curve-set.js';

import { expect } from 'chai';

describe('CurveSet', function () {

    describe('#constructor', function () {

        it('supports zero arguments', function () {
            const curveSet = new CurveSet();

            expect(curveSet.length).to.equal(1);
            expect(curveSet.type).to.equal(CURVE_SMOOTHSTEP);
        });

        it('supports one number argument', function () {
            const curveSet = new CurveSet(3);

            expect(curveSet.length).to.equal(3);
            expect(curveSet.type).to.equal(CURVE_SMOOTHSTEP);
        });

        it('supports one array argument', function () {
            const curveSet = new CurveSet([
                [
                    0, 0,        // At 0 time, value of 0
                    0.33, 2,     // At 0.33 time, value of 2
                    0.66, 2.6,   // At 0.66 time, value of 2.6
                    1, 3         // At 1 time, value of 3
                ],
                [
                    0, 34,
                    0.33, 35,
                    0.66, 36,
                    1, 37
                ]
            ]);

            expect(curveSet.length).to.equal(2);
            expect(curveSet.type).to.equal(CURVE_SMOOTHSTEP);
        });

    });

    describe('#type', function () {

        it('is CURVE_SMOOTHSTEP by default', function () {
            const curveSet = new CurveSet();

            expect(curveSet.type).to.equal(CURVE_SMOOTHSTEP);
        });

        it('can be set to CURVE_LINEAR', function () {
            const curveSet = new CurveSet();

            curveSet.type = CURVE_LINEAR;

            expect(curveSet.type).to.equal(CURVE_LINEAR);
        });

        it('can be set to CURVE_SMOOTHSTEP', function () {
            const curveSet = new CurveSet();

            curveSet.type = CURVE_SMOOTHSTEP;

            expect(curveSet.type).to.equal(CURVE_SMOOTHSTEP);
        });

        it('can be set to CURVE_SPLINE', function () {
            const curveSet = new CurveSet();

            curveSet.type = CURVE_SPLINE;

            expect(curveSet.type).to.equal(CURVE_SPLINE);
        });

        it('can be set to CURVE_STEP', function () {
            const curveSet = new CurveSet();

            curveSet.type = CURVE_STEP;

            expect(curveSet.type).to.equal(CURVE_STEP);
        });

        it('sets the type property of all curves in the curve set', function () {
            const curveSet = new CurveSet([
                [
                    0, 0,        // At 0 time, value of 0
                    0.33, 2,     // At 0.33 time, value of 2
                    0.66, 2.6,   // At 0.66 time, value of 2.6
                    1, 3         // At 1 time, value of 3
                ],
                [
                    0, 34,
                    0.33, 35,
                    0.66, 36,
                    1, 37
                ]
            ]);

            expect(curveSet.type).to.equal(CURVE_SMOOTHSTEP);
            expect(curveSet.curves[0].type).to.equal(CURVE_SMOOTHSTEP);
            expect(curveSet.curves[1].type).to.equal(CURVE_SMOOTHSTEP);

            curveSet.type = CURVE_LINEAR;

            expect(curveSet.type).to.equal(CURVE_LINEAR);
            expect(curveSet.curves[0].type).to.equal(CURVE_LINEAR);
            expect(curveSet.curves[1].type).to.equal(CURVE_LINEAR);

            curveSet.type = CURVE_SMOOTHSTEP;

            expect(curveSet.type).to.equal(CURVE_SMOOTHSTEP);
            expect(curveSet.curves[0].type).to.equal(CURVE_SMOOTHSTEP);
            expect(curveSet.curves[1].type).to.equal(CURVE_SMOOTHSTEP);

            curveSet.type = CURVE_SPLINE;

            expect(curveSet.type).to.equal(CURVE_SPLINE);
            expect(curveSet.curves[0].type).to.equal(CURVE_SPLINE);
            expect(curveSet.curves[1].type).to.equal(CURVE_SPLINE);

            curveSet.type = CURVE_STEP;

            expect(curveSet.type).to.equal(CURVE_STEP);
            expect(curveSet.curves[0].type).to.equal(CURVE_STEP);
            expect(curveSet.curves[1].type).to.equal(CURVE_STEP);
        });

    });

    describe('#clone()', function () {

        it('clones a simple curve set', function () {
            const curveSet = new CurveSet();
            const clone = curveSet.clone();

            expect(clone).to.not.equal(curveSet);
            expect(clone.length).to.equal(curveSet.length);
            expect(clone.type).to.equal(curveSet.type);
        });

        it('clones a complex curve set', function () {
            const curveSet = new CurveSet([
                [
                    0, 0,        // At 0 time, value of 0
                    0.33, 2,     // At 0.33 time, value of 2
                    0.66, 2.6,   // At 0.66 time, value of 2.6
                    1, 3         // At 1 time, value of 3
                ],
                [
                    0, 34,
                    0.33, 35,
                    0.66, 36,
                    1, 37
                ]
            ]);
            const cloneCurveSet = curveSet.clone();

            expect(cloneCurveSet).to.not.equal(curveSet);
            expect(cloneCurveSet.length).to.equal(curveSet.length);
            expect(cloneCurveSet.type).to.equal(curveSet.type);

            for (let i = 0; i < curveSet.length; i++) {
                const curve = curveSet.get(i);
                const cloneCurve = cloneCurveSet.get(i);

                expect(cloneCurve).to.not.equal(curve);
                expect(cloneCurve.length).to.equal(curve.length);
                expect(cloneCurve.type).to.equal(curve.type);

                for (let j = 0; j < curve.length; j++) {
                    const key = curve.get(j);
                    const cloneKey = cloneCurve.get(j);

                    expect(cloneKey).to.not.equal(key);
                    expect(cloneKey[0]).to.equal(key[0]);
                    expect(cloneKey[1]).to.equal(key[1]);
                }
            }
        });

        it('ensures that an instance of a subclass keeps its class prototype', function () {
            class UserCurveSet extends CurveSet {}
            const a = new UserCurveSet();
            const b = a.clone();
            expect(b).to.be.an.instanceof(UserCurveSet);
        });
    });

    describe('#get()', function () {

        it('returns the curve at the given index', function () {
            const curveSet = new CurveSet([
                [
                    0, 0,        // At 0 time, value of 0
                    0.33, 2,     // At 0.33 time, value of 2
                    0.66, 2.6,   // At 0.66 time, value of 2.6
                    1, 3         // At 1 time, value of 3
                ],
                [
                    0, 34,
                    0.33, 35,
                    0.66, 36,
                    1, 37
                ]
            ]);

            const c0 = curveSet.get(0);
            expect(c0.get(0)).to.deep.equal([0, 0]);
            expect(c0.get(1)).to.deep.equal([0.33, 2]);
            expect(c0.get(2)).to.deep.equal([0.66, 2.6]);
            expect(c0.get(3)).to.deep.equal([1, 3]);

            const c1 = curveSet.get(1);
            expect(c1.get(0)).to.deep.equal([0, 34]);
            expect(c1.get(1)).to.deep.equal([0.33, 35]);
            expect(c1.get(2)).to.deep.equal([0.66, 36]);
            expect(c1.get(3)).to.deep.equal([1, 37]);

            const c2 = curveSet.get(2);
            expect(c2).to.equal(undefined);
        });

    });

    describe('#value()', function () {

        it('returns the optional array parameter', function () {
            const curveSet = new CurveSet([
                [
                    0, 0,
                    0.5, 1,
                    1, 0
                ],
                [
                    0, 1,
                    0.5, 0,
                    1, 1
                ]
            ]);

            const input = [];
            const output = curveSet.value(0, input);
            expect(input).to.equal(output);
        });

        it('fills a supplied array with interpolated values based on the specified time (linear)', function () {
            const curveSet = new CurveSet([
                [
                    0, 0,
                    0.5, 1,
                    1, 0
                ],
                [
                    0, 1,
                    0.5, 0,
                    1, 1
                ]
            ]);
            curveSet.type = CURVE_LINEAR;

            const result = [];

            curveSet.value(0, result);
            expect(result).to.deep.equal([0, 1]);

            curveSet.value(0.25, result);
            expect(result).to.deep.equal([0.5, 0.5]);

            curveSet.value(0.5, result);
            expect(result).to.deep.equal([1, 0]);

            curveSet.value(0.75, result);
            expect(result).to.deep.equal([0.5, 0.5]);

            curveSet.value(1, result);
            expect(result).to.deep.equal([0, 1]);
        });

        it('fills a supplied array with interpolated values based on the specified time (smoothstep)', function () {
            const curveSet = new CurveSet([
                [
                    0, 0,
                    0.5, 1,
                    1, 0
                ],
                [
                    0, 1,
                    0.5, 0,
                    1, 1
                ]
            ]);

            const result = [];

            curveSet.value(0, result);
            expect(result).to.deep.equal([0, 1]);

            curveSet.value(0.25, result);
            expect(result).to.deep.equal([0.5, 0.5]);

            curveSet.value(0.5, result);
            expect(result).to.deep.equal([1, 0]);

            curveSet.value(0.75, result);
            expect(result).to.deep.equal([0.5, 0.5]);
        });

        it('fills a supplied array with interpolated values based on the specified time (spline)', function () {
            const curveSet = new CurveSet([
                [
                    0, 0,
                    0.5, 1,
                    1, 0
                ],
                [
                    0, 1,
                    0.5, 0,
                    1, 1
                ]
            ]);
            curveSet.type = CURVE_SPLINE;

            const result = [];

            curveSet.value(0, result);
            expect(result).to.deep.equal([0, 1]);

            curveSet.value(0.25, result);
            expect(result).to.deep.equal([0.625, 0.375]);

            curveSet.value(0.5, result);
            expect(result).to.deep.equal([1, 0]);

            curveSet.value(0.75, result);
            expect(result).to.deep.equal([0.625, 0.375]);

            curveSet.value(1, result);
            expect(result).to.deep.equal([0, 1]);
        });

        it('fills a supplied array with interpolated values based on the specified time (step)', function () {
            const curveSet = new CurveSet([
                [
                    0, 0,
                    0.5, 1,
                    1, 0
                ],
                [
                    0, 1,
                    0.5, 0,
                    1, 1
                ]
            ]);
            curveSet.type = CURVE_STEP;

            const result = [];

            curveSet.value(0, result);
            expect(result).to.deep.equal([0, 1]);

            curveSet.value(0.25, result);
            expect(result).to.deep.equal([0, 1]);

            curveSet.value(0.5, result);
            expect(result).to.deep.equal([1, 0]);

            curveSet.value(0.75, result);
            expect(result).to.deep.equal([1, 0]);

            curveSet.value(1, result);
            expect(result).to.deep.equal([0, 1]);
        });

    });

});
