uniform float exposure;

vec3 toneMap(vec3 color) {
    color *= exposure;
    const float  A = 0.22, B = 0.3, C = .1, D = 0.2, E = .01, F = 0.3;
    const float Scl = 1.25;

    vec3 h = max( vec3(0.0), color - vec3(0.004) );
    return (h*((Scl*A)*h+Scl*vec3(C*B,C*B,C*B))+Scl*vec3(D*E,D*E,D*E)) / (h*(A*h+vec3(B,B,B))+vec3(D*F,D*F,D*F)) - Scl*vec3(E/F,E/F,E/F);
}

