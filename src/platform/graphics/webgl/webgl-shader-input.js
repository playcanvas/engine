import { UNIFORMTYPE_FLOAT, UNIFORMTYPE_FLOATARRAY, UNIFORMTYPE_VEC2, UNIFORMTYPE_VEC3, UNIFORMTYPE_VEC4,
    UNIFORMTYPE_VEC2ARRAY, UNIFORMTYPE_VEC3ARRAY, UNIFORMTYPE_VEC4ARRAY } from '../constants.js';
import { Version } from '../version.js';

/**
 * Representation of a shader uniform.
 *
 * @ignore
 */
class WebglShaderInput {
    /**
     * Create a new WebglShaderInput instance.
     *
     * @param {import('../graphics-device.js').GraphicsDevice} graphicsDevice - The graphics device
     * used to manage this shader input.
     * @param {string} name - The name of the shader input.
     * @param {number} type - The type of the shader input.
     * @param {number | WebGLUniformLocation} locationId - The location id of the shader input.
     */
    constructor(graphicsDevice, name, type, locationId) {
        // Set the shader attribute location
        this.locationId = locationId;

        // Resolve the ScopeId for the attribute name
        this.scopeId = graphicsDevice.scope.resolve(name);

        // Create the version
        this.version = new Version();

        // custom data type for arrays
        if (name.substring(name.length - 3) === "[0]") {
            switch (type) {
                case UNIFORMTYPE_FLOAT: type = UNIFORMTYPE_FLOATARRAY; break;
                case UNIFORMTYPE_VEC2: type = UNIFORMTYPE_VEC2ARRAY; break;
                case UNIFORMTYPE_VEC3: type = UNIFORMTYPE_VEC3ARRAY; break;
                case UNIFORMTYPE_VEC4: type = UNIFORMTYPE_VEC4ARRAY; break;
            }
        }

        // Set the data dataType
        this.dataType = type;

        this.value = [null, null, null, null];

        // Array to hold texture unit ids
        this.array = [];
    }
}

export { WebglShaderInput };
