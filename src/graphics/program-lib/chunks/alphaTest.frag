uniform MMEDP float alpha_ref;

void alphaTest(float a) {
    if (a < alpha_ref) discard;
}
