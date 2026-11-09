// the texture storing the height of the surface in its alpha, and the size of its texel
uniform sampler2D uHeightTexture;
uniform vec2 uTexelSize;

// the strength of the bumps
uniform float uBumpiness;

varying vec2 uv0;

// the height at an offset in texels from the rendered texel. The texture repeats, and so the
// normals at its edges are computed from the texels on the opposite side
float heightAt(vec2 offset) {
    return textureLod(uHeightTexture, uv0 + offset * uTexelSize, 0.0).a;
}

void main(void)
{
    // the slope of the height along the texture axes, using the Sobel filter, which also smooths it
    float tl = heightAt(vec2(-1.0, 1.0));
    float t = heightAt(vec2(0.0, 1.0));
    float tr = heightAt(vec2(1.0, 1.0));
    float l = heightAt(vec2(-1.0, 0.0));
    float r = heightAt(vec2(1.0, 0.0));
    float bl = heightAt(vec2(-1.0, -1.0));
    float b = heightAt(vec2(0.0, -1.0));
    float br = heightAt(vec2(1.0, -1.0));

    vec2 slope = vec2((tr + 2.0 * r + br) - (tl + 2.0 * l + bl), (tl + 2.0 * t + tr) - (bl + 2.0 * b + br));

    // the slope per unit of the texture coordinates, which keeps the bumps the same at any resolution
    slope /= 8.0 * uTexelSize;

    // the tangent space normal, encoded into the 0 .. 1 range
    vec3 normal = normalize(vec3(-slope * uBumpiness, 1.0));
    gl_FragColor = vec4(normal * 0.5 + 0.5, 1.0);
}
