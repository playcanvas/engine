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
        ['inc2', 'block2'],
        ['incLoop', 'inserted{i}\n']
    ]);

    const srcData = `
        
        #define LOOP_COUNT 3
        #define {COUNT} 2
        #define {STRING} hello
        #define FEATURE1
        #define FEATURE2
        #define AND1
        #define AND2
        #define OR1
        #define OR2

        #include "incLoop, LOOP_COUNT"

        #if (defined(AND1) && defined(AND2))
            ANDS1
        #endif

        #if (defined(UNDEFINED) && defined(AND2))
            ANDS2
        #endif

        #if (defined(OR1) || defined(OR2))
            ORS1
        #endif

        #if (defined(UNDEFINED) || defined(OR2))
            ORS2
        #endif

        #if (defined(UNDEFINED) || defined(UNDEFINED2) || defined(OR2))
            ORS3
        #endif

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

        // Test parentheses precedence
        #define A
        #define B
        #define C

        // Without parentheses, AND has higher precedence than OR
        #if defined(A) || defined(B) && defined(UNDEFINED)
            PREC1
        #endif

        // With parentheses, force OR to be evaluated first
        #if (defined(A) || defined(B)) && defined(UNDEFINED)
            PREC2
        #endif

        // Nested parentheses
        #if (defined(A) && (defined(B) || defined(UNDEFINED))) && defined(C)
            PREC3
        #endif

        // Complex expression with multiple parentheses
        #if (defined(A) || defined(UNDEFINED)) && (defined(B) || defined(UNDEFINED)) && defined(C)
            PREC4
        #endif

        // Parentheses with comparisons
        #if (INDEX > 2) && (INDEX < 4)
            PREC5
        #endif

        // Mixed defined() and comparisons with parentheses
        #if (defined(A) && INDEX == 3) || (defined(UNDEFINED) && INDEX > 10)
            PREC6
        #endif

        // Make sure defined() parentheses are not treated as precedence
        #if defined(A) && defined(B)
            PREC7
        #endif

        // Multiple levels of nesting
        #if ((defined(A) || defined(B)) && (defined(C) || defined(UNDEFINED))) || defined(UNDEFINED)
            PREC8
        #endif

        TESTINJECTION {COUNT}
        INJECTSTRING {STRING}(x)
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

    it('returns true for working integer injection', function () {
        expect(Preprocessor.run(srcData, includes).includes('TESTINJECTION 2')).to.equal(true);
    });

    it('returns true for working string injection', function () {
        expect(Preprocessor.run(srcData, includes).includes('INJECTSTRING hello(x)')).to.equal(true);
    });

    it('returns true for loop injection', function () {
        expect(Preprocessor.run(srcData, includes).includes('inserted0')).to.equal(true);
        expect(Preprocessor.run(srcData, includes).includes('inserted1')).to.equal(true);
        expect(Preprocessor.run(srcData, includes).includes('inserted2')).to.equal(true);
        expect(Preprocessor.run(srcData, includes).includes('inserted3')).to.equal(false);
    });

    it('returns true for ANDS1', function () {
        expect(Preprocessor.run(srcData, includes).includes('ANDS1')).to.equal(true);
    });

    it('returns false for ANDS2', function () {
        expect(Preprocessor.run(srcData, includes).includes('ANDS2')).to.equal(false);
    });

    it('returns true for ORS1', function () {
        expect(Preprocessor.run(srcData, includes).includes('ORS1')).to.equal(true);
    });

    it('returns true for ORS2', function () {
        expect(Preprocessor.run(srcData, includes).includes('ORS2')).to.equal(true);
    });

    it('returns true for ORS3', function () {
        expect(Preprocessor.run(srcData, includes).includes('ORS3')).to.equal(true);
    });

    // Parentheses precedence tests
    it('returns true for PREC1 (without parentheses, A || B && UNDEFINED)', function () {
        expect(Preprocessor.run(srcData, includes).includes('PREC1')).to.equal(true);
    });

    it('returns false for PREC2 (with parentheses, (A || B) && UNDEFINED)', function () {
        expect(Preprocessor.run(srcData, includes).includes('PREC2')).to.equal(false);
    });

    it('returns true for PREC3 (nested parentheses)', function () {
        expect(Preprocessor.run(srcData, includes).includes('PREC3')).to.equal(true);
    });

    it('returns true for PREC4 (complex expression with parentheses)', function () {
        expect(Preprocessor.run(srcData, includes).includes('PREC4')).to.equal(true);
    });

    it('returns true for PREC5 (parentheses with comparisons)', function () {
        expect(Preprocessor.run(srcData, includes).includes('PREC5')).to.equal(true);
    });

    it('returns true for PREC6 (mixed defined and comparisons)', function () {
        expect(Preprocessor.run(srcData, includes).includes('PREC6')).to.equal(true);
    });

    it('returns true for PREC7 (defined() parentheses not treated as precedence)', function () {
        expect(Preprocessor.run(srcData, includes).includes('PREC7')).to.equal(true);
    });

    it('returns true for PREC8 (multiple levels of nesting)', function () {
        expect(Preprocessor.run(srcData, includes).includes('PREC8')).to.equal(true);
    });
});
