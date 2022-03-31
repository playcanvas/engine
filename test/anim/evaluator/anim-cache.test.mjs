import { AnimCache } from '../../../src/anim/evaluator/anim-cache.js';
import { AnimData } from '../../../src/anim/evaluator/anim-data.js';
import { INTERPOLATION_STEP, INTERPOLATION_LINEAR } from '../../../src/anim/constants.js';
import { expect } from 'chai';

describe('AnimCache', function () {
    const animCache = new AnimCache();
    const input = new AnimData(1, [0, 1, 2]);
    const output = new AnimData(3, [0, 0, 0, 1, 2, 3, 2, 4, 6]);

    describe('#constructor', function () {

        it('instantiates correctly', function () {
            expect(animCache).to.be.ok;
        });

    });

    describe('#update', function () {

        it('can update the normalized time of the cache', function () {
            animCache.update(1.25, input.data);
            expect(animCache._t).to.be.equal(0.25);
        });

    });

    describe('#eval', function () {

        it('can retrieve the step output keyframe value for a given input key', function () {
            const result = [0, 0, 0];
            animCache.update(0, input.data);
            animCache.eval(result, INTERPOLATION_STEP, output);
            expect(result[0]).to.be.equal(0);
            expect(result[1]).to.be.equal(0);
            expect(result[2]).to.be.equal(0);
            animCache.update(1, input.data);
            animCache.eval(result, INTERPOLATION_STEP, output);
            expect(result[0]).to.be.equal(1);
            expect(result[1]).to.be.equal(2);
            expect(result[2]).to.be.equal(3);
            animCache.update(2, input.data);
            animCache.eval(result, INTERPOLATION_STEP, output);
            expect(result[0]).to.be.equal(2);
            expect(result[1]).to.be.equal(4);
            expect(result[2]).to.be.equal(6);
            animCache.update(1.5, input.data);
            animCache.eval(result, INTERPOLATION_STEP, output);
            expect(result[0]).to.be.equal(1);
            expect(result[1]).to.be.equal(2);
            expect(result[2]).to.be.equal(3);
        });

        it('can retrieve the linear output keyframe value for a given input key', function () {
            const result = [0, 0, 0];
            animCache.update(0, input.data);
            animCache.eval(result, INTERPOLATION_LINEAR, output);
            expect(result[0]).to.be.equal(0);
            expect(result[1]).to.be.equal(0);
            expect(result[2]).to.be.equal(0);
            animCache.update(1, input.data);
            animCache.eval(result, INTERPOLATION_LINEAR, output);
            expect(result[0]).to.be.equal(1);
            expect(result[1]).to.be.equal(2);
            expect(result[2]).to.be.equal(3);
            animCache.update(2, input.data);
            animCache.eval(result, INTERPOLATION_LINEAR, output);
            expect(result[0]).to.be.equal(2);
            expect(result[1]).to.be.equal(4);
            expect(result[2]).to.be.equal(6);
            animCache.update(1.5, input.data);
            animCache.eval(result, INTERPOLATION_LINEAR, output);
            expect(result[0]).to.be.equal(1.5);
            expect(result[1]).to.be.equal(3);
            expect(result[2]).to.be.equal(4.5);
        });

    });

});
