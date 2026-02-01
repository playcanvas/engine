// Read functions for Container GSplat format
export default /* wgsl */`
fn getCenter() -> vec3f {
    #include "gsplatContainerUserReadVS"
    return splatCenter;
}

fn getRotation() -> vec4f {
    return splatRotation;
}

fn getScale() -> vec3f {
    return splatScale;
}

fn getColor() -> vec4f {
    return splatColor;
}
`;
