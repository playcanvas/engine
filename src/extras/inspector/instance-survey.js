import { MeshInstance } from '../../scene/mesh-instance.js';

/** @import { AppBase } from '../../framework/app-base.js' */

/**
 * A mesh instance found, and where it was found.
 *
 * @typedef {object} FoundInstance
 * @property {MeshInstance} instance - The mesh instance.
 * @property {string} role - Where it was found, such as 'render component' or 'drawn on "World"'.
 * @ignore
 */

/**
 * Finds the mesh instances of the app. Nothing keeps a list of them, so they are gathered from
 * what holds them: the render and model components of the hierarchy, including those of disabled
 * entities, which the layers drop, then every layer of the composition, which adds sprites, text,
 * particles, batches and the sky. An instance is held by its component and listed by every layer
 * it renders in, so it is reported once, under the first place it is found. The batches of debug
 * lines are not included: they are pushed straight into the visible lists each frame, so callers
 * find them through the immediate renderer.
 *
 * @param {AppBase} app - The app.
 * @returns {FoundInstance[]} The mesh instances, in the order found.
 */
function collectMeshInstances(app) {
    /** @type {FoundInstance[]} */
    const found = [];
    const seen = new Set();
    const add = (instance, role) => {
        if (!(instance instanceof MeshInstance) || seen.has(instance)) return;
        seen.add(instance);
        found.push({ instance, role });
    };

    app.root?.forEach((node) => {
        const components = /** @type {any} */ (node).c;
        if (!components) return;
        for (const instance of components.render?.meshInstances ?? []) add(instance, 'render component');
        for (const instance of components.model?.meshInstances ?? []) add(instance, 'model component');
    });

    for (const layer of app.scene?.layers?.layerList ?? []) {
        for (const instance of layer.meshInstances ?? []) add(instance, `drawn on "${layer.name}"`);
    }

    return found;
}

export { collectMeshInstances };
