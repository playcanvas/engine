void applyAO() {
    dAo = saturate(vVertexColor.$CH);
    dDiffuseLight *= dAo;
}

