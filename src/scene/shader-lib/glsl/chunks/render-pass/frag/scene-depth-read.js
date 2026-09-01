// Samples the scene depth over a region of the view, one sample per output pixel, and packs each one
// losslessly into RGBA8. Reading RGBA8 back is the one thing every device agrees on, and it is what
// makes the read work regardless of the format the depth itself was rendered to.
export default /* glsl */`
    #include "screenDepthPS"
    #include "floatAsUintPS"

    // the region of the view to sample, normalized, and the number of samples across and down it
    uniform vec4 uDepthReadRect;
    uniform vec2 uDepthReadGrid;

    // at or beyond this depth nothing was rendered, and the sample is reported as the value below.
    // Infinity arrives as a uniform rather than being written here, as WGSL rejects one written as a
    // constant expression, and both languages are kept the same.
    uniform float uDepthReadFar;
    uniform float uDepthReadEmpty;

    void main() {

        // the centre of this output pixel, as a fraction of the region
        vec2 cell = (floor(gl_FragCoord.xy) + 0.5) / uDepthReadGrid;
        vec2 uv = uDepthReadRect.xy + cell * uDepthReadRect.zw;

        // snap to the centre of the nearest depth texel. Depth cannot be filtered - the average of a
        // near and a far surface unprojects to empty space - and sampling a texel centre is what makes
        // the linear sampler of the unpacked formats return that texel exactly.
        vec2 size = vec2(textureSize(uSceneDepthMap, 0));
        uv = (floor(uv * size) + 0.5) / size;

        float depth = getLinearScreenDepth(uv);
        gl_FragColor = float2uint(depth >= uDepthReadFar ? uDepthReadEmpty : depth);
    }
`;
