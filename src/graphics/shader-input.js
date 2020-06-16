import { UNIFORMTYPE_FLOAT, UNIFORMTYPE_FLOATARRAY } from './graphics.js';
import { Version } from './version.js';

function ShaderInput(graphicsDevice, name, type, locationId) {
    // Set the shader attribute location
    this.locationId = locationId;

    // Resolve the ScopeId for the attribute name
    this.scopeId = graphicsDevice.scope.resolve(name);

    // Create the version
    this.version = new Version();

    // Set the data dataType
    if (type === UNIFORMTYPE_FLOAT) {
        if (name.substr(name.length - 3) === "[0]") type = UNIFORMTYPE_FLOATARRAY;
    }
    this.dataType = type;

    this.value = [null, null, null, null];

    // Array to hold texture unit ids
    this.array = [];
}

export { ShaderInput };