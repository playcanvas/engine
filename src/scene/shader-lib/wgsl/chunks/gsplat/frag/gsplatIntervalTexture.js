// fragment shader to generate intervals texture for GSplat LOD system
export default /* wgsl */`

// RG32U: (start, accumulatedSum)
var uIntervalsTexture: texture_2d<u32>;
uniform uNumIntervals: i32;
uniform uTextureWidth: i32;
uniform uActiveSplats: i32;

fn getCoordFromIndex(index: i32, textureWidth: i32) -> vec2i {
    return vec2i(index % textureWidth, index / textureWidth);
}

@fragment
fn fragmentMain(input: FragmentInput) -> FragmentOutput {
    var output: FragmentOutput;
    
    let coord = vec2i(i32(input.position.x), i32(input.position.y));
    let targetIndex = coord.y * uniform.uTextureWidth + coord.x;
    
    if (targetIndex >= uniform.uActiveSplats) {
        output.color = 0u;
        return output;
    }
    
    // Binary search through accumulated sums (G channel)
    var left = 0i;
    var right = uniform.uNumIntervals - 1;
    var intervalIndex = 0i;
    
    while (left <= right) {
        let mid = (left + right) / 2;
        
        let textureWidth = i32(textureDimensions(uIntervalsTexture, 0).x);
        let intervalCoord = getCoordFromIndex(mid, textureWidth);
        let intervalData = textureLoad(uIntervalsTexture, intervalCoord, 0).rg;
        
        let accumulatedSum = intervalData.g;  // G channel
        
        if (u32(targetIndex) < accumulatedSum) {
            intervalIndex = mid;
            right = mid - 1;
        } else {
            left = mid + 1;
        }
    }
    
    // Get interval data (both start and accumulated sum in one fetch)
    let textureWidth = i32(textureDimensions(uIntervalsTexture, 0).x);
    let intervalCoord = getCoordFromIndex(intervalIndex, textureWidth);
    let intervalData = textureLoad(uIntervalsTexture, intervalCoord, 0).rg;
    
    let intervalStart = intervalData.r;      // R channel
    let currentAccSum = intervalData.g;      // G channel
    
    // Get previous accumulated sum
    var prevAccSum = 0u;
    if (intervalIndex > 0) {
        let prevCoord = getCoordFromIndex(intervalIndex - 1, textureWidth);
        prevAccSum = textureLoad(uIntervalsTexture, prevCoord, 0).g;
    }
    
    // Calculate original splat index
    let offsetInInterval = u32(targetIndex) - prevAccSum;
    let originalIndex = intervalStart + offsetInInterval;
    
    output.color = originalIndex;
    return output;
}
`;
