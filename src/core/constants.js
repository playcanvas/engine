/**
 * Logs a frame number.
 *
 * @type {string}
 */
export const TRACEID_RENDER_FRAME = 'RenderFrame';

/**
 * Logs basic information about generated render passes.
 *
 * @type {string}
 */
export const TRACEID_RENDER_PASS = 'RenderPass';

/**
 * Logs additional detail for render passes.
 *
 * @type {string}
 */
export const TRACEID_RENDER_PASS_DETAIL = 'RenderPassDetail';

/**
 * Logs render actions created by the layer composition. Only executes when the
 * layer composition changes.
 *
 * @type {string}
 */
export const TRACEID_RENDER_ACTION = 'RenderAction';

/**
 * Logs the allocation of render targets.
 *
 * @type {string}
 */
export const TRACEID_RENDER_TARGET_ALLOC = 'RenderTargetAlloc';

/**
 * Logs the allocation of textures.
 *
 * @type {string}
 */
export const TRACEID_TEXTURE_ALLOC = 'TextureAlloc';

/**
 * Logs the creation of shaders.
 *
 * @type {string}
 */
export const TRACEID_SHADER_ALLOC = 'ShaderAlloc';

/**
 * Logs the compilation time of shaders.
 *
 * @type {string}
 */
export const TRACEID_SHADER_COMPILE = 'ShaderCompile';

/**
 * Logs the vram use by the textures.
 *
 * @type {string}
 */
export const TRACEID_VRAM_TEXTURE = 'VRAM.Texture';

/**
 * Logs the vram use by the vertex buffers.
 *
 * @type {string}
 */
export const TRACEID_VRAM_VB = 'VRAM.Vb';

/**
 * Logs the vram use by the index buffers.
 *
 * @type {string}
 */
export const TRACEID_VRAM_IB = 'VRAM.Ib';
