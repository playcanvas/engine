import { math } from '../../core/math/math.js';
import { UNIFORMTYPE_VEC3 } from '../../platform/graphics/constants.js';
import { _matTex2D } from '../shader-lib/programs/standard.js';
import { MaterialProperty } from './material-property.js';

/**
 * @import { StandardMaterial } from './standard-material.js'
 */

// The two vec3 uniforms of the transform of each texture map, texture_<map>MapTransform0 and 1,
// as properties of the material uniform buffer. They are static like the typed properties, but only
// join the layout of a material while the map is assigned. Their converters read the transform the
// tracker of the material computed, so the value argument, the non-existent backing field, is unused.
const _transformProperties = new Map();
const _mapNamesByUniform = new Map();

const getTransformProperties = (name) => {
    let properties = _transformProperties.get(name);
    if (!properties) {
        properties = [0, 1].map((half) => {
            return new MaterialProperty(`${name}MapTransform`, `texture_${name}MapTransform${half}`, UNIFORMTYPE_VEC3, (value, storage, offset, material) => {
                material._mapTransforms.write(name, half, storage, offset);
            });
        });
        _transformProperties.set(name, properties);
        for (const property of properties) {
            _mapNamesByUniform.set(property.uniformName, name);
        }
    }
    return properties;
};

const transformsEqual = (a, b) => {
    return a[0] === b[0] && a[1] === b[1] && a[2] === b[2] &&
           a[3] === b[3] && a[4] === b[4] && a[5] === b[5];
};

/**
 * Tracks the texture transforms of a StandardMaterial: which maps are assigned, the transform
 * computed from the tiling, offset and rotation of each, and the groups of maps sharing a
 * transform on a uv set, which the shader uses to transform each uv set once per unique transform.
 * The transforms are stored in the material uniform buffer: the tracker adds their uniforms to the
 * layout of the material while a map is assigned and marks them modified when the transform
 * changes, so that {@link Material#update} writes them.
 *
 * @ignore
 */
class StandardMaterialMapTransforms {
    /**
     * True when a map, tiling, offset, rotation or uv set was assigned since the last update.
     *
     * @type {boolean}
     * @private
     */
    _dirty = true;

    /**
     * True when a tiling or offset was exposed by a getter since the last update, and may have
     * been changed in place.
     *
     * @type {boolean}
     * @private
     */
    _mutable = false;

    /**
     * The transform group id of each map, 0 for a map without a transform.
     *
     * @type {Map<string, number>}
     * @private
     */
    _ids = new Map();

    /**
     * The state of each map as of the last update: assigned, uv set, tiling, offset and rotation.
     *
     * @type {Map<string, Float64Array>}
     * @private
     */
    _states = new Map();

    /**
     * The computed transform of each assigned map, the two vec3 uniforms in a row.
     *
     * @type {Map<string, Float32Array>}
     * @private
     */
    _values = new Map();

    /**
     * The property descriptors of the material, the typed properties followed by the transforms of
     * the assigned maps, rebuilt when the set of assigned maps changes.
     *
     * @type {MaterialProperty[]|null}
     * @private
     */
    _descriptors = null;

    reset() {
        this._ids.clear();
        this._states.clear();
        this._values.clear();
        this._descriptors = null;
        this._dirty = true;
        this._mutable = false;
    }

    markDirty() {
        this._dirty = true;
    }

    markMutable() {
        this._dirty = true;
        this._mutable = true;
    }

    /**
     * Returns the property descriptors of the material: the given typed properties, followed by
     * the transforms of the maps assigned as of the last update.
     *
     * @param {MaterialProperty[]} properties - The typed properties of the material.
     * @returns {MaterialProperty[]} The descriptors.
     */
    getDescriptors(properties) {
        let descriptors = this._descriptors;
        if (!descriptors) {
            descriptors = properties;
            for (const p of _matTex2D.keys()) {
                if (this._states.get(p)?.[0] === 1) {
                    if (descriptors === properties) {
                        descriptors = properties.slice();
                    }
                    descriptors.push(...getTransformProperties(p));
                }
            }
            this._descriptors = descriptors;
        }
        return descriptors;
    }

    /**
     * Returns the descriptor of a transform uniform stored in the material uniform buffer, or null
     * when the name is not a transform uniform or its map is not assigned.
     *
     * @param {string} uniformName - The name of the uniform.
     * @returns {MaterialProperty|null} The descriptor.
     */
    getUniformProperty(uniformName) {
        const name = _mapNamesByUniform.get(uniformName);
        if (name === undefined || this._states.get(name)?.[0] !== 1) {
            return null;
        }
        const properties = getTransformProperties(name);
        return properties[0].uniformName === uniformName ? properties[0] : properties[1];
    }

    /**
     * Writes one half of the transform of a map, three floats, into the storage of the material
     * uniform buffer.
     *
     * @param {string} name - The name of the map.
     * @param {number} half - 0 for the first uniform of the transform, 1 for the second.
     * @param {Float32Array} storage - The storage.
     * @param {number} offset - The element offset of the uniform.
     */
    write(name, half, storage, offset) {
        const values = this._values.get(name);
        const base = half * 3;
        storage[offset] = values[base];
        storage[offset + 1] = values[base + 1];
        storage[offset + 2] = values[base + 2];
    }

    /**
     * Applies the changes made since the last update: recomputes the transforms of the changed maps
     * and marks their uniforms modified, marks the layout of the material changed when a map was
     * assigned or removed, and regroups the transforms.
     *
     * @param {StandardMaterial} material - The material.
     * @returns {boolean} True when the transform groups changed, which selects different shader code.
     */
    update(material) {
        if (!this._dirty && !this._mutable) {
            return false;
        }
        this._dirty = false;

        let transformsChanged = false;
        let assignedChanged = false;
        for (const p of _matTex2D.keys()) {
            const active = material[`_${p}Map`] ? 1 : 0;
            const uv = material[`_${p}MapUv`];
            const tiling = material[`_${p}MapTiling`];
            const offset = material[`_${p}MapOffset`];
            const rotation = material[`_${p}MapRotation`];

            let state = this._states.get(p);
            if (!state) {
                state = new Float64Array(7);
                state[0] = -1;
                this._states.set(p, state);
            }

            if (state[0] !== active ||
                active && (state[1] !== uv ||
                           state[2] !== tiling.x || state[3] !== tiling.y ||
                           state[4] !== offset.x || state[5] !== offset.y ||
                           state[6] !== rotation)) {

                if ((state[0] === 1) !== (active === 1)) {
                    assignedChanged = true;
                }
                state[0] = active;
                state[1] = uv;
                state[2] = tiling.x;
                state[3] = tiling.y;
                state[4] = offset.x;
                state[5] = offset.y;
                state[6] = rotation;
                transformsChanged = true;

                if (active) {
                    this._compute(p, tiling, offset, rotation);
                    const properties = getTransformProperties(p);
                    material._markPropertyModified(properties[0]);
                    material._markPropertyModified(properties[1]);
                }
            }
        }

        if (assignedChanged) {
            // the transforms of the assigned maps are the uniforms of the layout
            this._descriptors = null;
            material._markLayoutDirty();
        }

        if (!transformsChanged) {
            return false;
        }
        return this._updateIds();
    }

    /**
     * Collects the names of the map properties changed since the last update, for the debug
     * warning about changes made without a subsequent update.
     *
     * @param {StandardMaterial} material - The material.
     * @param {string[]} names - The names to add to.
     */
    collectUnapplied(material, names) {
        if (!this._dirty && !this._mutable) {
            return;
        }
        for (const p of _matTex2D.keys()) {
            const state = this._states.get(p);
            const active = material[`_${p}Map`] ? 1 : 0;
            if (!state || state[0] !== active) {
                names.push(`${p}Map`);
            } else if (active) {
                if (state[1] !== material[`_${p}MapUv`]) names.push(`${p}MapUv`);
                const tiling = material[`_${p}MapTiling`];
                if (state[2] !== tiling.x || state[3] !== tiling.y) names.push(`${p}MapTiling`);
                const offset = material[`_${p}MapOffset`];
                if (state[4] !== offset.x || state[5] !== offset.y) names.push(`${p}MapOffset`);
                if (state[6] !== material[`_${p}MapRotation`]) names.push(`${p}MapRotation`);
            }
        }
    }

    /**
     * @param {string} p - The name of the map.
     * @param {import('../../core/math/vec2.js').Vec2} tiling - The tiling.
     * @param {import('../../core/math/vec2.js').Vec2} offset - The offset.
     * @param {number} rotation - The rotation in degrees.
     * @private
     */
    _compute(p, tiling, offset, rotation) {
        let values = this._values.get(p);
        if (!values) {
            values = new Float32Array(6);
            this._values.set(p, values);
        }
        const cr = Math.cos(rotation * math.DEG_TO_RAD);
        const sr = Math.sin(rotation * math.DEG_TO_RAD);
        values[0] = cr * tiling.x;
        values[1] = -sr * tiling.y;
        values[2] = offset.x;
        values[3] = sr * tiling.x;
        values[4] = cr * tiling.y;
        values[5] = 1.0 - tiling.y - offset.y;
    }

    /**
     * Groups the assigned maps with a transform by uv set and equal transform, so that the shader
     * transforms each uv set once per unique transform. A map without a transform has the id 0.
     *
     * @returns {boolean} True when the group of any map changed.
     * @private
     */
    _updateIds() {
        const groupsByUv = [];
        const previousIds = this._ids;
        const ids = new Map();
        let groupTopologyChanged = false;

        let mapId = 1;
        for (const p of _matTex2D.keys()) {
            let id = 0;
            const state = this._states.get(p);
            const identity = state[2] === 1 && state[3] === 1 && state[4] === 0 && state[5] === 0 && state[6] === 0;
            if (state[0] === 1 && !identity) {
                const transform = this._values.get(p);
                const uv = state[1];
                const groups = groupsByUv[uv] ?? (groupsByUv[uv] = []);
                let group;
                for (let i = 0; i < groups.length; i++) {
                    if (transformsEqual(groups[i].transform, transform)) {
                        group = groups[i];
                        break;
                    }
                }
                if (group) {
                    id = group.id;
                } else {
                    id = mapId;
                    groups.push({ id, transform });
                }
            }
            ids.set(p, id);
            groupTopologyChanged ||= (previousIds.get(p) ?? 0) !== id;
            mapId++;
        }

        this._ids = ids;
        return groupTopologyChanged;
    }

    getId(name) {
        return this._ids.get(name) ?? 0;
    }
}

export { StandardMaterialMapTransforms };
