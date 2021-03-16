uniform RMEDP vec3 envBoxMin, envBoxMax;

vec3 cubeMapProject(vec3 nrdir) {
    nrdir = cubeMapRotate(nrdir);

    RMEDP vec3 rbmax = (envBoxMax - vPositionW) / nrdir;
    RMEDP vec3 rbmin = (envBoxMin - vPositionW) / nrdir;

    RMEDP vec3 rbminmax;
    rbminmax.x = nrdir.x>0.0? rbmax.x : rbmin.x;
    rbminmax.y = nrdir.y>0.0? rbmax.y : rbmin.y;
    rbminmax.z = nrdir.z>0.0? rbmax.z : rbmin.z;

    RMEDP float fa = min(min(rbminmax.x, rbminmax.y), rbminmax.z);

    RMEDP vec3 posonbox = vPositionW + nrdir * fa;
    RMEDP vec3 envBoxPos = (envBoxMin + envBoxMax) * 0.5;
    return posonbox - envBoxPos;
}
