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

export { buildRenderTargetModel, renderTargetRows };
