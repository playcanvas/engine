/**
 * A WebGPU implementation of the Compute.
 *
 * @ignore
 */
class WebgpuCompute {
    constructor(compute) {
        this.compute = compute;

        const { device, shader } = compute;
        this.pipeline = device.computePipeline.get(shader);
    }

    dispatch(x, y, z) {

        // TODO: currently each dispatch is a separate compute pass, which is not optimal, and we should
        // batch multiple dispatches into a single compute pass
        const device = this.compute.device;
        device.startComputePass();

        // dispatch
        const passEncoder = device.passEncoder;
        passEncoder.setPipeline(this.pipeline);
        passEncoder.dispatchWorkgroups(x, y, z);

        device.endComputePass();
    }
}

export { WebgpuCompute };
