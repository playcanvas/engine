// The main code of particle system fragment shader used for the simulation
export default /* wgsl */`
    #include "particleUpdaterInitPS"

    #ifdef PACK8
        #include "particleInputRgba8PS"
        #include "particleOutputRgba8PS"
    #else
        #include "particleInputFloatPS"
        #include "particleOutputFloatPS"
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
