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

pc.gfx.ShaderInput = function (name, type, locationId) {
    // Set the shader attribute location
    this.locationId = locationId;

    // Resolve the ScopeId for the attribute name
    var device = pc.gfx.Device.getCurrent();
    this.scopeId = device.scope.resolve(name);

    // Create the version
    this.version = new pc.gfx.Version();

    // Set the data type
    this.dataType = type;

    this.commitArgs = [locationId];
    this.valueIndex = 1;
    var f;
    var gl = pc.gfx.Device.getCurrent().gl;
    switch (type) {
        case pc.gfx.ShaderInputType.BOOL: 
        case pc.gfx.ShaderInputType.INT: 
            f = gl.uniform1i;
            break;
        case pc.gfx.ShaderInputType.FLOAT: 
            f = gl.uniform1f;
            break;
        case pc.gfx.ShaderInputType.VEC2: 
            f = gl.uniform2fv;
            break;
        case pc.gfx.ShaderInputType.VEC3: 
            f = gl.uniform3fv;
            break;
        case pc.gfx.ShaderInputType.VEC4: 
            f = gl.uniform4fv;
            break;
        case pc.gfx.ShaderInputType.BVEC2: 
        case pc.gfx.ShaderInputType.IVEC2: 
            f = gl.uniform2iv;
            break;
        case pc.gfx.ShaderInputType.BVEC3: 
        case pc.gfx.ShaderInputType.IVEC3: 
            f = gl.uniform3iv;
            break;
        case pc.gfx.ShaderInputType.BVEC4: 
        case pc.gfx.ShaderInputType.IVEC4: 
            f = gl.uniform4iv;
            break;
        case pc.gfx.ShaderInputType.MAT2: 
            f = gl.uniformMatrix2fv;
            this.commitArgs.push(false);
            this.valueIndex = 2;
            break;
        case pc.gfx.ShaderInputType.MAT3: 
            f = gl.uniformMatrix3fv;
            this.commitArgs.push(false);
            this.valueIndex = 2;
            break;
        case pc.gfx.ShaderInputType.MAT4: 
            f = gl.uniformMatrix4fv;
            this.commitArgs.push(false);
            this.valueIndex = 2;
            break;
    }
    this.commitFunc = f;

    this.slot = -1;
};
