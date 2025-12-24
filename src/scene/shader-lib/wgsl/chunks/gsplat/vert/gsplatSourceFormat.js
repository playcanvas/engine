export default /* wgsl */`
#if defined(GSPLAT_WORKBUFFER_DATA)
    // getting data from work buffer
    #include "gsplatWorkBufferVS"
#elif GSPLAT_COMPRESSED_DATA == true
    #include "gsplatCompressedDataVS"
    #if SH_BANDS > 0
        #include "gsplatCompressedSHVS"
    #endif
#elif GSPLAT_SOGS_DATA
    #include "gsplatSogsDataVS"
    #include "gsplatSogsColorVS"
    #if SH_BANDS > 0
        #include "gsplatSogsSHVS"
    #endif
#else
    #include "gsplatDataVS"
    #include "gsplatColorVS"
    #if SH_BANDS > 0
        #include "gsplatSHVS"
    #endif
#endif
`;
