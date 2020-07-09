void getReflDir() {
    dReflDirW = normalize(-reflect(dViewDirW, dNormalW));

    #ifdef CLEARCOAT
        ccReflDirW = normalize(-reflect(dViewDirW, ccNormalW));
    #endif    
}
