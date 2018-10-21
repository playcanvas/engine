#ifdef MAPCOLOR
uniform vec3 material_emissive;
#endif

#ifdef MAPFLOAT
uniform float material_emissiveIntensity;
#endif

#ifdef MAPTEXTURE
uniform sampler2D texture_emissiveMap;
#endif

vec3 getEmission() {
    vec3 emission = vec3(1.0);

    #ifdef MAPFLOAT
        emission *= material_emissiveIntensity;
    #endif

    #ifdef MAPCOLOR
        emission *= material_emissive;
    #endif

    #ifdef MAPTEXTURE
        emission *= $texture2DSAMPLE(texture_emissiveMap, $UV).$CH;
    #endif

    #ifdef MAPVERTEX
        emission *= gammaCorrectInput(saturate(vVertexColor.$VC));
    #endif

    return emission;
}

