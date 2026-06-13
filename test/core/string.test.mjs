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

        it('keeps a base character and its combining marks together', function () {
            // 'a' + combining acute accent (U+0301)
            expect(string.getSymbols('á')).to.deep.equal(['á']);
            // multiple stacked marks stay with their base
            expect(string.getSymbols('ế')).to.deep.equal(['ế']);
        });

        it('clusters Devanagari vowel signs with their consonant', function () {
            // क (ka) + ि (vowel sign i) => one cluster (the vowel sign is reordered before the
            // consonant when shaped, so it must not be split into a separate symbol)
            expect(string.getSymbols('कि')).to.deep.equal(['कि']);
            // हिंदी => हिं (ha + i + anusvara) and दी (da + ii)
            expect(string.getSymbols('हिंदी')).to.deep.equal(['हिं', 'दी']);
        });

        it('clusters Devanagari conjuncts joined by a virama', function () {
            // क + ् (virama) + ष => single conjunct cluster क्ष
            expect(string.getSymbols('क्ष')).to.deep.equal(['क्ष']);
            // नमस्ते => न, म, स्ते (s + virama + t + e)
            expect(string.getSymbols('नमस्ते')).to.deep.equal(['न', 'म', 'स्ते']);
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
            expect(string.fromCodePoint(0x1F600)).to.equal('😀');

            // Musical note: 𝄞 (U+1D11E MUSICAL SYMBOL G CLEF)
            expect(string.fromCodePoint(0x1D11E)).to.equal('𝄞');
        });

        it('handles multiple code points including surrogate pairs', function () {
            // Mix of BMP and astral code points
            expect(string.fromCodePoint(65, 0x1F600, 66)).to.equal('A😀B');

            // Multiple astral code points: 💩 (U+1F4A9) and 🚀 (U+1F680)
            expect(string.fromCodePoint(0x1F4A9, 0x1F680)).to.equal('💩🚀');
        });

        it('matches native String.fromCodePoint behavior', function () {
            // Only run if native method is available
            if (String.fromCodePoint) {
                const testPoints = [65, 0x1F600, 0x1D11E, 0x10437];
                expect(string.fromCodePoint(...testPoints)).to.equal(String.fromCodePoint(...testPoints));
            }
        });
    });

});
