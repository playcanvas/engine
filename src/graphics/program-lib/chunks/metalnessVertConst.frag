uniform float material_metalness;
void getSpecularity() {
    processMetalness(saturate(vVertexColor.$CH) * material_metalness);
}

