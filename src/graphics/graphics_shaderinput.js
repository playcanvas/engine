pc.gfx.ShaderInputType = {
    BOOL: 0,
    INT: 1,
    FLOAT: 2,
    VEC2: 3,
    VEC3: 4,
    VEC4: 5,
    IVEC2: 6,
    IVEC3: 7,
    IVEC4: 8,
    BVEC2: 9,
    BVEC3: 10,
    BVEC4: 11,
    MAT2: 12,
    MAT3: 13,
    MAT4: 14,
    TEXTURE2D: 15,
    TEXTURECUBE: 16
};

pc.gfx.ShaderInput = function (graphicsDevice, name, type, locationId) {
    // Set the shader attribute location
    this.locationId = locationId;

    // Resolve the ScopeId for the attribute name
    this.scopeId = graphicsDevice.scope.resolve(name);

    // Create the version
    this.version = new pc.gfx.Version();

    // Set the data type
    this.dataType = type;
};
