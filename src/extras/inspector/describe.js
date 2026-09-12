import { Color } from '../../core/math/color.js';
import { CurveSet } from '../../core/math/curve-set.js';
import { Curve } from '../../core/math/curve.js';
import { Mat3 } from '../../core/math/mat3.js';
import { Mat4 } from '../../core/math/mat4.js';
import { Quat } from '../../core/math/quat.js';
import { Vec2 } from '../../core/math/vec2.js';
import { Vec3 } from '../../core/math/vec3.js';
import { Vec4 } from '../../core/math/vec4.js';
import { BoundingBox } from '../../core/shape/bounding-box.js';
import { OrientedBox } from '../../core/shape/oriented-box.js';
import { Tags } from '../../core/tags.js';
import { Asset } from '../../framework/asset/asset.js';
import { Entity } from '../../framework/entity.js';
import { pixelFormatInfo } from '../../platform/graphics/constants.js';
import { RenderTarget } from '../../platform/graphics/render-target.js';
import { Texture } from '../../platform/graphics/texture.js';
import { GraphNode } from '../../scene/graph-node.js';
import { Layer } from '../../scene/layer.js';
import { Material } from '../../scene/materials/material.js';
import { MeshInstance } from '../../scene/mesh-instance.js';
import { Mesh } from '../../scene/mesh.js';
import { Sprite } from '../../scene/sprite.js';

/**
 * A value rendered by the property view.
 *
 * @typedef {object} Described
 * @property {string} text - The display text.
 * @property {string} [cls] - A class suffix selecting the color: 'num', 'bool', 'str', 'null',
 * 'obj', 'ref' or 'err'.
 * @property {GraphNode} [target] - A node the value refers to. Rendered as a link that selects
 * the node in the hierarchy.
 * @property {string} [swatch] - A CSS color, rendered as a chip in front of the text.
 * @property {Described[]} [items] - Expanded entries of a collection, each carrying a `label`.
 * @property {string} [label] - The label of an expanded collection entry.
 */

/** The number of collection entries expanded into their own rows. */
const MAX_ITEMS = 12;

/** The number of characters of a string shown before it is cut. */
const MAX_STRING = 96;

/** Collections of primitives up to this length are printed inline. */
const INLINE_ARRAY = 8;

const _euler = new Vec3();

/**
 * Formats a number compactly: integers as they are, everything else to four decimals with the
 * trailing zeros removed (so float noise like 1.8e-15 reads as 0), and huge magnitudes in
 * exponent form.
 *
 * @param {number} n - The number.
 * @returns {string} The formatted number.
 */
function formatNumber(n) {
    if (Number.isInteger(n) || !Number.isFinite(n)) {
        return String(n);
    }
    if (Math.abs(n) >= 1e7) {
        return n.toExponential(3);
    }
    return String(parseFloat(n.toFixed(4)));
}

/**
 * @param {ArrayLike<number>} components - The vector components.
 * @returns {string} The components in parentheses.
 */
function tuple(components) {
    return `(${Array.from(components, formatNumber).join(', ')})`;
}

/**
 * @param {*} value - Any object.
 * @returns {string} The name of the object's class.
 */
function typeName(value) {
    return value?.constructor?.name || 'Object';
}

/**
 * @param {string} text - The text.
 * @returns {string} The text quoted, cut to {@link MAX_STRING} characters.
 */
function quote(text) {
    return JSON.stringify(text.length > MAX_STRING ? `${text.slice(0, MAX_STRING)}…` : text);
}

/**
 * Expands the first {@link MAX_ITEMS} entries of an iterable into labelled items.
 *
 * @param {Iterable<[string, *]>} entries - Label and value pairs.
 * @param {number} count - The total number of entries.
 * @returns {Described[]} The items.
 */
function expandItems(entries, count) {
    const items = [];
    for (const [label, value] of entries) {
        if (items.length >= MAX_ITEMS) {
            items.push({ label: '', text: `… ${count - MAX_ITEMS} more`, cls: 'null' });
            break;
        }
        items.push({ label, ...describeValue(value, 1) });
    }
    return items;
}

/**
 * Summarizes a value for display. Engine types get a purpose-built one-line summary; nodes come
 * back with a `target` so the UI can link to them; arrays, sets and maps expand their first
 * entries into `items` at the top level only.
 *
 * @param {*} value - The value to describe.
 * @param {number} [depth] - The nesting depth. Nested values are kept to a short type name.
 * @returns {Described} The description.
 */
function describeValue(value, depth = 0) {
    if (value === null) return { text: 'null', cls: 'null' };
    if (value === undefined) return { text: 'undefined', cls: 'null' };

    switch (typeof value) {
        case 'boolean': return { text: String(value), cls: 'bool' };
        case 'number': return { text: formatNumber(value), cls: 'num' };
        case 'bigint': return { text: `${value}n`, cls: 'num' };
        case 'string': return { text: quote(value), cls: 'str' };
        case 'symbol': return { text: value.toString(), cls: 'str' };
        case 'function': return { text: `ƒ ${value.name || 'anonymous'}`, cls: 'null' };
    }

    // math
    if (value instanceof Vec2) return { text: tuple([value.x, value.y]), cls: 'num' };
    if (value instanceof Vec3) return { text: tuple([value.x, value.y, value.z]), cls: 'num' };
    if (value instanceof Vec4) return { text: tuple([value.x, value.y, value.z, value.w]), cls: 'num' };
    if (value instanceof Quat) {
        value.getEulerAngles(_euler);
        return {
            text: `${tuple([value.x, value.y, value.z, value.w])}  euler ${tuple([_euler.x, _euler.y, _euler.z])}`,
            cls: 'num'
        };
    }
    if (value instanceof Color) {
        const c = v => Math.round(Math.min(1, Math.max(0, v)) * 255);
        return {
            text: tuple([value.r, value.g, value.b, value.a]),
            cls: 'num',
            swatch: `rgba(${c(value.r)}, ${c(value.g)}, ${c(value.b)}, ${Math.min(1, Math.max(0, value.a))})`
        };
    }
    if (value instanceof Mat4 || value instanceof Mat3) {
        return { text: `${typeName(value)} [${Array.from(value.data, formatNumber).join(', ')}]`, cls: 'num' };
    }
    if (value instanceof OrientedBox) {
        return { text: `OrientedBox halfExtents ${tuple([value.halfExtents.x, value.halfExtents.y, value.halfExtents.z])}`, cls: 'num' };
    }
    if (value instanceof BoundingBox) {
        const { center: c, halfExtents: h } = value;
        return { text: `center ${tuple([c.x, c.y, c.z])} halfExtents ${tuple([h.x, h.y, h.z])}`, cls: 'num' };
    }
    if (value instanceof Curve) return { text: `Curve (${value.keys.length} keys)`, cls: 'obj' };
    if (value instanceof CurveSet) return { text: `CurveSet (${value.curves.length} curves)`, cls: 'obj' };

    // scene graph
    if (value instanceof Entity) return { text: `Entity "${value.name}"`, cls: 'ref', target: value };
    if (value instanceof GraphNode) return { text: `GraphNode "${value.name}"`, cls: 'ref', target: value };
    if (value instanceof Tags) return describeValue(value.list(), depth);

    // resources
    if (value instanceof Asset) {
        return { text: `Asset #${value.id} "${value.name}" (${value.type}${value.loaded ? ', loaded' : ''})`, cls: 'obj' };
    }
    if (value instanceof Texture) {
        const shape = value.cubemap ? ' cubemap' : (value.volume ? ` ×${value.depth}` : (value.array ? ` [${value.arrayLength}]` : ''));
        return {
            text: `Texture "${value.name}" ${value.width}×${value.height}${shape} ${pixelFormatInfo.get(value.format)?.name ?? value.format}${value.mipmaps ? ' mips' : ''}`,
            cls: 'obj'
        };
    }
    if (value instanceof RenderTarget) {
        return { text: `RenderTarget "${value.name}" ${value.width}×${value.height}`, cls: 'obj' };
    }
    if (value instanceof Material) return { text: `${typeName(value)} "${value.name}"`, cls: 'obj' };
    if (value instanceof Mesh) {
        const prim = value.primitive?.[0];
        return {
            text: `Mesh ${value.vertexBuffer?.numVertices ?? 0} verts${prim ? `, ${prim.count} ${prim.indexed ? 'indices' : 'vertices drawn'}` : ''}`,
            cls: 'obj'
        };
    }
    if (value instanceof MeshInstance) {
        return {
            text: `MeshInstance material "${value.material?.name ?? ''}" ${value.mesh?.vertexBuffer?.numVertices ?? 0} verts${value.visible ? '' : ' (hidden)'}`,
            cls: 'obj',
            target: value.node
        };
    }
    if (value instanceof Layer) return { text: `Layer "${value.name}" (id ${value.id})`, cls: 'obj' };
    if (value instanceof Sprite) return { text: `Sprite ${value.frameKeys?.length ?? 0} frames`, cls: 'obj' };

    // DOM
    if (globalThis.Element && value instanceof globalThis.Element) {
        const cls = value.className ? `.${String(value.className).trim().split(/\s+/).join('.')}` : '';
        return { text: `<${value.tagName.toLowerCase()}${value.id ? `#${value.id}` : ''}${cls}>`, cls: 'obj' };
    }

    // collections
    if (ArrayBuffer.isView(value) && !(value instanceof DataView)) {
        const inline = value.length <= INLINE_ARRAY ? ` ${tuple(value)}` : '';
        return { text: `${typeName(value)}[${value.length}]${inline}`, cls: 'num' };
    }
    if (Array.isArray(value)) {
        const n = value.length;
        if (n === 0) return { text: '[]', cls: 'null' };
        const primitives = value.every(v => v === null || typeof v !== 'object');
        if (primitives && n <= INLINE_ARRAY) {
            return { text: `[${value.map(v => describeValue(v, depth + 1).text).join(', ')}]`, cls: 'obj' };
        }
        const result = { text: `Array(${n}) of ${primitives ? typeof value[0] : typeName(value[0])}`, cls: 'obj' };
        if (depth === 0) {
            result.items = expandItems(value.map((v, i) => [`[${i}]`, v]), n);
        }
        return result;
    }
    if (value instanceof Set) {
        const result = { text: `Set(${value.size})`, cls: 'obj' };
        if (depth === 0 && value.size) {
            result.items = expandItems(Array.from(value, (v, i) => [`[${i}]`, v]), value.size);
        }
        return result;
    }
    if (value instanceof Map) {
        const result = { text: `Map(${value.size})`, cls: 'obj' };
        if (depth === 0 && value.size) {
            result.items = expandItems(Array.from(value, ([k, v]) => [describeValue(k, 1).text, v]), value.size);
        }
        return result;
    }

    // anything else: class name plus a few public fields at the top level
    const name = typeName(value);
    if (depth > 0) return { text: name, cls: 'obj' };
    const keys = Object.keys(value).filter(k => !k.startsWith('_') && typeof value[k] !== 'function').slice(0, 6);
    if (keys.length === 0) return { text: name, cls: 'obj' };
    return {
        text: `${name} { ${keys.map(k => `${k}: ${describeValue(value[k], depth + 1).text}`).join(', ')} }`,
        cls: 'obj'
    };
}

/**
 * Lists the public properties of an object: accessors with a getter found on its prototype chain
 * (most derived class first, in declaration order), followed by its own enumerable data fields.
 * Names starting with an underscore, methods and anything in `skip` are left out.
 *
 * @param {object} obj - The object to reflect on.
 * @param {object[]} stopPrototypes - Prototypes at which to stop walking the chain. These and
 * anything above them are not searched.
 * @param {string[]} [skip] - Property names to leave out.
 * @returns {string[]} The property names.
 */
function collectProperties(obj, stopPrototypes, skip = []) {
    const names = [];
    const seen = new Set(skip);

    for (let proto = Object.getPrototypeOf(obj); proto && proto !== Object.prototype; proto = Object.getPrototypeOf(proto)) {
        if (stopPrototypes.includes(proto)) break;
        for (const name of Object.getOwnPropertyNames(proto)) {
            if (seen.has(name) || name.startsWith('_') || name === 'constructor') continue;
            const descriptor = Object.getOwnPropertyDescriptor(proto, name);
            if (!descriptor?.get) continue;
            seen.add(name);
            names.push(name);
        }
    }

    for (const name of Object.keys(obj)) {
        if (seen.has(name) || name.startsWith('_') || typeof obj[name] === 'function') continue;
        seen.add(name);
        names.push(name);
    }

    return names;
}

export { collectProperties, describeValue, formatNumber };
