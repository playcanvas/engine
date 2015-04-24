void getAlbedo(inout psInternalData data) {
    data.albedo = gammaCorrectInput(saturate(vVertexColor.$CH));
}

