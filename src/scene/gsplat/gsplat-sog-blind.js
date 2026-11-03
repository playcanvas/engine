import { Debug } from '../../core/debug.js';

import glslBlindField from '../shader-lib/glsl/chunks/gsplat/vert/formats/sogBlindField.js';
import wgslBlindField from '../shader-lib/wgsl/chunks/gsplat/vert/formats/sogBlindField.js';

/**
 * SOG v3 blind data: per-gaussian application data stored in RGBA8 textures (`meta.blind`, one
 * entry per texture). Each texture's fields are packed in order into its bytes (R, G, B, A),
 * little-endian, in one of these encodings:
 *
 * - `u8` `u16` `u24` `u32`: unsigned integer.
 * - `f16` `f32`: IEEE half / single float bits.
 * - `unorm8` `unorm16`: a float quantized linearly from `range` ([min, max], default [0, 1]).
 *
 * Shaders read field `name` through a generated `getBlind_<name>()` (name sanitized to an
 * identifier), returning `uint` / `u32` for integer encodings and `float` / `f32` otherwise; a
 * `SOG_BLIND_<name>` define marks each field that exists.
 *
 * @ignore
 */

/**
 * @typedef {object} BlindField
 * @property {number} texture - Index of the field's texture in `meta.blind`.
 * @property {string} name - The field name.
 * @property {string} id - Shader identifier suffix derived from the name.
 * @property {string} type - The encoding.
 * @property {number} offset - Index of the field's first byte in the texel (0 = R).
 * @property {number} bytes - Number of bytes.
 * @property {number} min - Value of the smallest code (unorm encodings).
 * @property {number} max - Value of the largest code (unorm encodings).
 * @ignore
 */

const BLIND_TYPE_BYTES = { u8: 1, u16: 2, u24: 3, u32: 4, f16: 2, f32: 4, unorm8: 1, unorm16: 2 };

const DEFAULT_RANGE = [0, 1];

const isIntegerType = type => type[0] === 'u' && !type.startsWith('unorm');

// Pre-compiled regex patterns for template replacement
const RE_ID = /\{id\}/g;
const RE_RETURN_TYPE = /\{returnType\}/g;
const RE_TEXTURE = /\{texture\}/g;
const RE_OFFSET = /\{offset\}/g;
const RE_BYTES = /\{bytes\}/g;
const RE_DECODE = /\{decode\}/g;

/**
 * Shader identifier suffix for a blind field name: characters outside [A-Za-z0-9_] become '_',
 * runs of '_' collapse to one and leading / trailing '_' are dropped, as GLSL reserves '__' and
 * the suffix follows a '_'.
 *
 * @param {string} name - The field name.
 * @returns {string} The suffix.
 */
const blindFieldId = name => name.replace(/\W/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');

/**
 * The fields of a SOG meta's blind textures, each with its texture index, byte offset and shader
 * identifier. Fields are packed in order, so each starts where the previous field of its texture
 * ended. The data is assumed valid, as the tools writing it check it; debug builds report
 * problems.
 *
 * @param {object} meta - The SOG meta.json.
 * @returns {BlindField[]} The fields.
 */
const parseBlindFields = (meta) => {
    const fields = [];
    (meta.blind ?? []).forEach((texture, t) => {
        let offset = 0;
        for (const f of texture.fields) {
            const bytes = BLIND_TYPE_BYTES[f.type];
            const [min, max] = f.range ?? DEFAULT_RANGE;
            fields.push({ texture: t, name: f.name, id: blindFieldId(f.name), type: f.type, offset, bytes, min, max });
            offset += bytes;
        }
    });

    Debug.call(() => {
        const ids = new Set();
        for (const f of fields) {
            Debug.assert(f.bytes, `SOG blind field ${f.name} has unknown type ${f.type}`);
            Debug.assert(f.offset + f.bytes <= 4, `SOG blind field ${f.name} does not fit in its texture`);
            Debug.assert(f.id && !ids.has(f.id), `SOG blind field ${f.name} has an empty or repeated shader identifier '${f.id}'`);
            ids.add(f.id);
        }
    });

    return fields;
};

// a float literal both GLSL and WGSL accept
const floatLiteral = (v) => {
    const s = String(v);
    return /[.e]/i.test(s) ? s : `${s}.0`;
};

/**
 * Shader code for the blind field accessors, appended to the SOG read code: the
 * `gsplatSogBlindVS` decoding helpers, then one accessor per field from the `sogBlindField`
 * template. The textures are declared as streams `blind0`, `blind1`, ... whose generated
 * `loadBlind<i>()` returns the RGBA8 texel as normalized floats.
 *
 * @param {BlindField[]} fields - The fields, from {@link parseBlindFields}.
 * @param {boolean} wgsl - Generate WGSL (else GLSL).
 * @returns {string} The accessor functions, empty when there are no fields.
 */
const blindAccessors = (fields, wgsl) => {
    if (!fields.length) {
        return '';
    }
    const template = wgsl ? wgslBlindField : glslBlindField;
    const accessors = fields.map((f) => {
        const integer = isIntegerType(f.type);
        let decode = 'bits';
        if (f.type === 'f16') {
            decode = 'sogBlindF16(bits)';
        } else if (f.type === 'f32') {
            decode = 'sogBlindF32(bits)';
        } else if (!integer) {
            const steps = f.type === 'unorm8' ? '255.0' : '65535.0';
            decode = `sogBlindUnorm(bits, ${steps}, ${floatLiteral(f.min)}, ${floatLiteral(f.max)})`;
        }
        return template
        .replace(RE_ID, f.id)
        .replace(RE_RETURN_TYPE, integer ? (wgsl ? 'u32' : 'uint') : (wgsl ? 'f32' : 'float'))
        .replace(RE_TEXTURE, String(f.texture))
        .replace(RE_OFFSET, String(f.offset))
        .replace(RE_BYTES, String(f.bytes))
        .replace(RE_DECODE, decode);
    });
    return `\n#include "gsplatSogBlindVS"\n${accessors.join('')}`;
};

export { blindAccessors, parseBlindFields };
