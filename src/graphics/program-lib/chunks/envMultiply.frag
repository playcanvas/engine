
//#ifdef GL2
//#define skyboxIntensity uniformScene.fogColor_skyInt.w
//#else
uniform float skyboxIntensity;
//#endif

vec3 processEnvironment(vec3 color) {
    return color * skyboxIntensity;
}

