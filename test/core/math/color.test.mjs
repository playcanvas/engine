import { Color } from '../../../src/core/math/color.js';

import { expect } from 'chai';

describe('Color', function () {

    describe('#constructor', function () {

        it('supports zero arguments', function () {
            const c = new Color();
            expect(c.r).to.equal(0);
            expect(c.g).to.equal(0);
            expect(c.b).to.equal(0);
            expect(c.a).to.equal(1);
        });

        it('supports number arguments', function () {
            const c = new Color(0.1, 0.2, 0.3, 0.4);
            expect(c.r).to.equal(0.1);
            expect(c.g).to.equal(0.2);
            expect(c.b).to.equal(0.3);
            expect(c.a).to.equal(0.4);
        });

        it('supports a 3 element array argument', function () {
            const c = new Color([0.1, 0.2, 0.3]);
            expect(c.r).to.equal(0.1);
            expect(c.g).to.equal(0.2);
            expect(c.b).to.equal(0.3);
            expect(c.a).to.equal(1);
        });

        it('supports a 4 element array argument', function () {
            const c = new Color([0.1, 0.2, 0.3, 0.4]);
            expect(c.r).to.equal(0.1);
            expect(c.g).to.equal(0.2);
            expect(c.b).to.equal(0.3);
            expect(c.a).to.equal(0.4);
        });

    });

    describe('#clone', function () {

        it('clones a color', function () {
            const c1 = new Color(0.1, 0.2, 0.3, 0.4);
            const c2 = c1.clone();
            expect(c2).to.not.equal(c1);
            expect(c2.r).to.equal(0.1);
            expect(c2.g).to.equal(0.2);
            expect(c2.b).to.equal(0.3);
            expect(c2.a).to.equal(0.4);
        });

        it('ensures that an instance of a subclass keeps its class prototype', function () {
            class UserColor extends Color {}
            const a = new UserColor();
            const b = a.clone();
            expect(b).to.be.an.instanceof(UserColor);
        });

    });

    describe('#copy', function () {

        it('copies a color', function () {
            const c1 = new Color(0.1, 0.2, 0.3, 0.4);
            const c2 = new Color();
            c2.copy(c1);
            expect(c2).to.not.equal(c1);
            expect(c2.r).to.equal(0.1);
            expect(c2.g).to.equal(0.2);
            expect(c2.b).to.equal(0.3);
            expect(c2.a).to.equal(0.4);
        });

    });

    describe('#equals', function () {

        it('returns true if colors are equal', function () {
            const c1 = new Color(0.1, 0.2, 0.3, 0.4);
            const c2 = new Color(0.1, 0.2, 0.3, 0.4);
            expect(c1.equals(c2)).to.be.true;
        });

        it('returns false if colors are not equal', function () {
            const c1 = new Color(0.1, 0.2, 0.3, 0.4);
            const c2 = new Color(0.5, 0.6, 0.7, 0.8);
            expect(c1.equals(c2)).to.be.false;
        });

    });

    describe('#fromString', function () {

        it('parses a lower case hex string', function () {
            const c = new Color();
            c.fromString('#ff00ff');
            expect(c.r).to.equal(1);
            expect(c.g).to.equal(0);
            expect(c.b).to.equal(1);
            expect(c.a).to.equal(1);
        });

        it('parses a lower case hex string with alpha', function () {
            const c = new Color();
            c.fromString('#ff00ff80');
            expect(c.r).to.equal(1);
            expect(c.g).to.equal(0);
            expect(c.b).to.equal(1);
            expect(c.a).to.closeTo(0.5019607843137255, 0.0001);
        });

        it('parses a upper case hex string with alpha', function () {
            const c = new Color();
            c.fromString('#FF00FF80');
            expect(c.r).to.equal(1);
            expect(c.g).to.equal(0);
            expect(c.b).to.equal(1);
            expect(c.a).to.be.closeTo(0.5019607843137255, 0.0001);
        });

    });

    describe('#lerp', function () {

        it('linearly interpolates between two colors with alpha of 0', function () {
            const c1 = new Color(0.1, 0.2, 0.3, 0.4);
            const c2 = new Color(0.5, 0.6, 0.7, 0.8);
            const c3 = new Color();
            c3.lerp(c1, c2, 0);
            expect(c3.r).to.equal(0.1);
            expect(c3.g).to.equal(0.2);
            expect(c3.b).to.equal(0.3);
            expect(c3.a).to.equal(0.4);
        });

        it('linearly interpolates between two colors with alpha of 0.5', function () {
            const c1 = new Color(0.1, 0.2, 0.3, 0.4);
            const c2 = new Color(0.5, 0.6, 0.7, 0.8);
            const c3 = new Color();
            c3.lerp(c1, c2, 0.5);
            expect(c3.r).to.be.closeTo(0.3, 0.0001);
            expect(c3.g).to.be.closeTo(0.4, 0.0001);
            expect(c3.b).to.be.closeTo(0.5, 0.0001);
            expect(c3.a).to.be.closeTo(0.6, 0.0001);
        });

        it('linearly interpolates between two colors with alpha of 1', function () {
            const c1 = new Color(0.1, 0.2, 0.3, 0.4);
            const c2 = new Color(0.5, 0.6, 0.7, 0.8);
            const c3 = new Color();
            c3.lerp(c1, c2, 1);
            expect(c3.r).to.equal(0.5);
            expect(c3.g).to.equal(0.6);
            expect(c3.b).to.equal(0.7);
            expect(c3.a).to.equal(0.8);
        });

    });

    describe('#set', function () {

        it('sets a color', function () {
            const c = new Color();
            c.set(0.1, 0.2, 0.3, 0.4);
            expect(c.r).to.equal(0.1);
            expect(c.g).to.equal(0.2);
            expect(c.b).to.equal(0.3);
            expect(c.a).to.equal(0.4);
        });

    });

    describe('#toString', function () {

        it('returns a string representation of black (no alpha)', function () {
            expect(Color.BLACK.toString()).to.equal('#000000');
        });

        it('returns a string representation of white (no alpha)', function () {
            expect(Color.WHITE.toString()).to.equal('#ffffff');
        });

        it('returns a string representation of an arbitrary color (no alpha)', function () {
            const c = new Color(0.1, 0.2, 0.3, 0.4);
            expect(c.toString()).to.equal('#1a334d');
        });

        it('returns a string representation of an arbitrary color (with single digit alpha)', function () {
            const c = new Color(0.1, 0.2, 0.3, 0.05);
            expect(c.toString(true)).to.equal('#1a334d0d');
        });

        it('returns a string representation of an arbitrary color (with double digit alpha)', function () {
            const c = new Color(0.1, 0.2, 0.3, 0.4);
            expect(c.toString(true)).to.equal('#1a334d66');
        });

    });
});
