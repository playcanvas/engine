import { expect } from 'chai';

import { getSingleAttachmentBlendState } from '../../../src/platform/graphics/blend-state-utils.js';
import { BlendState } from '../../../src/platform/graphics/blend-state.js';
import { BLENDEQUATION_ADD, BLENDMODE_ONE, BLENDMODE_ONE_MINUS_SRC_ALPHA } from '../../../src/platform/graphics/constants.js';

describe('getSingleAttachmentBlendState', function () {

    const premultiplied = () => new BlendState(true, BLENDEQUATION_ADD, BLENDMODE_ONE, BLENDMODE_ONE_MINUS_SRC_ALPHA);

    it('leaves the first attachment untouched', function () {
        const src = premultiplied();
        const masked = getSingleAttachmentBlendState(src, 2);

        const target = new BlendState();
        masked.getAttachment(0, target);
        expect(target.blend).to.equal(src.blend);
        expect(target.colorSrcFactor).to.equal(src.colorSrcFactor);
        expect(target.colorDstFactor).to.equal(src.colorDstFactor);
        expect(target.allWrite).to.equal(src.allWrite);
    });

    it('disables the writes of every other attachment', function () {
        const masked = getSingleAttachmentBlendState(premultiplied(), 4);

        const target = new BlendState();
        for (let i = 1; i < 4; i++) {
            masked.getAttachment(i, target);
            expect(target.redWrite, `attachment ${i}`).to.be.false;
            expect(target.greenWrite, `attachment ${i}`).to.be.false;
            expect(target.blueWrite, `attachment ${i}`).to.be.false;
            expect(target.alphaWrite, `attachment ${i}`).to.be.false;
        }
    });

    it('does not modify the supplied state', function () {
        const src = premultiplied();
        const key = src.key;
        getSingleAttachmentBlendState(src, 2);
        expect(src.key).to.equal(key);
        expect(src.hasAttachmentOverrides).to.be.false;
    });

    it('returns the same instance for the same state and attachment count', function () {
        const first = getSingleAttachmentBlendState(premultiplied(), 2);
        const second = getSingleAttachmentBlendState(premultiplied(), 2);
        expect(first).to.equal(second);
    });

    it('caches per attachment count', function () {
        const two = getSingleAttachmentBlendState(premultiplied(), 2);
        const three = getSingleAttachmentBlendState(premultiplied(), 3);
        expect(three).to.not.equal(two);

        const target = new BlendState();
        two.getAttachment(2, target);
        expect(target.redWrite).to.be.true;      // outside the two attachments, so left inheriting
        three.getAttachment(2, target);
        expect(target.redWrite).to.be.false;
    });

    it('passes through a state which already carries per attachment overrides', function () {
        const src = premultiplied();
        const other = new BlendState();
        src.setAttachment(1, other);
        expect(getSingleAttachmentBlendState(src, 2)).to.equal(src);
    });
});
