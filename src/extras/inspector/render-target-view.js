import {
    FILTER_NEAREST, FILTER_NEAREST_MIPMAP_LINEAR, FILTER_NEAREST_MIPMAP_NEAREST,
    PIXELFORMAT_DEPTH, PIXELFORMAT_DEPTH16, PIXELFORMAT_DEPTHSTENCIL,
    PIXELFORMAT_R32F, PIXELFORMAT_RG32F, PIXELFORMAT_RGB32F, PIXELFORMAT_RGBA32F,
    isIntegerPixelFormat, pixelFormatInfo
} from '../../platform/graphics/constants.js';

import { describeValue } from './describe.js';
import { attachmentsText, formatName, makeSection, passDisplayName, push, read, reflectRows } from './model.js';

/** @import { GraphicsDevice } from '../../platform/graphics/graphics-device.js' */
/** @import { RenderTarget } from '../../platform/graphics/render-target.js' */
/** @import { Texture } from '../../platform/graphics/texture.js' */
/** @import { FrameSnapshot } from './frame-graph-view.js' */
/** @import { ListRow } from './list-view.js' */
/** @import { PropertySection } from './model.js' */

// render target properties the model shows explicitly, or that are plumbing
const SKIP_TARGET = [
    'name', 'width', 'height', 'samples', 'depth', 'stencil', 'flipY', 'mipLevel', 'face', 'initialized',
    'colorBuffer', 'colorBufferCount', 'resolveBuffer', 'depthBuffer', 'depthResolveBuffer', 'device', 'impl'
];

/** @type {WeakMap<RenderTarget, number>} */
const ids = new WeakMap();
let nextId = 1;

/**
 * @param {RenderTarget} rt - A render target.
 * @returns {string} A row key that stays the same for the lifetime of the object.
 */
function keyOf(rt) {
    let id = ids.get(rt);
    if (id === undefined) {
        id = nextId++;
        ids.set(rt, id);
    }
    return `rt${id}`;
}

/**
 * @param {RenderTarget} rt - A render target.
 * @param {GraphicsDevice} device - The device.
 * @returns {string} The display name.
 */
function targetName(rt, device) {
    return rt === device.backBuffer ? 'Backbuffer' : (rt.name || '(unnamed)');
}

/**
 * Every render target alive on the device, backbuffer first. The device keeps a registry of the
 * targets created on it, so this covers targets no pass used this frame too.
 *
 * @param {GraphicsDevice} device - The device.
 * @returns {RenderTarget[]} The targets.
 */
function collectRenderTargets(device) {
    const list = [];
    if (device.backBuffer) list.push(device.backBuffer);
    for (const rt of device.targets ?? []) {
        if (rt !== device.backBuffer) list.push(rt);
    }
    return list;
}

/**
 * @param {string} label - The attachment label.
 * @param {Texture} texture - The attached texture.
 * @returns {string} One line describing the attachment.
 */
function textureLine(label, texture) {
    return `${label}: "${texture.name}" ${formatName(texture.format)} ${texture.width}×${texture.height}`;
}

/**
 * @param {RenderTarget} rt - A render target.
 * @param {GraphicsDevice} device - The device.
 * @returns {string} A multi-line tooltip listing the attachments with their formats.
 */
function targetTitle(rt, device) {
    const lines = [`${targetName(rt, device)} ${rt.width}×${rt.height}${rt.samples > 1 ? ` ×${rt.samples} samples` : ''}`];

    if (rt === device.backBuffer) {
        lines.push(`color: swapchain ${formatName(device.backBufferFormat)}`);
    }
    const count = rt.colorBufferCount ?? 0;
    for (let i = 0; i < count; i++) {
        const texture = rt.getColorBuffer(i);
        if (texture) lines.push(textureLine(`color[${i}]`, texture));
    }
    if (rt.depthBuffer) {
        lines.push(textureLine('depth', rt.depthBuffer));
    } else if (rt.depth) {
        lines.push(`depth: internal${rt.stencil ? ' + stencil' : ''}`);
    }
    if (rt.mipLevel > 0) lines.push(`mip level ${rt.mipLevel}`);

    return lines.join('\n');
}

/**
 * One row per render target on the device, dimmed when no pass of the captured frame used it.
 *
 * @param {GraphicsDevice} device - The device.
 * @param {FrameSnapshot|null} frame - The captured frame, for usage counts.
 * @returns {ListRow[]} The rows.
 */
function renderTargetRows(device, frame) {
    return collectRenderTargets(device).map((rt) => {
        const name = targetName(rt, device);
        const uses = frame?.usage.get(rt)?.length ?? 0;

        const cells = [{ text: name, cls: 'pci-cell-name' }];
        if (rt === device.backBuffer) cells.push({ text: 'backbuffer', cls: 'pci-cell-tag pci-cell-tag-info' });
        cells.push({ text: `${rt.width}×${rt.height} ${attachmentsText(rt, device)}${rt.samples > 1 ? ` ×${rt.samples}` : ''}`, cls: 'pci-cell-info' });
        cells.push({ text: uses ? `${uses} pass${uses === 1 ? '' : 'es'}` : 'unused this frame', cls: 'pci-cell-info pci-cell-right' });

        return { key: keyOf(rt), item: rt, name, dim: uses === 0, title: targetTitle(rt, device), cells };
    });
}

/**
 * Everything the property view shows for a render target: its setup, the passes that rendered
 * into it this frame (linked), its attachments, and every other public property.
 *
 * @param {RenderTarget} rt - The render target.
 * @param {{ device: GraphicsDevice, frame: FrameSnapshot|null }} ctx - The device and the captured frame.
 * @returns {PropertySection[]} The sections.
 */
function buildRenderTargetModel(rt, ctx) {
    const { device, frame } = ctx;
    const back = rt === device.backBuffer;
    const sections = [];

    const general = makeSection('target', back ? 'Backbuffer' : 'Render target');
    push(general, 'name', describeValue(rt.name));
    push(general, 'size', { text: `${rt.width} × ${rt.height}`, cls: 'num' });
    push(general, 'samples', read(rt, 'samples'));
    push(general, 'depth', read(rt, 'depth'));
    push(general, 'stencil', read(rt, 'stencil'));
    push(general, 'flip y', read(rt, 'flipY'));
    push(general, 'mip level', read(rt, 'mipLevel'));
    push(general, 'face', read(rt, 'face'));
    push(general, 'initialized', read(rt, 'initialized'));

    const uses = frame?.usage.get(rt) ?? [];
    push(general, 'used by', {
        text: uses.length ? `${uses.length} pass${uses.length === 1 ? '' : 'es'} this frame` : 'no pass this frame',
        cls: uses.length ? 'obj' : 'null',
        items: uses.map(entry => ({ label: `#${entry.index}`, text: passDisplayName(entry.pass), cls: 'ref', target: entry.pass }))
    });
    sections.push(general);

    const attachments = makeSection('attachments', 'Attachments');
    if (back) push(attachments, 'color', { text: `swapchain ${formatName(device.backBufferFormat)}`, cls: 'obj' });
    const count = rt.colorBufferCount ?? 0;
    for (let i = 0; i < count; i++) {
        push(attachments, `color ${i}`, describeValue(rt.getColorBuffer(i)));
    }
    if (rt.resolveBuffer) push(attachments, 'resolve buffer', describeValue(rt.resolveBuffer));
    if (rt.depthBuffer) {
        push(attachments, 'depth buffer', describeValue(rt.depthBuffer));
    } else if (rt.depth) {
        push(attachments, 'depth buffer', { text: `internal depth${rt.stencil ? ' + stencil' : ''}`, cls: 'obj' });
    }
    if (rt.depthResolveBuffer) push(attachments, 'depth resolve buffer', describeValue(rt.depthResolveBuffer));
    if (attachments.rows.length) sections.push(attachments);

    const rest = makeSection('props', 'Properties');
    reflectRows(rest, rt, [], SKIP_TARGET);
    if (rest.rows.length) sections.push(rest);

    return sections;
}

/**
 * A texture of a render target that the preview can sample.
 *
 * @typedef {object} PreviewAttachment
 * @property {string} key - 'color0', 'color1' and so on, or 'depth'.
 * @property {string} label - The label shown in the attachment selector.
 * @property {Texture} texture - The texture to sample.
 * @ignore
 */

/**
 * The textures of a render target a preview can sample: each color attachment, using the resolve
 * texture of the first when the target keeps explicit multisampled color buffers, and the depth
 * buffer when it is a texture. The backbuffer has none: it is the screen itself.
 *
 * @param {RenderTarget} rt - The render target.
 * @param {GraphicsDevice} device - The device.
 * @returns {PreviewAttachment[]} The attachments, in selector order.
 */
function previewAttachments(rt, device) {
    /** @type {PreviewAttachment[]} */
    const attachments = [];
    if (rt === device.backBuffer) return attachments;

    const count = rt.colorBufferCount ?? 0;
    for (let i = 0; i < count; i++) {
        const texture = (i === 0 && rt.resolveBuffer) || rt.getColorBuffer(i);
        if (texture) attachments.push({ key: `color${i}`, label: count > 1 ? `color ${i}` : 'color', texture });
    }
    if (rt.depthBuffer) attachments.push({ key: 'depth', label: 'depth', texture: rt.depthBuffer });
    return attachments;
}

/**
 * @param {number} format - A PIXELFORMAT_* constant.
 * @returns {boolean} Whether it is one of the depth formats, which preview as raw grayscale.
 */
function isDepthFormat(format) {
    return format === PIXELFORMAT_DEPTH || format === PIXELFORMAT_DEPTH16 || format === PIXELFORMAT_DEPTHSTENCIL;
}

/**
 * Mirrors the checks TextureRenderer applies before drawing, so the panel can say why a texture
 * cannot be shown instead of letting the renderer warn once and draw nothing.
 *
 * @param {Texture|null} texture - The texture.
 * @param {GraphicsDevice} device - The device.
 * @returns {{ ok: boolean, reason: string }} Whether it can be previewed, and if not, why.
 */
function previewSupport(texture, device) {
    if (!texture) return { ok: false, reason: 'no texture to sample' };
    if (texture.cubemap) return { ok: false, reason: 'cube textures cannot be previewed' };
    if (texture.volume) return { ok: false, reason: 'volume textures cannot be previewed' };
    if (texture.arrayLength) return { ok: false, reason: 'texture arrays cannot be previewed' };
    if (texture.samples > 1) return { ok: false, reason: 'multisampled textures cannot be previewed' };

    const format = texture.format;
    if (isIntegerPixelFormat(format)) return { ok: false, reason: 'integer formats cannot be previewed' };

    const depth = isDepthFormat(format);
    if (depth && device.isWebGL2 && texture.compareOnRead) {
        return { ok: false, reason: 'comparison depth textures cannot be previewed on WebGL2' };
    }

    const unfilterable = !device.textureFloatFilterable &&
        (format === PIXELFORMAT_R32F || format === PIXELFORMAT_RG32F || format === PIXELFORMAT_RGB32F || format === PIXELFORMAT_RGBA32F);
    if (device.isWebGL2 && (depth || unfilterable)) {
        const minFilter = texture.minFilter;
        const nearestMin = minFilter === FILTER_NEAREST || minFilter === FILTER_NEAREST_MIPMAP_NEAREST ||
            (!texture.mipmaps && minFilter === FILTER_NEAREST_MIPMAP_LINEAR);
        if (!nearestMin || texture.magFilter !== FILTER_NEAREST) {
            return { ok: false, reason: `${depth ? 'depth' : 'float'} textures need nearest filtering to preview on WebGL2` };
        }
    }

    return { ok: true, reason: '' };
}

/**
 * The r, g, b and a channels an uncompressed color format stores, read from its name: R8 stores
 * 'r', RG16F 'rg', SRGB8 'rgb', BGRA8 and RGB10A2 'rgba'. Sampling a channel the format lacks
 * returns a constant (0, or 1 for alpha), so a preview of it shows nothing. Empty when the name
 * carries no channel letters: depth, the packed 111110F and compressed formats.
 *
 * @param {number} format - A PIXELFORMAT_* constant.
 * @returns {string} The stored channels as lower-case letters from 'rgba', or ''.
 */
function formatChannels(format) {
    const name = pixelFormatInfo.get(format)?.name ?? '';
    const match = /^S?([RGBA]+)(?:\d+(A)\d)?/.exec(name);
    if (!match) return '';
    const letters = (match[1] + (match[2] ?? '')).toLowerCase();
    return [...'rgba'].filter(letter => letters.includes(letter)).join('');
}

export { buildRenderTargetModel, formatChannels, isDepthFormat, previewAttachments, previewSupport, renderTargetRows };
