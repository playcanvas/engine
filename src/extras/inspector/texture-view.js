import {
    ADDRESS_CLAMP_TO_EDGE, ADDRESS_MIRRORED_REPEAT, ADDRESS_REPEAT,
    FILTER_LINEAR, FILTER_LINEAR_MIPMAP_LINEAR, FILTER_LINEAR_MIPMAP_NEAREST, FILTER_NEAREST, FILTER_NEAREST_MIPMAP_LINEAR,
    FILTER_NEAREST_MIPMAP_NEAREST,
    FUNC_ALWAYS, FUNC_EQUAL, FUNC_GREATER, FUNC_GREATEREQUAL, FUNC_LESS, FUNC_LESSEQUAL, FUNC_NEVER, FUNC_NOTEQUAL
} from '../../platform/graphics/constants.js';

import { describeValue } from './describe.js';
import { formatName, makeSection, push, read, reflectRows } from './model.js';

/** @import { GraphicsDevice } from '../../platform/graphics/graphics-device.js' */
/** @import { RenderTarget } from '../../platform/graphics/render-target.js' */
/** @import { Texture } from '../../platform/graphics/texture.js' */
/** @import { ListRow } from './list-view.js' */
/** @import { PropertySection } from './model.js' */

// texture properties the model shows explicitly, plumbing, and deprecated getters that warn when read
const SKIP_TEXTURE = [
    'name', 'width', 'height', 'depth', 'format', 'gpuSize', 'mipmaps', 'numLevels', 'cubemap', 'volume', 'array',
    'arrayLength', 'samples', 'minFilter', 'magFilter', 'addressU', 'addressV', 'addressW', 'anisotropy', 'compareOnRead',
    'compareFunc', 'device', 'impl', 'rgbm', 'swizzleGGGR'
];

// sampler state constants by value, so the panel shows names rather than numbers
const FILTER_NAMES = new Map([
    [FILTER_NEAREST, 'FILTER_NEAREST'], [FILTER_LINEAR, 'FILTER_LINEAR'],
    [FILTER_NEAREST_MIPMAP_NEAREST, 'FILTER_NEAREST_MIPMAP_NEAREST'], [FILTER_NEAREST_MIPMAP_LINEAR, 'FILTER_NEAREST_MIPMAP_LINEAR'],
    [FILTER_LINEAR_MIPMAP_NEAREST, 'FILTER_LINEAR_MIPMAP_NEAREST'], [FILTER_LINEAR_MIPMAP_LINEAR, 'FILTER_LINEAR_MIPMAP_LINEAR']
]);
const ADDRESS_NAMES = new Map([
    [ADDRESS_REPEAT, 'ADDRESS_REPEAT'], [ADDRESS_CLAMP_TO_EDGE, 'ADDRESS_CLAMP_TO_EDGE'], [ADDRESS_MIRRORED_REPEAT, 'ADDRESS_MIRRORED_REPEAT']
]);
const FUNC_NAMES = new Map([
    [FUNC_NEVER, 'FUNC_NEVER'], [FUNC_LESS, 'FUNC_LESS'], [FUNC_EQUAL, 'FUNC_EQUAL'], [FUNC_LESSEQUAL, 'FUNC_LESSEQUAL'],
    [FUNC_GREATER, 'FUNC_GREATER'], [FUNC_NOTEQUAL, 'FUNC_NOTEQUAL'], [FUNC_GREATEREQUAL, 'FUNC_GREATEREQUAL'], [FUNC_ALWAYS, 'FUNC_ALWAYS']
]);

/**
 * @param {Map<number, string>} names - Constant names by value.
 * @param {number} value - The value.
 * @returns {import('./describe.js').Described} The name, or the number when it is not a known constant.
 */
function constant(names, value) {
    const name = names.get(value);
    return name ? { text: name, cls: 'obj' } : describeValue(value);
}

/** @type {WeakMap<Texture, number>} */
const ids = new WeakMap();
let nextId = 1;

/**
 * @param {Texture} texture - A texture.
 * @returns {string} A row key that stays the same for the lifetime of the object.
 */
function keyOf(texture) {
    let id = ids.get(texture);
    if (id === undefined) {
        id = nextId++;
        ids.set(texture, id);
    }
    return `tex${id}`;
}

/**
 * @param {number} bytes - A byte count.
 * @returns {string} The count in the largest unit that keeps it above one, with two decimals.
 */
function formatBytes(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/**
 * @param {Texture} texture - A texture.
 * @returns {string} Its dimensions, with the shape when it is not a plain 2D texture.
 */
function shapeText(texture) {
    const shape = texture.cubemap ? ' cube' : texture.volume ? ` ×${texture.depth}` : texture.array ? ` [${texture.arrayLength}]` : '';
    return `${texture.width}×${texture.height}${shape}`;
}

/**
 * Every texture alive on the device, largest GPU footprint first. The device keeps a registry of
 * the textures created on it, so this covers textures nothing rendered this frame too.
 *
 * @param {GraphicsDevice} device - The device.
 * @returns {Texture[]} The textures.
 */
function collectTextures(device) {
    return [...device.textures ?? []].sort((a, b) => b.gpuSize - a.gpuSize);
}

/**
 * @param {GraphicsDevice} device - The device.
 * @returns {Map<Texture, RenderTarget[]>} The render targets each attached texture belongs to.
 */
function attachmentTargets(device) {
    /** @type {Map<Texture, RenderTarget[]>} */
    const owners = new Map();
    const add = (texture, rt) => {
        if (!texture) return;
        const list = owners.get(texture) ?? [];
        list.push(rt);
        owners.set(texture, list);
    };
    for (const rt of device.targets ?? []) {
        const count = rt.colorBufferCount ?? 0;
        for (let i = 0; i < count; i++) {
            add(rt.getColorBuffer(i), rt);
            add(rt.getResolveBuffer?.(i), rt);
        }
        add(rt.depthBuffer, rt);
        add(rt.depthResolveBuffer, rt);
    }
    return owners;
}

/**
 * One row per texture on the device, largest first, tagged when it is a render target attachment.
 *
 * @param {GraphicsDevice} device - The device.
 * @returns {ListRow[]} The rows.
 */
function textureRows(device) {
    const owners = attachmentTargets(device);
    return collectTextures(device).map((texture) => {
        const name = texture.name || '(unnamed)';
        const cells = [{ text: name, cls: 'pci-cell-name' }];
        if (owners.has(texture)) cells.push({ text: 'target', cls: 'pci-cell-tag pci-cell-tag-info' });
        cells.push({ text: `${shapeText(texture)} ${formatName(texture.format)}${texture.mipmaps ? ' mips' : ''}`, cls: 'pci-cell-info' });
        cells.push({ text: formatBytes(texture.gpuSize), cls: 'pci-cell-info pci-cell-right' });
        const title = `${name} ${shapeText(texture)} ${formatName(texture.format)}\n${formatBytes(texture.gpuSize)}${texture.mipmaps ? `, ${texture.numLevels} mip levels` : ''}`;
        return { key: keyOf(texture), item: texture, name, title, cells };
    });
}

/**
 * Everything the property view shows for a texture: its storage, the render targets it is attached
 * to (linked), and every other public property.
 *
 * @param {Texture} texture - The texture.
 * @param {{ device: GraphicsDevice }} ctx - The device.
 * @returns {PropertySection[]} The sections.
 */
function buildTextureModel(texture, ctx) {
    const sections = [];

    const general = makeSection('texture', 'Texture');
    push(general, 'name', describeValue(texture.name));
    push(general, 'size', { text: shapeText(texture), cls: 'num' });
    push(general, 'format', { text: formatName(texture.format), cls: 'obj' });
    push(general, 'gpu size', { text: formatBytes(texture.gpuSize), cls: 'num' });
    push(general, 'mipmaps', { text: texture.mipmaps ? `${texture.numLevels} levels` : 'false', cls: texture.mipmaps ? 'num' : 'bool' });
    if (texture.samples > 1) push(general, 'samples', read(texture, 'samples'));
    if (texture.cubemap) push(general, 'cubemap', describeValue(true));
    if (texture.volume) push(general, 'volume depth', read(texture, 'depth'));
    if (texture.array) push(general, 'array length', read(texture, 'arrayLength'));

    const owners = attachmentTargets(ctx.device).get(texture) ?? [];
    push(general, 'attached to', {
        text: owners.length ? `${owners.length} render target${owners.length === 1 ? '' : 's'}` : 'no render target',
        cls: owners.length ? 'obj' : 'null',
        items: owners.map(rt => ({ label: '', text: rt.name || '(unnamed)', cls: 'ref', target: rt }))
    });
    sections.push(general);

    const sampling = makeSection('sampling', 'Sampling');
    push(sampling, 'min filter', constant(FILTER_NAMES, texture.minFilter));
    push(sampling, 'mag filter', constant(FILTER_NAMES, texture.magFilter));
    push(sampling, 'address u', constant(ADDRESS_NAMES, texture.addressU));
    push(sampling, 'address v', constant(ADDRESS_NAMES, texture.addressV));
    if (texture.volume) push(sampling, 'address w', constant(ADDRESS_NAMES, texture.addressW));
    push(sampling, 'anisotropy', read(texture, 'anisotropy'));
    push(sampling, 'compare on read', read(texture, 'compareOnRead'));
    if (texture.compareOnRead) push(sampling, 'compare func', constant(FUNC_NAMES, texture.compareFunc));
    sections.push(sampling);

    const rest = makeSection('props', 'Properties');
    reflectRows(rest, texture, [], SKIP_TEXTURE);
    if (rest.rows.length) sections.push(rest);

    return sections;
}

export { buildTextureModel, collectTextures, formatBytes, textureRows };
