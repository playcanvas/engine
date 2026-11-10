export default /* wgsl */`
fn evalOmniLight(lightPosW: vec3f) -> vec3f {
    return litArgs_worldPosition - lightPosW;
}
`;
