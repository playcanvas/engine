import { FramePass } from '../../platform/graphics/frame-pass.js';
import { RenderPassForward } from '../../scene/renderer/render-pass-forward.js';

import { describeValue } from './describe.js';
import { formatName, makeSection, passDisplayName, push, read, reflectRows, renderTargetSummary } from './model.js';

/** @import { AppBase } from '../../framework/app-base.js' */
/** @import { GraphicsDevice } from '../../platform/graphics/graphics-device.js' */
/** @import { RenderTarget } from '../../platform/graphics/render-target.js' */
/** @import { Described } from './describe.js' */
/** @import { ListRow } from './list-view.js' */
/** @import { PropertySection } from './model.js' */

/**
 * One pass of a captured frame.
 *
 * @typedef {object} PassEntry
 * @property {FramePass} pass - The pass.
 * @property {number} index - The position in execution order.
 * @property {string} key - A key stable across frames for passes that are recreated each frame.
 * @property {number} depth - How many wrapper passes enclose this one.
 * @property {FramePass|null} parent - The wrapper pass this one belongs to, if any.
 * @property {number} children - The number of passes this one wraps directly.
 * @property {number} views - The XR views the pass is replicated for, or 0 outside multi-view.
 * @property {RenderTarget|null|undefined} renderTarget - The target the pass renders to, with the
 * backbuffer resolved to the device's backbuffer object; undefined for passes that render nothing.
 */

/**
 * The frame graph of one frame, flattened.
 *
 * @typedef {object} FrameSnapshot
 * @property {PassEntry[]} entries - The passes in execution order.
 * @property {Map<RenderTarget, PassEntry[]>} usage - The passes rendering into each target.
 * @property {Map<string, number>} nameCounts - How many passes share each profiler name.
 * @property {Map<string, number>|null} timings - GPU time per profiler name, when profiling is on.
 * @property {number|undefined} frameTime - The GPU time of the whole frame, when known.
 */

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

    const profiler = device.gpuProfiler;
    return {
        entries,
        usage,
        nameCounts,
        timings: profiler?.enabled ? profiler.passTimings : null,
        frameTime: profiler?.frameTime
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

    for (const entry of frame.entries) {
        const { pass, index, depth, renderTarget } = entry;
        const name = passDisplayName(pass);
        const merged = pass._skipStart;

        const cells = [
            { text: merged ? '++' : String(index), cls: 'pci-cell-index', title: merged ? 'Merged into the previous pass: same render target, nothing cleared' : '' },
            { text: name, cls: 'pci-cell-name' }
        ];
        if (!pass.executeEnabled) cells.push({ text: 'DISABLED', cls: 'pci-cell-tag' });
        if (entry.views > 1) cells.push({ text: `×${entry.views} views`, cls: 'pci-cell-tag pci-cell-tag-info' });
        if (renderTarget) {
            cells.push({ text: renderTargetSummary(renderTarget, device), cls: 'pci-cell-info', target: renderTarget });
        } else if (entry.children) {
            cells.push({ text: `wraps ${entry.children} pass${entry.children === 1 ? '' : 'es'}`, cls: 'pci-cell-info' });
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

        rows.push({ key: entry.key, item: pass, name, indent: depth, dim: !pass.executeEnabled, title: passTitle(entry, device), cells });

        if (pass instanceof RenderPassForward) {
            pass.layerRenderSteps.forEach((step, i) => {
                const layer = step.layer;
                const enabled = layer.enabled && (pass.layerComposition?.isEnabled(layer, step.transparent) ?? true);
                const camera = step.cameraComponent?.entity;
                const flags = `${step.firstCameraUse ? ' · first' : ''}${step.lastCameraUse ? ' · last' : ''}${enabled ? '' : ' · disabled'}`;
                rows.push({
                    key: `${entry.key}/${i}`,
                    item: pass,
                    name,
                    indent: depth + 1,
                    dim: !enabled,
                    cells: [
                        { text: '', cls: 'pci-cell-index' },
                        { text: camera?.name ?? '-', cls: 'pci-cell-info', target: camera ?? undefined, title: 'Camera' },
                        { text: `· ${layer.name} · ${step.transparent ? 'transparent' : 'opaque'} · ${layer.meshInstances.length} meshes${flags}`, cls: 'pci-cell-info' }
                    ]
                });
            });
        }

        const lightNode = /** @type {any} */ (pass).light?._node;
        if (lightNode) {
            rows.push({
                key: `${entry.key}/light`,
                item: pass,
                name,
                indent: depth + 1,
                cells: [
                    { text: '', cls: 'pci-cell-index' },
                    { text: 'light', cls: 'pci-cell-info' },
                    { text: lightNode.name, cls: 'pci-cell-info', target: lightNode }
                ]
            });
        }
    }

    return rows;
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
 * @param {{ device: GraphicsDevice, frame: FrameSnapshot|null }} ctx - The device and the frame the pass was captured in.
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
    if (entry?.parent) push(general, 'wrapped by', { text: passDisplayName(entry.parent), cls: 'ref', target: entry.parent });
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
            push(section, `[${i}] draws`, {
                text: `${step.transparent ? 'transparent' : 'opaque'}, ${layer.meshInstances.length} meshes` +
                    `${enabled ? '' : ', disabled'}${step.firstCameraUse ? ', first camera use' : ''}${step.lastCameraUse ? ', last camera use' : ''}`,
                cls: 'obj'
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

export { buildPassModel, captureFrameGraph, passRows };
