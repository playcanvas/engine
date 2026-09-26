import { FramePass } from '../../platform/graphics/frame-pass.js';
import { SHADER_FORWARD } from '../../scene/constants.js';
import { RenderPassForward } from '../../scene/renderer/render-pass-forward.js';

import { describeValue } from './describe.js';
import { nodeLabel } from './memory-view.js';
import { formatName, makeSection, passDisplayName, push, read, reflectRows, renderTargetSummary } from './model.js';
import { meshInstanceRows } from './node-model.js';

/** @import { AppBase } from '../../framework/app-base.js' */
/** @import { GraphicsDevice } from '../../platform/graphics/graphics-device.js' */
/** @import { RenderTarget } from '../../platform/graphics/render-target.js' */
/** @import { Described } from './describe.js' */
/** @import { ListRow } from './list-view.js' */
/** @import { PropertyRow, PropertySection } from './model.js' */
/** @import { MeshInstance } from '../../scene/mesh-instance.js' */

/**
 * One pass of a captured frame.
 *
 * @typedef {object} PassEntry
 * @ignore
 * @property {FramePass} pass - The pass.
 * @property {number} index - The position in execution order.
 * @property {string} key - A key stable across frames for passes that are recreated each frame.
 * @property {number} depth - How many passes own this one, through their before and after passes or
 * as the children of a multi-view pass.
 * @property {FramePass|null} parent - The pass owning this one, if any.
 * @property {number} children - The number of passes this one owns directly.
 * @property {number} views - The XR views the pass is replicated for, or 0 outside multi-view.
 * @property {RenderTarget|null|undefined} renderTarget - The target the pass renders to, with the
 * backbuffer resolved to the device's backbuffer object; undefined for passes that render nothing.
 */

/**
 * The frame graph of one frame, flattened.
 *
 * @typedef {object} FrameSnapshot
 * @ignore
 * @property {PassEntry[]} entries - The passes in execution order.
 * @property {Map<RenderTarget, PassEntry[]>} usage - The passes rendering into each target.
 * @property {Map<string, number>} nameCounts - How many passes share each profiler name.
 * @property {Map<string, number>|null} timings - GPU time per profiler name, when profiling is on.
 * @property {number|undefined} frameTime - The GPU time of the whole frame, when known.
 * @property {Map<object, VisibleList|null>} visible - What each layer step of a forward pass drew,
 * by step, or null when its camera has not culled the layer.
 */

/**
 * The mesh instances a layer step submitted in one frame, in draw order.
 *
 * @typedef {object} VisibleList
 * @ignore
 * @property {MeshInstance[]} instances - The instances, after culling, the transparency split and
 * sorting, including any debug lines the immediate renderer added.
 * @property {number} drawn - How many were actually drawn, leaving out {@link skipped}.
 * @property {Set<MeshInstance>} skipped - Instances the forward renderer passes over: masked out of
 * the step's shader pass, or instanced with no instances and no draw commands.
 * @property {Set<MeshInstance>} debugLines - Instances that are batches of debug lines.
 */

/**
 * The context the pass model needs besides the pass.
 *
 * @typedef {object} PassModelContext
 * @ignore
 * @property {GraphicsDevice} device - The device.
 * @property {FrameSnapshot|null} frame - The captured frame.
 * @property {string|null} [passKey] - The list key of the pass, to keep its pages apart from others.
 * @property {Map<string, number>} [pages] - The page shown for each layer step, kept across refreshes.
 * @property {string} [filter] - A lower-cased filter the listed instances must match by node name.
 * @property {boolean} [stable] - Whether the app is paused or the frame frozen, so pages hold still.
 * @property {DebugFrameContext|null} [debug] - The debug frame, when it is on.
 */

/**
 * What the pass and step models need to show a debug frame: the draw it stops at, and how to
 * choose another.
 *
 * @typedef {object} DebugFrameContext
 * @ignore
 * @property {string|null} stepKey - The list key of the layer step the frame stops in.
 * @property {number} index - The draw it stops at, in that step's list.
 * @property {MeshInstance|null} instance - The instance drawn last.
 * @property {(stepKey: string, index: number, instance: MeshInstance) => void} choose - Makes an
 * instance the last one drawn.
 */

/**
 * What a layer step row of the pass list selects: one step of a forward pass, rather than the pass.
 *
 * @ignore
 */
class LayerStepSelection {
    /**
     * @param {RenderPassForward} pass - The forward pass the step belongs to.
     * @param {*} step - The layer render step.
     * @param {number} index - The step's index within the pass.
     */
    constructor(pass, step, index) {
        this.pass = pass;
        this.step = step;
        this.index = index;
    }
}

/** How many mesh instances a page of a layer step shows. */
const INSTANCES_PER_PAGE = 200;

/** @type {WeakMap<object, number>} */
const instanceIds = new WeakMap();
let nextInstanceId = 1;

/**
 * @param {MeshInstance} instance - A mesh instance.
 * @returns {number} An id that stays the same for the lifetime of the instance, so an instance
 * opened in the list stays open when the draw order changes.
 */
function instanceId(instance) {
    let id = instanceIds.get(instance);
    if (id === undefined) {
        id = nextInstanceId++;
        instanceIds.set(instance, id);
    }
    return id;
}

/**
 * Reads what a layer step drew in the last frame. The culler fills each layer's list per camera and
 * sub-layer, the forward renderer sorts it in place and adds debug lines to it, and it is only
 * cleared when the next frame culls again, so between frames it holds exactly what was submitted.
 * The layer's store is read directly: its accessor creates an empty entry for a camera it has not
 * seen, which would change the engine's state.
 *
 * @param {*} step - A layer render step of a forward pass.
 * @param {Set<MeshInstance>} debugLines - The mesh instances of the immediate renderer's batches.
 * @returns {VisibleList|null} What it drew, or null when its camera has not culled the layer.
 */
function captureVisible(step, debugLines) {
    const camera = step.cameraComponent?.camera;
    const culled = camera ? step.layer?._visibleInstances?.get(camera) : undefined;
    if (!culled) return null;
    const list = step.transparent ? culled.transparent : culled.opaque;

    // the checks the forward renderer makes before drawing. A mask that the owner toggles during
    // the frame, as the texture preview quads do, reads as it was left afterwards
    const pass = camera.shaderPassInfo?.index ?? SHADER_FORWARD;
    const skipped = new Set();
    for (const instance of list) {
        if ((instance.shaderPassMask & (1 << pass)) === 0) {
            skipped.add(instance);
        } else if (instance.instancingData && instance.instancingData.count <= 0 && !instance.getDrawCommands?.(camera)) {
            skipped.add(instance);
        }
    }

    return { instances: list.slice(), drawn: list.length - skipped.size, skipped, debugLines };
}

/**
 * @param {MeshInstance} instance - A mesh instance drawn by a layer step.
 * @param {VisibleList} list - The list it was drawn from.
 * @returns {string} The name to show and filter it by.
 */
function instanceName(instance, list) {
    return list.debugLines.has(instance) ? 'debug lines' : nodeLabel(instance.node ?? null);
}

/**
 * @param {VisibleList|null} list - What a layer step drew.
 * @param {string} filter - A lower-cased filter.
 * @returns {boolean} Whether any instance it drew matches the filter by name.
 */
function drewMatching(list, filter) {
    return !!list?.instances.some(instance => instanceName(instance, list).toLowerCase().includes(filter));
}

/**
 * @param {VisibleList|null} list - What a layer step drew.
 * @param {*} layer - The step's layer.
 * @returns {string} How many meshes it drew, out of how many the layer holds.
 */
function drawnText(list, layer) {
    const total = layer.meshInstances.length;
    return list ? `${list.drawn} of ${total} meshes` : `${total} meshes, not culled for this camera`;
}

/**
 * One page of what a layer step drew, in draw order, each instance opening into its own rows. Long
 * lists page rather than show everything, since every shown row is re-read on each refresh. The
 * filter narrows the list by node name before paging.
 *
 * @param {VisibleList} list - What the step drew.
 * @param {string} key - Identifies the step across refreshes, to remember its page.
 * @param {PassModelContext} ctx - The pages, the filter and whether the frame holds still.
 * @returns {PropertyRow[]} The rows.
 */
function instancePage(list, key, ctx) {
    const filter = ctx.filter ?? '';
    const pages = ctx.pages ?? new Map();
    const matching = [];
    list.instances.forEach((instance, index) => {
        if (!filter || instanceName(instance, list).toLowerCase().includes(filter)) matching.push(index);
    });

    const count = Math.max(1, Math.ceil(matching.length / INSTANCES_PER_PAGE));
    const page = Math.min(pages.get(key) ?? 0, count - 1);
    pages.set(key, page);
    const start = page * INSTANCES_PER_PAGE;
    const shown = matching.slice(start, start + INSTANCES_PER_PAGE);

    const rows = [];
    if (matching.length > INSTANCES_PER_PAGE || filter) {
        rows.push({
            key: 'pager',
            label: 'showing',
            value: {
                text: `${matching.length ? `${start + 1}–${start + shown.length}` : 'none'} of ${matching.length}` +
                    `${filter ? ` matching "${filter}"` : ''}${ctx.stable ? '' : ' · live: pause or freeze to page steadily'}`,
                cls: 'num',
                actions: [
                    { text: '‹', title: 'Previous page', disabled: page === 0, run: () => pages.set(key, page - 1) },
                    { text: '›', title: 'Next page', disabled: page >= count - 1, run: () => pages.set(key, page + 1) }
                ]
            }
        });
    }

    for (const index of shown) {
        const instance = list.instances[index];
        const skipped = list.skipped.has(instance);
        const material = instance.material ? `material "${instance.material.name}"` : 'no material';
        // in a debug frame an instance is a choice of where the frame stops, and opens from its caret
        const debug = ctx.debug ?? null;
        rows.push({
            key: `mi${instanceId(instance)}`,
            label: `${index}`,
            group: true,
            value: {
                text: `${instanceName(instance, list)} · ${material} · ${instance.mesh?.vertexBuffer?.numVertices ?? 0} verts` +
                    `${skipped ? ' · not drawn in this pass' : ''}`,
                cls: skipped ? 'null' : 'obj',
                expand: () => meshInstanceRows(instance),
                select: debug ? () => debug.choose(key, index, instance) : undefined,
                active: !!debug && debug.stepKey === key && debug.instance === instance
            }
        });
    }
    if (!matching.length && !filter) {
        rows.push({ key: 'none', label: '', value: { text: 'nothing drawn', cls: 'null' } });
    }
    return rows;
}

// pass properties the model shows explicitly, or that are plumbing
const SKIP_PASS = [
    'name', 'enabled', 'executeEnabled', 'requiresCubemaps', 'device', 'renderTarget', 'colorOps',
    'colorArrayOps', 'depthStencilOps', 'beforePasses', 'afterPasses', 'children', 'samples',
    'scaleX', 'scaleY', 'options', 'fullSizeClearRect', 'layerRenderSteps', 'renderer', 'scene',
    'shadowRenderer'
];

/**
 * Mirrors how the GPU profiler keys its per-pass timings.
 *
 * @param {FramePass} pass - The pass.
 * @returns {string} The profiler name.
 */
function profilerName(pass) {
    const name = pass.name;
    return name.startsWith('RenderPass') ? name.slice(10) : name;
}

/**
 * @param {object} ops - Color attachment ops.
 * @returns {string} Load and store actions in the trace's notation.
 */
function colorOpsText(ops) {
    return `${ops.clear ? 'clear' : 'load'}→${ops.store ? 'store' : 'discard'}` +
        `${ops.resolve ? ' resolve' : ''}${ops.genMipmaps ? ' mipmaps' : ''}`;
}

/**
 * @param {object} ops - Depth-stencil ops.
 * @returns {string} Depth load and store actions.
 */
function depthOpsText(ops) {
    return `${ops.clearDepth ? 'clear' : 'load'}→${ops.storeDepth ? 'store' : 'discard'}${ops.resolveDepth ? ' resolve' : ''}`;
}

/**
 * @param {object} ops - Depth-stencil ops.
 * @returns {string} Stencil load and store actions.
 */
function stencilOpsText(ops) {
    return `${ops.clearStencil ? 'clear' : 'load'}→${ops.storeStencil ? 'store' : 'discard'}`;
}

/**
 * @param {FramePass} pass - The pass.
 * @param {RenderTarget} rt - Its resolved target.
 * @param {GraphicsDevice} device - The device.
 * @returns {number} The number of color attachments the pass writes.
 */
function colorCount(pass, rt, device) {
    const attachments = rt === device.backBuffer ? 1 : (rt.colorBufferCount ?? 0);
    return Math.min(attachments, pass.colorArrayOps?.length ?? 0);
}

/**
 * @param {RenderTarget} rt - A target.
 * @param {number} index - A color attachment index.
 * @param {GraphicsDevice} device - The device.
 * @returns {number|undefined} The attachment's pixel format.
 */
function colorFormat(rt, index, device) {
    return rt === device.backBuffer ? device.backBufferFormat : rt.getColorBuffer?.(index)?.format;
}

/**
 * Walks the frame graph the app rendered last and flattens it into execution order, the same
 * order the render pass trace prints. Wrapper passes are recognized through their before, after and
 * multi-view child lists so their members can be indented.
 *
 * @param {AppBase} app - The app.
 * @returns {FrameSnapshot} The snapshot.
 */
function captureFrameGraph(app) {
    const device = app.graphicsDevice;
    const passes = app.frameGraph?.renderPasses ?? [];

    /** @type {Map<FramePass, FramePass>} */
    const parentOf = new Map();
    const mark = (pass) => {
        const children = [...pass.beforePasses, ...pass.afterPasses, ...(Array.isArray(pass.children) ? pass.children : [])];
        for (const child of children) {
            parentOf.set(child, pass);
            mark(child);
        }
    };
    passes.forEach(mark);

    /** @type {PassEntry[]} */
    const entries = [];
    const usage = new Map();
    const nameCounts = new Map();
    const childCounts = new Map();
    const views = device.xrSubImages?.length ?? 0;

    const add = (pass, inMultiView) => {
        let depth = 0;
        for (let p = parentOf.get(pass); p; p = parentOf.get(p)) depth++;

        const parent = parentOf.get(pass) ?? null;
        if (parent) childCounts.set(parent, (childCounts.get(parent) ?? 0) + 1);

        const raw = pass.renderTarget;
        const renderTarget = raw === undefined ? undefined : (raw ?? device.backBuffer ?? null);

        const index = entries.length;
        const entry = { pass, index, key: `${index}:${pass.name}`, depth, parent, children: 0, views: inMultiView ? views : 0, renderTarget };
        entries.push(entry);

        if (renderTarget) {
            let list = usage.get(renderTarget);
            if (!list) usage.set(renderTarget, list = []);
            list.push(entry);
        }

        const name = profilerName(pass);
        nameCounts.set(name, (nameCounts.get(name) ?? 0) + 1);
    };

    for (const pass of passes) {
        add(pass, false);
        if (Array.isArray(pass.children)) {
            for (const child of pass.children) add(child, true);
        }
    }
    for (const entry of entries) {
        entry.children = childCounts.get(entry.pass) ?? 0;
    }

    // what each forward pass layer step drew, copied now so a frozen frame keeps its own lists
    const debugLines = new Set();
    for (const batches of app.scene?.immediate?.batchesMap?.values() ?? []) {
        for (const batch of batches.map?.values() ?? []) {
            if (batch.meshInstance) debugLines.add(batch.meshInstance);
        }
    }
    const visible = new Map();
    for (const entry of entries) {
        if (!(entry.pass instanceof RenderPassForward)) continue;
        for (const step of entry.pass.layerRenderSteps) {
            visible.set(step, captureVisible(step, debugLines));
        }
    }

    const profiler = device.gpuProfiler;
    return {
        entries,
        usage,
        nameCounts,
        timings: profiler?.enabled ? profiler.passTimings : null,
        frameTime: profiler?.frameTime,
        visible
    };
}

/**
 * The text the render pass trace would print for a pass, used as the row tooltip.
 *
 * @param {PassEntry} entry - The pass entry.
 * @param {GraphicsDevice} device - The device.
 * @returns {string} The multi-line text.
 */
function passTitle(entry, device) {
    const { pass, index, renderTarget: rt } = entry;
    const lines = [`${pass._skipStart ? '++' : index}: ${pass.name}${pass.executeEnabled ? '' : ' DISABLED'}`];

    if (rt) {
        lines.push(`RT: ${renderTargetSummary(rt, device)}`);
        const count = colorCount(pass, rt, device);
        for (let i = 0; i < count; i++) {
            const ops = pass.colorArrayOps[i];
            lines.push(`color[${i}]: ${colorOpsText(ops)} [${formatName(colorFormat(rt, i, device))}]` +
                `${ops.clear ? ` clear ${ops.clearValue?.toString?.(true, true) ?? ''}` : ''}`);
        }
        const ds = pass.depthStencilOps;
        if (ds && rt.depth) {
            lines.push(`depth: ${depthOpsText(ds)}${rt.depthBuffer ? ` [${formatName(rt.depthBuffer.format)}]` : ''}` +
                `${ds.clearDepth ? ` clear ${ds.clearDepthValue}` : ''}`);
        }
        if (ds && rt.stencil) {
            lines.push(`stencil: ${stencilOpsText(ds)}${ds.clearStencil ? ` clear ${ds.clearStencilValue}` : ''}`);
        }
    }

    return lines.join('\n');
}

/**
 * Turns a snapshot into list rows: one per pass, plus one per layer step of a forward pass and one
 * naming the light of a shadow pass. Render target cells link to the target, camera and light
 * cells link to their entities.
 *
 * @param {FrameSnapshot} frame - The snapshot.
 * @param {GraphicsDevice} device - The device.
 * @returns {ListRow[]} The rows.
 */
function passRows(frame, device) {
    /** @type {ListRow[]} */
    const rows = [];
    // for the brackets: the entry each row belongs to, and the row of each entry's pass
    const rowEntries = [];
    const passRowOf = [];

    for (const entry of frame.entries) {
        const { pass, index, renderTarget } = entry;
        const name = passDisplayName(pass);
        const merged = pass._skipStart;

        const cells = [
            { text: merged ? `${index}+` : String(index), cls: 'pci-cell-index', title: merged ? 'Merged into the previous pass: same render target, nothing cleared' : '' },
            { text: name, cls: 'pci-cell-name' }
        ];
        if (!pass.executeEnabled) cells.push({ text: 'DISABLED', cls: 'pci-cell-tag' });
        if (entry.views > 1) cells.push({ text: `×${entry.views} views`, cls: 'pci-cell-tag pci-cell-tag-info' });
        if (renderTarget) {
            cells.push({ text: renderTargetSummary(renderTarget, device), cls: 'pci-cell-info', target: renderTarget });
        } else if (entry.children) {
            // a pass rendering nothing owns passes only to add them to the frame, and does no work
            const own = pass.execute === FramePass.prototype.execute ? ' · no work of its own' : '';
            const verb = Array.isArray(/** @type {any} */ (pass).children) ? 'runs' : 'owns';
            cells.push({ text: `${verb} ${entry.children} pass${entry.children === 1 ? '' : 'es'}${own}`, cls: 'pci-cell-info' });
        }

        const profiler = profilerName(pass);
        const time = frame.timings?.get(profiler);
        if (time !== undefined) {
            const shared = frame.nameCounts.get(profiler) ?? 1;
            cells.push({
                text: `${time.toFixed(2)} ms${shared > 1 ? ' Σ' : ''}`,
                cls: 'pci-cell-time',
                title: shared > 1 ? `GPU time summed over ${shared} passes named ${profiler}` : 'GPU time'
            });
        }

        // a forward pass also matches the filter by the names of what it drew, so a name finds the
        // passes and steps that rendered it
        const steps = pass instanceof RenderPassForward ? pass.layerRenderSteps : [];
        const lists = steps.map(step => frame.visible?.get(step) ?? null);
        const passMatches = steps.length ?
            filter => name.toLowerCase().includes(filter) || lists.some(list => drewMatching(list, filter)) : undefined;
        // hovering the pass previews what it rendered into; the screen needs no preview
        const preview = renderTarget && renderTarget !== device.backBuffer ? renderTarget : undefined;
        passRowOf[index] = rows.length;
        rows.push({ key: entry.key, item: pass, name, matches: passMatches, preview, dim: !pass.executeEnabled, title: passTitle(entry, device), cells });

        steps.forEach((step, i) => {
            const layer = step.layer;
            const enabled = layer.enabled && (pass.layerComposition?.isEnabled(layer, step.transparent) ?? true);
            const camera = step.cameraComponent?.entity;
            const flags = `${step.firstCameraUse ? ' · first' : ''}${step.lastCameraUse ? ' · last' : ''}${enabled ? '' : ' · disabled'}`;
            rows.push({
                key: `${entry.key}/${i}`,
                item: new LayerStepSelection(pass, step, i),
                name,
                matches: filter => name.toLowerCase().includes(filter) || drewMatching(lists[i], filter),
                preview,
                indent: 1,
                dim: !enabled,
                cells: [
                    { text: '', cls: 'pci-cell-index' },
                    { text: camera?.name ?? '-', cls: 'pci-cell-info', target: camera ?? undefined, title: 'Camera' },
                    { text: `· ${layer.name} · ${step.transparent ? 'transparent' : 'opaque'} · ${drawnText(lists[i], layer)}${flags}`, cls: 'pci-cell-info' }
                ]
            });
        });

        const lightNode = /** @type {any} */ (pass).light?._node;
        if (lightNode) {
            rows.push({
                key: `${entry.key}/light`,
                item: pass,
                name,
                preview,
                indent: 1,
                cells: [
                    { text: '', cls: 'pci-cell-index' },
                    { text: 'light', cls: 'pci-cell-info' },
                    { text: lightNode.name, cls: 'pci-cell-info', target: lightNode }
                ]
            });
        }
    }

    // every row after an entry's pass row, up to the next one, belongs to that entry
    let current = -1;
    for (let row = 0; row < rows.length; row++) {
        if (passRowOf[current + 1] === row) current++;
        rowEntries.push(current);
    }
    const guides = passGuides(frame, rowEntries, passRowOf);
    if (guides) {
        rows.forEach((row, i) => {
            row.guides = guides[i];
        });
    }

    return rows;
}

/**
 * The brackets of the pass list. The passes a pass owns, its before and after passes and the
 * children of a multi-view pass, are added to the frame right around it, so a pass and everything
 * it owns always fill a run of consecutive rows. Each owner brackets that run in the lane of its
 * own depth, and ticks its own row, which sits below its before passes and above its after passes.
 * The rows themselves are not indented: the frame executes them one after the other.
 *
 * @param {FrameSnapshot} frame - The frame.
 * @param {number[]} rowEntries - The index of the entry each row belongs to, in row order.
 * @param {number[]} passRowOf - The row of each entry's own pass row.
 * @returns {import('./list-view.js').ListGuides[]|null} The brackets of each row, or null when no
 * pass owns another.
 */
function passGuides(frame, rowEntries, passRowOf) {
    const { entries } = frame;
    const lanes = entries.reduce((count, entry) => (entry.children ? Math.max(count, entry.depth + 1) : count), 0);
    if (!lanes) return null;

    // the first and last entry each owner spans, over everything it owns, however deep
    const entryOf = new Map(entries.map(entry => [entry.pass, entry]));
    const first = new Map();
    const last = new Map();
    for (const entry of entries) {
        for (let owner = entryOf.get(entry.parent); owner; owner = entryOf.get(owner.parent)) {
            first.set(owner, Math.min(first.get(owner) ?? owner.index, entry.index));
            last.set(owner, Math.max(last.get(owner) ?? owner.index, entry.index));
        }
    }

    // the rows of an entry run from its pass row to the row before the next entry's pass row
    const lastRowOf = (index) => {
        let row = passRowOf[index];
        while (row + 1 < rowEntries.length && rowEntries[row + 1] === index) row++;
        return row;
    };

    const guides = rowEntries.map(() => ({ lanes, segments: new Array(lanes).fill(null), tick: -1 }));
    for (const [owner, start] of first) {
        const top = passRowOf[Math.min(start, owner.index)];
        const bottom = lastRowOf(Math.max(last.get(owner), owner.index));
        for (let row = top; row <= bottom; row++) {
            guides[row].segments[owner.depth] = row === top ? 'start' : row === bottom ? 'end' : 'mid';
        }
        guides[passRowOf[owner.index]].tick = owner.depth;
    }
    return guides;
}

/**
 * @param {FramePass[]} passes - Passes.
 * @returns {Described} A count that expands into one linked row per pass.
 */
function passList(passes) {
    return {
        text: `${passes.length} pass${passes.length === 1 ? '' : 'es'}`,
        cls: 'obj',
        items: passes.map((pass, i) => ({ label: `[${i}]`, text: passDisplayName(pass), cls: 'ref', target: pass }))
    };
}

/**
 * Everything the property view shows for a pass: identity and structure, the render target and
 * its attachment ops as the trace prints them, the layer steps of a forward pass, and every other
 * public property the pass class exposes.
 *
 * @param {FramePass} pass - The pass.
 * @param {PassModelContext} ctx - The device, the frame the pass was captured in, and the paging
 * state of its layer steps.
 * @returns {PropertySection[]} The sections.
 */
function buildPassModel(pass, ctx) {
    const { device, frame } = ctx;
    const entry = frame?.entries.find(e => e.pass === pass);
    const sections = [];

    const general = makeSection('pass', passDisplayName(pass));
    push(general, 'name', describeValue(pass.name));
    push(general, 'class', describeValue(pass.constructor.name));
    if (entry) push(general, 'index', describeValue(entry.index));
    push(general, 'enabled', read(pass, 'enabled'));
    push(general, 'execute enabled', read(pass, 'executeEnabled'));
    if (pass._skipStart) push(general, 'merged with previous', describeValue(true));
    if (pass._skipEnd) push(general, 'merged with next', describeValue(true));
    if (entry?.parent) {
        const runs = Array.isArray(/** @type {any} */ (entry.parent).children) && /** @type {any} */ (entry.parent).children.includes(pass);
        push(general, runs ? 'run by' : 'owned by', { text: passDisplayName(entry.parent), cls: 'ref', target: entry.parent });
    }
    if (pass.beforePasses.length) push(general, 'before passes', passList(pass.beforePasses));
    if (pass.afterPasses.length) push(general, 'after passes', passList(pass.afterPasses));
    const children = /** @type {any} */ (pass).children;
    if (Array.isArray(children) && children.length) push(general, 'per-view passes', passList(children));
    push(general, 'requires cubemaps', read(pass, 'requiresCubemaps'));
    sections.push(general);

    const rt = entry ? entry.renderTarget : (pass.renderTarget === undefined ? undefined : (pass.renderTarget ?? device.backBuffer));
    if (rt !== undefined) {
        const target = makeSection('target', 'Render target');
        push(target, 'target', rt ? { text: renderTargetSummary(rt, device), cls: 'ref', target: rt } : { text: 'Backbuffer', cls: 'obj' });
        push(target, 'samples', read(pass, 'samples'));
        push(target, 'options', read(pass, 'options'));
        push(target, 'full-size clear rect', read(pass, 'fullSizeClearRect'));
        sections.push(target);

        if (rt) {
            const count = colorCount(pass, rt, device);
            for (let i = 0; i < count; i++) {
                const ops = pass.colorArrayOps[i];
                const section = makeSection(`color${i}`, `Color ${i}`);
                push(section, 'ops', { text: colorOpsText(ops), cls: 'obj' });
                push(section, 'format', { text: formatName(colorFormat(rt, i, device)), cls: 'obj' });
                push(section, 'clear', read(ops, 'clear'));
                push(section, 'clear value', read(ops, 'clearValue'));
                push(section, 'store', read(ops, 'store'));
                push(section, 'resolve', read(ops, 'resolve'));
                push(section, 'generate mipmaps', read(ops, 'genMipmaps'));
                sections.push(section);
            }

            const ds = pass.depthStencilOps;
            if (ds && (rt.depth || rt.stencil)) {
                const section = makeSection('depth', 'Depth / stencil');
                if (rt.depthBuffer) push(section, 'format', { text: formatName(rt.depthBuffer.format), cls: 'obj' });
                if (rt.depth) {
                    push(section, 'depth ops', { text: depthOpsText(ds), cls: 'obj' });
                    push(section, 'clear depth value', read(ds, 'clearDepthValue'));
                }
                if (rt.stencil) {
                    push(section, 'stencil ops', { text: stencilOpsText(ds), cls: 'obj' });
                    push(section, 'clear stencil value', read(ds, 'clearStencilValue'));
                }
                sections.push(section);
            }
        }
    }

    if (pass instanceof RenderPassForward) {
        const section = makeSection('steps', 'Layer render steps');
        pass.layerRenderSteps.forEach((step, i) => {
            const layer = step.layer;
            const enabled = layer.enabled && (pass.layerComposition?.isEnabled(layer, step.transparent) ?? true);
            const clears = `${step.clearColor ? 'color ' : ''}${step.clearDepth ? 'depth ' : ''}${step.clearStencil ? 'stencil' : ''}`.trim();
            push(section, `[${i}] camera`, describeValue(step.cameraComponent?.entity ?? null));
            push(section, `[${i}] layer`, describeValue(layer));
            const list = ctx.frame?.visible?.get(step) ?? null;
            push(section, `[${i}] draws`, {
                text: `${step.transparent ? 'transparent' : 'opaque'}, ${drawnText(list, layer)}` +
                    `${enabled ? '' : ', disabled'}${step.firstCameraUse ? ', first camera use' : ''}${step.lastCameraUse ? ', last camera use' : ''}`,
                cls: 'obj',
                expand: list ? () => instancePage(list, `${ctx.passKey ?? ''}/${i}`, ctx) : undefined
            });
            push(section, `[${i}] clears`, { text: clears || 'nothing', cls: clears ? 'obj' : 'null' });
        });
        sections.push(section);
    }

    const rest = makeSection('props', 'Properties');
    reflectRows(rest, pass, [FramePass.prototype], SKIP_PASS);
    if (rest.rows.length) sections.push(rest);

    return sections;
}

/**
 * @param {*} step - A layer render step.
 * @param {RenderPassForward} pass - The pass it belongs to.
 * @returns {boolean} Whether the step's layer and sub-layer are enabled.
 */
function stepEnabled(step, pass) {
    return step.layer.enabled && (pass.layerComposition?.isEnabled(step.layer, step.transparent) ?? true);
}

/**
 * Everything the property view shows for one layer step of a forward pass: the camera and layer it
 * renders, what it clears, and the instances it drew in draw order, listed straight away and paged
 * the same way as under the pass, sharing the page.
 *
 * @param {LayerStepSelection} selection - The step and its pass.
 * @param {PassModelContext} ctx - The frame the step was captured in, and the paging state, where
 * `passKey` is the key of the step's own row.
 * @returns {PropertySection[]} The sections.
 */
function buildStepModel(selection, ctx) {
    const { pass, step, index } = selection;
    const layer = step.layer;
    const list = ctx.frame?.visible?.get(step) ?? null;
    const enabled = stepEnabled(step, pass);
    const clears = `${step.clearColor ? 'color ' : ''}${step.clearDepth ? 'depth ' : ''}${step.clearStencil ? 'stencil' : ''}`.trim();
    const sections = [];

    const general = makeSection('step', `${passDisplayName(pass)} › ${layer.name} ${step.transparent ? 'transparent' : 'opaque'}`);
    push(general, 'pass', { text: `${passDisplayName(pass)}, step ${index}`, cls: 'ref', target: pass });
    push(general, 'camera', describeValue(step.cameraComponent?.entity ?? null));
    push(general, 'layer', describeValue(layer));
    push(general, 'sub-layer', { text: step.transparent ? 'transparent' : 'opaque', cls: 'obj' });
    push(general, 'draws', { text: drawnText(list, layer), cls: list ? 'num' : 'null' });
    push(general, 'enabled', describeValue(enabled));
    push(general, 'clears', { text: clears || 'nothing', cls: clears ? 'obj' : 'null' });
    if (step.firstCameraUse) push(general, 'first camera use', describeValue(true));
    if (step.lastCameraUse) push(general, 'last camera use', describeValue(true));
    if (ctx.debug?.stepKey === ctx.passKey && list) {
        push(general, 'debug frame', { text: `stops after draw ${ctx.debug.index} of ${list.instances.length}`, cls: 'num' });
    }
    sections.push(general);

    const drawn = makeSection('instances', 'Drawn instances');
    if (list) {
        drawn.rows.push(...instancePage(list, ctx.passKey ?? '', ctx));
    } else {
        push(drawn, 'instances', { text: 'the camera has not culled this layer', cls: 'null' });
    }
    sections.push(drawn);

    return sections;
}

export { INSTANCES_PER_PAGE, LayerStepSelection, buildPassModel, buildStepModel, captureFrameGraph, passRows };
