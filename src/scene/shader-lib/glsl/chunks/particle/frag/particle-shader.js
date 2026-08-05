// The main code of particle system fragment shader used for rendering
export default /* glsl */`
    #if NORMAL != NONE
        #if NORMAL == VERTEX
            varying vec3 Normal;
        #endif

        #if NORMAL == MAP
            varying mat3 ParticleMat;
        #endif

        uniform vec3 lightCube[6];
    #endif

    #ifdef SOFT
        varying float vDepth;
        #include "screenDepthPS"
    #endif

    #include "gammaPS"
    #include "tonemappingPS"
    #include "fogPS"

    #if NORMAL == MAP
        uniform sampler2D normalMap;
    #endif

    #include "particlePS"

    #ifdef SOFT
        #include "particle_softPS"
    #endif

    #if NORMAL == VERTEX
        vec3 normal = Normal;
    #endif

    #if NORMAL == MAP
        #include "particle_normalMapPS"
    #endif

    #if NORMAL != NONE
        #ifdef HALF_LAMBERT
            #include "particle_halflambertPS"
        #else
            #include "particle_lambertPS"
        #endif

        #include "particle_lightingPS"
    #endif

    #if BLEND == NORMAL
        #include "particle_blendNormalPS"
    #elif BLEND == ADDITIVE
        #include "particle_blendAddPS"
    #elif BLEND == MULTIPLICATIVE
        #include "particle_blendMultiplyPS"
    #endif

    #include "particle_endPS"
`;
