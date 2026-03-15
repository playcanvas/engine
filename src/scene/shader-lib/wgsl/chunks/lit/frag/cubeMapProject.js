export default /* wgsl */`

#if LIT_CUBEMAP_PROJECTION == BOX
    uniform envBoxMin: vec3f;
    uniform envBoxMax: vec3f;
#endif

fn cubeMapProject(nrdir: vec3f) -> vec3f {

    #if LIT_CUBEMAP_PROJECTION == NONE
        return cubeMapRotate(nrdir);
    #endif

    #if LIT_CUBEMAP_PROJECTION == BOX

        let nrdir_rotated: vec3f = cubeMapRotate(nrdir);

        let rbmax: vec3f = (uniform.envBoxMax - vPositionW) / nrdir_rotated;
        let rbmin: vec3f = (uniform.envBoxMin - vPositionW) / nrdir_rotated;

        let rbminmax: vec3f = select(rbmin, rbmax, nrdir_rotated > vec3f(0.0));
        let fa: f32 = min(min(rbminmax.x, rbminmax.y), rbminmax.z);

        let posonbox: vec3f = vPositionW + nrdir_rotated * fa;
        let envBoxPos: vec3f = (uniform.envBoxMin + uniform.envBoxMax) * 0.5;
        return normalize(posonbox - envBoxPos);

    #endif
}
`;
