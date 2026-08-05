// Read functions for large work buffer format (GSPLATDATA_LARGE, 32 bytes/splat).
// Uses GSPLAT_COLOR_FLOAT define to switch between float and uint color reading paths.
export default /* wgsl */`
// Required call order: getCenter() first, then getOpacity() (loads and caches color),
// then getColor() (returns cached RGB). getRotation(), getScale() can follow in any order.
var<private> cachedTransformA: vec4u;
var<private> cachedTransformB: vec2u;
var<private> cachedColor: vec4f;

fn getCenter() -> vec3f {
    cachedTransformA = loadDataTransformA();
    cachedTransformB = loadDataTransformB().xy;
    return vec3f(bitcast<f32>(cachedTransformA.r), bitcast<f32>(cachedTransformA.g), bitcast<f32>(cachedTransformA.b));
}

fn getOpacity() -> f32 {
    #ifdef GSPLAT_COLOR_FLOAT
        cachedColor = loadDataColor();
    #else
        let packedColor = loadDataColor();
        let packed_rg = packedColor.r | (packedColor.g << 16u);
        let packed_ba = packedColor.b | (packedColor.a << 16u);
        cachedColor = vec4f(unpack2x16float(packed_rg), unpack2x16float(packed_ba));
    #endif
    return cachedColor.a;
}

fn getColor() -> vec3f {
    return cachedColor.rgb;
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
