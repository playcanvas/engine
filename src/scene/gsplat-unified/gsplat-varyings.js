import { Debug } from '../../core/debug.js';
import {
    SHADERLANGUAGE_GLSL, SHADERLANGUAGE_WGSL,
    TYPE_FLOAT32, TYPE_INT32, TYPE_UINT32
} from '../../platform/graphics/constants.js';
import { CACHE_STRIDE } from './gsplat-projector-constants.js';

// Shader chunk templates for varying declarations and projection cache access
import glslVaryingDeclVS from '../shader-lib/glsl/chunks/gsplat/varyings/gsplatVaryingDeclVS.js';
import glslVaryingDeclPS from '../shader-lib/glsl/chunks/gsplat/varyings/gsplatVaryingDeclPS.js';
import wgslVaryingDeclVS from '../shader-lib/wgsl/chunks/gsplat/varyings/gsplatVaryingDeclVS.js';
import wgslVaryingFlushVS from '../shader-lib/wgsl/chunks/gsplat/varyings/gsplatVaryingFlushVS.js';
import wgslVaryingDeclCS from '../shader-lib/wgsl/chunks/gsplat/varyings/gsplatVaryingDeclCS.js';
import wgslVaryingDeclPS from '../shader-lib/wgsl/chunks/gsplat/varyings/gsplatVaryingDeclPS.js';
import wgslVaryingCacheWriteCS from '../shader-lib/wgsl/chunks/gsplat/varyings/gsplatVaryingCacheWriteCS.js';
import wgslVaryingCacheReadVS from '../shader-lib/wgsl/chunks/gsplat/varyings/gsplatVaryingCacheReadVS.js';

/**
 * @import { GraphicsDevice } from '../../platform/graphics/graphics-device.js'
 * @import { ShaderMaterial } from '../materials/shader-material.js'
 */

/**
 * @typedef {object} GSplatVaryingDescriptor
 * @property {string} name - The varying name. Must be a valid shader identifier.
 * @property {number} type - The component data type: {@link TYPE_FLOAT32}, {@link TYPE_INT32} or
 * {@link TYPE_UINT32}.
 * @property {number} components - The number of components, 1 to 4.
 */

// type tables indexed by [type][components - 1]
const GLSL_TYPES = {
    [TYPE_FLOAT32]: ['float', 'vec2', 'vec3', 'vec4'],
    [TYPE_INT32]: ['int', 'ivec2', 'ivec3', 'ivec4'],
    [TYPE_UINT32]: ['uint', 'uvec2', 'uvec3', 'uvec4']
};

const WGSL_TYPES = {
    [TYPE_FLOAT32]: ['f32', 'vec2f', 'vec3f', 'vec4f'],
    [TYPE_INT32]: ['i32', 'vec2i', 'vec3i', 'vec4i'],
    [TYPE_UINT32]: ['u32', 'vec2u', 'vec3u', 'vec4u']
};

const COMPONENT_SWIZZLE = ['x', 'y', 'z', 'w'];

const IDENTIFIER_REGEX = /^[a-z_]\w*$/i;

// Pre-compiled regex patterns for template replacement
const RE_NAME = /\{name\}/g;
const RE_TYPE = /\{type\}/g;
const RE_FUNC_NAME = /\{funcName\}/g;
const RE_WORD = /\{word\}/g;
const RE_VALUE = /\{value\}/g;

// chunk-map keys managed by this class
const GLSL_CHUNK_NAMES = ['gsplatUserVaryingsVS', 'gsplatUserVaryingsPS'];
const WGSL_CHUNK_NAMES = [
    'gsplatUserVaryingsVS', 'gsplatUserVaryingsFlushVS', 'gsplatUserVaryingsCS',
    'gsplatUserVaryingsPS', 'gsplatUserCacheWriteCS', 'gsplatUserCacheReadVS'
];

/**
 * @param {string} name - The stream name.
 * @returns {string} The name with the first letter upper-cased.
 */
const pascal = name => name.charAt(0).toUpperCase() + name.slice(1);

// per-component encode to a u32 cache word
const encodeWord = (type, expr) => {
    return type === TYPE_UINT32 ? expr : `bitcast<u32>(${expr})`;
};

// per-component decode from a u32 cache word
const decodeWord = (type, expr) => {
    if (type === TYPE_UINT32) return expr;
    return type === TYPE_INT32 ? `bitcast<i32>(${expr})` : `bitcast<f32>(${expr})`;
};

/**
 * Manages custom varying streams for the gsplat render customization. Streams added here generate
 * set functions available to the `gsplatModifyVS` shader chunk, where they run once per splat,
 * and matching get functions available to the `gsplatModifyPS` shader chunk, where the per-splat
 * value can be read for each rendered fragment.
 *
 * Access the instance via {@link GSplatParams#varyings}.
 *
 * @category Graphics
 */
class GSplatVaryings {
    /**
     * @type {GraphicsDevice}
     * @private
     */
    _device;

    /**
     * @type {GSplatVaryingDescriptor[]}
     * @private
     */
    _streams = [];

    /**
     * @type {number}
     * @private
     */
    _words = 0;

    /**
     * @type {number}
     * @private
     */
    _version = 0;

    /**
     * Creates a new GSplatVaryings instance.
     *
     * @param {GraphicsDevice} device - The graphics device.
     * @ignore
     */
    constructor(device) {
        this._device = device;
    }

    /**
     * Gets the varying stream descriptors. Do not modify the returned array.
     *
     * @type {GSplatVaryingDescriptor[]}
     */
    get streams() {
        return this._streams;
    }

    /**
     * The number of u32 words the varying streams add to the per-splat projection cache of the
     * {@link GSPLAT_RENDERER_RASTER_GPU_SORT} renderer.
     *
     * @type {number}
     * @ignore
     */
    get words() {
        return this._words;
    }

    /**
     * The version of the varying streams, incremented on every change.
     *
     * @type {number}
     * @ignore
     */
    get version() {
        return this._version;
    }

    /**
     * Adds varying streams. For each stream, a set function (`set<Name>`) is generated and made
     * available to the `gsplatModifyVS` shader chunk, where it runs once per splat, and a
     * matching get function (`get<Name>`) is made available to the `gsplatModifyPS` shader
     * chunk, where the per-splat value can be read for each rendered fragment.
     *
     * Supported types are {@link TYPE_FLOAT32}, {@link TYPE_INT32} and {@link TYPE_UINT32}, with
     * 1 to 4 components. Adding or removing streams rebuilds the gsplat shaders.
     *
     * Note: on some platforms each component is stored in per-splat video memory, so its size
     * scales with the number of rendered splats. Keep the data as compact as possible - prefer
     * fewer components, and consider bit-packing multiple small values into a single uint
     * component instead of using separate streams.
     *
     * @param {GSplatVaryingDescriptor[]} streams - The streams to add.
     * @example
     * // Add a per-splat flag, written once per splat in gsplatModifyVS using setFlag(value),
     * // and read per fragment in gsplatModifyPS using getFlag()
     * app.scene.gsplat.varyings.add([{
     *     name: 'flag',
     *     type: pc.TYPE_UINT32,
     *     components: 1
     * }]);
     */
    add(streams) {
        Debug.call(() => {
            Debug.assert(streams && streams.length > 0, 'GSplatVaryings#add: streams must be a non-empty array.');
            streams?.forEach((s) => {
                Debug.assert(!!s && IDENTIFIER_REGEX.test(s.name ?? ''), `GSplatVaryings: varying name '${s?.name}' is not a valid identifier.`);
                Debug.assert(!!GLSL_TYPES[s.type], `GSplatVaryings: varying '${s.name}' has unsupported type. Use TYPE_FLOAT32, TYPE_INT32 or TYPE_UINT32.`);
                Debug.assert(s.components >= 1 && s.components <= 4, `GSplatVaryings: varying '${s.name}' must have 1 to 4 components.`);
                Debug.assert(!this._streams.some(v => v.name === s.name), `GSplatVaryings: varying '${s.name}' already exists.`);
            });
        });

        for (const s of streams) {
            this._streams.push({ name: s.name, type: s.type, components: s.components });
        }
        this._changed();
    }

    /**
     * Removes varying streams previously added by {@link GSplatVaryings#add}.
     *
     * @param {string[]} names - The names of the streams to remove.
     */
    remove(names) {
        Debug.call(() => {
            Debug.assert(names && names.length > 0, 'GSplatVaryings#remove: names must be a non-empty array.');
        });

        const count = this._streams.length;
        this._streams = this._streams.filter(v => !names.includes(v.name));
        if (this._streams.length !== count) {
            this._changed();
        }
    }

    /**
     * Marks the streams as changed: recomputes the cache word count eagerly (so consumers never
     * see a stale value) and bumps the version. The shader chunks are regenerated and applied to
     * the material once per frame by the engine via {@link GSplatVaryings#apply}.
     *
     * @private
     */
    _changed() {
        this._words = this._streams.reduce((sum, s) => sum + s.components, 0);
        this._version++;
    }

    /**
     * Generates the shader chunks implementing the varying streams: declarations and set
     * functions for the vertex stage (and its compute projector equivalent), declarations and
     * get functions for the fragment stage, and the projection cache read / write code used by
     * the hybrid renderer.
     *
     * @returns {object} The generated chunk sources.
     * @private
     */
    _generateChunks() {
        const isWebGPU = this._device.isWebGPU;
        const types = isWebGPU ? WGSL_TYPES : GLSL_TYPES;
        const declVSTemplate = isWebGPU ? wgslVaryingDeclVS : glslVaryingDeclVS;
        const declPSTemplate = isWebGPU ? wgslVaryingDeclPS : glslVaryingDeclPS;

        const vs = [];
        const ps = [];
        const flush = [];
        const cs = [];
        const cacheWrite = [];
        const cacheRead = [];

        let wordOffset = 0;
        for (const s of this._streams) {
            const { name, type, components } = s;
            const shaderType = types[type][components - 1];
            const funcName = pascal(name);
            const sub = template => template
            .replace(RE_NAME, name)
            .replace(RE_TYPE, shaderType)
            .replace(RE_FUNC_NAME, funcName);

            vs.push(sub(declVSTemplate));
            ps.push(sub(declPSTemplate));

            if (isWebGPU) {
                flush.push(sub(wgslVaryingFlushVS));
                cs.push(sub(wgslVaryingDeclCS));

                // hybrid projection cache: one u32 word per component, appended after the base layout
                const words = [];
                for (let c = 0; c < components; c++) {
                    const component = components === 1 ? `_user_${name}` : `_user_${name}.${COMPONENT_SWIZZLE[c]}`;
                    cacheWrite.push(wgslVaryingCacheWriteCS
                    .replace(RE_WORD, String(CACHE_STRIDE + wordOffset + c))
                    .replace(RE_VALUE, encodeWord(type, component)));
                    words.push(decodeWord(type, `projCache[base + ${CACHE_STRIDE + wordOffset + c}u]`));
                }
                cacheRead.push(wgslVaryingCacheReadVS
                .replace(RE_NAME, name)
                .replace(RE_VALUE, components === 1 ? words[0] : `${shaderType}(${words.join(', ')})`));
            }

            wordOffset += components;
        }

        // chunk sources keyed by chunk name
        const chunks = {
            gsplatUserVaryingsVS: vs.join(''),
            gsplatUserVaryingsPS: ps.join('')
        };
        if (isWebGPU) {
            chunks.gsplatUserVaryingsFlushVS = flush.join('');
            chunks.gsplatUserVaryingsCS = cs.join('');
            chunks.gsplatUserCacheWriteCS = cacheWrite.join('');
            chunks.gsplatUserCacheReadVS = cacheRead.join('');
        }
        return chunks;
    }

    /**
     * Regenerates the shader chunks and applies them to the material, from where the renderers
     * pick them up (and rebuild shaders) via the existing chunk synchronization. Consumers track
     * {@link GSplatVaryings#version} to call this only when the streams changed.
     *
     * @param {ShaderMaterial} material - The gsplat material to apply the chunks to.
     * @ignore
     */
    apply(material) {
        const isWebGPU = this._device.isWebGPU;
        const chunks = material.getShaderChunks(isWebGPU ? SHADERLANGUAGE_WGSL : SHADERLANGUAGE_GLSL);

        // the define gates the include of the generated chunks in the engine shaders
        material.setDefine('GSPLAT_USER_VARYINGS', this._streams.length > 0);

        if (this._streams.length > 0) {
            const sources = this._generateChunks();
            for (const name in sources) {
                chunks.set(name, sources[name]);
            }
        } else {
            const names = isWebGPU ? WGSL_CHUNK_NAMES : GLSL_CHUNK_NAMES;
            names.forEach(name => chunks.delete(name));
        }

        material.update();
    }
}

export { GSplatVaryings };
