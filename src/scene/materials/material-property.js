import { Color } from '../../core/math/color.js';

/**
 * @import { Material } from './material.js'
 */

const _tempColor = new Color();

/**
 * Describes a typed material property whose value is stored in the material uniform buffer: the
 * public property name, the uniform it feeds, the uniform type and the conversion from the public
 * value to the uniform data. Descriptors are static, one per property of a material class, and
 * are shared by all instances of that class.
 *
 * @ignore
 */
class MaterialProperty {
    /**
     * The public property name, for example 'diffuse'.
     *
     * @type {string}
     */
    name;

    /**
     * The name of the field storing the public value on the material, for example '_diffuse'.
     *
     * @type {string}
     */
    backingName;

    /**
     * The name of the uniform in the material uniform buffer, for example 'material_diffuse'.
     *
     * @type {string}
     */
    uniformName;

    /**
     * The type of the uniform, one of UNIFORMTYPE_***.
     *
     * @type {number}
     */
    type;

    /**
     * The array size of the uniform, 0 for a non-array uniform.
     *
     * @type {number}
     */
    count;

    /**
     * Writes the uniform data for a public value into the float storage of a uniform buffer at
     * the given element offset. A uniform derived from several properties reads the others from
     * the material.
     *
     * @type {(value: any, storage: Float32Array, offset: number, material: Material) => void}
     */
    convert;

    /**
     * A string describing the uniform of the property, used to build and order the layout key.
     *
     * @type {string}
     */
    key;

    /**
     * @param {string} name - The public property name.
     * @param {string} uniformName - The name of the uniform in the material uniform buffer.
     * @param {number} type - The type of the uniform, one of UNIFORMTYPE_***.
     * @param {(value: any, storage: Float32Array, offset: number, material: Material) => void} convert - Converts
     * the public value into the uniform data, reading any other property it depends on from the
     * material.
     * @param {number} [count] - The array size of the uniform. Defaults to 0 (not an array).
     */
    constructor(name, uniformName, type, convert, count = 0) {
        this.name = name;
        this.backingName = `_${name}`;
        this.uniformName = uniformName;
        this.type = type;
        this.convert = convert;
        this.count = count;
        this.key = `${uniformName}:${type}:${count}`;
    }
}

/**
 * Converts an sRGB color to a linear RGB uniform value.
 *
 * @param {Color} color - The color in sRGB space.
 * @param {Float32Array} storage - The uniform buffer storage.
 * @param {number} offset - The element offset of the uniform in the storage.
 * @ignore
 */
const convertColorToLinear = (color, storage, offset) => {
    _tempColor.linear(color);
    storage[offset] = _tempColor.r;
    storage[offset + 1] = _tempColor.g;
    storage[offset + 2] = _tempColor.b;
};

/**
 * Writes a number to a float uniform value.
 *
 * @param {number} value - The number.
 * @param {Float32Array} storage - The uniform buffer storage.
 * @param {number} offset - The element offset of the uniform in the storage.
 * @ignore
 */
const convertFloat = (value, storage, offset) => {
    storage[offset] = value;
};

export { MaterialProperty, convertColorToLinear, convertFloat };
