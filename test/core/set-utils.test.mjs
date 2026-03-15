import { expect } from 'chai';

import { SetUtils } from '../../src/core/set-utils.js';

describe('SetUtils', function () {

    describe('#equals', function () {

        it('returns true for equal sets with same elements', function () {
            const setA = new Set([1, 2, 3]);
            const setB = new Set([1, 2, 3]);
            expect(SetUtils.equals(setA, setB)).to.be.true;
        });

        it('returns true for equal sets with different insertion order', function () {
            const setA = new Set([3, 1, 2]);
            const setB = new Set([1, 2, 3]);
            expect(SetUtils.equals(setA, setB)).to.be.true;
        });

        it('returns false for sets with different elements', function () {
            const setA = new Set([1, 2, 3]);
            const setB = new Set([1, 2, 4]);
            expect(SetUtils.equals(setA, setB)).to.be.false;
        });

        it('returns false for sets with different sizes', function () {
            const setA = new Set([1, 2, 3]);
            const setB = new Set([1, 2]);
            expect(SetUtils.equals(setA, setB)).to.be.false;
        });

        it('returns true for two empty sets', function () {
            const setA = new Set();
            const setB = new Set();
            expect(SetUtils.equals(setA, setB)).to.be.true;
        });

        it('returns true for sets with one element', function () {
            const setA = new Set([42]);
            const setB = new Set([42]);
            expect(SetUtils.equals(setA, setB)).to.be.true;
        });

        it('returns false for sets with different single elements', function () {
            const setA = new Set([42]);
            const setB = new Set([43]);
            expect(SetUtils.equals(setA, setB)).to.be.false;
        });

        it('returns true for sets with multiple elements', function () {
            const setA = new Set(['a', 'b', 'c', 'd', 'e']);
            const setB = new Set(['e', 'd', 'c', 'b', 'a']);
            expect(SetUtils.equals(setA, setB)).to.be.true;
        });

        it('returns true for sets with object references', function () {
            const obj1 = { id: 1 };
            const obj2 = { id: 2 };
            const setA = new Set([obj1, obj2]);
            const setB = new Set([obj2, obj1]);
            expect(SetUtils.equals(setA, setB)).to.be.true;
        });

        it('returns false for sets with different object references', function () {
            const obj1 = { id: 1 };
            const obj2 = { id: 2 };
            const obj3 = { id: 3 };
            const setA = new Set([obj1, obj2]);
            const setB = new Set([obj2, obj3]);
            expect(SetUtils.equals(setA, setB)).to.be.false;
        });

    });

});
