/**
 * Logs a frame number.
 *
 * @category Debug
 */
export const TRACEID_RENDER_FRAME = 'RenderFrame';

/**
 * Logs a frame time.
 *
 * @category Debug
 */
export const TRACEID_RENDER_FRAME_TIME = 'RenderFrameTime';

/**
 * Logs basic information about generated render passes.
 *
 * @category Debug
 */
export const TRACEID_RENDER_PASS = 'RenderPass';

/**
 * Logs additional detail for render passes.
 *
 * @category Debug
 */
export const TRACEID_RENDER_PASS_DETAIL = 'RenderPassDetail';

/**
 * Logs render actions created by the layer composition. Only executes when the
 * layer composition changes.
 *
 * @category Debug
 */
export const TRACEID_RENDER_ACTION = 'RenderAction';

/**
 * Logs the allocation of render targets.
 *
 * @category Debug
 */
export const TRACEID_RENDER_TARGET_ALLOC = 'RenderTargetAlloc';

/**
 * Logs the allocation of textures.
 *
 * @category Debug
 */
export const TRACEID_TEXTURE_ALLOC = 'TextureAlloc';

/**
 * Logs the creation of shaders.
 *
 * @category Debug
 */
export const TRACEID_SHADER_ALLOC = 'ShaderAlloc';

/**
 * Logs the compilation time of shaders.
 *
 * @category Debug
 */
export const TRACEID_SHADER_COMPILE = 'ShaderCompile';

/**
 * Logs the vram use by the textures.
 *
 * @category Debug
 */
export const TRACEID_VRAM_TEXTURE = 'VRAM.Texture';

/**
 * Logs the vram use by the vertex buffers.
 *
 * @category Debug
 */
export const TRACEID_VRAM_VB = 'VRAM.Vb';

/**
 * Logs the vram use by the index buffers.
 *
 * @category Debug
 */
export const TRACEID_VRAM_IB = 'VRAM.Ib';

/**
 * Logs the vram use by the storage buffers.
 *
 * @category Debug
 */
export const TRACEID_VRAM_SB = 'VRAM.Sb';

/**
 * Logs the creation of bind groups.
 *
 * @category Debug
 */
export const TRACEID_BINDGROUP_ALLOC = 'BindGroupAlloc';

/**
 * Logs the creation of bind group formats.
 *
 * @category Debug
 */
export const TRACEID_BINDGROUPFORMAT_ALLOC = 'BindGroupFormatAlloc';

/**
 * Logs the creation of render pipelines. WebBPU only.
 *
 * @category Debug
 */
export const TRACEID_RENDERPIPELINE_ALLOC = 'RenderPipelineAlloc';

/**
 * Logs the creation of compute pipelines. WebGPU only.
 *
 * @category Debug
 */
export const TRACEID_COMPUTEPIPELINE_ALLOC = 'ComputePipelineAlloc';

/**
 * Logs the creation of pipeline layouts. WebBPU only.
 *
 * @category Debug
 */
export const TRACEID_PIPELINELAYOUT_ALLOC = 'PipelineLayoutAlloc';

/**
 * Logs the internal debug information for Elements.
 *
 * @category Debug
 */
export const TRACEID_ELEMENT = 'Element';

/**
 * Logs the vram use by all textures in memory.
 *
 * @category Debug
 */
export const TRACEID_TEXTURES = 'Textures';

/**
 * Logs the render queue commands.
 *
 * @category Debug
 */
export const TRACEID_RENDER_QUEUE = 'RenderQueue';

/**
 * Logs the GPU timings.
 *
 * @category Debug
 */
export const TRACEID_GPU_TIMINGS = 'GpuTimings';
