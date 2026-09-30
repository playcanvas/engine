import { PROJECTION_ORTHOGRAPHIC } from '../../scene/constants.js';

import { describeValue } from './describe.js';
import { nodeLabel } from './memory-view.js';
import { makeSection, push, read } from './model.js';
import { layersValue } from './node-model.js';
import { RENDER_MODES, isScreenCamera } from './viewport-tools.js';

/** @import { AppBase } from '../../framework/app-base.js' */
/** @import { CameraComponent } from '../../framework/components/camera/component.js' */
/** @import { ListRow } from './list-view.js' */
/** @import { PropertySection } from './model.js' */

/**
 * What the Cameras tab offers on a camera, supplied by the inspector.
 *
 * @typedef {object} CameraActions
 * @property {(camera: CameraComponent) => void} fly - Flies the camera.
 * @property {CameraComponent|null} flying - The camera being flown, if any.
 * @ignore
 */

const MODE_NAMES = new Map(RENDER_MODES);

/**
 * Every camera component of the hierarchy, disabled ones included, in the order they render: by
 * priority, then in hierarchy order.
 *
 * @param {AppBase} app - The app.
 * @returns {CameraComponent[]} The cameras.
 */
function collectCameras(app) {
    const cameras = [];
    app.root?.forEach((node) => {
        const camera = /** @type {any} */ (node).c?.camera;
        if (camera) cameras.push(camera);
    });
    return cameras.map((camera, order) => ({ camera, order }))
    .sort((a, b) => a.camera.priority - b.camera.priority || a.order - b.order)
    .map(({ camera }) => camera);
}

/**
 * @param {CameraComponent} camera - A camera.
 * @returns {string} The name of the shader pass it renders with.
 */
function renderModeOf(camera) {
    const name = camera.camera.shaderPassInfo?.name ?? 'forward';
    return MODE_NAMES.get(name) ?? name;
}

/**
 * @param {CameraComponent} camera - A camera.
 * @returns {string} Where it draws: its viewport of the screen, or the texture it renders into.
 */
function targetText(camera) {
    if (camera.renderTarget) return `texture ${camera.renderTarget.name || '(unnamed)'}`;
    const { x, y, z, w } = camera.rect;
    return x === 0 && y === 0 && z === 1 && w === 1 ? 'screen' : `screen rect ${x}, ${y}, ${z}, ${w}`;
}

/**
 * One row per camera, in render order, dimmed when it does not render.
 *
 * @param {AppBase} app - The app.
 * @param {CameraComponent|null} flying - The camera being flown, if any.
 * @returns {ListRow[]} The rows.
 */
function cameraRows(app, flying) {
    return collectCameras(app).map((camera) => {
        const entity = camera.entity;
        const name = nodeLabel(entity);
        const cells = [{ text: name, cls: 'pci-cell-name' }];
        cells.push({ text: camera.renderTarget ? 'texture' : 'screen', cls: 'pci-cell-tag pci-cell-tag-info' });
        if (camera.projection === PROJECTION_ORTHOGRAPHIC) cells.push({ text: 'ortho', cls: 'pci-cell-tag pci-cell-tag-info' });
        const mode = renderModeOf(camera);
        if (mode !== 'standard') cells.push({ text: mode, cls: 'pci-cell-tag' });
        if (camera === flying) cells.push({ text: 'flying', cls: 'pci-cell-tag' });
        cells.push({ text: `priority ${camera.priority} · ${camera.layers.length} layers · ${targetText(camera)}`, cls: 'pci-cell-info' });
        const running = camera.enabled && entity.enabled;
        return { key: `camera${entity.getGuid?.() ?? name}`, item: camera, name, dim: !running, title: `${name}\n${targetText(camera)}`, cells };
    });
}

/**
 * Everything the property view shows for a camera: where and how it draws, the layers it renders,
 * its render mode, and a button to fly it.
 *
 * @param {CameraComponent} camera - The camera.
 * @param {{ app: AppBase, cameraActions: CameraActions }} ctx - The app, and what the tab offers.
 * @returns {PropertySection[]} The sections.
 */
function buildCameraModel(camera, ctx) {
    const { cameraActions } = ctx;
    const entity = camera.entity;
    const general = makeSection('camera', `Camera "${entity.name}"`);
    push(general, 'entity', describeValue(entity));
    push(general, 'enabled', { text: String(camera.enabled && entity.enabled), cls: 'bool' });
    push(general, 'fly', {
        text: camera === cameraActions.flying ? 'flying now, Esc to stop' : 'fly it with the mouse and WASD',
        cls: 'obj',
        actions: [{
            text: camera === cameraActions.flying ? 'Flying' : 'Fly',
            title: 'Fly this camera: WASD and QE move, drag to look, the wheel sets the speed, Shift is faster, Esc stops',
            disabled: camera === cameraActions.flying,
            run: () => cameraActions.fly(camera)
        }]
    });
    push(general, 'render mode', { text: renderModeOf(camera), cls: 'obj' });
    push(general, 'priority', read(camera, 'priority'));
    push(general, 'target', camera.renderTarget ? describeValue(camera.renderTarget) : { text: targetText(camera), cls: 'obj' });
    push(general, 'rect', read(camera, 'rect'));
    push(general, 'projection', { text: camera.projection === PROJECTION_ORTHOGRAPHIC ? 'orthographic' : 'perspective', cls: 'obj' });
    push(general, camera.projection === PROJECTION_ORTHOGRAPHIC ? 'ortho height' : 'fov',
        read(camera, camera.projection === PROJECTION_ORTHOGRAPHIC ? 'orthoHeight' : 'fov'));
    push(general, 'near clip', read(camera, 'nearClip'));
    push(general, 'far clip', read(camera, 'farClip'));
    push(general, 'clear', {
        text: [camera.clearColorBuffer && 'color', camera.clearDepthBuffer && 'depth', camera.clearStencilBuffer && 'stencil'].filter(Boolean).join(', ') || 'nothing',
        cls: 'obj'
    });
    push(general, 'layers', layersValue(camera.layers, ctx.app.scene?.layers ?? null));
    const passes = camera.framePasses ?? [];
    if (passes.length) push(general, 'frame passes', describeValue(passes));
    return [general];
}

export { buildCameraModel, cameraRows, collectCameras, isScreenCamera };
