// vertex shader for instanced LOD quad rendering to work buffer.
// Each instance covers one row-aligned segment of an interval.
// The fragment shader computes originalIndex from flat varyings.
export default /* glsl */`

attribute vec2 vertex_position;

// Sub-draw data texture: RGBA32U
// R = rowStart | (numRows << 16)
// G = colStart
// B = colEnd
// A = sourceBase
precision highp usampler2D;
uniform usampler2D uSubDrawData;
uniform ivec2 uTextureSize;  // (width, height)

// packed sub-draw params: (sourceBase, colStart, rowWidth, rowStart)
flat varying ivec4 vSubDraw;

void main(void) {
    // Read sub-draw parameters from 2D data texture
    int subDrawWidth = textureSize(uSubDrawData, 0).x;
    uvec4 data = texelFetch(uSubDrawData, ivec2(gl_InstanceID % subDrawWidth, gl_InstanceID / subDrawWidth), 0);
    int rowStart = int(data.r & 0xFFFFu);
    int numRows = int(data.r >> 16u);
    int colStart = int(data.g);
    int colEnd = int(data.b);
    int sourceBase = int(data.a);

    // Quad corner from gl_VertexID (0-3 via index buffer [0,1,2, 2,1,3])
    float u = float(gl_VertexID & 1);        // 0 or 1 (left or right)
    float v = float(gl_VertexID >> 1);       // 0 or 1 (bottom or top)

    // Map to NDC within the viewport
    vec4 ndc = vec4(colStart, colEnd, rowStart, rowStart + numRows) / vec4(uTextureSize.x, uTextureSize.x, uTextureSize.y, uTextureSize.y) * 2.0 - 1.0;

    gl_Position = vec4(mix(ndc.x, ndc.y, u), mix(ndc.z, ndc.w, v), 0.5, 1.0);

    // Output packed flat varying: (sourceBase, colStart, rowWidth, rowStart)
    vSubDraw = ivec4(sourceBase, colStart, colEnd - colStart, rowStart);
}
`;
