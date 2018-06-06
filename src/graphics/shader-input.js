Object.assign(pc, function () {
    'use strict';

    var ShaderInput = function (graphicsDevice, name, type, locationId) {
        // Set the shader attribute location
        this.locationId = locationId;

        // Resolve the ScopeId for the attribute name
        this.scopeId = graphicsDevice.scope.resolve(name);

        // Create the version
        this.version = new pc.Version();

        // Set the data type
        if (type === pc.UNIFORMTYPE_FLOAT) {
            if (name.substr(name.length - 3) === "[0]") type = pc.UNIFORMTYPE_FLOATARRAY;
        }
        this.dataType = type;

        this.value = [null, null, null, null];

        // Array to hold texture unit ids
        this.array = [];
    };

    return {
        ShaderInput: ShaderInput
    };
}());
