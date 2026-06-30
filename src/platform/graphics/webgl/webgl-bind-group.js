/**
 * A WebGL implementation of the BindGroup.
 *
 * On WebGL2 there is no GPU-side bind group object - uniform buffers are bound to their binding
 * points at draw time in {@link WebglGraphicsDevice#setBindGroup}, which reads the resolved GL
 * buffers directly from the {@link BindGroup}. This impl therefore holds no state.
 *
 * @ignore
 */
class WebglBindGroup {
    update(bindGroup) {
    }

    destroy() {
    }
}

export { WebglBindGroup };
