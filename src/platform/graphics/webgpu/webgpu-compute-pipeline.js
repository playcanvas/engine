import { array } from '../../../core/array-utils.js';
import { Debug, DebugHelper } from '../../../core/debug.js';
import { TRACEID_COMPUTEPIPELINE_ALLOC } from '../../../core/constants.js';
import { hash32Fnv1a } from '../../../core/hash.js';
import { WebgpuDebug } from './webgpu-debug.js';
import { WebgpuPipeline } from './webgpu-pipeline.js';

/**
 * @import { WebgpuShader } from './webgpu-shader.js'
 */

let _pipelineId = 0;

class CacheEntry {
    /**
     * Compute pipeline
     *
     * @type {GPUComputePipeline|null}
     * @private
     */
    pipeline = null;

    /**
     * The full array of hashes used to lookup the pipeline, used in case of hash collision.
     *
     * @type {Uint32Array|null}
     */
    hashes = null;
}

class WebgpuComputePipeline extends WebgpuPipeline {
    lookupHashes = new Uint32Array(2);

    /**
     * The cache of compute pipelines
     *
     * @type {Map<number, CacheEntry[]>}
     */
    cache = new Map();

    get(shader, bindGroupFormat) {

        // unique hash for the pipeline
        const lookupHashes = this.lookupHashes;
        lookupHashes[0] = shader.impl.computeKey;
        lookupHashes[1] = bindGroupFormat.impl.key;
        const hash = hash32Fnv1a(lookupHashes);

        // Check cache
        let cacheEntries = this.cache.get(hash);
        if (cacheEntries) {
            // Handle hash collisions by checking actual values
            for (let i = 0; i < cacheEntries.length; i++) {
                const entry = cacheEntries[i];
                if (array.equals(entry.hashes, lookupHashes)) {
                    return entry.pipeline;
                }
            }
        }

        // Cache miss - create new pipeline
        const pipelineLayout = this.getPipelineLayout([bindGroupFormat.impl]);
        const cacheEntry = new CacheEntry();
        cacheEntry.hashes = new Uint32Array(lookupHashes);
        cacheEntry.pipeline = this.create(shader, pipelineLayout);

        // Add to cache
        if (cacheEntries) {
            cacheEntries.push(cacheEntry);
        } else {
            cacheEntries = [cacheEntry];
        }
        this.cache.set(hash, cacheEntries);

        return cacheEntry.pipeline;
    }

    create(shader, pipelineLayout) {

        const wgpu = this.device.wgpu;

        /** @type {WebgpuShader} */
        const webgpuShader = shader.impl;

        /** @type {GPUComputePipelineDescriptor} */
        const desc = {
            compute: {
                module: webgpuShader.getComputeShaderModule(),
                entryPoint: webgpuShader.computeEntryPoint
            },

            // uniform / texture binding layout
            layout: pipelineLayout
        };

        WebgpuDebug.validate(this.device);

        _pipelineId++;
        DebugHelper.setLabel(desc, `ComputePipelineDescr-${_pipelineId}`);

        const pipeline = wgpu.createComputePipeline(desc);

        DebugHelper.setLabel(pipeline, `ComputePipeline-${_pipelineId}`);
        Debug.trace(TRACEID_COMPUTEPIPELINE_ALLOC, `Alloc: Id ${_pipelineId}`, desc);

        WebgpuDebug.end(this.device, 'ComputePipeline creation', {
            computePipeline: this,
            desc: desc,
            shader
        });

        return pipeline;
    }
}

export { WebgpuComputePipeline };
