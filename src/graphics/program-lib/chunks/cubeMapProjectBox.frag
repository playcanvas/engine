uniform MEDP vec3 envBoxMin, envBoxMax;

vec3 cubeMapProject(vec3 nrdir) {
    nrdir = cubeMapRotate(nrdir);

    MEDP vec3 rbmax = (envBoxMax - vPositionW) / nrdir;
    MEDP vec3 rbmin = (envBoxMin - vPositionW) / nrdir;

    MEDP vec3 rbminmax;
    rbminmax.x = nrdir.x>0.0? rbmax.x : rbmin.x;
    rbminmax.y = nrdir.y>0.0? rbmax.y : rbmin.y;
    rbminmax.z = nrdir.z>0.0? rbmax.z : rbmin.z;

    MEDP float fa = min(min(rbminmax.x, rbminmax.y), rbminmax.z);

    MEDP vec3 posonbox = vPositionW + nrdir * fa;
    MEDP vec3 envBoxPos = (envBoxMin + envBoxMax) * 0.5;
    return posonbox - envBoxPos;
}
