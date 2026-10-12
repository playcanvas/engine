// Places one lens flare element per instance along the axis from its flare's source through the
// screen centre. Sizes are in screen heights, so an element is the same size at any resolution and
// aspect ratio, and the element is faded by its flare's measured visibility. See FramePassLensFlare
// for the layout of the element texture and the per-flare uniforms.
export default /* wgsl */`
    attribute aPosition: vec2f;

    // three texels per element: offset, size, aspect, rotation; colour, auto rotate; flare, layer
    var lensFlareElements: texture_2d<uff>;

    // one texel per flare: the measured visibility of its source
    var lensFlareVisibility: texture_2d<f32>;

    // two per flare: xy source NDC, z fade, w scale; rgb colour
    uniform lensFlareData: array<vec4f, 64>;

    // x: aspect ratio of the screen (height / width)
    uniform lensFlareParams: vec4f;

    varying vUv0: vec2f;
    varying vColor: vec3f;
    varying vLayer: f32;

    fn lensFlareFetchElement(element: i32, part: i32) -> vec4f {
        let texel = element * 3 + part;
        return textureLoad(lensFlareElements, vec2i(texel % 1536, texel / 1536), 0);
    }

    @vertex fn vertexMain(input: VertexInput) -> VertexOutput {
        var output: VertexOutput;

        let element = i32(pcInstanceIndex);
        let e0 = lensFlareFetchElement(element, 0);
        let e1 = lensFlareFetchElement(element, 1);
        let e2 = lensFlareFetchElement(element, 2);
        let flare = i32(e2.x + 0.5);
        let f0 = uniform.lensFlareData[flare * 2];
        let f1 = uniform.lensFlareData[flare * 2 + 1];
        let visibility = textureLoad(lensFlareVisibility, vec2i(flare, 0), 0).r;

        let fade = f0.z * visibility;
        output.vColor = e1.rgb * f1.rgb * fade;
        output.vLayer = e2.y;
        output.vUv0 = input.aPosition * 0.5 + 0.5;

        // nothing to draw: collapse the quad off screen
        if (fade <= 0.0001) {
            output.position = vec4f(2.0, 2.0, 0.0, 1.0);
            return output;
        }

        // work in screen heights, where a unit is half the screen height - the aspect ratio
        // corrects x, so that the rotation and the size are not distorted
        let aspect = uniform.lensFlareParams.x;
        let source = vec2f(f0.x / aspect, f0.y);
        let center = source * (1.0 - e0.x);

        var rotation = e0.w;
        if (e1.w > 0.5) {
            rotation += atan2(-source.y, -source.x);
        }
        let c = cos(rotation);
        let s = sin(rotation);
        var p = input.aPosition * vec2f(e0.y * e0.z, e0.y) * f0.w;
        p = vec2f(p.x * c - p.y * s, p.x * s + p.y * c);

        output.position = vec4f((center.x + p.x) * aspect, center.y + p.y, 0.0, 1.0);
        return output;
    }
`;
