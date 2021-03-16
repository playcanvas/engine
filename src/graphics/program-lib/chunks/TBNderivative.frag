// http://www.thetenthplanet.de/archives/1180
void getTBN() {
    MEDP vec2 uv = $UV;

    // get edge vectors of the pixel triangle
    MEDP vec3 dp1 = dFdx( vPositionW );
    MEDP vec3 dp2 = dFdy( vPositionW );
    MEDP vec2 duv1 = dFdx( uv );
    MEDP vec2 duv2 = dFdy( uv );

    // solve the linear system
    MEDP vec3 dp2perp = cross( dp2, dVertexNormalW );
    MEDP vec3 dp1perp = cross( dVertexNormalW, dp1 );
    MEDP vec3 T = dp2perp * duv1.x + dp1perp * duv2.x;
    MEDP vec3 B = dp2perp * duv1.y + dp1perp * duv2.y;

    // construct a scale-invariant frame
    MEDP float invmax = 1.0 / sqrt( max( dot(T,T), dot(B,B) ) );
    dTBN = mat3( T * invmax, B * invmax, dVertexNormalW );
}
