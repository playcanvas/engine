import { string } from '../../src/core/string.js';

import { expect } from 'chai';

describe('string', () => {

    describe('#format', () => {

        it('handles no args', () => {
            const src = 'a string';
            const result = string.format(src);

            expect(result).to.equal('a string');
        });

        it('handles one arg', () => {
            const src = 'a string {0}';
            const result = string.format(src, 'abc');

            expect(result).to.equal('a string abc');
        });

        it('handles two args', () => {
            const src = '{0} a string {1}';
            const result = string.format(src, 'abc', 'def');

            expect(result).to.equal('abc a string def');
        });

    });

    describe('#getSymbols', () => {

        it('returns an array of the expected length', () => {
            expect(string.getSymbols('ABC').length).to.equal(3);
            expect(string.getSymbols('A🇺🇸').length).to.equal(2);
            expect(string.getSymbols('👨🏿').length).to.equal(1);
            expect(string.getSymbols('👁️‍🗨️').length).to.equal(1);
            expect(string.getSymbols('3️⃣').length).to.equal(1);
            expect(string.getSymbols('🏴‍☠️').length).to.equal(1);
        });

    });

});
