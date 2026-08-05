import { expect } from 'chai';

import { string } from '../../src/core/string.js';

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

    describe('#fromCodePoint', function () {
        it('converts basic ASCII code points to characters', function () {
            expect(string.fromCodePoint(65)).to.equal('A');
            expect(string.fromCodePoint(66, 67)).to.equal('BC');
            expect(string.fromCodePoint(97, 98, 99)).to.equal('abc');
        });

        it('handles code points beyond the BMP (Basic Multilingual Plane)', function () {
            // Emoji: 😀 (U+1F600 GRINNING FACE)
            expect(string.fromCodePoint(0x1f600)).to.equal('😀');

            // Musical note: 𝄞 (U+1D11E MUSICAL SYMBOL G CLEF)
            expect(string.fromCodePoint(0x1d11e)).to.equal('𝄞');
        });

        it('handles multiple code points including surrogate pairs', function () {
            // Mix of BMP and astral code points
            expect(string.fromCodePoint(65, 0x1f600, 66)).to.equal('A😀B');

            // Multiple astral code points: 💩 (U+1F4A9) and 🚀 (U+1F680)
            expect(string.fromCodePoint(0x1f4a9, 0x1f680)).to.equal('💩🚀');
        });

        it('matches native String.fromCodePoint behavior', function () {
            // Only run if native method is available
            if (String.fromCodePoint) {
                const testPoints = [65, 0x1f600, 0x1d11e, 0x10437];
                expect(string.fromCodePoint(...testPoints)).to.equal(String.fromCodePoint(...testPoints));
            }
        });
    });
});
