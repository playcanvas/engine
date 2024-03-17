import { Debug } from '../../core/debug.js';
import { math } from '../../core/math/math.js';
import {
    uniformTypeToName, bindGroupNames,
    UNIFORMTYPE_BOOL, UNIFORMTYPE_INT, UNIFORMTYPE_FLOAT, UNIFORMTYPE_UINT, UNIFORMTYPE_VEC2,
    UNIFORMTYPE_VEC3, UNIFORMTYPE_VEC4, UNIFORMTYPE_IVEC2, UNIFORMTYPE_UVEC2, UNIFORMTYPE_IVEC3,
    UNIFORMTYPE_IVEC4, UNIFORMTYPE_BVEC2, UNIFORMTYPE_BVEC3, UNIFORMTYPE_UVEC3, UNIFORMTYPE_BVEC4,
    UNIFORMTYPE_MAT4, UNIFORMTYPE_MAT2, UNIFORMTYPE_MAT3, UNIFORMTYPE_FLOATARRAY, UNIFORMTYPE_UVEC4,
    UNIFORMTYPE_VEC2ARRAY, UNIFORMTYPE_VEC3ARRAY, UNIFORMTYPE_VEC4ARRAY, UNIFORMTYPE_MAT4ARRAY, UNIFORMTYPE_INTARRAY,
    UNIFORMTYPE_UINTARRAY, UNIFORMTYPE_BOOLARRAY, UNIFORMTYPE_IVEC2ARRAY, UNIFORMTYPE_UVEC2ARRAY,
    UNIFORMTYPE_BVEC2ARRAY, UNIFORMTYPE_IVEC3ARRAY, UNIFORMTYPE_UVEC3ARRAY, UNIFORMTYPE_BVEC3ARRAY,
    UNIFORMTYPE_IVEC4ARRAY, UNIFORMTYPE_UVEC4ARRAY, UNIFORMTYPE_BVEC4ARRAY
} from './constants.js';

// map of UNIFORMTYPE_*** to number of 32bit components
const uniformTypeToNumComponents = [];
uniformTypeToNumComponents[UNIFORMTYPE_FLOAT] = 1;
uniformTypeToNumComponents[UNIFORMTYPE_VEC2] = 2;
uniformTypeToNumComponents[UNIFORMTYPE_VEC3] = 3;
uniformTypeToNumComponents[UNIFORMTYPE_VEC4] = 4;
uniformTypeToNumComponents[UNIFORMTYPE_INT] = 1;
uniformTypeToNumComponents[UNIFORMTYPE_IVEC2] = 2;
uniformTypeToNumComponents[UNIFORMTYPE_IVEC3] = 3;
uniformTypeToNumComponents[UNIFORMTYPE_IVEC4] = 4;
uniformTypeToNumComponents[UNIFORMTYPE_BOOL] = 1;
uniformTypeToNumComponents[UNIFORMTYPE_BVEC2] = 2;
uniformTypeToNumComponents[UNIFORMTYPE_BVEC3] = 3;
uniformTypeToNumComponents[UNIFORMTYPE_BVEC4] = 4;
uniformTypeToNumComponents[UNIFORMTYPE_MAT2] = 8;    // 2 x vec4
uniformTypeToNumComponents[UNIFORMTYPE_MAT3] = 12;   // 3 x vec4
uniformTypeToNumComponents[UNIFORMTYPE_MAT4] = 16;   // 4 x vec4
uniformTypeToNumComponents[UNIFORMTYPE_UINT] = 1;
uniformTypeToNumComponents[UNIFORMTYPE_UVEC2] = 2;
uniformTypeToNumComponents[UNIFORMTYPE_UVEC3] = 3;
uniformTypeToNumComponents[UNIFORMTYPE_UVEC4] = 4;


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
     * Count of elements for arrays, otherwise 0.
     *
     * @type {number}
     */
    count;

    /**
     * Number of components in each element (e.g. vec2 has 2 components, mat4 has 16 components)
     *
     * @type {number}
     */
    numComponents;

    /**
     * True if this is an array of elements (i.e. count > 0)
     *
     * @type {boolean}
     */
    get isArrayType() {
        return this.count > 0;
    }

    constructor(name, type, count = 0) {

        // just a name
        this.shortName = name;

        // name with [0] if this is an array
        this.name = count ? `${name}[0]` : name;

        this.type = type;

        this.numComponents = uniformTypeToNumComponents[type];
        Debug.assert(this.numComponents, `Unhandled uniform format ${type} used for ${name}`);

        this.updateType = type;
        if (count > 0) {

            switch (type) {
                case UNIFORMTYPE_FLOAT: this.updateType = UNIFORMTYPE_FLOATARRAY; break;
                case UNIFORMTYPE_INT: this.updateType = UNIFORMTYPE_INTARRAY; break;
                case UNIFORMTYPE_UINT: this.updateType = UNIFORMTYPE_UINTARRAY; break;
                case UNIFORMTYPE_BOOL: this.updateType = UNIFORMTYPE_BOOLARRAY; break;

                case UNIFORMTYPE_VEC2: this.updateType = UNIFORMTYPE_VEC2ARRAY; break;
                case UNIFORMTYPE_IVEC2: this.updateType = UNIFORMTYPE_IVEC2ARRAY; break;
                case UNIFORMTYPE_UVEC2: this.updateType = UNIFORMTYPE_UVEC2ARRAY; break;
                case UNIFORMTYPE_BVEC2: this.updateType = UNIFORMTYPE_BVEC2ARRAY; break;

                case UNIFORMTYPE_VEC3: this.updateType = UNIFORMTYPE_VEC3ARRAY; break;
                case UNIFORMTYPE_IVEC3: this.updateType = UNIFORMTYPE_IVEC3ARRAY; break;
                case UNIFORMTYPE_UVEC3: this.updateType = UNIFORMTYPE_UVEC3ARRAY; break;
                case UNIFORMTYPE_BVEC3: this.updateType = UNIFORMTYPE_BVEC3ARRAY; break;

                case UNIFORMTYPE_VEC4: this.updateType = UNIFORMTYPE_VEC4ARRAY; break;
                case UNIFORMTYPE_IVEC4: this.updateType = UNIFORMTYPE_IVEC4ARRAY; break;
                case UNIFORMTYPE_UVEC4: this.updateType = UNIFORMTYPE_UVEC4ARRAY; break;
                case UNIFORMTYPE_BVEC4: this.updateType = UNIFORMTYPE_BVEC4ARRAY; break;

                case UNIFORMTYPE_MAT4: this.updateType = UNIFORMTYPE_MAT4ARRAY; break;

                default:
                    Debug.error(`Uniform array of type ${uniformTypeToName[type]} is not supported when processing uniform '${name}'.`);
                    Debug.call(() => {
                        this.invalid = true;
                    });
                    break;
            }
        }

        this.count = count;
        Debug.assert(!isNaN(count), `Unsupported uniform: ${name}[${count}]`);
        Debug.call(() => {
            if (isNaN(count))
                this.invalid = true;
        });

        let componentSize = this.numComponents;

        // component size for arrays is aligned up to vec4
        if (count) {
            componentSize = math.roundUp(componentSize, 4);
        }

        this.byteSize = componentSize * 4;
        if (count)
            this.byteSize *= count;

        Debug.assert(this.byteSize, `Unknown byte size for uniform format ${type} used for ${name}`);
    }

    // std140 rules: https://registry.khronos.org/OpenGL/specs/gl/glspec45.core.pdf#page=159
    // TODO: this support limited subset of functionality, arrays and structs are not supported.
    calculateOffset(offset) {

        // Note: vec3 has the same alignment as vec4
        let alignment = this.byteSize <= 8 ? this.byteSize : 16;

        // arrays have vec4 alignments
        if (this.count)
            alignment = 16;

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
     * Returns format of a uniform with specified name. Returns undefined if the uniform is not found.
     *
     * @param {string} name - The name of the uniform.
     * @returns {UniformFormat|undefined} - The format of the uniform.
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
            code += `    ${typeString} ${uniform.shortName}${uniform.count ? `[${uniform.count}]` : ''};\n`;
        });

        return code + '};\n';
    }
}

export { UniformFormat, UniformBufferFormat };
