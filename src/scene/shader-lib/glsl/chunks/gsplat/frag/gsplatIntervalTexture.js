// fragment shader to generate intervals texture for GSplat LOD system
export default /* glsl */`

precision highp usampler2D;

// RG32U: (start, accumulatedSum)
uniform usampler2D uIntervalsTexture;
uniform int uNumIntervals;
uniform int uTextureWidth;
uniform int uActiveSplats;

ivec2 getCoordFromIndex(int index, int textureWidth) {
    return ivec2(index % textureWidth, index / textureWidth);
}

void main() {
    ivec2 coord = ivec2(gl_FragCoord.xy);
    int targetIndex = coord.y * uTextureWidth + coord.x;
    
    if (targetIndex >= uActiveSplats) {
        gl_FragColor = 0u;
        return;
    }
    
    // Binary search through accumulated sums (G channel)
    int left = 0;
    int right = uNumIntervals - 1;
    int intervalIndex = 0;
    
    while (left <= right) {
        int mid = (left + right) / 2;
        
        int textureWidth = textureSize(uIntervalsTexture, 0).x;
        ivec2 intervalCoord = getCoordFromIndex(mid, textureWidth);
        uvec2 intervalData = texelFetch(uIntervalsTexture, intervalCoord, 0).rg;
        
        uint accumulatedSum = intervalData.g;  // G channel
        
        if (uint(targetIndex) < accumulatedSum) {
            intervalIndex = mid;
            right = mid - 1;
        } else {
            left = mid + 1;
        }
    }
    
    // Get interval data (both start and accumulated sum in one fetch)
    int textureWidth = textureSize(uIntervalsTexture, 0).x;
    ivec2 intervalCoord = getCoordFromIndex(intervalIndex, textureWidth);
    uvec2 intervalData = texelFetch(uIntervalsTexture, intervalCoord, 0).rg;
    
    uint intervalStart = intervalData.r;      // R channel
    uint currentAccSum = intervalData.g;      // G channel
    
    // Get previous accumulated sum
    uint prevAccSum = 0u;
    if (intervalIndex > 0) {
        ivec2 prevCoord = getCoordFromIndex(intervalIndex - 1, textureWidth);
        prevAccSum = texelFetch(uIntervalsTexture, prevCoord, 0).g;
    }
    
    // Calculate original splat index
    uint offsetInInterval = uint(targetIndex) - prevAccSum;
    uint originalIndex = intervalStart + offsetInInterval;
    
    gl_FragColor = originalIndex;
}
`;
