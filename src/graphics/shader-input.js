pc.extend(pc, function () {
    'use strict';

    var ShaderInput = function (graphicsDevice, name, type, locationId) {
        // Set the shader attribute location
        this.locationId = locationId;

        // Resolve the ScopeId for the attribute name
        this.scopeId = graphicsDevice.scope.resolve(name);

        // Create the version
        this.version = new pc.Version();

        // Set the data type
        this.dataType = type;

        // Array to hold texture unit ids
        this.array = [];
    };

    return {
        ShaderInput: ShaderInput
    }; 
}());