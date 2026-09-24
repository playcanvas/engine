import { VertexBuffer } from '../../platform/graphics/vertex-buffer.js';
import { MeshInstance } from '../../scene/mesh-instance.js';
import { Mesh } from '../../scene/mesh.js';

import { describeValue } from './describe.js';
import { nodeLabel } from './memory-view.js';
import { formatBytes, makeSection, push } from './model.js';
import { meshInstanceRows, meshRows } from './node-model.js';

/** @import { AppBase } from '../../framework/app-base.js' */
/** @import { Asset } from '../../framework/asset/asset.js' */
/** @import { GraphNode } from '../../scene/graph-node.js' */
/** @import { ListRow } from './list-view.js' */
/** @import { PropertySection } from './model.js' */

/**
 * Something a mesh was found to be used by.
 *
 * @typedef {object} MeshUser
 * @property {string} role - How it uses the mesh, such as 'render component'.
 * @property {string} label - Its name.
 * @property {GraphNode|Asset|null} target - What to link to, or null when there is nothing to show.
 * @property {MeshInstance|null} instance - The mesh instance drawing the mesh, when there is one.
 * @ignore
 */

/**
 * The meshes found, with what uses each, and how complete the search was.
 *
 * @typedef {object} MeshSurvey
 * @property {Map<Mesh, MeshUser[]>} users - The users of each mesh found.
 * @property {number} instances - How many mesh instances were found drawing them.
 * @property {number} vertexBuffers - How many vertex buffers the device holds.
 * @property {number} unaccounted - How many of those belong to no mesh found and to no instancing
 * data or other known user: the buffers of meshes only the app's own code holds, or buffers made
 * without a mesh.
 * @ignore
 */

// most users a mesh lists in the property view; shared primitives are drawn by many
const MAX_USERS = 100;

/**
 * Finds the meshes of the app. Nothing keeps a list of them, so they are found through what uses
 * them: the render and model components of the hierarchy, including those of disabled entities,
 * which the layers drop; every mesh instance in the layer composition, which adds sprites, text,
 * particles, batches and the sky; the immediate renderer's batches of debug lines; and the loaded
 * render and model assets, which hold meshes nothing may be drawing. A mesh only the app's own
 * code holds cannot be found, but it still owns a vertex buffer on the device, so the vertex
 * buffers no found mesh owns are counted to tell how complete the list is.
 *
 * @param {AppBase} app - The app.
 * @returns {MeshSurvey} The meshes and what uses them.
 */
function surveyMeshes(app) {
    /** @type {Map<Mesh, MeshUser[]>} */
    const users = new Map();
    /** @type {Set<object>} */
    const known = new Set();
    const addMesh = (mesh, user) => {
        if (!(mesh instanceof Mesh)) return;
        let list = users.get(mesh);
        if (!list) {
            list = [];
            users.set(mesh, list);
        }
        list.push(user);
    };

    // a mesh instance is held by its component and listed by every layer it renders in, so it
    // counts once, under the first place it is found
    const seen = new Set();
    const addInstance = (instance, role) => {
        if (!(instance instanceof MeshInstance) || seen.has(instance)) return;
        seen.add(instance);
        const node = instance.node ?? null;
        addMesh(instance.mesh, { role, label: nodeLabel(node), target: node, instance });
        known.add(/** @type {any} */ (instance).instancingData?.vertexBuffer);
    };

    app.root?.forEach((node) => {
        const components = /** @type {any} */ (node).c;
        if (!components) return;
        for (const instance of components.render?.meshInstances ?? []) addInstance(instance, 'render component');
        for (const instance of components.model?.meshInstances ?? []) addInstance(instance, 'model component');
    });

    for (const layer of app.scene?.layers?.layerList ?? []) {
        for (const instance of layer.meshInstances ?? []) addInstance(instance, `drawn on "${layer.name}"`);
    }

    // debug lines are pushed straight into the visible list each frame rather than added to a
    // layer, so their batches are found through the immediate renderer that owns them
    for (const [layer, batches] of app.scene?.immediate?.batchesMap ?? []) {
        for (const batch of batches.map?.values() ?? []) {
            addMesh(batch.mesh, { role: 'debug lines', label: `Lines on "${layer.name}"`, target: null, instance: null });
        }
    }

    for (const asset of app.assets?.list() ?? []) {
        if (!asset.loaded) continue;
        const label = `Asset "${asset.name}"`;
        if (asset.type === 'render') {
            for (const mesh of asset.resource?.meshes ?? []) addMesh(mesh, { role: 'render asset', label, target: asset, instance: null });
        } else if (asset.type === 'model') {
            for (const instance of asset.resource?.meshInstances ?? []) {
                addMesh(instance?.mesh, { role: 'model asset', label, target: asset, instance: null });
            }
        }
    }

    const device = /** @type {any} */ (app.graphicsDevice);
    for (const mesh of users.keys()) {
        known.add(mesh.vertexBuffer);
        known.add(/** @type {any} */ (mesh.morph)?.vertexBufferIds);
    }
    known.add(device?.quadVertexBuffer);

    let vertexBuffers = 0;
    let unaccounted = 0;
    for (const buffer of device?.buffers ?? []) {
        if (!(buffer instanceof VertexBuffer)) continue;
        vertexBuffers++;
        if (!known.has(buffer)) unaccounted++;
    }

    return { users, instances: seen.size, vertexBuffers, unaccounted };
}

/**
 * @param {Mesh} mesh - A mesh.
 * @returns {number} The bytes of its vertex buffer and index buffers.
 */
function meshBytes(mesh) {
    let bytes = mesh.vertexBuffer?.numBytes ?? 0;
    for (const indexBuffer of mesh.indexBuffer ?? []) bytes += indexBuffer?.numBytes ?? 0;
    return bytes;
}

/**
 * @param {Mesh} mesh - A mesh.
 * @param {MeshUser[]} users - What uses it.
 * @returns {string} A name for it, from its first user, since meshes carry none of their own.
 */
function meshName(mesh, users) {
    return users[0]?.label ?? `Mesh #${mesh.id}`;
}

/**
 * @param {Mesh} mesh - A mesh.
 * @returns {string} Its geometry, in a few words.
 */
function geometryText(mesh) {
    const primitive = mesh.primitive?.[0];
    const drawn = primitive ? `, ${primitive.count} ${primitive.indexed ? 'indices' : 'vertices drawn'}` : '';
    return `${mesh.vertexBuffer?.numVertices ?? 0} verts${drawn}`;
}

/**
 * @param {MeshUser[]} users - What uses a mesh.
 * @returns {number} How many mesh instances draw it.
 */
function instanceCount(users) {
    return users.reduce((count, user) => count + (user.instance ? 1 : 0), 0);
}

/**
 * One row per mesh found, largest first, dimmed when no mesh instance draws it.
 *
 * @param {MeshSurvey} survey - The meshes found.
 * @returns {ListRow[]} The rows.
 */
function meshListRows(survey) {
    const meshes = [...survey.users.keys()].sort((a, b) => meshBytes(b) - meshBytes(a) || a.id - b.id);
    return meshes.map((mesh) => {
        const users = survey.users.get(mesh);
        const name = meshName(mesh, users);
        const instances = instanceCount(users);
        const cells = [{ text: name, cls: 'pci-cell-name' }];
        if (mesh.skin) cells.push({ text: 'skinned', cls: 'pci-cell-tag pci-cell-tag-info' });
        if (mesh.morph) cells.push({ text: 'morph', cls: 'pci-cell-tag pci-cell-tag-info' });
        cells.push({ text: `${geometryText(mesh)} · ${instances} instance${instances === 1 ? '' : 's'}`, cls: 'pci-cell-info' });
        cells.push({ text: formatBytes(meshBytes(mesh)), cls: 'pci-cell-info pci-cell-right' });
        const title = `Mesh #${mesh.id}\n${geometryText(mesh)}, ${formatBytes(meshBytes(mesh))}\n` +
            `${instances ? `drawn by ${instances} mesh instance${instances === 1 ? '' : 's'}` : 'drawn by no mesh instance'}` +
            `${users.length > instances ? `, held by ${users[users.length - 1].label}` : ''}`;
        return {
            key: `mesh${mesh.id}`,
            item: mesh,
            name,
            // a shared primitive is named after its first user, so match on any of them
            matches: filter => users.some(user => user.label.toLowerCase().includes(filter)),
            dim: instances === 0,
            title,
            cells
        };
    });
}

/**
 * The line above the list: how many meshes were found, and whether any vertex buffer on the device
 * belongs to none of them.
 *
 * @param {MeshSurvey} survey - The meshes found.
 * @returns {string} The note, or an empty string when every vertex buffer is accounted for.
 */
function meshNote(survey) {
    if (!survey.unaccounted) return '';
    const count = survey.unaccounted;
    return `${count} of the ${survey.vertexBuffers} vertex buffers on the device belong to no mesh found here: ` +
        'meshes only the app\'s own code holds, or buffers made without a mesh. The Memory tab lists them.';
}

/**
 * Everything the property view shows for a mesh: its geometry, down to the elements of its vertex
 * format, and what uses it, with each mesh instance opening in place.
 *
 * @param {Mesh} mesh - The mesh.
 * @param {{ app: AppBase }} ctx - The app, to find the mesh's users.
 * @returns {PropertySection[]} The sections.
 */
function buildMeshModel(mesh, ctx) {
    const users = surveyMeshes(ctx.app).users.get(mesh) ?? [];

    const general = makeSection('mesh', `Mesh #${mesh.id}`);
    push(general, 'size', { text: formatBytes(meshBytes(mesh)), cls: 'num' });
    general.rows.push(...meshRows(mesh));

    const usage = makeSection('users', 'Used by');
    const instances = instanceCount(users);
    push(usage, 'users', {
        text: users.length ?
            `${instances} mesh instance${instances === 1 ? '' : 's'}${users.length > instances ? `, ${users.length - instances} other` : ''}` :
            'none found',
        cls: users.length ? 'obj' : 'null',
        items: users.slice(0, MAX_USERS).map((user) => {
            if (user.instance) {
                const instance = user.instance;
                return { label: user.role, ...describeValue(instance), text: user.label, expand: () => meshInstanceRows(instance) };
            }
            return { label: user.role, ...(user.target ? describeValue(user.target) : { text: user.label, cls: 'obj' }) };
        })
    });
    if (users.length > MAX_USERS) {
        usage.rows.push({ key: 'more', label: '', value: { text: `… ${users.length - MAX_USERS} more`, cls: 'null' }, depth: 1 });
    }

    return [general, usage];
}

export { buildMeshModel, meshBytes, meshListRows, meshNote, surveyMeshes };
