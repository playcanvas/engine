import { string } from '../../src/core/string.js';

import { expect } from 'chai';

describe('string', function () {

    describe('#format', function () {

        it('handles no args', function () {
            const src = 'a string';
            const result = string.format(src);

            expect(result).to.equal('a string');
        });

        it('handles one arg', function () {
            const src = 'a string {0}';
            const result = string.format(src, 'abc');

            expect(result).to.equal('a string abc');
        });

        it('handles two args', function () {
            const src = '{0} a string {1}';
            const result = string.format(src, 'abc', 'def');

            expect(result).to.equal('abc a string def');
        });

    });

    describe('#toBool', function () {

        it('handles strict conversion', function () {
            expect(string.toBool('true', true)).to.be.true;
            expect(string.toBool('false', true)).to.be.false;
            expect(function () {
                string.toBool('abc', true);
            }).to.throw;
        });

        it('handles non-strict conversion', function () {
            expect(string.toBool('true')).to.be.true;
            expect(string.toBool('false')).to.be.false;
            expect(string.toBool('abc')).to.be.false;
            expect(string.toBool(undefined)).to.be.false;
        });

    });

    describe('#getSymbols', function () {

        it('returns an array of the expected length', function () {
            expect(string.getSymbols('ABC').length).to.equal(3);
            expect(string.getSymbols('A🇺🇸').length).to.equal(2);
            expect(string.getSymbols('👨🏿').length).to.equal(1);
            expect(string.getSymbols('👁️‍🗨️').length).to.equal(1);
            expect(string.getSymbols('3️⃣').length).to.equal(1);
            expect(string.getSymbols('🏴‍☠️').length).to.equal(1);
        });

    });

});
