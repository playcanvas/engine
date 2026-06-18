// The main code of particle system fragment shader used for the simulation
export default /* glsl */`
    #include "particleUpdaterInitPS"

    #ifdef CAPS_TEXTURE_FLOAT_RENDERABLE
        #include "particleInputFloatPS"
        #include "particleOutputFloatPS"
    #else
        #include "particleInputU32PS"
        #include "particleOutputU32PS"
    #endif

    #ifdef EMITTERSHAPE_BOX
        #include "particleUpdaterAABBPS"
    #else
        #include "particleUpdaterSpherePS"
    #endif

    #include "particleUpdaterStartPS"

    #ifdef RESPAWN
        #include "particleUpdaterRespawnPS"
    #endif

    #ifdef NO_RESPAWN
        #include "particleUpdaterNoRespawnPS"
    #endif

    #ifdef ON_STOP
        #include "particleUpdaterOnStopPS"
    #endif

    #include "particleUpdaterEndPS"
`;
