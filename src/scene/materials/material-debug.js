import { TRACEID_MATERIAL_UPDATE } from '../../core/constants.js';
import { Debug } from '../../core/debug.js';
import { Tracing } from '../../core/tracing.js';

/**
 * @import { Material } from './material.js'
 * @import { MeshInstance, MeshInstanceParameter } from '../mesh-instance.js'
 */

// Debug-only helpers for Material and for the mesh instance overrides of its uniform buffer. They
// are called from Debug.call blocks only, so release builds strip the calls and drop these
// functions with them.

/**
 * Initializes the debug state of a material, recording where it was created when the
 * TRACEID_MATERIAL_UPDATE trace channel is enabled.
 *
 * @param {Material} material - The material.
 * @ignore
 */
const initMaterialDebug = (material) => {
    // where the material was created, reported with the warning about changes made without update()
    material._debugCreationStack = Tracing.get(TRACEID_MATERIAL_UPDATE) ? new Error('Material created at') : null;

    // where a typed property was last changed or exposed
    material._debugChangeStack = null;

    // true once the warning about unapplied changes fired, until the next update()
    material._debugWarnedUnapplied = false;
};

/**
 * Records where a typed property of the material was changed or exposed, when the
 * TRACEID_MATERIAL_UPDATE trace channel is enabled.
 *
 * @param {Material} material - The material.
 * @ignore
 */
const recordMaterialChange = (material) => {
    if (Tracing.get(TRACEID_MATERIAL_UPDATE)) {
        material._debugChangeStack = new Error('Material last changed at');
    }
};

/**
 * Returns the names of the typed properties changed since the last {@link Material#update}:
 * assigned, or exposed by a getter and mutated in place.
 *
 * @param {Material} material - The material.
 * @returns {string[]} The names of the changed properties.
 * @ignore
 */
const getUnappliedMaterialProperties = (material) => {
    const names = [];
    material._modifiedProperties?.forEach((property) => {
        if (!names.includes(property.name)) {
            names.push(property.name);
        }
    });
    material._mutableProperties?.forEach((snapshot, property) => {
        if (!names.includes(property.name) && !snapshot.equals(material[property.backingName])) {
            names.push(property.name);
        }
    });
    material._collectUnappliedChanges?.(names);
    return names;
};

/**
 * Warns about typed properties changed without a subsequent {@link Material#update}, identifying
 * the material by its name, id and the nodes rendering it. When the TRACEID_MATERIAL_UPDATE trace
 * channel is enabled, the warning includes where the material was created and last changed.
 *
 * @param {Material} material - The material.
 * @param {string[]} names - The names of the changed properties.
 * @ignore
 */
const warnUnappliedMaterialProperties = (material, names) => {
    // the distinct nodes rendering the material - several mesh instances often share a node
    const paths = new Set();
    for (const meshInstance of material.meshInstances) {
        const node = meshInstance.node;
        if (node) {
            paths.add(node.path || node.name);
        }
    }
    const total = material.meshInstances.size;
    let usage = '';
    if (total > 0) {
        usage = `, used by ${total} mesh instance${total === 1 ? '' : 's'}`;
        const shown = [...paths].slice(0, 3).map(path => `'${path}'`);
        if (shown.length > 0) {
            const more = paths.size - shown.length;
            usage += ` on ${shown.join(', ')}${more > 0 ? ` and ${more} more node${more === 1 ? '' : 's'}` : ''}`;
        }
    }
    const tracing = Tracing.get(TRACEID_MATERIAL_UPDATE);
    const hint = tracing ? '' : ' Enable Tracing.set(TRACEID_MATERIAL_UPDATE, true) to record where the material was created and changed.';
    const message = `Material '${material.name}' (id ${material.id}${usage}) changed ${names.join(', ')} without calling update(); the change is not applied until update() is called.${hint}`;
    if (tracing) {
        // the stacks recorded while the channel was enabled (a material created before that has none)
        const stacks = [material._debugCreationStack, material._debugChangeStack].filter(stack => !!stack);
        Debug.warnOnce(message, material, ...stacks);
    } else {
        Debug.warnOnce(message, material);
    }
};

/**
 * Initializes the debug state of a mesh instance.
 *
 * @param {MeshInstance} meshInstance - The mesh instance.
 * @ignore
 */
const initMeshInstanceDebug = (meshInstance) => {
    // the override version at which the warning about an override changed in place fired, so that
    // nothing is checked again until the next setParameter
    meshInstance._debugWarnedOverridesVersion = -1;

    // the array values of the overrides as last applied to the copy of the material uniform buffer,
    // by parameter, kept here rather than on the parameters to leave their shape and API untouched,
    // and weakly, so that a deleted parameter is collected without any lifecycle hook
    meshInstance._debugOverrideSnapshots = new WeakMap();
};

/**
 * Records the array values of the overrides just applied to a mesh instance's copy of the material
 * uniform buffer, to detect changes made in place afterwards. Numbers cannot change in place and
 * are not recorded.
 *
 * @param {MeshInstance} meshInstance - The mesh instance.
 * @param {MeshInstanceParameter[]} overrides - The applied overrides.
 * @ignore
 */
const recordAppliedOverrides = (meshInstance, overrides) => {
    const snapshots = meshInstance._debugOverrideSnapshots;
    for (let i = 0; i < overrides.length; i++) {
        const override = overrides[i];
        const data = override.data;
        if (typeof data === 'number') {
            snapshots.delete(override);
        } else {
            // only the components the uniform reads, kept as numbers to compare exactly; the
            // per-frame pattern of mutating and setting an array again records on every draw, so
            // the snapshot array is reused while its length holds
            const format = override.uniformFormat;
            const length = Math.min(data.length, format.numComponents * Math.max(1, format.count));
            let snapshot = snapshots.get(override);
            if (!snapshot || snapshot.length !== length) {
                snapshot = new Array(length);
                snapshots.set(override, snapshot);
            }
            for (let j = 0; j < length; j++) {
                snapshot[j] = data[j];
            }
        }
    }
};

/**
 * Returns the names of the overrides whose array values changed in place since they were applied.
 *
 * @param {MeshInstance} meshInstance - The mesh instance.
 * @param {MeshInstanceParameter[]} overrides - The overrides.
 * @returns {string[]} The names of the changed overrides.
 * @ignore
 */
const getMutatedOverrides = (meshInstance, overrides) => {
    const names = [];
    const snapshots = meshInstance._debugOverrideSnapshots;
    for (let i = 0; i < overrides.length; i++) {
        const override = overrides[i];
        const snapshot = snapshots.get(override);
        if (snapshot) {
            const data = override.data;
            for (let j = 0; j < snapshot.length; j++) {
                if (snapshot[j] !== data[j]) {
                    names.push(override.name);
                    break;
                }
            }
        }
    }
    return names;
};

/**
 * Warns about overrides changed in place without a subsequent {@link MeshInstance#setParameter},
 * identifying the mesh instance by its node and material. Like the material warning, one report
 * per message is enough to point at the bug, so the message is deduplicated for the session: the
 * warned version kept by the mesh instance limits the cost of the detection, not the output.
 *
 * @param {MeshInstance} meshInstance - The mesh instance.
 * @param {string[]} names - The names of the changed overrides.
 * @ignore
 */
const warnMutatedOverrides = (meshInstance, names) => {
    const node = meshInstance.node;
    const where = node ? ` on node '${node.path || node.name}'` : '';
    const material = meshInstance.material;
    const list = names.map(name => `'${name}'`).join(', ');
    const plural = names.length === 1 ? '' : 's';
    Debug.warnOnce(`MeshInstance${where} (material '${material.name}', id ${material.id}) changed the array value of parameter${plural} ${list} in place after it was applied to the material uniform buffer; the change is not applied until setParameter() is called again with the value.`, meshInstance);
};

export {
    initMaterialDebug, recordMaterialChange, getUnappliedMaterialProperties, warnUnappliedMaterialProperties,
    initMeshInstanceDebug, recordAppliedOverrides, getMutatedOverrides, warnMutatedOverrides
};
