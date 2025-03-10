export default /* glsl */`

#ifdef LIT_TANGENTS
    #define TBN_TANGENTS
#else
    #if defined(LIT_USE_NORMALS) || defined(LIT_USE_CLEARCOAT_NORMALS)
        #define TBN_DERIVATIVES
    #endif
#endif

#if defined(TBN_DERIVATIVES)
    uniform float tbnBasis;
#endif

void getTBN(vec3 tangent, vec3 binormal, vec3 normal) {

    #ifdef TBN_TANGENTS // tangents / binormals based TBN

        dTBN = mat3(normalize(tangent), normalize(binormal), normalize(normal));

    #elif defined(TBN_DERIVATIVES) // derivatives based TBN

        vec2 uv = {lightingUv};

        // get edge vectors of the pixel triangle
        vec3 dp1 = dFdx( vPositionW );
        vec3 dp2 = dFdy( vPositionW );
        vec2 duv1 = dFdx( uv );
        vec2 duv2 = dFdy( uv );

        // solve the linear system
        vec3 dp2perp = cross( dp2, normal );
        vec3 dp1perp = cross( normal, dp1 );
        vec3 T = dp2perp * duv1.x + dp1perp * duv2.x;
        vec3 B = dp2perp * duv1.y + dp1perp * duv2.y;

        // construct a scale-invariant frame
        float denom = max( dot(T,T), dot(B,B) );
        float invmax = (denom == 0.0) ? 0.0 : tbnBasis / sqrt( denom );
        dTBN = mat3(T * invmax, -B * invmax, normal );

    #else // object space TBN

        vec3 B = cross(normal, vObjectSpaceUpW);
        vec3 T = cross(normal, B);

        if (dot(B,B)==0.0) // deal with case when vObjectSpaceUpW normal are parallel
        {
            float major=max(max(normal.x, normal.y), normal.z);

            if (normal.x == major)
            {
                B = cross(normal, vec3(0,1,0));
                T = cross(normal, B);
            }
            else if (normal.y == major)
            {
                B = cross(normal, vec3(0,0,1));
                T = cross(normal, B);
            }
            else if (normal.z == major)
            {
                B = cross(normal, vec3(1,0,0));
                T = cross(normal, B);
            }
        }

        dTBN = mat3(normalize(T), normalize(B), normalize(normal));

    #endif
}
`;
