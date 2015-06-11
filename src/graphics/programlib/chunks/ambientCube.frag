//vec3 ambientNX, ambientPX, ambientNY, ambientPY, ambientNZ, ambientPZ;
uniform vec3 ambientCube[6];
void addAmbient(inout psInternalData data) {
    vec3 n = data.normalW;
    vec3 ns = n * n;
    bvec3 isNeg = lessThan(n, vec3(0.0));

    data.diffuseLight = ns.x * (isNeg.x? ambientCube[1] : ambientCube[0]) +
                        ns.y * (isNeg.y? ambientCube[2] : ambientCube[3]) +
                        ns.z * (isNeg.z? ambientCube[4] : ambientCube[5]);
}

