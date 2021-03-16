const MEDP float A =  0.15;
const MEDP float B =  0.50;
const MEDP float C =  0.10;
const MEDP float D =  0.20;
const MEDP float E =  0.02;
const MEDP float F =  0.30;
const MEDP float W =  11.2;

uniform MEDP float exposure;

vec3 uncharted2Tonemap(vec3 x) {
   return ((x*(A*x+C*B)+D*E)/(x*(A*x+B)+D*F))-E/F;
}

vec3 toneMap(vec3 color) {
    color = uncharted2Tonemap(color * exposure);
    MEDP vec3 whiteScale = 1.0 / uncharted2Tonemap(vec3(W,W,W));
    color = color * whiteScale;

    return color;
}
