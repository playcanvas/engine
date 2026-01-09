export default /* glsl */`
#if defined(GSPLAT_WORKBUFFER_DATA)
    // getting data from work buffer
    #include "gsplatWorkBufferVS"
#elif defined(GSPLAT_CONTAINER)
    // getting data from container (procedural splats)
    #include "gsplatContainerDataVS"
#elif GSPLAT_COMPRESSED_DATA == true
    #include "gsplatCompressedDataVS"
    #if SH_COEFFS > 0
        #include "gsplatCompressedSHVS"
    #endif
#elif GSPLAT_SOGS_DATA == true
    #include "gsplatSogsDataVS"
    #include "gsplatSogsColorVS"
    #if SH_COEFFS > 0
        #include "gsplatSogsSHVS"
    #endif
#else
    #include "gsplatDataVS"
    #include "gsplatColorVS"
    #if SH_COEFFS > 0
        #include "gsplatSHVS"
    #endif
#endif
`;
