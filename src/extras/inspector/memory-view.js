import {
    BUFFER_DYNAMIC, BUFFER_GPUDYNAMIC, BUFFER_STATIC, BUFFER_STREAM,
    INDEXFORMAT_UINT8, INDEXFORMAT_UINT16, INDEXFORMAT_UINT32
} from '../../platform/graphics/constants.js';
import { IndexBuffer } from '../../platform/graphics/index-buffer.js';
import { StorageBuffer } from '../../platform/graphics/storage-buffer.js';
import { UniformBuffer } from '../../platform/graphics/uniform-buffer.js';
import { VertexBuffer } from '../../platform/graphics/vertex-buffer.js';

import { describeValue } from './describe.js';
import { formatBytes, makeSection, push, read, reflectRows } from './model.js';
import { vertexFormatValue } from './node-model.js';
import { formatUniformBuffer } from './shader-view.js';

/** @import { AppBase } from '../../framework/app-base.js' */
/** @import { Asset } from '../../framework/asset/asset.js' */
/** @import { GraphicsDevice } from '../../platform/graphics/graphics-device.js' */
/** @import { GraphNode } from '../../scene/graph-node.js' */
/** @import { Described } from './describe.js' */
/** @import { ListRow } from './list-view.js' */
/** @import { PropertySection } from './model.js' */

/**
 * @typedef {VertexBuffer|IndexBuffer|UniformBuffer|StorageBuffer} Buffer
 * @ignore
 */

/**
 * Something a buffer was found to belong to.
 *
 * @typedef {object} BufferOwner
 * @property {string} role - What the buffer holds for it, such as 'vertices'.
 * @property {string} label - The owner's name.
 * @property {GraphNode|Asset|null} target - What to link to, or null when there is nothing to show.
 * @ignore
 */

// buffer properties the model shows explicitly, or that are plumbing
const SKIP_BUFFER = [
    'device', 'impl', 'storage', 'format', 'numBytes', 'numVertices', 'numIndices', 'byteSize', 'usage', 'persistent',
    'id', 'allocation', 'vaoKeyPart'
];

/** What the list can be narrowed to, as selector options. */
const BUFFER_KINDS = [
    ['all', 'all'], ['vertex', 'vertex'], ['index', 'index'], ['uniform', 'uniform'], ['storage', 'storage']
];

const KIND_NAMES = { vertex: 'VertexBuffer', index: 'IndexBuffer', uniform: 'UniformBuffer', storage: 'StorageBuffer' };

const USAGE_NAMES = {
    [BUFFER_STATIC]: 'BUFFER_STATIC',
    [BUFFER_DYNAMIC]: 'BUFFER_DYNAMIC',
    [BUFFER_STREAM]: 'BUFFER_STREAM',
    [BUFFER_GPUDYNAMIC]: 'BUFFER_GPUDYNAMIC'
};

// what each index buffer of a mesh holds, by render style: triangles, then the lazily built edges
// and points
const INDEX_ROLES = ['indices', 'wireframe indices', 'point indices'];

const INDEX_FORMAT_NAMES = {
    [INDEXFORMAT_UINT8]: 'UINT8',
    [INDEXFORMAT_UINT16]: 'UINT16',
    [INDEXFORMAT_UINT32]: 'UINT32'
};

/** @type {WeakMap<object, number>} */
const ids = new WeakMap();
let nextId = 1;

/**
 * @param {Buffer} buffer - A buffer.
 * @returns {number} An id that stays the same for the lifetime of the buffer, since buffers carry
 * no name of their own.
 */
function idOf(buffer) {
    let id = ids.get(buffer);
    if (id === undefined) {
        id = nextId++;
        ids.set(buffer, id);
    }
    return id;
}

/**
 * @param {*} buffer - A buffer.
 * @returns {'vertex'|'index'|'uniform'|'storage'|null} Its kind, or null for anything else.
 */
function bufferKind(buffer) {
    if (buffer instanceof VertexBuffer) return 'vertex';
    if (buffer instanceof IndexBuffer) return 'index';
    if (buffer instanceof UniformBuffer) return 'uniform';
    if (buffer instanceof StorageBuffer) return 'storage';
    return null;
}

/**
 * @param {Buffer} buffer - A buffer.
 * @returns {number} Its size in bytes.
 */
function bufferBytes(buffer) {
    const b = /** @type {any} */ (buffer);
    return b.numBytes ?? b.byteSize ?? b.format?.byteSize ?? 0;
}

/**
 * @param {Buffer} buffer - A buffer.
 * @returns {string} What it holds, in a few words.
 */
function contentText(buffer) {
    const b = /** @type {any} */ (buffer);
    switch (bufferKind(buffer)) {
        case 'vertex':
            return `${b.numVertices} vertices, ${b.format?.elements?.length ?? 0} elements${b.format?.instancing ? ', instancing' : ''}`;
        case 'index':
            return `${b.numIndices} indices, ${INDEX_FORMAT_NAMES[b.format] ?? b.format}`;
        case 'uniform':
            return `${b.format?.uniforms?.length ?? 0} uniforms`;
        default:
            return 'storage';
    }
}

/**
 * @param {GraphNode|null} node - The node a mesh instance draws at.
 * @returns {string} Its name, after its parent's when it has one below the root: imported models
 * often give every mesh node the same name, and the parent tells them apart.
 */
function nodeLabel(node) {
    if (!node) return '(no node)';
    const parent = node.parent;
    return parent?.parent ? `${parent.name} › ${node.name}` : node.name;
}

/**
 * Finds what the buffers on the device belong to. No buffer records its owner, so the owners are
 * found from the other end: every mesh instance in the layer composition gives its mesh's
 * geometry and its material's uniforms, the immediate renderer gives the batches of debug lines,
 * loaded render assets give the geometry of meshes not drawn right now, and the device gives its
 * own quad. Storage buffers and the per-draw uniform pool are
 * held privately by their users and stay unattributed.
 *
 * @param {AppBase} app - The app.
 * @returns {Map<Buffer, BufferOwner[]>} The owners of each attributed buffer.
 */
function bufferOwners(app) {
    /** @type {Map<Buffer, BufferOwner[]>} */
    const owners = new Map();
    const add = (buffer, owner) => {
        if (!buffer) return;
        let list = owners.get(buffer);
        if (!list) {
            list = [];
            owners.set(buffer, list);
        }
        list.push(owner);
    };

    // a mesh instance is listed by every layer it renders in, so count it once
    const seen = new Set();
    for (const layer of app.scene?.layers?.layerList ?? []) {
        for (const instance of layer.meshInstances ?? []) {
            if (seen.has(instance)) continue;
            seen.add(instance);
            const node = instance.node ?? null;
            const label = nodeLabel(node);
            const mesh = instance.mesh;
            if (mesh) {
                add(mesh.vertexBuffer, { role: 'vertices', label, target: node });
                mesh.indexBuffer?.forEach((indexBuffer, style) => {
                    add(indexBuffer, { role: INDEX_ROLES[style] ?? 'indices', label, target: node });
                });
                add(mesh.morph?.vertexBufferIds, { role: 'morph target ids', label, target: node });
            }
            add(/** @type {any} */ (instance)._materialUniformBuffer, { role: 'material uniforms of the instance', label, target: node });
            const material = instance.material;
            add(/** @type {any} */ (material)?._uniformBuffer, { role: `uniforms of material "${material?.name}"`, label, target: node });
        }
    }

    // debug lines are pushed straight into the visible list each frame rather than added to a
    // layer, so their batches are found through the immediate renderer that owns them
    for (const [layer, batches] of app.scene?.immediate?.batchesMap ?? []) {
        for (const batch of batches.map?.values() ?? []) {
            add(batch.mesh?.vertexBuffer, { role: 'debug lines', label: `Lines on "${layer.name}"`, target: null });
        }
    }

    for (const asset of app.assets?.list() ?? []) {
        if (asset.type !== 'render' || !asset.loaded) continue;
        const label = `Asset "${asset.name}"`;
        for (const mesh of asset.resource?.meshes ?? []) {
            add(mesh?.vertexBuffer, { role: 'vertices', label, target: asset });
            mesh?.indexBuffer?.forEach((indexBuffer, style) => {
                add(indexBuffer, { role: INDEX_ROLES[style] ?? 'indices', label, target: asset });
            });
        }
    }

    // the quad every full screen pass draws
    const device = /** @type {any} */ (app.graphicsDevice);
    add(device?.quadVertexBuffer, { role: 'full screen quad vertices', label: 'Graphics device', target: null });
    add(device?.quadIndexBuffer, { role: 'full screen quad indices', label: 'Graphics device', target: null });
    return owners;
}

/**
 * Every buffer the device tracks, largest first. Uniform buffers appear only when persistent, as
 * the rest are slices of the per-frame pool.
 *
 * @param {GraphicsDevice} device - The device.
 * @param {string} [kind] - One of {@link BUFFER_KINDS}.
 * @returns {Buffer[]} The buffers.
 */
function collectBuffers(device, kind = 'all') {
    const buffers = [...(device.buffers ?? [])].filter(buffer => bufferKind(buffer) && (kind === 'all' || bufferKind(buffer) === kind));
    return buffers.sort((a, b) => bufferBytes(b) - bufferBytes(a) || idOf(a) - idOf(b));
}

/**
 * @param {Buffer} buffer - A buffer.
 * @param {BufferOwner[]|undefined} owners - What it belongs to.
 * @returns {string} A name for it, from its first owner, since buffers carry none of their own.
 */
function bufferName(buffer, owners) {
    if (!owners?.length) return `${KIND_NAMES[bufferKind(buffer)]} #${idOf(buffer)}`;
    return owners[0].label;
}

/**
 * One row per buffer, largest first, named after what uses it and dimmed when nothing was found.
 *
 * @param {GraphicsDevice} device - The device.
 * @param {Map<Buffer, BufferOwner[]>} owners - The owners of each buffer.
 * @param {string} kind - The kind to list, or 'all'.
 * @returns {ListRow[]} The rows.
 */
function bufferRows(device, owners, kind) {
    return collectBuffers(device, kind).map((buffer) => {
        const users = owners.get(buffer);
        const name = bufferName(buffer, users);
        const cells = [{ text: name, cls: 'pci-cell-name' }];
        cells.push({ text: bufferKind(buffer), cls: 'pci-cell-tag pci-cell-tag-info' });
        const extra = users && users.length > 1 ? `, ${users.length} users` : '';
        cells.push({ text: `${contentText(buffer)}${users ? ` · ${users[0].role}` : ''}${extra}`, cls: 'pci-cell-info' });
        cells.push({ text: formatBytes(bufferBytes(buffer)), cls: 'pci-cell-info pci-cell-right' });
        const title = `${KIND_NAMES[bufferKind(buffer)]} #${idOf(buffer)}\n${contentText(buffer)}, ${formatBytes(bufferBytes(buffer))}` +
            `${users ? `\n${users[0].role} of ${users[0].label}${extra}` : '\nowner not found'}`;
        return { key: `buffer${idOf(buffer)}`, item: buffer, name, dim: !users, title, cells };
    });
}

/**
 * The totals shown above the list: video memory by kind of resource, the per-frame uniform pool,
 * and the counts of the device caches that grow with the variety of what is drawn.
 *
 * @param {GraphicsDevice} device - The device.
 * @returns {string} The totals, one line per group.
 */
function memorySummary(device) {
    const vram = /** @type {any} */ (device)._vram ?? {};
    const lines = [];
    lines.push(`VRAM: textures ${formatBytes(vram.tex ?? 0)} · vertex ${formatBytes(vram.vb ?? 0)} · index ${formatBytes(vram.ib ?? 0)}` +
        ` · uniform ${formatBytes(vram.ub ?? 0)} · storage ${formatBytes(vram.sb ?? 0)}`);
    // the texture split is only tracked by profiler builds
    if (vram.texShadow || vram.texAsset || vram.texLightmap) {
        lines.push(`textures: assets ${formatBytes(vram.texAsset ?? 0)} · shadow maps ${formatBytes(vram.texShadow ?? 0)} · lightmaps ${formatBytes(vram.texLightmap ?? 0)}`);
    }

    // WebGPU carves draws out of large fixed blocks; WebGL2 keeps whole buffers of each size
    // requested, so only the count says anything there
    const pool = /** @type {any} */ (device).dynamicBuffers;
    if (pool?.bufferCount) {
        lines.push(pool.bufferSize ?
            `per-draw uniform pool: ${pool.bufferCount} × ${formatBytes(pool.bufferSize)}` :
            `per-draw uniform pool: ${pool.bufferCount} buffers`);
    }

    const counts = new Map();
    /** @type {any} */ (device).getResourceCounts?.(counts);
    const names = [['renderPipelines', 'render pipelines'], ['computePipelines', 'compute pipelines'], ['bindGroups', 'bind groups'],
        ['bindGroupFormats', 'bind group formats'], ['drawCommands', 'draw commands'], ['shaders', 'shaders']];
    const parts = names.filter(([key]) => counts.has(key)).map(([key, label]) => `${label} ${counts.get(key)}`);
    if (parts.length) lines.push(parts.join(' · '));

    return lines.join('\n');
}

/**
 * Everything the property view shows for a buffer: its size and layout, what it was found to
 * belong to (linked), and every other public property.
 *
 * @param {Buffer} buffer - The buffer.
 * @param {{ app: AppBase }} ctx - The app, to find the buffer's owners.
 * @returns {PropertySection[]} The sections.
 */
function buildBufferModel(buffer, ctx) {
    const sections = [];
    const b = /** @type {any} */ (buffer);
    const kind = bufferKind(buffer);

    const general = makeSection('buffer', KIND_NAMES[kind] ?? 'Buffer');
    push(general, 'id', describeValue(idOf(buffer)));
    push(general, 'size', { text: formatBytes(bufferBytes(buffer)), cls: 'num' });
    if (kind === 'vertex') {
        push(general, 'vertices', describeValue(b.numVertices));
        if (b.format) push(general, 'vertex format', vertexFormatValue(b.format));
    } else if (kind === 'index') {
        push(general, 'indices', describeValue(b.numIndices));
        push(general, 'index format', { text: INDEX_FORMAT_NAMES[b.format] ?? String(b.format), cls: 'obj' });
    } else if (kind === 'uniform') {
        push(general, 'persistent', read(b, 'persistent'));
        if (b.format) {
            push(general, 'layout', { text: `${b.format.uniforms.length} uniforms`, cls: 'num', code: formatUniformBuffer(b.format) });
        }
    }
    if (b.usage !== undefined) push(general, 'usage', { text: USAGE_NAMES[b.usage] ?? String(b.usage), cls: 'obj' });
    sections.push(general);

    const owners = bufferOwners(ctx.app).get(buffer) ?? [];
    const usage = makeSection('users', 'Used by');
    push(usage, 'owners', {
        text: owners.length ? `${owners.length} user${owners.length === 1 ? '' : 's'}` :
            'not found: held by something the panel cannot reach, such as a storage buffer',
        cls: owners.length ? 'obj' : 'null',
        items: owners.slice(0, 50).map(owner => ({
            label: owner.role,
            ...(owner.target ? describeValue(owner.target) : { text: owner.label, cls: 'obj' })
        }))
    });
    if (owners.length > 50) usage.rows.push({ key: 'more', label: '', value: { text: `… ${owners.length - 50} more`, cls: 'null' }, depth: 1 });
    sections.push(usage);

    const rest = makeSection('props', 'Properties');
    reflectRows(rest, buffer, [], SKIP_BUFFER);
    if (rest.rows.length) sections.push(rest);

    return sections;
}

export {
    BUFFER_KINDS, bufferBytes, bufferKind, bufferOwners, bufferRows, buildBufferModel, collectBuffers, idOf,
    memorySummary
};
