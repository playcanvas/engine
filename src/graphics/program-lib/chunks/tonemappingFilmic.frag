const PMEDP float A =  0.15;
const PMEDP float B =  0.50;
const PMEDP float C =  0.10;
const PMEDP float D =  0.20;
const PMEDP float E =  0.02;
const PMEDP float F =  0.30;
const PMEDP float W =  11.2;

uniform PMEDP float exposure;

vec3 uncharted2Tonemap(vec3 x) {
   return ((x*(A*x+C*B)+D*E)/(x*(A*x+B)+D*F))-E/F;
}

vec3 toneMap(vec3 color) {
    color = uncharted2Tonemap(color * exposure);
    PMEDP vec3 whiteScale = 1.0 / uncharted2Tonemap(vec3(W,W,W));
    color = color * whiteScale;

    return color;
}
