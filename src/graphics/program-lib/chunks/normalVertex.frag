void getNormal() {
    dNormalW = normalize(dVertexNormalW);
    #ifdef CLEARCOAT
        ccNormalW = normalize(dVertexNormalW);
    #endif
}