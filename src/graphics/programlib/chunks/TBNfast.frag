void getTBN(inout psInternalData data) {
    data.TBN = mat3((vTangentW), (vBinormalW), (vNormalW));
}

