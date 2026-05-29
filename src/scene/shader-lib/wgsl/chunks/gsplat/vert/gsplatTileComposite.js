// Tile-based composite vertex shader for the local compute gsplat renderer.
// No vertex attributes — generates tile quads procedurally from the built-in
// vertex index and a storage buffer of non-empty tile indices.
export default /* wgsl */`
varying vUv0: vec2f;

var<storage, read> rasterizeTileList: array<u32>;

uniform numTilesX: u32;
uniform screenWidth: f32;
uniform screenHeight: f32;

@vertex
fn vertexMain(input: VertexInput) -> VertexOutput {
    var output: VertexOutput;

    let quadIdx = pcVertexIndex / 6u;
    let cornerIdx = pcVertexIndex % 6u;

    let tileIdx = rasterizeTileList[quadIdx];
    let tileX = tileIdx % uniform.numTilesX;
    let tileY = tileIdx / uniform.numTilesX;

    let corners = array<vec2f, 6>(
        vec2f(0.0, 0.0), vec2f(1.0, 0.0), vec2f(1.0, 1.0),
        vec2f(0.0, 0.0), vec2f(1.0, 1.0), vec2f(0.0, 1.0)
    );
    let corner = corners[cornerIdx];

    let x0 = f32(tileX * 16u);
    let y0 = f32(tileY * 16u);
    let pixelX = x0 + corner.x * 16.0;
    let pixelY = y0 + corner.y * 16.0;

    output.position = vec4f(
        pixelX / uniform.screenWidth * 2.0 - 1.0,
        pixelY / uniform.screenHeight * 2.0 - 1.0,
        0.5, 1.0
    );

    output.vUv0 = vec2f(pixelX / uniform.screenWidth,
                        pixelY / uniform.screenHeight);
    return output;
}
`;
