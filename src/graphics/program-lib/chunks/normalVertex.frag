void getNormal() {
    dNormalW = normalize(dVertexNormalW);
    #ifdef CLEARCOAT
        ccNormalW = dNormalW;
    #endif
}

