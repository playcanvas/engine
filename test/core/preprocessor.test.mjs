import { expect } from 'chai';

import { Preprocessor } from '../../src/core/preprocessor.js';

describe('Preprocessor', function () {

    const includes = new Map([
        ['inc1', `
            block1
            #ifdef FEATURE2
                nested
            #endif
        `],
        ['inc2', 'block2']
    ]);

    const srcData = `
        
        #define FEATURE1
        #define FEATURE2

        #ifdef FEATURE1
            TEST1
            #include "inc1"
        #endif

        #if defined(FEATURE1)
            TEST2
        #endif

        #ifdef FEATURE1
            #if defined(FEATURE2)
                TEST3
            #endif
        #endif

        #ifndef UNKNOWN
            TEST4
        #endif

        #if defined (UNKNOWN)
            TEST5
            #include "inc2"
        #else
            TEST6
        #endif

        $// comment

        // TEST7

        /*
        TEST8
        */

        #ifdef UNKNOWN
            TEST9
        #elif FEATURE2
            TEST10
        #else
            TEST11
        #endif

        #undef FEATURE1
        #ifdef FEATURE1
            TEST12
        #endif

        #ifndef FEATURE1
            TEST13
        #endif

        #ifdef (UNKNOWN)
            #define TEST14  // this should not be defined
        #endif

        #define INDEX 3
        #if INDEX == 3
            CMP1
        #endif

        #if INDEX != 3
            CMP2
        #endif

        #if INDEX > 2
            CMP3
        #endif

        #define NAME hello
        #if NAME == hello
            CMP4
        #endif

        #if NAME != hello
            CMP5
        #endif
    `;

    it('returns false for MORPH_A', function () {
        expect(Preprocessor.run(srcData, includes).includes('MORPH_A')).to.equal(false);
    });

    it('returns false for MORPH_B', function () {
        expect(Preprocessor.run(srcData, includes).includes('MORPH_B')).to.equal(false);
    });

    it('returns true for $', function () {
        expect(Preprocessor.run(srcData, includes).includes('$')).to.equal(true);
    });

    it('returns true for TEST1', function () {
        expect(Preprocessor.run(srcData, includes).includes('TEST1')).to.equal(true);
    });

    it('returns true for TEST2', function () {
        expect(Preprocessor.run(srcData, includes).includes('TEST2')).to.equal(true);
    });

    it('returns true for TEST3', function () {
        expect(Preprocessor.run(srcData, includes).includes('TEST3')).to.equal(true);
    });

    it('returns true for TEST4', function () {
        expect(Preprocessor.run(srcData, includes).includes('TEST4')).to.equal(true);
    });

    it('returns false for TEST5', function () {
        expect(Preprocessor.run(srcData, includes).includes('TEST5')).to.equal(false);
    });

    it('returns true for TEST6', function () {
        expect(Preprocessor.run(srcData, includes).includes('TEST6')).to.equal(true);
    });

    it('returns false for TEST7', function () {
        expect(Preprocessor.run(srcData, includes).includes('TEST7')).to.equal(false);
    });

    it('returns false for TEST8', function () {
        expect(Preprocessor.run(srcData, includes).includes('TEST8')).to.equal(false);
    });

    it('returns false for TEST9', function () {
        expect(Preprocessor.run(srcData, includes).includes('TEST9')).to.equal(false);
    });

    it('returns true for TEST10', function () {
        expect(Preprocessor.run(srcData, includes).includes('TEST10')).to.equal(true);
    });

    it('returns false for TEST11', function () {
        expect(Preprocessor.run(srcData, includes).includes('TEST11')).to.equal(false);
    });

    it('returns false for TEST12', function () {
        expect(Preprocessor.run(srcData, includes).includes('TEST12')).to.equal(false);
    });

    it('returns true for TEST13', function () {
        expect(Preprocessor.run(srcData, includes).includes('TEST13')).to.equal(true);
    });

    it('returns false for TEST14', function () {
        expect(Preprocessor.run(srcData, includes).includes('TEST14')).to.equal(false);
    });

    it('returns true for INC1', function () {
        expect(Preprocessor.run(srcData, includes).includes('block1')).to.equal(true);
    });

    it('returns false for INC2', function () {
        expect(Preprocessor.run(srcData, includes).includes('block2')).to.equal(false);
    });

    it('returns true for nested', function () {
        expect(Preprocessor.run(srcData, includes).includes('nested')).to.equal(true);
    });

    it('returns true for CMP1', function () {
        expect(Preprocessor.run(srcData, includes).includes('CMP1')).to.equal(true);
    });

    it('returns false for CMP2', function () {
        expect(Preprocessor.run(srcData, includes).includes('CMP2')).to.equal(false);
    });

    it('returns true for CMP3', function () {
        expect(Preprocessor.run(srcData, includes).includes('CMP3')).to.equal(true);
    });

    it('returns true for CMP4', function () {
        expect(Preprocessor.run(srcData, includes).includes('CMP4')).to.equal(true);
    });

    it('returns false for CMP5', function () {
        expect(Preprocessor.run(srcData, includes).includes('CMP5')).to.equal(false);
    });

    it('returns false for any leftover hash symbols', function () {
        expect(Preprocessor.run(srcData, includes, { stripDefines: true }).includes('#')).to.equal(false);
    });

});
