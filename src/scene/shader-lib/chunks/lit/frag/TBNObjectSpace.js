export default /* glsl */`
void getTBN(vec3 tangent, vec3 binormal, vec3 normal) {

    vec3 B = cross(normal, vObjectSpaceUpW);
    vec3 T = cross(normal, B);

    if (dot(B,B)==0.0) // deal with case when vObjectSpaceUpW normal are parallel
    {
        float major=max(max(normal.x, normal.y), normal.z);

        if (normal.x == major)
        {
            B=cross(normal, vec3(0,1,0));
            T=cross(normal, B);
        }
        else if (normal.y == major)
        {
            B=cross(normal, vec3(0,0,1));
            T=cross(normal, B);
        }
        else if (normal.z == major)
        {
            B=cross(normal, vec3(1,0,0));
            T=cross(normal, B);
        }
    }

    dTBN = mat3(normalize(T), normalize(B), normalize(normal));
}
`;
