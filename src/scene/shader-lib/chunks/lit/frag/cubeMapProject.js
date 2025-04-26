export default /* glsl */`

#if LIT_CUBEMAP_PROJECTION == BOX
    uniform vec3 envBoxMin;
    uniform vec3 envBoxMax;
#endif

vec3 cubeMapProject(vec3 nrdir) {

    #if LIT_CUBEMAP_PROJECTION == NONE
        return cubeMapRotate(nrdir);
    #endif

    #if LIT_CUBEMAP_PROJECTION == BOX

        nrdir = cubeMapRotate(nrdir);

        vec3 rbmax = (envBoxMax - vPositionW) / nrdir;
        vec3 rbmin = (envBoxMin - vPositionW) / nrdir;

        vec3 rbminmax = mix(rbmin, rbmax, vec3(greaterThan(nrdir, vec3(0.0))));
        float fa = min(min(rbminmax.x, rbminmax.y), rbminmax.z);

        vec3 posonbox = vPositionW + nrdir * fa;
        vec3 envBoxPos = (envBoxMin + envBoxMax) * 0.5;
        return normalize(posonbox - envBoxPos);

    #endif
}
`;
