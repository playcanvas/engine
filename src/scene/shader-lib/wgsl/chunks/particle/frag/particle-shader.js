// The main code of particle system fragment shader used for rendering
export default /* wgsl */`
    #if NORMAL != NONE
        #if NORMAL == VERTEX
            varying Normal: vec3f;
        #endif

        #if NORMAL == MAP
            varying ParticleMat0: vec3f;
            varying ParticleMat1: vec3f;
            varying ParticleMat2: vec3f;
        #endif

        uniform lightCube: array<vec3f, 6>;
    #endif

    #ifdef SOFT
        varying vDepth: f32;
        #include "screenDepthPS"
    #endif

    #include "gammaPS"
    #include "tonemappingPS"
    #include "fogPS"

    #if NORMAL == MAP
        var normalMap: texture_2d<f32>;
        var normalMapSampler: sampler;
    #endif

    #include "particlePS"

    #ifdef SOFT
        #include "particle_softPS"
    #endif

    #if NORMAL == VERTEX
        var normal: vec3f = Normal;
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
