import { UNIFORMTYPE_FLOAT, UNIFORMTYPE_FLOATARRAY, UNIFORMTYPE_VEC2, UNIFORMTYPE_VEC3, UNIFORMTYPE_VEC4,
    UNIFORMTYPE_VEC2ARRAY, UNIFORMTYPE_VEC3ARRAY, UNIFORMTYPE_VEC4ARRAY } from './graphics.js';
import { Version } from './version.js';

function ShaderInput(graphicsDevice, name, type, locationId) {
    // Set the shader attribute location
    this.locationId = locationId;

    // Resolve the ScopeId for the attribute name
    this.scopeId = graphicsDevice.scope.resolve(name);

    // Create the version
    this.version = new Version();

    // custom data type for arrays
    if (name.substr(name.length - 3) === "[0]") {
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

export { ShaderInput };
