import { BlendState } from './blend-state.js';

// scratch state used to build the write mask
const _noWrite = new BlendState();

// derived blend states, in an array indexed by the color attachment count, each holding a map from
// the key of the blend state they were derived from to the derived state. Rendering uses a handful of
// blend states, so these stay tiny.
const _caches = [];

/**
 * Returns a blend state matching the supplied one, but with the color writes to all attachments other
 * than the first disabled. Used when rendering to a render target with more color attachments than
 * the fragment shader writes - both WebGL2 and WebGPU require an attachment the shader does not write
 * to have its writes disabled, otherwise the draw is invalid.
 *
 * Note that masking the writes off requires {@link GraphicsDevice#supportsIndependentBlending}, as
 * without it the state of the attachment 0 applies to all attachments and the mask has no effect.
 *
 * Note also that a dual-source blend state cannot be used with multiple color attachments at all,
 * and masking does not change that - dual-source blending requires exactly one attachment, so a
 * material using it is incompatible with a render target carrying additional attachments.
 *
 * @param {BlendState} blendState - The blend state of the render, describing attachment 0.
 * @param {number} attachmentCount - The number of color attachments of the render target.
 * @returns {BlendState} The blend state to use.
 * @ignore
 */
function getSingleAttachmentBlendState(blendState, attachmentCount) {

    // a state specifying its own per attachment values is left alone, as it takes precedence
    if (blendState.hasAttachmentOverrides) {
        return blendState;
    }

    const cache = _caches[attachmentCount] ?? (_caches[attachmentCount] = new Map());
    const key = blendState.key;
    let masked = cache.get(key);
    if (!masked) {
        _noWrite.copy(blendState);
        _noWrite.setColorWrite(false, false, false, false);

        masked = blendState.clone();
        for (let i = 1; i < attachmentCount; i++) {
            masked.setAttachment(i, _noWrite);
        }
        cache.set(key, masked);
    }

    return masked;
}

export { getSingleAttachmentBlendState };
