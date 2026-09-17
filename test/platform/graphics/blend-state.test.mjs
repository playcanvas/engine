import { expect } from 'chai';

import { BlendState } from '../../../src/platform/graphics/blend-state.js';
import {
    BLENDEQUATION_ADD, BLENDEQUATION_MAX, BLENDEQUATION_MIN, BLENDMODE_ONE, BLENDMODE_ZERO,
    BLENDMODE_ONE_MINUS_DST_COLOR, BLENDMODE_SRC_ALPHA, BLENDMODE_ONE_MINUS_SRC_ALPHA,
    BLENDMODE_SRC_ALPHA_SATURATE, BLENDMODE_SRC1_COLOR, BLENDMODE_ONE_MINUS_SRC1_ALPHA
} from '../../../src/platform/graphics/constants.js';

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

        it('dual-source factors', function () {
            const bs = new BlendState(true, BLENDEQUATION_ADD, BLENDMODE_ONE, BLENDMODE_SRC1_COLOR,
                BLENDEQUATION_ADD, BLENDMODE_ONE, BLENDMODE_ONE_MINUS_SRC1_ALPHA);

            expect(bs.colorDstFactor).to.equal(BLENDMODE_SRC1_COLOR);
            expect(bs.alphaDstFactor).to.equal(BLENDMODE_ONE_MINUS_SRC1_ALPHA);
            expect(bs.usesDualSourceBlending).to.equal(true);
        });

    });

    // reusable destination for getAttachment, mirroring how the backends use it
    const scratch = new BlendState();

    const expectSameState = (actual, expected) => {
        expect(actual.blend).to.equal(expected.blend);
        expect(actual.colorOp).to.equal(expected.colorOp);
        expect(actual.colorSrcFactor).to.equal(expected.colorSrcFactor);
        expect(actual.colorDstFactor).to.equal(expected.colorDstFactor);
        expect(actual.alphaOp).to.equal(expected.alphaOp);
        expect(actual.alphaSrcFactor).to.equal(expected.alphaSrcFactor);
        expect(actual.alphaDstFactor).to.equal(expected.alphaDstFactor);
        expect(actual.allWrite).to.equal(expected.allWrite);
    };

    // an alpha blended state, used as the attachment 0 of the per-attachment tests
    const createBase = () => new BlendState(true, BLENDEQUATION_ADD, BLENDMODE_SRC_ALPHA, BLENDMODE_ONE_MINUS_SRC_ALPHA);

    describe('#setAttachment', function () {

        it('an attachment which was not set follows attachment 0', function () {
            const bs = createBase();
            expect(bs.hasAttachmentOverrides).to.equal(false);

            for (let i = 0; i < 8; i++) {
                expectSameState(bs.getAttachment(i, scratch), bs);
            }
        });

        it('an attachment which was set reports its own state', function () {
            const bs = createBase();
            const additive = new BlendState(true, BLENDEQUATION_ADD, BLENDMODE_ONE, BLENDMODE_ONE);
            bs.setAttachment(1, additive);

            expect(bs.hasAttachmentOverrides).to.equal(true);
            expectSameState(bs.getAttachment(1, scratch), additive);

            // attachment 0 and the remaining attachments are unaffected
            expectSameState(bs.getAttachment(0, scratch), createBase());
            expectSameState(bs.getAttachment(2, scratch), createBase());
        });

        it('supports an independent write mask', function () {
            const bs = createBase();
            const noWrite = createBase();
            noWrite.setColorWrite(false, false, false, false);
            bs.setAttachment(1, noWrite);

            expect(bs.allWrite).to.equal(0b1111);
            expect(bs.getAttachment(1, scratch).allWrite).to.equal(0);

            // the blending of the override is preserved
            expect(bs.getAttachment(1, scratch).colorDstFactor).to.equal(BLENDMODE_ONE_MINUS_SRC_ALPHA);
        });

        it('an attachment which was not set tracks later changes of attachment 0', function () {
            const bs = createBase();
            bs.setAttachment(1, new BlendState(true, BLENDEQUATION_ADD, BLENDMODE_ONE, BLENDMODE_ONE));

            bs.setColorBlend(BLENDEQUATION_MIN, BLENDMODE_ZERO, BLENDMODE_ONE);
            expectSameState(bs.getAttachment(2, scratch), bs);
        });

        it('an attachment which was set is independent of later changes of attachment 0', function () {
            const bs = createBase();
            const additive = new BlendState(true, BLENDEQUATION_ADD, BLENDMODE_ONE, BLENDMODE_ONE);
            bs.setAttachment(1, additive);

            bs.setColorBlend(BLENDEQUATION_MIN, BLENDMODE_ZERO, BLENDMODE_ONE);
            expectSameState(bs.getAttachment(1, scratch), additive);
        });

        it('the state returned by getAttachment does not report overrides of its own', function () {
            const bs = createBase();
            bs.setAttachment(1, new BlendState(true, BLENDEQUATION_ADD, BLENDMODE_ONE, BLENDMODE_ONE));

            expect(bs.getAttachment(0, scratch).hasAttachmentOverrides).to.equal(false);
            expect(bs.getAttachment(1, scratch).hasAttachmentOverrides).to.equal(false);
        });

        it('throws when used on one of the frozen presets', function () {
            expect(() => BlendState.NOBLEND.setAttachment(1, createBase())).to.throw();
        });

    });

    describe('#clearAttachment', function () {

        it('makes the attachment follow attachment 0 again', function () {
            const bs = createBase();
            bs.setAttachment(1, new BlendState(true, BLENDEQUATION_ADD, BLENDMODE_ONE, BLENDMODE_ONE));
            bs.clearAttachment(1);

            expectSameState(bs.getAttachment(1, scratch), bs);
        });

        it('clears the overrides flag once the last override is removed', function () {
            const bs = createBase();
            const additive = new BlendState(true, BLENDEQUATION_ADD, BLENDMODE_ONE, BLENDMODE_ONE);
            bs.setAttachment(1, additive);
            bs.setAttachment(2, additive);

            bs.clearAttachment(1);
            expect(bs.hasAttachmentOverrides).to.equal(true);

            bs.clearAttachment(2);
            expect(bs.hasAttachmentOverrides).to.equal(false);
        });

        it('restores the key of the equivalent state without overrides', function () {
            const bs = createBase();
            bs.setAttachment(1, new BlendState(true, BLENDEQUATION_ADD, BLENDMODE_ONE, BLENDMODE_ONE));
            bs.clearAttachment(1);

            expect(bs.key).to.equal(createBase().key);
        });

    });

    describe('#key', function () {

        it('matches for two identically configured states without overrides', function () {
            expect(createBase().key).to.equal(createBase().key);
        });

        it('matches for two identically configured states with overrides', function () {
            const additive = new BlendState(true, BLENDEQUATION_ADD, BLENDMODE_ONE, BLENDMODE_ONE);

            const a = createBase();
            a.setAttachment(1, additive);
            const b = createBase();
            b.setAttachment(1, additive);

            expect(a.key).to.equal(b.key);
        });

        it('differs between states with and without overrides', function () {
            const bs = createBase();
            bs.setAttachment(1, new BlendState(true, BLENDEQUATION_ADD, BLENDMODE_ONE, BLENDMODE_ONE));

            expect(bs.key).to.not.equal(createBase().key);
        });

        it('differs when the overridden attachment differs', function () {
            const a = createBase();
            a.setAttachment(1, new BlendState(true, BLENDEQUATION_ADD, BLENDMODE_ONE, BLENDMODE_ONE));
            const b = createBase();
            b.setAttachment(1, new BlendState(true, BLENDEQUATION_MAX, BLENDMODE_ONE, BLENDMODE_ONE));

            expect(a.key).to.not.equal(b.key);
        });

        it('differs when the overridden attachment index differs', function () {
            const additive = new BlendState(true, BLENDEQUATION_ADD, BLENDMODE_ONE, BLENDMODE_ONE);

            const a = createBase();
            a.setAttachment(1, additive);
            const b = createBase();
            b.setAttachment(2, additive);

            expect(a.key).to.not.equal(b.key);
        });

        it('reflects a change of attachment 0 made after an override was set', function () {
            const bs = createBase();
            bs.setAttachment(1, new BlendState(true, BLENDEQUATION_ADD, BLENDMODE_ONE, BLENDMODE_ONE));
            const before = bs.key;

            bs.setColorBlend(BLENDEQUATION_MIN, BLENDMODE_ZERO, BLENDMODE_ONE);
            expect(bs.key).to.not.equal(before);
        });

        it('is stable across repeated access on a frozen state', function () {
            const key = BlendState.NOBLEND.key;
            expect(BlendState.NOBLEND.key).to.equal(key);
            expect(BlendState.ALPHABLEND.key).to.equal(BlendState.ALPHABLEND.key);
        });

    });

    describe('#equals', function () {

        it('compares states without overrides', function () {
            expect(createBase().equals(createBase())).to.equal(true);
            expect(createBase().equals(new BlendState())).to.equal(false);
        });

        it('compares states with matching overrides', function () {
            const additive = new BlendState(true, BLENDEQUATION_ADD, BLENDMODE_ONE, BLENDMODE_ONE);

            const a = createBase();
            a.setAttachment(1, additive);
            const b = createBase();
            b.setAttachment(1, additive);

            expect(a.equals(b)).to.equal(true);
        });

        it('separates a state with overrides from one without', function () {
            const a = createBase();
            a.setAttachment(1, new BlendState(true, BLENDEQUATION_ADD, BLENDMODE_ONE, BLENDMODE_ONE));

            expect(a.equals(createBase())).to.equal(false);
            expect(createBase().equals(a)).to.equal(false);
        });

    });

    describe('#copy', function () {

        it('copies the overrides', function () {
            const additive = new BlendState(true, BLENDEQUATION_ADD, BLENDMODE_ONE, BLENDMODE_ONE);
            const src = createBase();
            src.setAttachment(1, additive);

            const dst = new BlendState();
            dst.copy(src);

            expect(dst.hasAttachmentOverrides).to.equal(true);
            expectSameState(dst.getAttachment(1, scratch), additive);
            expect(dst.equals(src)).to.equal(true);
        });

        it('clears the overrides when the source has none', function () {
            const dst = createBase();
            dst.setAttachment(1, new BlendState(true, BLENDEQUATION_ADD, BLENDMODE_ONE, BLENDMODE_ONE));

            dst.copy(new BlendState());

            expect(dst.hasAttachmentOverrides).to.equal(false);
            expectSameState(dst.getAttachment(1, scratch), new BlendState());
            expect(dst.equals(new BlendState())).to.equal(true);
        });

        it('overwrites existing overrides', function () {
            const dst = createBase();
            dst.setAttachment(1, new BlendState(true, BLENDEQUATION_ADD, BLENDMODE_ONE, BLENDMODE_ONE));
            dst.setAttachment(2, new BlendState(true, BLENDEQUATION_ADD, BLENDMODE_ONE, BLENDMODE_ONE));

            const src = createBase();
            const min = new BlendState(true, BLENDEQUATION_MIN, BLENDMODE_ONE, BLENDMODE_ONE);
            src.setAttachment(1, min);
            dst.copy(src);

            expectSameState(dst.getAttachment(1, scratch), min);
            expectSameState(dst.getAttachment(2, scratch), src);
            expect(dst.equals(src)).to.equal(true);
        });

    });

    describe('#clone', function () {

        it('preserves the overrides', function () {
            const additive = new BlendState(true, BLENDEQUATION_ADD, BLENDMODE_ONE, BLENDMODE_ONE);
            const src = createBase();
            src.setAttachment(1, additive);

            const clone = src.clone();
            expect(clone.equals(src)).to.equal(true);
            expectSameState(clone.getAttachment(1, scratch), additive);
        });

        it('is independent of the source', function () {
            const src = createBase();
            src.setAttachment(1, new BlendState(true, BLENDEQUATION_ADD, BLENDMODE_ONE, BLENDMODE_ONE));

            const clone = src.clone();
            clone.setAttachment(1, new BlendState(true, BLENDEQUATION_MIN, BLENDMODE_ONE, BLENDMODE_ONE));

            expect(src.getAttachment(1, scratch).colorOp).to.equal(BLENDEQUATION_ADD);
        });

    });

    describe('#usesDualSourceBlending', function () {

        it('detects a dual-source factor used by an overridden attachment', function () {
            const bs = createBase();
            expect(bs.usesDualSourceBlending).to.equal(false);

            bs.setAttachment(1, new BlendState(true, BLENDEQUATION_ADD, BLENDMODE_ONE, BLENDMODE_SRC1_COLOR));
            expect(bs.usesDualSourceBlending).to.equal(true);
        });

        it('stops detecting it once the attachment is cleared', function () {
            const bs = createBase();
            bs.setAttachment(1, new BlendState(true, BLENDEQUATION_ADD, BLENDMODE_ONE, BLENDMODE_SRC1_COLOR));
            bs.clearAttachment(1);

            expect(bs.usesDualSourceBlending).to.equal(false);
        });

    });

});
