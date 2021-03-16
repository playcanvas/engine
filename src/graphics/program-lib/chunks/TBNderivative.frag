// http://www.thetenthplanet.de/archives/1180
void getTBN() {
    MMEDP vec2 uv = $UV;

    // get edge vectors of the pixel triangle
    MMEDP vec3 dp1 = dFdx( vPositionW );
    MMEDP vec3 dp2 = dFdy( vPositionW );
    MMEDP vec2 duv1 = dFdx( uv );
    MMEDP vec2 duv2 = dFdy( uv );

    // solve the linear system
    MMEDP vec3 dp2perp = cross( dp2, dVertexNormalW );
    MMEDP vec3 dp1perp = cross( dVertexNormalW, dp1 );
    MMEDP vec3 T = dp2perp * duv1.x + dp1perp * duv2.x;
    MMEDP vec3 B = dp2perp * duv1.y + dp1perp * duv2.y;

    // construct a scale-invariant frame
    MMEDP float invmax = 1.0 / sqrt( max( dot(T,T), dot(B,B) ) );
    dTBN = mat3( T * invmax, B * invmax, dVertexNormalW );
}
