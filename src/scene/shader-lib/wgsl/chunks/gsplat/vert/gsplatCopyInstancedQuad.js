// vertex shader for instanced LOD quad rendering to work buffer.
// Each instance covers one row-aligned segment of an interval.
// The fragment shader computes originalIndex from flat varyings.
export default /* wgsl */`

attribute vertex_position: vec2f;

// Sub-draw data texture: RGBA32U
// R = rowStart | (numRows << 16)
// G = colStart
// B = colEnd
// A = sourceBase
var uSubDrawData: texture_2d<u32>;
uniform uLineCount: i32;
uniform uTextureWidth: i32;

// packed sub-draw params: (sourceBase, colStart, rowWidth, rowStart)
varying @interpolate(flat) vSubDraw: vec4i;

@vertex
fn vertexMain(input: VertexInput) -> VertexOutput {
    var output: VertexOutput;

    // Read sub-draw parameters from 2D data texture
    let subDrawWidth = i32(textureDimensions(uSubDrawData, 0).x);
    let instIdx = i32(input.instanceIndex);
    let data = textureLoad(uSubDrawData, vec2i(instIdx % subDrawWidth, instIdx / subDrawWidth), 0);
    let rowStart = i32(data.r & 0xFFFFu);
    let numRows = i32(data.r >> 16u);
    let colStart = i32(data.g);
    let colEnd = i32(data.b);
    let sourceBase = i32(data.a);

    // Quad corner from vertexIndex (0-3 via index buffer [0,1,2, 2,1,3])
    let u = f32(i32(input.vertexIndex) & 1);       // 0 or 1 (left or right)
    let v = f32(i32(input.vertexIndex) >> 1u);      // 0 or 1 (bottom or top)

    // Map to NDC within the viewport
    // WebGPU viewport transform inverts Y: y_pixel = viewport.y + viewport.h * (1 - y_ndc) / 2
    // so we negate Y compared to the GLSL version to get correct row positioning
    let ndc = vec4f(f32(colStart), f32(colEnd), f32(rowStart), f32(rowStart + numRows)) / vec4f(f32(uniform.uTextureWidth), f32(uniform.uTextureWidth), f32(uniform.uLineCount), f32(uniform.uLineCount)) * 2.0 - 1.0;

    output.position = vec4f(mix(ndc.x, ndc.y, u), mix(-ndc.z, -ndc.w, v), 0.5, 1.0);

    // Output packed flat varying: (sourceBase, colStart, rowWidth, rowStart)
    output.vSubDraw = vec4i(sourceBase, colStart, colEnd - colStart, rowStart);

    return output;
}
`;
