// The haze of the dynamic sky effect - the aerial perspective, colored by the sky, see
// DynamicSkyEffect#haze. It fades a surface into the sky behind it with its distance, thinning out
// with the height, so valleys stay hazy while the view from high up is clear.
export default /* wgsl */`
    #include "dynamicSkyAtmospherePS"

    uniform dynSkyRotation: mat3x3f;    // the rotation of the sky of the scene
    uniform dynSkyHaze: vec4f;          // x: density at the base height, y: one over the height of the haze, z: base height

    // the color of the haze in a world space direction - the sky behind it, without the sun disc,
    // the stars and the moon
    fn dynamicSkyHazeColor(worldDir: vec3f) -> vec3f {

        // to the space of the sky, turned by its rotation and with X flipped. Below the horizon,
        // where the daylight model has no answer, the haze takes the color of the sky just above it
        let turned = worldDir * uniform.dynSkyRotation;
        var dir = vec3f(-turned.x, turned.y, turned.z) / max(length(turned), 1e-6);
        dir.y = max(dir.y, 0.015);

        var ambient: vec3f;
        return dynamicSkyBase(normalize(dir), &ambient);
    }

    // the fraction of a surface hidden by the haze, from its position and the position of the camera
    fn dynamicSkyHazeAmount(cameraPos: vec3f, worldPos: vec3f) -> f32 {
        let b = uniform.dynSkyHaze.y;
        let h0 = cameraPos.y - uniform.dynSkyHaze.z;
        let h1 = worldPos.y - uniform.dynSkyHaze.z;
        let x = b * (h1 - h0);

        // the mean density along the ray, which falls off exponentially with the height, from the
        // integral of the density - and its limit along a level ray
        let e0 = exp(-b * h0);
        var density = e0 * (1.0 - 0.5 * x);
        if (abs(x) >= 1e-3) {
            density = (e0 - exp(-b * h1)) / x;
        }

        return 1.0 - exp(-uniform.dynSkyHaze.x * density * distance(worldPos, cameraPos));
    }

    // a linear color seen through the haze
    fn dynamicSkyHaze(color: vec3f, cameraPos: vec3f, worldPos: vec3f) -> vec3f {
        let amount = dynamicSkyHazeAmount(cameraPos, worldPos);
        return mix(color, dynamicSkyHazeColor(worldPos - cameraPos), vec3f(amount));
    }
`;
