import { BlendState } from '../../../src/platform/graphics/blend-state.js';
import {
    BLENDEQUATION_ADD, BLENDEQUATION_MAX, BLENDEQUATION_MIN, BLENDMODE_ONE, BLENDMODE_ZERO,
    BLENDMODE_ONE_MINUS_DST_COLOR, BLENDMODE_SRC_ALPHA_SATURATE
} from '../../../src/platform/graphics/constants.js';

import { expect } from 'chai';

describe('BlendState', function () {

    describe('#constructor', function () {

        it('empty', function () {
            const bs = new BlendState();
            expect(bs.blend).to.equal(false);
            expect(bs.colorOp).to.equal(BLENDEQUATION_ADD);
            expect(bs.colorSrcFactor).to.equal(BLENDMODE_ONE);
            expect(bs.colorDstFactor).to.equal(BLENDMODE_ZERO);
            expect(bs.alphaOp).to.equal(BLENDEQUATION_ADD);
            expect(bs.alphaSrcFactor).to.equal(BLENDMODE_ONE);
            expect(bs.alphaDstFactor).to.equal(BLENDMODE_ZERO);
            expect(bs.redWrite).to.equal(true);
            expect(bs.greenWrite).to.equal(true);
            expect(bs.blueWrite).to.equal(true);
            expect(bs.alphaWrite).to.equal(true);
        });

        it('minimal parameters', function () {
            const bs = new BlendState(true, BLENDEQUATION_ADD, BLENDMODE_ONE, BLENDMODE_ZERO);
            expect(bs.blend).to.equal(true);
            expect(bs.colorOp).to.equal(BLENDEQUATION_ADD);
            expect(bs.colorSrcFactor).to.equal(BLENDMODE_ONE);
            expect(bs.colorDstFactor).to.equal(BLENDMODE_ZERO);
            expect(bs.alphaOp).to.equal(BLENDEQUATION_ADD);
            expect(bs.alphaSrcFactor).to.equal(BLENDMODE_ONE);
            expect(bs.alphaDstFactor).to.equal(BLENDMODE_ZERO);
            expect(bs.redWrite).to.equal(true);
            expect(bs.greenWrite).to.equal(true);
            expect(bs.blueWrite).to.equal(true);
            expect(bs.alphaWrite).to.equal(true);
        });

        it('full parameters', function () {
            const bs = new BlendState(true, BLENDEQUATION_MIN, BLENDMODE_ONE, BLENDMODE_ZERO,
                                      BLENDEQUATION_MAX, BLENDMODE_ONE_MINUS_DST_COLOR, BLENDMODE_SRC_ALPHA_SATURATE,
                                      false, false, false, false);
            expect(bs.blend).to.equal(true);
            expect(bs.colorOp).to.equal(BLENDEQUATION_MIN);
            expect(bs.colorSrcFactor).to.equal(BLENDMODE_ONE);
            expect(bs.colorDstFactor).to.equal(BLENDMODE_ZERO);
            expect(bs.alphaOp).to.equal(BLENDEQUATION_MAX);
            expect(bs.alphaSrcFactor).to.equal(BLENDMODE_ONE_MINUS_DST_COLOR);
            expect(bs.alphaDstFactor).to.equal(BLENDMODE_SRC_ALPHA_SATURATE);
            expect(bs.redWrite).to.equal(false);
            expect(bs.greenWrite).to.equal(false);
            expect(bs.blueWrite).to.equal(false);
            expect(bs.alphaWrite).to.equal(false);
        });

    });

});
