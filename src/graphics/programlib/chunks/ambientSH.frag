uniform vec3 ambientSH[9];
void addAmbient(inout psInternalData data) {
    vec3 n = data.normalW;

    data.diffuseLight =
                        ambientSH[0] +
                        ambientSH[1] * n.x +
                        ambientSH[2] * n.y +
                        ambientSH[3] * n.z +
                        ambientSH[4] * n.x * n.z +
                        ambientSH[5] * n.z * n.y +
                        ambientSH[6] * n.y * n.x +
                        ambientSH[7] * (3.0 * n.z * n.z - 1.0) +
                        ambientSH[8] * (n.x * n.x - n.y * n.y);

    data.diffuseLight = processEnvironment(max(data.diffuseLight, vec3(0.0)));
}

