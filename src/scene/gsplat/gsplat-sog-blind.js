/**
 * SOG v3 blind data: per-gaussian application data stored in RGBA8 textures (`meta.blind`, one
 * entry per texture). Each texture's fields occupy its bytes (R, G, B, A) at their `offset`,
 * little-endian, in one of these encodings:
 *
 * - `u8` `u16` `u24` `u32`: unsigned integer.
 * - `f16` `f32`: IEEE half / single float bits.
 * - `unorm8` `unorm16`: a float quantized linearly from [`min`, `max`] (default [0, 1]).
 *
 * Shaders read field `name` through a generated `getBlind_<name>()` (name sanitized to an
 * identifier), returning `uint` / `u32` for integer encodings and `float` / `f32` otherwise; a
 * `SOG_BLIND_<name>` define marks each field that exists.
 *
 * @ignore
 */

const BLIND_TYPE_BYTES = { u8: 1, u16: 2, u24: 3, u32: 4, f16: 2, f32: 4, unorm8: 1, unorm16: 2 };

const isIntegerType = type => type[0] === 'u' && !type.startsWith('unorm');

/**
 * Shader identifier suffix for a blind field name: characters outside [A-Za-z0-9_] become '_',
 * and runs of '_' collapse to one (GLSL reserves '__').
 *
 * @param {string} name - The field name.
 * @returns {string} The suffix.
 */
const blindFieldId = name => name.replace(/\W/g, '_').replace(/_+/g, '_');

/**
 * The validated fields of a SOG meta's blind textures, each with its texture index and shader
 * identifier. Fields whose type is unknown, which do not fit their texture, or whose identifier
 * repeats an earlier field's are reported in `skipped` and left out.
 *
 * @param {object} meta - The SOG meta.json.
 * @returns {{fields: {texture: number, name: string, id: string, type: string, offset: number, bytes: number, min: number, max: number}[], skipped: string[]}} The fields.
 */
const blindFields = (meta) => {
    const fields = [];
    const skipped = [];
    const ids = new Set();
    (meta.blind ?? []).forEach((texture, t) => {
        for (const f of texture.fields ?? []) {
            const bytes = BLIND_TYPE_BYTES[f.type];
            const id = blindFieldId(f.name);
            if (!bytes || !(f.offset >= 0 && f.offset + bytes <= 4) || ids.has(id)) {
                skipped.push(f.name);
                continue;
            }
            ids.add(id);
            fields.push({ texture: t, name: f.name, id, type: f.type, offset: f.offset, bytes, min: f.min ?? 0, max: f.max ?? 1 });
        }
    });
    return { fields, skipped };
};

// a float literal both GLSL and WGSL accept
const floatLiteral = (v) => {
    const s = String(v);
    return /[.e]/i.test(s) ? s : `${s}.0`;
};

/**
 * Shader code for the blind field accessors, appended to the SOG read code. The textures are
 * declared as streams `blind0`, `blind1`, ... whose generated `loadBlind<i>()` returns the RGBA8
 * texel as normalized floats.
 *
 * @param {object} meta - The SOG meta.json.
 * @param {boolean} wgsl - Generate WGSL (else GLSL).
 * @returns {string} The accessor functions.
 */
const blindAccessors = (meta, wgsl) => {
    const lines = [];
    for (const f of blindFields(meta).fields) {
        const ch = 'xyzw';
        const terms = [];
        for (let k = 0; k < f.bytes; k++) {
            const byte = `b.${ch[f.offset + k]}`;
            terms.push(k === 0 ? byte : `(${byte} << ${8 * k}u)`);
        }
        const bits = terms.join(' | ');
        const integer = isIntegerType(f.type);
        let value;
        if (integer) {
            value = 'bits';
        } else if (f.type === 'f32') {
            value = wgsl ? 'bitcast<f32>(bits)' : 'uintBitsToFloat(bits)';
        } else if (f.type === 'f16') {
            value = wgsl ? 'unpack2x16float(bits).x' : 'unpackHalf2x16(bits).x';
        } else {
            const steps = f.type === 'unorm8' ? '255.0' : '65535.0';
            const toFloat = wgsl ? 'f32(bits)' : 'float(bits)';
            value = `${floatLiteral(f.min)} + ${toFloat} / ${steps} * ${floatLiteral(f.max - f.min)}`;
        }
        lines.push(wgsl ?
            `fn getBlind_${f.id}() -> ${integer ? 'u32' : 'f32'} {\n` +
            `    let b = vec4u(loadBlind${f.texture}() * 255.0 + 0.5);\n` +
            `    let bits = ${bits};\n` +
            `    return ${value};\n}` :
            `${integer ? 'uint' : 'float'} getBlind_${f.id}() {\n` +
            `    uvec4 b = uvec4(loadBlind${f.texture}() * 255.0 + 0.5);\n` +
            `    uint bits = ${bits};\n` +
            `    return ${value};\n}`);
    }
    return lines.length ? `\n// SOG v3 blind data accessors (see gsplat-sog-blind.js)\n${lines.join('\n')}\n` : '';
};

const halfToFloat = (h) => {
    const sign = h & 0x8000 ? -1 : 1;
    const exp = (h >>> 10) & 0x1f;
    const mant = h & 0x3ff;
    if (exp === 0) return sign * mant * 2 ** -24;
    if (exp === 0x1f) return mant ? NaN : sign * Infinity;
    return sign * (1 + mant / 1024) * 2 ** (exp - 15);
};

const f32 = new Float32Array(1);
const u32 = new Uint32Array(f32.buffer);

/**
 * Decode one blind field for every gaussian from its texture's RGBA8 bytes.
 *
 * @param {Uint8Array|Uint8ClampedArray} rgba - The texture's pixels.
 * @param {object} field - A field from {@link blindFields}.
 * @param {number} count - Gaussian count.
 * @returns {Uint32Array|Float32Array} The values: Uint32Array for integer encodings.
 */
const decodeBlindField = (rgba, field, count) => {
    const integer = isIntegerType(field.type);
    const out = integer ? new Uint32Array(count) : new Float32Array(count);
    for (let i = 0; i < count; i++) {
        const t = i * 4 + field.offset;
        let bits = 0;
        for (let k = 0; k < field.bytes; k++) bits |= rgba[t + k] << (8 * k);
        bits >>>= 0;
        if (integer) {
            out[i] = bits;
        } else if (field.type === 'f32') {
            u32[0] = bits;
            out[i] = f32[0];
        } else if (field.type === 'f16') {
            out[i] = halfToFloat(bits);
        } else {
            const steps = field.type === 'unorm8' ? 255 : 65535;
            out[i] = field.min + (bits / steps) * (field.max - field.min);
        }
    }
    return out;
};

export { blindAccessors, blindFields, decodeBlindField, isIntegerType };
