// Read functions for packed format - used by:
// - GSplatFormat.createPackedFormat() for reading from GSplatContainer (RGBA16U color)
// - Work buffer format for reading during forward rendering (RGBA16F/RGBA16U color)
// Uses GSPLAT_COLOR_FLOAT define to switch between float and uint color reading paths
export default /* wgsl */`
// cached texture fetches
var<private> cachedTransformA: vec4u;
var<private> cachedTransformB: vec2u;

fn getCenter() -> vec3f {
    cachedTransformA = loadDataTransformA();
    cachedTransformB = loadDataTransformB().xy;
    return vec3f(bitcast<f32>(cachedTransformA.r), bitcast<f32>(cachedTransformA.g), bitcast<f32>(cachedTransformA.b));
}

fn getColor() -> vec4f {
    #ifdef GSPLAT_COLOR_FLOAT
        return loadDataColor();
    #else
        // Unpack RGBA from 4x half-float (16-bit) values stored in RGBA16U format
        let packedColor = loadDataColor();
        let packed_rg = packedColor.r | (packedColor.g << 16u);
        let packed_ba = packedColor.b | (packedColor.a << 16u);
        return vec4f(unpack2x16float(packed_rg), unpack2x16float(packed_ba));
    #endif
}

fn getRotation() -> vec4f {
    let rotXY = unpack2x16float(cachedTransformA.a);
    let rotZscaleX = unpack2x16float(cachedTransformB.x);
    let rotXYZ = vec3f(rotXY, rotZscaleX.x);
    return vec4f(rotXYZ, sqrt(max(0.0, 1.0 - dot(rotXYZ, rotXYZ)))).wxyz;
}

fn getScale() -> vec3f {
    let rotZscaleX = unpack2x16float(cachedTransformB.x);
    let scaleYZ = unpack2x16float(cachedTransformB.y);
    return vec3f(rotZscaleX.y, scaleYZ);
}
`;
