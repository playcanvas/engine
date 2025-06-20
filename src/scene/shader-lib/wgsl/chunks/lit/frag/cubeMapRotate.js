export default /* wgsl */`
#ifdef CUBEMAP_ROTATION
uniform cubeMapRotationMatrix: mat3x3f;
#endif

fn cubeMapRotate(refDir: vec3f) -> vec3f {
#ifdef CUBEMAP_ROTATION
    return refDir * uniform.cubeMapRotationMatrix;
#else
    return refDir;
#endif
}
`;
