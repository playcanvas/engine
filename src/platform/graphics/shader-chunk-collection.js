/**
 * A named set of shader chunks in one shading language. Collections are plain object literals, so
 * that a module declaring one has no side effects and is dropped by tree-shaking when unused.
 *
 * @typedef {object} ShaderChunkCollection
 * @property {string} name - The name of the collection, used in error messages.
 * @property {string} language - The shading language of the chunks, `SHADERLANGUAGE_GLSL` or
 * `SHADERLANGUAGE_WGSL`.
 * @property {Record<string, string>} chunks - The chunks, keyed by name.
 * @ignore
 */

// the module only declares a type, and is never imported at runtime
export {};
