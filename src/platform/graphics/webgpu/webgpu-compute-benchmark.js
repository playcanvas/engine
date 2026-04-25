/**
 * Standalone GPU compute benchmark using raw WebGPU API. Measures compute throughput
 * (shared memory + barriers + atomics) to determine whether the GPU is efficient enough
 * for the compute-based GSplat renderer vs the vertex/fragment path.
 *
 * Runs during device creation before engine infrastructure is initialized.
 *
 * @ignore
 */
class WebgpuComputeBenchmark {
    /**
     * Run a short compute benchmark and return the elapsed time in milliseconds.
     *
     * @param {GPUDevice} device - The raw WebGPU device.
     * @param {boolean} supportsTimestamp - Whether the device supports timestamp queries.
     * @returns {Promise<number>} Elapsed milliseconds, or -1 if timestamp queries unavailable.
     */
    static async run(device, supportsTimestamp) {
        if (!supportsTimestamp) {
            return -1;
        }

        const NUM_WORKGROUPS = 512;
        const WORKGROUP_SIZE = 64;
        const ITERATIONS = 4;

        const shaderModule = device.createShaderModule({
            label: 'ComputeBenchmark',
            code: `
@group(0) @binding(0) var<storage, read_write> output: array<atomic<u32>>;
var<workgroup> sdata: array<u32, ${WORKGROUP_SIZE}>;

@compute @workgroup_size(${WORKGROUP_SIZE})
fn main(@builtin(local_invocation_index) lid: u32,
        @builtin(workgroup_id) wid: vec3u) {
    var sum = 0u;
    for (var iter = 0u; iter < ${ITERATIONS}u; iter++) {
        sdata[lid] = lid + wid.x + iter;
        workgroupBarrier();
        for (var i = 0u; i < ${WORKGROUP_SIZE}u; i++) {
            sum += sdata[i];
        }
        workgroupBarrier();
    }
    atomicAdd(&output[wid.x % ${NUM_WORKGROUPS}u], sum);
}
`
        });

        const pipeline = device.createComputePipeline({
            label: 'ComputeBenchmarkPipeline',
            layout: 'auto',
            compute: { module: shaderModule, entryPoint: 'main' }
        });

        const storageBuffer = device.createBuffer({
            label: 'ComputeBenchmarkStorage',
            size: NUM_WORKGROUPS * 4,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
        });

        const querySet = device.createQuerySet({
            label: 'ComputeBenchmarkQueries',
            type: 'timestamp',
            count: 2
        });

        const resolveBuffer = device.createBuffer({
            label: 'ComputeBenchmarkResolve',
            size: 16,
            usage: GPUBufferUsage.QUERY_RESOLVE | GPUBufferUsage.COPY_SRC
        });

        const readbackBuffer = device.createBuffer({
            label: 'ComputeBenchmarkReadback',
            size: 16,
            usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
        });

        const bindGroup = device.createBindGroup({
            layout: pipeline.getBindGroupLayout(0),
            entries: [{ binding: 0, resource: { buffer: storageBuffer } }]
        });

        const encoder = device.createCommandEncoder({ label: 'ComputeBenchmarkEncoder' });
        const pass = encoder.beginComputePass({
            label: 'ComputeBenchmarkPass',
            timestampWrites: {
                querySet,
                beginningOfPassWriteIndex: 0,
                endOfPassWriteIndex: 1
            }
        });
        pass.setPipeline(pipeline);
        pass.setBindGroup(0, bindGroup);
        pass.dispatchWorkgroups(NUM_WORKGROUPS);
        pass.end();

        encoder.resolveQuerySet(querySet, 0, 2, resolveBuffer, 0);
        encoder.copyBufferToBuffer(resolveBuffer, 0, readbackBuffer, 0, 16);
        device.queue.submit([encoder.finish()]);

        let elapsedMs = -1;
        try {
            await readbackBuffer.mapAsync(GPUMapMode.READ);
            const times = new BigInt64Array(readbackBuffer.getMappedRange());
            const elapsedNs = Number(times[1] - times[0]);
            elapsedMs = elapsedNs / 1_000_000;
            readbackBuffer.unmap();
        } catch (_) {
            // Timestamp readback failed — fall back to heuristic
        }

        storageBuffer.destroy();
        resolveBuffer.destroy();
        readbackBuffer.destroy();
        querySet.destroy();

        return elapsedMs;
    }
}

export { WebgpuComputeBenchmark };
