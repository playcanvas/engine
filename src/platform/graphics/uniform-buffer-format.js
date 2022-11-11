import { Debug } from '../../core/debug.js';
import { math } from '../../core/math/math.js';
import {
    uniformTypeToName, bindGroupNames,
    UNIFORMTYPE_BOOL, UNIFORMTYPE_INT, UNIFORMTYPE_FLOAT, UNIFORMTYPE_VEC2, UNIFORMTYPE_VEC3,
    UNIFORMTYPE_VEC4, UNIFORMTYPE_IVEC2, UNIFORMTYPE_IVEC3, UNIFORMTYPE_IVEC4, UNIFORMTYPE_BVEC2,
    UNIFORMTYPE_BVEC3, UNIFORMTYPE_BVEC4, UNIFORMTYPE_MAT4, UNIFORMTYPE_MAT2, UNIFORMTYPE_MAT3
} from './constants.js';

// map of UNIFORMTYPE_*** to number of 32bit elements
const uniformTypeToNumElements = [];
uniformTypeToNumElements[UNIFORMTYPE_FLOAT] = 1;
uniformTypeToNumElements[UNIFORMTYPE_VEC2] = 2;
uniformTypeToNumElements[UNIFORMTYPE_VEC3] = 3;
uniformTypeToNumElements[UNIFORMTYPE_VEC4] = 4;
uniformTypeToNumElements[UNIFORMTYPE_INT] = 1;
uniformTypeToNumElements[UNIFORMTYPE_IVEC2] = 2;
uniformTypeToNumElements[UNIFORMTYPE_IVEC3] = 3;
uniformTypeToNumElements[UNIFORMTYPE_IVEC4] = 4;
uniformTypeToNumElements[UNIFORMTYPE_BOOL] = 1;
uniformTypeToNumElements[UNIFORMTYPE_BVEC2] = 2;
uniformTypeToNumElements[UNIFORMTYPE_BVEC3] = 3;
uniformTypeToNumElements[UNIFORMTYPE_BVEC4] = 4;
uniformTypeToNumElements[UNIFORMTYPE_MAT2] = 8;    // 2 x vec4
uniformTypeToNumElements[UNIFORMTYPE_MAT3] = 12;   // 3 x vec4
uniformTypeToNumElements[UNIFORMTYPE_MAT4] = 16;   // 4 x vec4

// Handle additional types:
//      UNIFORMTYPE_FLOATARRAY = 17;
//      UNIFORMTYPE_VEC2ARRAY = 21;
//      UNIFORMTYPE_VEC3ARRAY = 22;
//      UNIFORMTYPE_VEC4ARRAY = 23;

/**
 * A class storing description of an individual uniform, stored inside a uniform buffer.
 *
 * @ignore
 */
class UniformFormat {
    /** @type {string} */
    name;

    // UNIFORMTYPE_***
    /** @type {number} */
    type;

    /** @type {number} */
    byteSize;

    /**
     * Index of the uniform in an array of 32bit values (Float32Array and similar)
     *
     * @type {number}
     */
    offset;

    /** @type {import('./scope-id.js').ScopeId} */
    scopeId;

    /**
     * Count of elements for arrays, otherwise 1.
     *
     * @type {number}
     */
    count;

    constructor(name, type, count = 1) {
        this.name = name;
        this.type = type;

        this.count = count;
        Debug.assert(count === 1, `Uniform arrays are not currently supported - uniform ${name}`);

        const elementSize = uniformTypeToNumElements[type];
        Debug.assert(elementSize, `Unhandled uniform format ${type} used for ${name}`);

        this.byteSize = count * elementSize * 4;
        Debug.assert(this.byteSize, `Unknown byte size for uniform format ${type} used for ${name}`);
    }

    // std140 rules: https://registry.khronos.org/OpenGL/specs/gl/glspec45.core.pdf#page=159
    // TODO: this support limited subset of functionality, arrays and structs are not supported.
    calculateOffset(offset) {

        // Note: vec3 has the same alignment as vec4
        const alignment = this.byteSize <= 8 ? this.byteSize : 16;

        // align the start offset
        offset = math.roundUp(offset, alignment);
        this.offset = offset / 4;
    }
}

/**
 * A descriptor that defines the layout of of data inside the {@link UniformBuffer}.
 *
 * @ignore
 */
class UniformBufferFormat {
    /** @type {number} */
    byteSize = 0;

    /** @type {Map<string,UniformFormat>} */
    map = new Map();

    /**
     * Create a new UniformBufferFormat instance.
     *
     * @param {import('./graphics-device.js').GraphicsDevice} graphicsDevice - The graphics device.
     * @param {UniformFormat[]} uniforms - An array of uniforms to be stored in the buffer
     */
    constructor(graphicsDevice, uniforms) {
        this.scope = graphicsDevice.scope;

        /** @type {UniformFormat[]} */
        this.uniforms = uniforms;

        // TODO: optimize uniforms ordering

        let offset = 0;
        for (let i = 0; i < uniforms.length; i++) {
            const uniform = uniforms[i];
            uniform.calculateOffset(offset);
            offset = uniform.offset * 4 + uniform.byteSize;

            uniform.scopeId = this.scope.resolve(uniform.name);

            this.map.set(uniform.name, uniform);
        }

        // round up buffer size
        this.byteSize = math.roundUp(offset, 16);
    }

    /**
     * Returns format of a uniform with specified name.
     *
     * @param {string} name - The name of the uniform.
     * @returns {UniformFormat} - The format of the uniform.
     */
    get(name) {
        return this.map.get(name);
    }

    getShaderDeclaration(bindGroup, bindIndex) {

        const name = bindGroupNames[bindGroup];
        let code = `layout(set = ${bindGroup}, binding = ${bindIndex}, std140) uniform ub_${name} {\n`;

        this.uniforms.forEach((uniform) => {
            const typeString = uniformTypeToName[uniform.type];
            Debug.assert(typeString.length > 0, `Uniform type ${uniform.type} is not handled.`);
            code += `    ${typeString} ${uniform.name};\n`;
        });

        return code + '};\n';
    }
}

export { UniformFormat, UniformBufferFormat };
