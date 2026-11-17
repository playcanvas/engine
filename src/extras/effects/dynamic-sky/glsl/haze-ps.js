// The haze of the dynamic sky effect - the aerial perspective, colored by the sky, see
// DynamicSkyEffect#haze. It fades a surface into the sky behind it with its distance, thinning out
// with the height, so valleys stay hazy while the view from high up is clear.
export default /* glsl */`
    #include "dynamicSkyAtmospherePS"

    uniform mat3 dynSkyRotation;        // the rotation of the sky of the scene
    uniform vec4 dynSkyHaze;            // x: density at the base height, y: one over the height of the haze, z: base height

    // the color of the haze in a world space direction - the sky behind it, without the sun disc,
    // the stars and the moon
    vec3 dynamicSkyHazeColor(vec3 worldDir) {

        // to the space of the sky, turned by its rotation and with X flipped. Below the horizon,
        // where the daylight model has no answer, the haze takes the color of the sky just above it
        vec3 dir = worldDir * dynSkyRotation;
        dir = vec3(-dir.x, dir.y, dir.z) / max(length(dir), 1e-6);
        dir.y = max(dir.y, 0.015);

        vec3 ambient;
        return dynamicSkyBase(normalize(dir), ambient);
    }

    // the fraction of a surface hidden by the haze, from its position and the position of the camera
    float dynamicSkyHazeAmount(vec3 cameraPos, vec3 worldPos) {
        float b = dynSkyHaze.y;
        float h0 = cameraPos.y - dynSkyHaze.z;
        float h1 = worldPos.y - dynSkyHaze.z;
        float x = b * (h1 - h0);

        // the mean density along the ray, which falls off exponentially with the height, from the
        // integral of the density - and its limit along a level ray
        float e0 = exp(-b * h0);
        float density = abs(x) < 1e-3 ? e0 * (1.0 - 0.5 * x) : (e0 - exp(-b * h1)) / x;

        return 1.0 - exp(-dynSkyHaze.x * density * distance(worldPos, cameraPos));
    }

    // a linear color seen through the haze
    vec3 dynamicSkyHaze(vec3 color, vec3 cameraPos, vec3 worldPos) {
        float amount = dynamicSkyHazeAmount(cameraPos, worldPos);
        return mix(color, dynamicSkyHazeColor(worldPos - cameraPos), amount);
    }
`;
