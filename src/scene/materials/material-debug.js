import { TRACEID_MATERIAL_UPDATE } from '../../core/constants.js';
import { Debug } from '../../core/debug.js';
import { Tracing } from '../../core/tracing.js';

/**
 * @import { Material } from './material.js'
 */

// Debug-only helpers for Material. They are called from Debug.call blocks only, so release builds
// strip the calls and drop these functions with them.

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
    material._modifiedProperties?.forEach(property => names.push(property.name));
    material._mutableProperties?.forEach((snapshot, property) => {
        if (!names.includes(property.name) && !snapshot.equals(material[property.backingName])) {
            names.push(property.name);
        }
    });
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

export { initMaterialDebug, recordMaterialChange, getUnappliedMaterialProperties, warnUnappliedMaterialProperties };
