import { hash32Fnv1a } from '../../core/hash.js';
import {
    LIGHTTYPE_DIRECTIONAL,
    MASK_AFFECT_DYNAMIC, MASK_AFFECT_RUNTIME
} from '../constants.js';

/**
 * @import { Light } from '../light.js'
 */

/**
 * Ranks a light by how broadly it applies, ordering the lights that reach every mesh instance
 * ahead of those restricted to one kind of geometry. See {@link LightList#update}.
 *
 * @param {Light} light - The light.
 * @returns {number} The rank, lowest first.
 */
const lightSlotRank = (light) => {
    const mask = light.mask & MASK_AFFECT_RUNTIME;
    if (mask === MASK_AFFECT_RUNTIME) return 0;     // carries both bits, so reaches every mesh instance
    if (mask & MASK_AFFECT_DYNAMIC) return 1;       // dynamic geometry is usually most of the draws
    return 2;
};

/**
 * Orders the light slots: by type, so directional lights come first; then by how broadly a light
 * applies, so the slots a mesh instance's mask selects form a gap-free run whenever one mask's
 * lights are a subset of the other's - the normal case; then by key, which keeps the order a pure
 * function of the set of lights, so reordering lights generates no new shaders.
 *
 * @param {Light} a - A light.
 * @param {Light} b - Another light.
 * @returns {number} The comparison result.
 */
const compareSlots = (a, b) => {
    return (a._type - b._type) || (lightSlotRank(a) - lightSlotRank(b)) || (a.key - b.key);
};

/** @type {number[]} */
const _keys = [];

/**
 * The lights of a set that take part in rendering, in the forms the renderer consumes. A layer
 * owns one for its lights and rebuilds it lazily when they change, and the lightmapper owns one
 * for the single light it bakes at a time.
 *
 * The central form is the light slots: the lights applied at runtime, in the order that gives each
 * its slot in a shader - `light<N>_` is the light at index N. The slot order is the same for every
 * mesh instance in a pass whatever its light mask selects, so a light's uniforms are dispatched
 * once per pass and each shader reads its own slots. The shader generator, the shader variant hash
 * and the light dispatch all read this one array, so they cannot disagree.
 *
 * @ignore
 */
class LightList {
    /**
     * The lights applied at runtime, in slot order. Directional lights, then - when clustered
     * lighting is disabled - omni and spot lights, since clustered lighting supplies the local
     * lights another way. A light that only contributes to a lightmap reaches nothing at runtime
     * and takes no slot.
     *
     * @type {Light[]}
     */
    slots = [];

    /**
     * The enabled directional lights, in no particular order. Read by the shadow cull and the
     * gsplat shadow renderer, which look for the shadow casters among them.
     *
     * @type {Light[]}
     */
    directional = [];

    /**
     * The keys of the slot lights, joined in slot order. Identifies the layout of the lights, and
     * so the shader code and the uniform layout they generate.
     *
     * @type {string}
     */
    key = '';

    /**
     * A hash of {@link LightList#key}, for the shader variant hash.
     *
     * @type {number}
     */
    hash = 0;

    /**
     * Whether the slots were built for clustered lighting.
     *
     * @type {boolean}
     */
    clustered = true;

    /**
     * Rebuilds every form from the given lights. The arrays are reused, so nothing is allocated
     * on a rebuild but the key.
     *
     * @param {Light[]} lights - The lights of the set, enabled or not.
     * @param {boolean} clustered - Whether clustered lighting is enabled, in which case the local
     * lights take no slot.
     */
    update(lights, clustered) {
        this.clustered = clustered;

        const slots = this.slots;
        const directional = this.directional;
        slots.length = 0;
        directional.length = 0;

        for (let i = 0; i < lights.length; i++) {
            const light = lights[i];
            if (!light.enabled) continue;

            const isDirectional = light._type === LIGHTTYPE_DIRECTIONAL;
            if (isDirectional) {
                directional.push(light);
            }

            if ((light.mask & MASK_AFFECT_RUNTIME) && (isDirectional || !clustered)) {
                slots.push(light);
            }
        }

        slots.sort(compareSlots);

        let key = '';
        for (let i = 0; i < slots.length; i++) {
            const lightKey = slots[i].key;
            _keys.push(lightKey);
            key += `${lightKey},`;
        }
        this.key = key;
        this.hash = _keys.length > 0 ? hash32Fnv1a(_keys) : 0;
        _keys.length = 0;
    }
}

export { LightList };
