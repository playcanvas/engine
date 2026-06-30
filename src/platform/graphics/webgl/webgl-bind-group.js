/**
 * A WebGL implementation of the BindGroup.
 *
 * On WebGL2 there is no GPU-side bind group object. Instead, at update time this captures - per
 * uniform buffer slot - the object that owns the GL buffer (the persistent buffer impl, or the
 * dynamic buffer the uniform buffer is currently allocated from). {@link WebglGraphicsDevice#setBindGroup}
 * then binds those captured buffers. Capturing here (rather than reading the uniform buffer's live
 * allocation at draw time) is essential when a single uniform buffer is re-allocated several times
 * in a frame - e.g. the shared view UB across XR multiview eyes: each eye's bind group must bind
 * the buffer it was built for, not the buffer the shared uniform buffer ends up pointing at.
 *
 * @ignore
 */
class WebglBindGroup {
    /**
     * Per uniform-buffer slot, the object exposing the GL buffer via its `bufferId` (a
     * WebglUniformBuffer for persistent buffers, or a WebglDynamicBuffer for dynamic ones). The GL
     * buffer is read lazily at bind time, as a dynamic buffer's `bufferId` is created on its first
     * upload, after this bind group is built.
     *
     * @type {Array<{ bufferId: WebGLBuffer|null }>}
     */
    buffers = [];

    update(bindGroup) {
        const uniformBuffers = bindGroup.uniformBuffers;
        this.buffers.length = uniformBuffers.length;
        for (let i = 0; i < uniformBuffers.length; i++) {
            const uniformBuffer = uniformBuffers[i];
            this.buffers[i] = uniformBuffer.persistent ? uniformBuffer.impl : uniformBuffer.allocation.gpuBuffer;
        }
    }

    destroy() {
        this.buffers.length = 0;
    }
}

export { WebglBindGroup };
