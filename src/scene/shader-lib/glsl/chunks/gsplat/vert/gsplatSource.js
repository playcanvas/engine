export default /* glsl */`
attribute vec3 vertex_position;         // xy: cornerUV, z: render order offset within instance

uniform uint numSplats;                 // total number of splats
#if !defined(GSPLAT_OIR) && !defined(GSPLAT_OIR_DEPTH)
    uniform highp usampler2D splatOrder;    // per-splat index to source gaussian
#endif

// initialize the splat source structure and global splat
bool initSource(out SplatSource source) {
    // calculate splat order from instance index and vertex position offset
    source.order = uint(gl_InstanceID) * {GSPLAT_INSTANCE_SIZE}u + uint(vertex_position.z);

    // return if out of range (since the last block of splats may be partially full)
    if (source.order >= numSplats) {
        return false;
    }

    // read splat id and initialize global splat for format read functions
    #if defined(GSPLAT_OIR) || defined(GSPLAT_OIR_DEPTH)
        uint splatId = source.order;
    #else
        ivec2 orderUV = ivec2(source.order % splatTextureSize, source.order / splatTextureSize);
        uint splatId = texelFetch(splatOrder, orderUV, 0).r;
    #endif
    setSplat(splatId);

    // get the corner
    source.cornerUV = vertex_position.xy;

    return true;
}
`;
