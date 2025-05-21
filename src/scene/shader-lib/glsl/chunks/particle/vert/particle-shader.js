// The main code of particle system vertex shader
export default /* glsl */`
    #ifdef ANIMTEX
        uniform vec2 animTexTilesParams;
        uniform vec4 animTexParams;
        uniform vec2 animTexIndexParams;
    #endif

    #if NORMAL == MAP
        varying mat3 ParticleMat;
    #endif

    #if NORMAL == VERTEX
        varying vec3 Normal;
    #endif

    #ifdef SOFT
        varying float vDepth;
    #endif

    #ifdef PARTICLE_GPU

        #include "particle_initVS"

        #ifdef PACK8
            #include "particleInputRgba8PS"     // why are these PS and not VS?
        #else
            #include  "particleInputFloatPS"    // why are these PS and not VS?
        #endif

        #ifdef SOFT
            #include "screenDepthPS"
        #endif

        #include "particleVS"

    #else // PARTICLE_CPU

        #ifdef SOFT
            #include "screenDepthPS"
        #endif

        #include "particle_cpuVS"

    #endif

    #ifdef LOCAL_SPACE
        #include "particle_localShiftVS"
    #endif

    #ifdef ANIMTEX
        #ifdef ANIMTEX_LOOP
            #include "particleAnimFrameLoopVS"
        #else
            #include "particleAnimFrameClampVS"
        #endif
        #include "particleAnimTexVS"
    #endif

    // wrap is not used on CPU, it was commented out. TODO: investigate why
    #ifdef PARTICLE_GPU
        #ifdef WRAP
            #include "particle_wrapVS"
        #endif
    #endif

    #ifdef ALIGN_TO_MOTION
        #include "particle_pointAlongVS"
    #endif

    #ifdef USE_MESH
        #include "particle_meshVS"
    #else
        #ifdef CUSTOM_FACE
            #include "particle_customFaceVS"
        #else
            #include "particle_billboardVS"
        #endif
    #endif

    #if NORMAL == VERTEX
        #include "particle_normalVS"
    #endif

    #if NORMAL == MAP
        #include "particle_TBNVS"
    #endif

    #ifdef STRETCH
        #include "particle_stretchVS"
    #endif


    #ifdef PARTICLE_GPU
        #include "particle_endVS"
    #else // PARTICLE_CPU
        #include "particle_cpu_endVS"
    #endif

    #ifdef SOFT
        #include "particle_softVS"
    #endif

    }
`;
