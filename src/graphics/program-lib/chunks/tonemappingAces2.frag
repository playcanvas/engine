uniform float exposure;

mat3 mul2(mat3 a, mat3 b) {
    return b * a;
}

vec3 mul2(mat3 a, vec3 b) {
    return b * a;
}


const float PI = 3.1415926535897932384626433832795;

float rgb_2_saturation( vec3 rgb ) {
    float minrgb = min( min(rgb.r, rgb.g ), rgb.b );
    float maxrgb = max( max(rgb.r, rgb.g ), rgb.b );
    return ( max( maxrgb, 1e-10 ) - max( minrgb, 1e-10 ) ) / max( maxrgb, 1e-2 );
}

// Transformations from RGB to other color representations
float rgb_2_hue( vec3 rgb ) {
    // Returns a geometric hue angle in degrees (0-360) based on RGB values.
    // For neutral colors, hue is undefined and the function will return a quiet NaN value.
    float hue;
    if (rgb[0] == rgb[1] && rgb[1] == rgb[2])
    {
        //hue = FLT_NAN; // RGB triplets where RGB are equal have an undefined hue
        hue = 0.0;
    }
    else
    {
        hue = (180. / PI) * atan(2.0 * rgb[0] - rgb[1] - rgb[2], sqrt(3.0)*(rgb[1] - rgb[2]));
    }

    if (hue < 0.)
        hue = hue + 360.0;

    return clamp( hue, 0.0, 360.0 );
}

float center_hue( float hue, float centerH)
{
    float hueCentered = hue - centerH;
    if (hueCentered < -180.)
        hueCentered += 360.0;
    else if (hueCentered > 180.)
        hueCentered -= 360.0;
    return hueCentered;
}

float log10(float x) {
    return log(x) / log(10.0);
}

vec3 log10(vec3 x) {
    return log(x) / log(10.0);
}

vec3 toneMap(vec3 LinearColor) {
    LinearColor *= exposure;

    mat3 XYZ_2_AP0_MAT = mat3(
         1.0498110175, 0.0000000000,-0.0000974845,
        -0.4959030231, 1.3733130458, 0.0982400361,
         0.0000000000, 0.0000000000, 0.9912520182
    );
    mat3 D65_2_D60_CAT = mat3(
         1.01303,    0.00610531, -0.014971,
        0.00769823, 0.998165,   -0.00503203,
        -0.00284131, 0.00468516,  0.924507
    );
    mat3 sRGB_2_XYZ_MAT = mat3(
        0.4124564, 0.3575761, 0.1804375,
        0.2126729, 0.7151522, 0.0721750,
        0.0193339, 0.1191920, 0.9503041
    );
    mat3 XYZ_2_AP1_MAT = mat3(
         1.6410233797, -0.3248032942, -0.2364246952,
        -0.6636628587,  1.6153315917,  0.0167563477,
         0.0117218943, -0.0082844420,  0.9883948585
    );
    mat3 XYZ_2_sRGB_MAT = mat3(
         3.2409699419, -1.5373831776, -0.4986107603,
        -0.9692436363,  1.8759675015,  0.0415550574,
         0.0556300797, -0.2039769589,  1.0569715142
    );
    mat3 D60_2_D65_CAT = mat3(
         0.987224,   -0.00611327, 0.0159533,
        -0.00759836,  1.00186,    0.00533002,
         0.00307257, -0.00509595, 1.08168
    );
    mat3 AP1_2_XYZ_MAT = mat3(
         0.6624541811, 0.1340042065, 0.1561876870,
         0.2722287168, 0.6740817658, 0.0536895174,
        -0.0055746495, 0.0040607335, 1.0103391003
    );
    mat3 AP0_2_AP1_MAT = mat3(
         1.4514393161, -0.2365107469, -0.2149285693,
        -0.0765537734,  1.1762296998, -0.0996759264,
         0.0083161484, -0.0060324498,  0.9977163014
    );
    vec3 AP1_RGB2Y = vec3(0.2722287168, 0.6740817658, 0.0536895174);

    float FilmSlope = 0.88;
    float FilmToe = 0.55;
    float FilmShoulder = 0.26;
    float FilmBlackClip = 0.0;
    float FilmWhiteClip = 0.04;

    mat3 sRGB_2_AP0 = mul2( XYZ_2_AP0_MAT, mul2( D65_2_D60_CAT, sRGB_2_XYZ_MAT ) );
    mat3 sRGB_2_AP1 = mul2( XYZ_2_AP1_MAT, mul2( D65_2_D60_CAT, sRGB_2_XYZ_MAT ) );
    mat3 AP1_2_sRGB = mul2( XYZ_2_sRGB_MAT, mul2( D60_2_D65_CAT, AP1_2_XYZ_MAT ) );

    vec3 ACESColor = mul2( sRGB_2_AP0, LinearColor );

    // --- Red modifier --- //
    const float RRT_RED_SCALE = 0.82;
    const float RRT_RED_PIVOT = 0.03;
    const float RRT_RED_HUE = 0.0;
    const float RRT_RED_WIDTH = 135.0;

    float saturation = rgb_2_saturation( ACESColor );
    float hue = rgb_2_hue( ACESColor );
    float centeredHue = center_hue( hue, RRT_RED_HUE );
    float hueWeight =  smoothstep( 0.0, 1.0, 1.0 - abs( 2.0 * centeredHue / RRT_RED_WIDTH ) );
    hueWeight *= hueWeight;

    ACESColor.r += hueWeight * saturation * (RRT_RED_PIVOT - ACESColor.r) * (1. - RRT_RED_SCALE);

    // Use ACEScg primaries as working space
    vec3 WorkingColor = mul2( AP0_2_AP1_MAT, ACESColor );

    WorkingColor = max( vec3(0.0), WorkingColor );

    // Pre desaturate
    WorkingColor = mix( vec3(dot( WorkingColor, AP1_RGB2Y )), WorkingColor, 0.96 );

    float ToeScale         = 1.0 + FilmBlackClip - FilmToe;
    float ShoulderScale    = 1.0 + FilmWhiteClip - FilmShoulder;

    float InMatch = 0.18;
    float OutMatch = 0.18;

    float ToeMatch;
    if( FilmToe > 0.8 )
    {
        // 0.18 will be on straight segment
        ToeMatch = ( 1.0 - FilmToe  - OutMatch ) / FilmSlope + log10( InMatch );
    }
    else
    {
        // 0.18 will be on toe segment

        // Solve for ToeMatch such that input of InMatch gives output of OutMatch.
        float bt = ( OutMatch + FilmBlackClip ) / ToeScale - 1.0;
        ToeMatch = log10( InMatch ) - 0.5 * log( (1.0+bt)/(1.0-bt) ) * (ToeScale / FilmSlope);
    }

    float StraightMatch = ( 1.0 - FilmToe ) / FilmSlope - ToeMatch;
    float ShoulderMatch = FilmShoulder / FilmSlope - StraightMatch;

    vec3 LogColor = log10( WorkingColor );
    vec3 StraightColor = FilmSlope * ( LogColor + StraightMatch );

    vec3 ToeColor      = (    -FilmBlackClip ) + (2.0 *      ToeScale) / ( 1.0 + exp( (-2.0 * FilmSlope /      ToeScale) * ( LogColor -      ToeMatch ) ) );
    vec3 ShoulderColor = ( 1.0 + FilmWhiteClip ) - (2.0 * ShoulderScale) / ( 1.0 + exp( ( 2.0 * FilmSlope / ShoulderScale) * ( LogColor - ShoulderMatch ) ) );

    ToeColor.x        = LogColor.x <      ToeMatch ?      ToeColor.x : StraightColor.x;
    ToeColor.y        = LogColor.y <      ToeMatch ?      ToeColor.y : StraightColor.y;
    ToeColor.z        = LogColor.z <      ToeMatch ?      ToeColor.z : StraightColor.z;

    ShoulderColor.x   = LogColor.x > ShoulderMatch ? ShoulderColor.x : StraightColor.x;
    ShoulderColor.y   = LogColor.y > ShoulderMatch ? ShoulderColor.y : StraightColor.y;
    ShoulderColor.z   = LogColor.z > ShoulderMatch ? ShoulderColor.z : StraightColor.z;

    vec3 t = ( ( LogColor - ToeMatch ) / ( ShoulderMatch - ToeMatch ) );
    t = clamp(t, vec3(0.0), vec3(1.0));
    t = ShoulderMatch < ToeMatch ? vec3(1.0) - t : t;
    t = (3.0-2.0*t)*t*t;
    vec3 ToneColor = mix( ToeColor, ShoulderColor, t );

    // Post desaturate
    ToneColor = mix( vec3(dot( ToneColor, AP1_RGB2Y )), ToneColor, 0.93 );

    ToneColor = mul2( AP1_2_sRGB, ToneColor );

    //return saturate( ToneColor );
    return max( vec3(0.0), ToneColor );
}

