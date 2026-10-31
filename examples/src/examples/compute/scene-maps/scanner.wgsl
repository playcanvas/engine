// A world scanner: a pulse expands through the scene from an origin, lighting up the surfaces it
// passes and leaving a fading grid of world space lines behind it. The world position of each pixel
// is reconstructed from the scene depth map, and the scene color map tints the pulse with the color
// of the surfaces it sweeps over.

// The scene depth and color maps of the camera, attached using Compute#setSceneDepthMap and
// Compute#setSceneColorMap
#include "sceneDepthCS"
#include "sceneColorCS"

// The overlay the scanner draws into, added over the final image
var overlay: texture_storage_2d<rgba8unorm, write>;

uniform origin: vec3f;
uniform radius: f32;
uniform bandWidth: f32;
uniform trailLength: f32;
uniform gridSize: f32;
uniform scanColor: vec3f;

// the world size of an overlay pixel at the distance of one unit from the camera
uniform pixelSize: f32;

@compute @workgroup_size(8, 8, 1)
fn main(@builtin(global_invocation_id) id: vec3u) {
    let size = textureDimensions(overlay);
    if (id.x >= size.x || id.y >= size.y) {
        return;
    }

    // the overlay can be of a lower resolution than the scene maps
    let uv = (vec2f(id.xy) + 0.5) / vec2f(size);
    let texel = vec2i(uv * vec2f(sceneDepthSize()));

    // nothing to scan where the sky is
    let depth = sceneDepthLinear(texel);
    if (depth > sceneDepthFarClip() * 0.99) {
        textureStore(overlay, id.xy, vec4f(0.0));
        return;
    }

    let position = sceneDepthWorldPosition(texel);

    // positive behind the wavefront, where the pulse has already passed
    let behind = uniform.radius - distance(position, uniform.origin);

    // the bright wavefront, and the trail fading out behind it
    let front = exp(-abs(behind) / uniform.bandWidth);
    let trail = select(0.0, exp(-behind / uniform.trailLength), behind > 0.0);

    // lines where the surface crosses the planes of a world space grid, at least a pixel and a half
    // wide on the screen
    let cell = abs(fract(position / uniform.gridSize + 0.5) - 0.5) * uniform.gridSize;
    let lineWidth = max(uniform.gridSize * 0.03, depth * uniform.pixelSize * 1.5);
    let line = 1.0 - smoothstep(0.0, lineWidth, min(cell.x, min(cell.y, cell.z)));

    // the pulse takes on the hue of the surfaces it sweeps over
    let surface = sceneColorToLinear(sceneColorSample(uv, 0.0).rgb);
    let hue = surface / max(max(surface.r, max(surface.g, surface.b)), 0.001);
    let tint = uniform.scanColor * mix(vec3f(1.0), hue, 0.6);

    let glow = tint * (front * 1.6 + trail * (line * 0.9 + 0.06));
    textureStore(overlay, id.xy, vec4f(glow, 1.0));
}
