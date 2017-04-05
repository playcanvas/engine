vec3 billboard(vec3 instanceCoords, vec2 quadXY, out mat3 localMat)
{
    mat3 billMat;
    billMat[0] = -matrix_viewInverse[0].xyz;
    billMat[1] = -matrix_viewInverse[1].xyz;
    billMat[2] = -matrix_viewInverse[2].xyz;
    vec3 pos = billMat * vec3(quadXY, 0);

    localMat = billMat;

    return pos;
}
