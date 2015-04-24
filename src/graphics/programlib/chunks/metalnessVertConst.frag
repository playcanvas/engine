uniform float material_metalness;
void getSpecularity(inout psInternalData data) {
    processMetalness(data, saturate(vVertexColor.$CH) * material_metalness);
}

