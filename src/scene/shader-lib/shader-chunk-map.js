import { Debug } from '../../core/debug.js';
import { hashCode } from '../../core/hash.js';

/**
 * @typedef {object} ChunkValidation
 * @property {string} [message] - Deprecation message to display.
 * @property {function(string, string):void} [callback] - Validation callback receiving chunk name and code.
 * @property {string} [defaultCodeGLSL] - Default GLSL code. If matches, no warning.
 * @property {string} [defaultCodeWGSL] - Default WGSL code. If matches, no warning.
 */

/**
 * A collection of shader chunks, used by {@link ShaderChunks}. This is a map of shader chunk names
 * to their code.  As this class extends `Map`, it can be used as a `Map` as well in addition to
 * custom functionality it provides.
 *
 * @category Graphics
 */
class ShaderChunkMap extends Map {
    /**
     * Reference to chunk validations map.
     *
     * @type {Map<string, ChunkValidation>|undefined}
     * @private
     */
    _validations;

    _keyDirty = false;

    _key = '';

    /**
     * Create a new ShaderChunkMap instance.
     *
     * @param {Map<string, ChunkValidation>} [validations] - Optional map of chunk validations.
     * @ignore
     */
    constructor(validations) {
        super();
        this._validations = validations;
    }

    /**
     * Adds a new shader chunk with a specified name and shader source code to the Map. If an
     * element with the same name already exists, the element will be updated.
     *
     * @param {string} name - The name of the shader chunk.
     * @param {string} code - The shader source code.
     * @returns {this} The ShaderChunkMap instance.
     */
    set(name, code) {
        // Run validation if registered for this chunk
        Debug.call(() => {
            const validation = this._validations?.get(name);
            if (validation) {
                const isDefault = code === validation.defaultCodeGLSL || code === validation.defaultCodeWGSL;
                if (!isDefault) {
                    if (validation.message) {
                        Debug.deprecated(validation.message);
                    }
                    if (validation.callback) {
                        validation.callback(name, code);
                    }
                }
            }
        });

        if (!this.has(name) || this.get(name) !== code) {
            this.markDirty();
        }
        return super.set(name, code);
    }

    /**
     * Adds multiple shader chunks to the Map. This method accepts an object where the keys are the
     * names of the shader chunks and the values are the shader source code. If an element with the
     * same name already exists, the element will be updated.
     *
     * @param {Object} object - Object containing shader chunks.
     * @param {boolean} override - Whether to override existing shader chunks. Defaults to true.
     * @returns {this} The ShaderChunkMap instance.
     */
    add(object, override = true) {
        for (const [key, value] of Object.entries(object)) {
            if (override || !this.has(key)) {
                this.set(key, value);
            }
        }
        return this;
    }

    /**
     * Removes a shader chunk by name from the Map. If the element does not exist, no action is
     * taken.
     *
     * @param {string} name - The name of the shader chunk to remove.
     * @returns {boolean} True if an element in the Map existed and has been removed, or false if the
     * element does not exist.
     */
    delete(name) {
        const existed = this.has(name);
        const result = super.delete(name);
        if (existed && result) {
            this.markDirty();
        }
        return result;
    }

    /**
     * Removes all shader chunks from the Map.
     */
    clear() {
        if (this.size > 0) {
            this.markDirty();
        }
        super.clear();
    }

    markDirty() {
        this._dirty = true;
        this._keyDirty = true;
    }

    isDirty() {
        return this._dirty;
    }

    resetDirty() {
        this._dirty = false;
    }

    get key() {
        if (this._keyDirty) {
            this._keyDirty = false;

            // unique key for this chunk map
            this._key = Array.from(this.entries())
            .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
            .map(([k, v]) => `${k}=${hashCode(v)}`)
            .join(',');
        }

        return this._key;
    }

    /**
     * Copy the shader chunk map.
     *
     * @param {ShaderChunkMap} source - The instance to copy.
     * @returns {this} The destination instance.
     * @ignore
     */
    copy(source) {
        this.clear();
        for (const [key, value] of source) {
            this.set(key, value);
        }

        return this;
    }
}

export { ShaderChunkMap };
