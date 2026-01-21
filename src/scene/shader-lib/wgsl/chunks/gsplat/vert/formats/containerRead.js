// Read functions for Container GSplat format
export default /* wgsl */`
fn readCenter(source: ptr<function, SplatSource>) -> vec3f {
    splatUV = (*source).uv;
    #include "gsplatContainerUserReadVS"
    return splatCenter;
}

fn getRotation() -> vec4f {
    return splatRotation;
}

fn getScale() -> vec3f {
    return splatScale;
}

fn readColor(source: ptr<function, SplatSource>) -> vec4f {
    return splatColor;
}
`;
