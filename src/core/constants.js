/**
 * Logs a frame number.
 *
 * @type {string}
 * @category Debug
 */
export const TRACEID_RENDER_FRAME = 'RenderFrame';

/**
 * Logs a frame time.
 *
 * @type {string}
 * @category Debug
 */
export const TRACEID_RENDER_FRAME_TIME = 'RenderFrameTime';

/**
 * Logs basic information about generated render passes.
 *
 * @type {string}
 * @category Debug
 */
export const TRACEID_RENDER_PASS = 'RenderPass';

/**
 * Logs additional detail for render passes.
 *
 * @type {string}
 * @category Debug
 */
export const TRACEID_RENDER_PASS_DETAIL = 'RenderPassDetail';

/**
 * Logs render actions created by the layer composition. Only executes when the
 * layer composition changes.
 *
 * @type {string}
 * @category Debug
 */
export const TRACEID_RENDER_ACTION = 'RenderAction';

/**
 * Logs the allocation of render targets.
 *
 * @type {string}
 * @category Debug
 */
export const TRACEID_RENDER_TARGET_ALLOC = 'RenderTargetAlloc';

/**
 * Logs the allocation of textures.
 *
 * @type {string}
 * @category Debug
 */
export const TRACEID_TEXTURE_ALLOC = 'TextureAlloc';

/**
 * Logs the creation of shaders.
 *
 * @type {string}
 * @category Debug
 */
export const TRACEID_SHADER_ALLOC = 'ShaderAlloc';

/**
 * Logs the compilation time of shaders.
 *
 * @type {string}
 * @category Debug
 */
export const TRACEID_SHADER_COMPILE = 'ShaderCompile';

/**
 * Logs the vram use by the textures.
 *
 * @type {string}
 * @category Debug
 */
export const TRACEID_VRAM_TEXTURE = 'VRAM.Texture';

/**
 * Logs the vram use by the vertex buffers.
 *
 * @type {string}
 * @category Debug
 */
export const TRACEID_VRAM_VB = 'VRAM.Vb';

/**
 * Logs the vram use by the index buffers.
 *
 * @type {string}
 * @category Debug
 */
export const TRACEID_VRAM_IB = 'VRAM.Ib';

/**
 * Logs the vram use by the storage buffers.
 *
 * @type {string}
 * @category Debug
 */
export const TRACEID_VRAM_SB = 'VRAM.Sb';

/**
 * Logs the creation of bind groups.
 *
 * @type {string}
 * @category Debug
 */
export const TRACEID_BINDGROUP_ALLOC = 'BindGroupAlloc';

/**
 * Logs the creation of bind group formats.
 *
 * @type {string}
 * @category Debug
 */
export const TRACEID_BINDGROUPFORMAT_ALLOC = 'BindGroupFormatAlloc';

/**
 * Logs the creation of render pipelines. WebBPU only.
 *
 * @type {string}
 * @category Debug
 */
export const TRACEID_RENDERPIPELINE_ALLOC = 'RenderPipelineAlloc';

/**
 * Logs the creation of compute pipelines. WebGPU only.
 *
 * @type {string}
 * @category Debug
 */
export const TRACEID_COMPUTEPIPELINE_ALLOC = 'ComputePipelineAlloc';

/**
 * Logs the creation of pipeline layouts. WebBPU only.
 *
 * @type {string}
 * @category Debug
 */
export const TRACEID_PIPELINELAYOUT_ALLOC = 'PipelineLayoutAlloc';

/**
 * Logs the internal debug information for Elements.
 *
 * @type {string}
 * @category Debug
 */
export const TRACE_ID_ELEMENT = "Element";

/**
 * Logs the vram use by all textures in memory.
 *
 * @type {string}
 * @category Debug
 */
export const TRACEID_TEXTURES = 'Textures';

/**
 * Logs the render queue commands.
 *
 * @type {string}
 * @category Debug
 */
export const TRACEID_RENDER_QUEUE = 'RenderQueue';

/**
 * Logs the GPU timings.
 *
 * @type {string}
 * @category Debug
 */
export const TRACEID_GPU_TIMINGS = 'GpuTimings';
