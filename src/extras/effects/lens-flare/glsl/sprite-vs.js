// Places one lens flare element per instance along the axis from its flare's source through the
// screen centre. Sizes are in screen heights, so an element is the same size at any resolution and
// aspect ratio, and the element is faded by its flare's measured visibility. See FramePassLensFlare
// for the layout of the element texture and the per-flare uniforms.
export default /* glsl */`
    attribute vec2 aPosition;

    // three texels per element: offset, size, aspect, rotation; colour, auto rotate; flare, layer
    uniform highp sampler2D lensFlareElements;

    // one texel per flare: the measured visibility of its source
    uniform sampler2D lensFlareVisibility;

    // two per flare: xy source NDC, z fade, w scale; rgb colour
    uniform vec4 lensFlareData[64];

    // x: aspect ratio of the screen (height / width)
    uniform vec4 lensFlareParams;

    varying vec2 vUv0;
    varying vec3 vColor;
    varying float vLayer;

    vec4 lensFlareFetchElement(int element, int part) {
        int texel = element * 3 + part;
        return texelFetch(lensFlareElements, ivec2(texel % 1536, texel / 1536), 0);
    }

    void main(void) {
        int element = gl_InstanceID;
        vec4 e0 = lensFlareFetchElement(element, 0);
        vec4 e1 = lensFlareFetchElement(element, 1);
        vec4 e2 = lensFlareFetchElement(element, 2);
        int flare = int(e2.x + 0.5);
        vec4 f0 = lensFlareData[flare * 2];
        vec4 f1 = lensFlareData[flare * 2 + 1];
        float visibility = texelFetch(lensFlareVisibility, ivec2(flare, 0), 0).r;

        float fade = f0.z * visibility;
        vColor = e1.rgb * f1.rgb * fade;
        vLayer = e2.y;
        vUv0 = aPosition * 0.5 + 0.5;

        // nothing to draw: collapse the quad off screen
        if (fade <= 0.0001) {
            gl_Position = vec4(2.0, 2.0, 0.0, 1.0);
            return;
        }

        // work in screen heights, where a unit is half the screen height - the aspect ratio
        // corrects x, so that the rotation and the size are not distorted
        float aspect = lensFlareParams.x;
        vec2 source = vec2(f0.x / aspect, f0.y);
        vec2 center = source * (1.0 - e0.x);

        float rotation = e0.w;
        if (e1.w > 0.5) {
            rotation += atan(-source.y, -source.x);
        }
        float c = cos(rotation);
        float s = sin(rotation);
        vec2 p = aPosition * vec2(e0.y * e0.z, e0.y) * f0.w;
        p = vec2(p.x * c - p.y * s, p.x * s + p.y * c);

        gl_Position = vec4((center.x + p.x) * aspect, center.y + p.y, 0.0, 1.0);
    }
`;
