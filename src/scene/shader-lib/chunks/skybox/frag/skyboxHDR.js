export default /* glsl */`
varying vec3 vViewDir;

uniform samplerCube texture_cubeMap;

#ifdef PROJECTED_SKYDOME

    uniform mat3 cubeMapRotationMatrix;
    uniform vec3 view_position;             // camera world position
    uniform vec4 projectedSkydomeCenter;    // x, y, z: world space origin of the tripod, w: blend factor
    uniform vec4 projectedSkydomeDome;      // x, y, z: world space dome center, w: (dome radius)^2
    uniform vec4 projectedSkydomePlane;     // x, y, z, w: world space ground plane

    void intersectPlane(inout float t, vec3 pos, vec3 dir, vec4 plane) {
        float d = dot(dir, plane.xyz);
        if (d != 0.0) {
            float n = -(dot(pos, plane.xyz) + plane.w) / d;
            if (n >= 0.0 && n < t) {
                t = n;
            }
        }
    }

    bool intersectSphere(inout float t, vec3 pos, vec3 dir, vec4 sphere) {
        vec3 L = sphere.xyz - pos;
        float tca = dot(L, dir);

        float d2 = sphere.w - (dot(L, L) - tca * tca);
        if (d2 >= 0.0) {
            float thc = tca + sqrt(d2);
            if (thc >= 0.0 && thc < t) {
                t = thc;
                return true;
            }
        }

        return false;
    }

#endif

void main(void) {

    #ifdef PROJECTED_SKYDOME

        // get world space ray
        vec3 view_pos = view_position;
        vec3 view_dir = normalize(vViewDir);

        // intersect ray with world geometry
        float t = 8000.0;   // max intersection distance
        if (intersectSphere(t, view_pos, view_dir, projectedSkydomeDome) && view_dir.y < 0.0) {
            intersectPlane(t, view_pos, view_dir, projectedSkydomePlane);
        }

        // calculate world space intersection
        vec3 world_pos = view_pos + view_dir * t;

        // get vector from world space pos to tripod origin
        vec3 env_dir = normalize(world_pos - projectedSkydomeCenter.xyz);

        vec3 dir = mix(view_dir, env_dir, projectedSkydomeCenter.w) * cubeMapRotationMatrix;

    #else

        vec3 dir = vViewDir;

    #endif

    dir.x *= -1.0;

    vec3 linear = $DECODE(textureCube(texture_cubeMap, fixSeamsStatic(dir, $FIXCONST)));

    gl_FragColor = vec4(gammaCorrectOutput(toneMap(processEnvironment(linear))), 1.0);
}
`;
