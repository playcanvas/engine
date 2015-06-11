uniform vec3 ambientSH[9];
void addAmbient(inout psInternalData data) {
    vec3 n = data.normalW;
    n.x *= -1.0;

    float x = n.x;
    float y = n.y;
    float z = n.z;

    float nx = max(-x, 0.0);
    float px = max(x, 0.0);
    float ny = max(-y, 0.0);
    float py = max(y, 0.0);
    float nz = max(-z, 0.0);
    float pz = max(z, 0.0);

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

                        /*ambientSH[9] * (-3.0 * x*x * y + y*y*y) +
                        ambientSH[10] * x * y * z +
                        ambientSH[11] * y * (-1.0 + 5.0 * z*z) +
                        ambientSH[12] * z * (-3.0 + 5.0 * z*z) +
                        ambientSH[13] * x * (-1.0 + 5.0 * z*z) +
                        ambientSH[14] * (x*x - y*y) * z +
                        ambientSH[15] * (x*x*x - 3.0 * x * y*y) +
                        ambientSH[16] * x * y * (x*x - y*y) +
                        ambientSH[17] * (3.0 * x*x * y - y*y*y) * z +
                        ambientSH[18] * x * y * (-1.0 + 7.0 * z*z) +
                        ambientSH[19] * y * z * (-3.0 + 7.0 * z*z) +
                        ambientSH[20] * (3.0 - 30.0 * z*z + 35.0 * z*z*z*z) +
                        ambientSH[21] * x * z * (-3.0 + 7.0 * z*z) +
                        ambientSH[22] * (x*x - y*y) * (-1.0 + 7.0 * z*z) +
                        ambientSH[23] * (x*x*x - 3.0 * x * y*y) * z +
                        ambientSH[24] * (x*x*x*x - 6.0 * x*x * y*y + y*y*y*y);*/


                        //data.diffuseLight = vec3(3.0 * n.z * n.z - 1.0);
    //data.diffuseLight = max(data.diffuseLight, vec3(0.001));
}

