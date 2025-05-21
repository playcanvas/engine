export default /* wgsl */`
// Real-Time Polygonal-Light Shading with Linearly Transformed Cosines
// by Eric Heitz, Jonathan Dupuy, Stephen Hill and David Neubelt
// code: https://github.com/selfshadow/ltc_code/

fn LTC_Uv(N: vec3f, V: vec3f, roughness: f32) -> vec2f {
    const LUT_SIZE: f32 = 64.0;
    const LUT_SCALE: f32 = (LUT_SIZE - 1.0) / LUT_SIZE;
    const LUT_BIAS: f32 = 0.5 / LUT_SIZE;
    let dotNV: f32 = saturate(dot( N, V ));
    // texture parameterized by sqrt( GGX alpha ) and sqrt( 1 - cos( theta ) )
    let uv: vec2f = vec2f( roughness, sqrt( 1.0 - dotNV ) );
    return uv * LUT_SCALE + LUT_BIAS;
}

fn LTC_ClippedSphereFormFactor( f: vec3f ) -> f32 {
    // Real-Time Area Lighting: a Journey from Research to Production (p.102)
    // An approximation of the form factor of a horizon-clipped rectangle.
    let l: f32 = length( f );
    return max( ( l * l + f.z ) / ( l + 1.0 ), 0.0 );
}

fn LTC_EdgeVectorFormFactor( v1: vec3f, v2: vec3f ) -> vec3f {
    let x: f32 = dot( v1, v2 );
    let y: f32 = abs( x );
    // rational polynomial approximation to theta / sin( theta ) / 2PI
    let a: f32 = 0.8543985 + ( 0.4965155 + 0.0145206 * y ) * y;
    let b: f32 = 3.4175940 + ( 4.1616724 + y ) * y;
    let v: f32 = a / b;
    let inv_sqrt_term = inverseSqrt( max( 1.0 - x * x, 1e-7f ) );
    let theta_sintheta: f32 = select( (0.5 * inv_sqrt_term - v), v, x > 0.0 );
    return cross( v1, v2 ) * theta_sintheta;
}

struct Coords {
    coord0: vec3f,
    coord1: vec3f,
    coord2: vec3f,
    coord3: vec3f,
}

fn LTC_EvaluateRect( N: vec3f, V: vec3f, P: vec3f, mInv: mat3x3f, rectCoords: Coords) -> f32 {
    // bail if point is on back side of plane of light
    // assumes ccw winding order of light vertices
    let v1: vec3f = rectCoords.coord1 - rectCoords.coord0;
    let v2: vec3f = rectCoords.coord3 - rectCoords.coord0;

    let lightNormal: vec3f = cross( v1, v2 );
    let factor: f32 = sign(-dot( lightNormal, P - rectCoords.coord0 ));

    // construct orthonormal basis around N
    let T1: vec3f = normalize( V - N * dot( V, N ) );
    let T2: vec3f = factor * cross( N, T1 ); // negated from paper; possibly due to a different handedness of world coordinate system
    // compute transform
    let mat: mat3x3f = mInv * transpose( mat3x3f( T1, T2, N ) );
    // transform rect
    var coords: array<vec3f, 4>;
    coords[0] = mat * ( rectCoords.coord0 - P );
    coords[1] = mat * ( rectCoords.coord1 - P );
    coords[2] = mat * ( rectCoords.coord2 - P );
    coords[3] = mat * ( rectCoords.coord3 - P );
    // project rect onto sphere
    coords[0] = normalize( coords[0] );
    coords[1] = normalize( coords[1] );
    coords[2] = normalize( coords[2] );
    coords[3] = normalize( coords[3] );
    // calculate vector form factor
    var vectorFormFactor: vec3f = vec3f( 0.0 );
    vectorFormFactor = vectorFormFactor + LTC_EdgeVectorFormFactor( coords[0], coords[1] );
    vectorFormFactor = vectorFormFactor + LTC_EdgeVectorFormFactor( coords[1], coords[2] );
    vectorFormFactor = vectorFormFactor + LTC_EdgeVectorFormFactor( coords[2], coords[3] );
    vectorFormFactor = vectorFormFactor + LTC_EdgeVectorFormFactor( coords[3], coords[0] );
    // adjust for horizon clipping
    let result: f32 = LTC_ClippedSphereFormFactor( vectorFormFactor );

    return result;
}

var<private> dLTCCoords: Coords;
fn getLTCLightCoords(lightPos: vec3f, halfWidth: vec3f, halfHeight: vec3f) -> Coords {
    var coords: Coords;
    coords.coord0 = lightPos + halfWidth - halfHeight;
    coords.coord1 = lightPos - halfWidth - halfHeight;
    coords.coord2 = lightPos - halfWidth + halfHeight;
    coords.coord3 = lightPos + halfWidth + halfHeight;
    return coords;
}

var<private> dSphereRadius: f32;
fn getSphereLightCoords(lightPos: vec3f, halfWidth: vec3f, halfHeight: vec3f) -> Coords {
    // used for simple sphere light falloff
    // also, the code only handles a spherical light, it cannot be non-uniformly scaled in world space, and so we enforce it here
    dSphereRadius = max(length(halfWidth), length(halfHeight));

    // Billboard the 2d light quad to reflection vector, as it's used for specular. This allows us to use disk math for the sphere.
    let f: vec3f = reflect(normalize(lightPos - uniform.view_position), vNormalW);
    let w: vec3f = normalize(cross(f, halfHeight));
    let h: vec3f = normalize(cross(f, w));

    return getLTCLightCoords(lightPos, w * dSphereRadius, h * dSphereRadius);
}

// used for LTC LUT texture lookup
var<private> dLTCUV: vec2f;
#ifdef LIT_CLEARCOAT
    var<private> ccLTCUV: vec2f;
#endif

fn getLTCLightUV(gloss: f32, worldNormal: vec3f, viewDir: vec3f) -> vec2f {
    let roughness: f32 = max((1.0 - gloss) * (1.0 - gloss), 0.001);
    return LTC_Uv( worldNormal, viewDir, roughness );
}

// used for energy conservation and to modulate specular
var<private> dLTCSpecFres: vec3f;
#ifdef LIT_CLEARCOAT
    var<private> ccLTCSpecFres: vec3f;
#endif

fn getLTCLightSpecFres(uv: vec2f, specularity: vec3f) -> vec3f {
    let t2: vec4f = textureSampleLevel(areaLightsLutTex2, areaLightsLutTex2Sampler, uv, 0.0);
    return specularity * t2.x + ( vec3f( 1.0 ) - specularity) * t2.y;
}

fn calcLTCLightValues(gloss: f32, worldNormal: vec3f, viewDir: vec3f, specularity: vec3f, clearcoatGloss: f32, clearcoatWorldNormal: vec3f, clearcoatSpecularity: f32) {
    dLTCUV = getLTCLightUV(gloss, worldNormal, viewDir);
    dLTCSpecFres = getLTCLightSpecFres(dLTCUV, specularity);

    #ifdef LIT_CLEARCOAT
        ccLTCUV = getLTCLightUV(clearcoatGloss, clearcoatWorldNormal, viewDir);
        ccLTCSpecFres = getLTCLightSpecFres(ccLTCUV, vec3f(clearcoatSpecularity));
    #endif
}

fn calcRectLightValues(lightPos: vec3f, halfWidth: vec3f, halfHeight: vec3f) {
    dLTCCoords = getLTCLightCoords(lightPos, halfWidth, halfHeight);
}
fn calcDiskLightValues(lightPos: vec3f, halfWidth: vec3f, halfHeight: vec3f) {
    calcRectLightValues(lightPos, halfWidth, halfHeight);
}
fn calcSphereLightValues(lightPos: vec3f, halfWidth: vec3f, halfHeight: vec3f) {
    dLTCCoords = getSphereLightCoords(lightPos, halfWidth, halfHeight);
}

// An extended version of the implementation from "How to solve a cubic equation, revisited"
// http://momentsingraphics.de/?p=105
fn SolveCubic(Coefficient_in: vec4f) -> vec3f {
    let pi: f32 = 3.14159;
    var Coefficient = Coefficient_in;

    // Normalize the polynomial
    Coefficient = vec4f(Coefficient.xyz / Coefficient.w, Coefficient.w);

    // Divide middle coefficients by three
    let new_yz: vec2f = Coefficient.yz / 3.0;
    Coefficient = vec4f(Coefficient.x, new_yz.x, new_yz.y, Coefficient.w);
    
    let A: f32 = Coefficient.w;
    let B: f32 = Coefficient.z;
    let C: f32 = Coefficient.y;
    let D: f32 = Coefficient.x;

    // Compute the Hessian and the discriminant
    let Delta: vec3f = vec3f(
        -Coefficient.z * Coefficient.z + Coefficient.y,
        -Coefficient.y * Coefficient.z + Coefficient.x,
        dot(vec2f(Coefficient.z, -Coefficient.y), Coefficient.xy)
    );

    let Discriminant: f32 = dot(vec2f(4.0 * Delta.x, -Delta.y), Delta.zy);

    var xlc: vec2f;
    var xsc: vec2f;

    // Algorithm A
    {
        let A_a: f32 = 1.0;
        let C_a: f32 = Delta.x;
        let D_a: f32 = -2.0 * B * Delta.x + Delta.y;

        // Take the cubic root of a normalized complex number
        let Theta: f32 = atan2(sqrt(Discriminant), -D_a) / 3.0;

        let sqrt_neg_Ca = sqrt(-C_a);
        let x_1a: f32 = 2.0 * sqrt_neg_Ca * cos(Theta);
        let x_3a: f32 = 2.0 * sqrt_neg_Ca * cos(Theta + (2.0 / 3.0) * pi);

        let xl: f32 = select(x_3a, x_1a, (x_1a + x_3a) > 2.0 * B);
        xlc = vec2f(xl - B, A);
    }

    // Algorithm D
    {
        let A_d: f32 = D;
        let C_d: f32 = Delta.z;
        let D_d: f32 = -D * Delta.y + 2.0 * C * Delta.z;

        // Take the cubic root of a normalized complex number
        let Theta: f32 = atan2(D * sqrt(Discriminant), -D_d) / 3.0;

        let sqrt_neg_Cd = sqrt(-C_d);
        let x_1d: f32 = 2.0 * sqrt_neg_Cd * cos(Theta);
        let x_3d: f32 = 2.0 * sqrt_neg_Cd * cos(Theta + (2.0 / 3.0) * pi);

        let xs: f32 = select(x_3d, x_1d, x_1d + x_3d < 2.0 * C);
        xsc = vec2f(-D, xs + C);
    }

    let E: f32 =  xlc.y * xsc.y;
    let F: f32 = -xlc.x * xsc.y - xlc.y * xsc.x;
    let G: f32 =  xlc.x * xsc.x;

    let xmc: vec2f = vec2f(C * F - B * G, -B * F + C * E);

    var Root: vec3f = vec3f(xsc.x / xsc.y, xmc.x / xmc.y, xlc.x / xlc.y);

    if (Root.x < Root.y && Root.x < Root.z) {
        Root = Root.yxz;
    } else if (Root.z < Root.x && Root.z < Root.y) {
        Root = Root.xzy;
    }
    return Root;
}

fn LTC_EvaluateDisk(N: vec3f, V: vec3f, P: vec3f, Minv: mat3x3f, points: Coords) -> f32 {
    // construct orthonormal basis around N
    let T1: vec3f = normalize(V - N * dot(V, N));
    let T2: vec3f = cross(N, T1);

    // rotate area light in (T1, T2, N) basis
    let R: mat3x3f = transpose( mat3x3f( T1, T2, N ) );
    // polygon (allocate 5 vertices for clipping
    var L_: array<vec3f, 3>;
    L_[0] = R * ( points.coord0 - P );
    L_[1] = R * ( points.coord1 - P );
    L_[2] = R * ( points.coord2 - P );

    // init ellipse
    let C: vec3f  = 0.5 * (L_[0] + L_[2]);
    var V1: vec3f = 0.5 * (L_[1] - L_[2]);
    var V2: vec3f = 0.5 * (L_[1] - L_[0]);

    let C_Minv: vec3f  = Minv * C;
    let V1_Minv: vec3f = Minv * V1;
    let V2_Minv: vec3f = Minv * V2;

    // compute eigenvectors of ellipse
    var a: f32;
    var b: f32;
    let d11: f32 = dot(V1_Minv, V1_Minv);
    let d22: f32 = dot(V2_Minv, V2_Minv);
    let d12: f32 = dot(V1_Minv, V2_Minv);
    if (abs(d12) / sqrt(d11 * d22) > 0.0001) {
        let tr: f32 = d11 + d22;
        let det_inner: f32 = -d12 * d12 + d11 * d22;
        let det: f32 = sqrt(det_inner);
        let u: f32 = 0.5 * sqrt(tr - 2.0 * det);
        let v: f32 = 0.5 * sqrt(tr + 2.0 * det);
        let e_max: f32 = (u + v) * (u + v);
        let e_min: f32 = (u - v) * (u - v);

        var V1_: vec3f;
        var V2_: vec3f;

        if (d11 > d22) {
            V1_ = d12 * V1_Minv + (e_max - d11) * V2_Minv;
            V2_ = d12 * V1_Minv + (e_min - d11) * V2_Minv;
        } else {
            V1_ = d12*V2_Minv + (e_max - d22)*V1_Minv;
            V2_ = d12*V2_Minv + (e_min - d22)*V1_Minv;
        }

        a = 1.0 / e_max;
        b = 1.0 / e_min;
        V1 = normalize(V1_);
        V2 = normalize(V2_);
    } else {
        a = 1.0 / dot(V1_Minv, V1_Minv);
        b = 1.0 / dot(V2_Minv, V2_Minv);
        V1 = V1_Minv * sqrt(a);
        V2 = V2_Minv * sqrt(b);
    }

    var V3: vec3f = normalize(cross(V1, V2));
    if (dot(C_Minv, V3) < 0.0) {
        V3 = V3 * -1.0;
    }

    let L: f32  = dot(V3, C_Minv);
    let x0: f32 = dot(V1, C_Minv) / L;
    let y0: f32 = dot(V2, C_Minv) / L;

    let E1: f32 = inverseSqrt(a);
    let E2: f32 = inverseSqrt(b);

    let a_scaled = a * L * L;
    let b_scaled = b * L * L;

    let c0: f32 = a_scaled * b_scaled;
    let c1: f32 = a_scaled * b_scaled * (1.0 + x0 * x0 + y0 * y0) - a_scaled - b_scaled;
    let c2: f32 = 1.0 - a_scaled * (1.0 + x0 * x0) - b_scaled * (1.0 + y0 * y0);
    let c3: f32 = 1.0;

    let roots: vec3f = SolveCubic(vec4f(c0, c1, c2, c3));
    let e1: f32 = roots.x;
    let e2: f32 = roots.y;
    let e3: f32 = roots.z;

    var avgDir: vec3f = vec3f(a_scaled * x0 / (a_scaled - e2), b_scaled * y0 / (b_scaled - e2), 1.0);

    let rotate: mat3x3f = mat3x3f(V1, V2, V3);

    avgDir = rotate * avgDir;
    avgDir = normalize(avgDir);

    let L1: f32 = sqrt(-e2 / e3);
    let L2: f32 = sqrt(-e2 / e1);

    let formFactor: f32 = max(0.0, L1 * L2 * inverseSqrt((1.0 + L1 * L1) * (1.0 + L2 * L2)));

    const LUT_SIZE_disk: f32 = 64.0;
    const LUT_SCALE_disk: f32 = ( LUT_SIZE_disk - 1.0 ) / LUT_SIZE_disk;
    const LUT_BIAS_disk: f32 = 0.5 / LUT_SIZE_disk;

    // use tabulated horizon-clipped sphere
    var uv: vec2f = vec2f(avgDir.z * 0.5 + 0.5, formFactor);
    uv = uv * LUT_SCALE_disk + LUT_BIAS_disk;

    let scale: f32 = textureSampleLevel(areaLightsLutTex2, areaLightsLutTex2Sampler, uv, 0.0).w;

    return formFactor * scale;
}

// LTC_EvaluateDisk in some rare cases genereates NaN values in a or b, just before 'float c0 = a * b;'
// Get rid of those Nan values before they propagate further, as in case of bloom / DOF blurs they
// propagate to large areas. I didn't find the actual reason where those come from, so that is still TODO.
// Note that only disk/sphere lights are causing it, so only handle those.
fn FixNan(value: f32) -> f32 {
    // use value != value check for NaN as isnan() is not available in WGSL
    return select(value, 0.0, value != value);
}

fn getRectLightDiffuse(worldNormal: vec3f, viewDir: vec3f, lightDir: vec3f, lightDirNorm: vec3f) -> f32 {
    let identityMat = mat3x3f(vec3f(1.0, 0.0, 0.0), vec3f(0.0, 1.0, 0.0), vec3f(0.0, 0.0, 1.0));
    return LTC_EvaluateRect( worldNormal, viewDir, vPositionW, identityMat, dLTCCoords );
}

fn getDiskLightDiffuse(worldNormal: vec3f, viewDir: vec3f, lightDir: vec3f, lightDirNorm: vec3f) -> f32 {
    let identityMat = mat3x3f(vec3f(1.0, 0.0, 0.0), vec3f(0.0, 1.0, 0.0), vec3f(0.0, 0.0, 1.0));
    return FixNan(LTC_EvaluateDisk( worldNormal, viewDir, vPositionW, identityMat, dLTCCoords ));
}

fn getSphereLightDiffuse(worldNormal: vec3f, viewDir: vec3f, lightDir: vec3f, lightDirNorm: vec3f) -> f32 {
    // NB: this could be improved further with distance based wrap lighting
    let falloff: f32 = dSphereRadius / (dot(lightDir, lightDir) + dSphereRadius);
    return FixNan(getLightDiffuse(worldNormal, viewDir, lightDirNorm) * falloff);
}

fn getLTCLightInvMat(uv: vec2f) -> mat3x3f {
    let t1: vec4f = textureSampleLevel(areaLightsLutTex1, areaLightsLutTex1Sampler, uv, 0.0);

    return mat3x3f(
        vec3f( t1.x, 0.0, t1.y ),
        vec3f( 0.0, 1.0, 0.0 ),
        vec3f( t1.z, 0.0, t1.w )
    );
}

fn calcRectLightSpecular(worldNormal: vec3f, viewDir: vec3f, uv: vec2f) -> f32 {
    let mInv: mat3x3f = getLTCLightInvMat(uv);
    return LTC_EvaluateRect( worldNormal, viewDir, vPositionW, mInv, dLTCCoords );
}

fn getRectLightSpecular(worldNormal: vec3f, viewDir: vec3f) -> f32 {
    return calcRectLightSpecular(worldNormal, viewDir, dLTCUV);
}

fn calcDiskLightSpecular(worldNormal: vec3f, viewDir: vec3f, uv: vec2f) -> f32 {
    let mInv: mat3x3f = getLTCLightInvMat(uv);
    return LTC_EvaluateDisk( worldNormal, viewDir, vPositionW, mInv, dLTCCoords );
}

fn getDiskLightSpecular(worldNormal: vec3f, viewDir: vec3f) -> f32 {
    return calcDiskLightSpecular(worldNormal, viewDir, dLTCUV);
}

fn getSphereLightSpecular(worldNormal: vec3f, viewDir: vec3f) -> f32 {
    return calcDiskLightSpecular(worldNormal, viewDir, dLTCUV);
}
`;
