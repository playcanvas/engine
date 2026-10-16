export default /* wgsl */`

// The clipping planes of the mesh instance, see MeshInstance#clippingPlanes, and of the camera, see
// CameraComponent#clippingPlanes. Each plane is in world space, stored as (normal, distance). Each
// params vector holds the number of planes, and 1 when only the fragments behind all of the planes
// are clipped. The planes of the camera do not clip screen space elements.
#ifdef CLIP_PLANES_MESH
    uniform clipPlanes: array<vec4f, 8>;
    uniform clipParams: vec2f;
#endif

#if defined(CLIP_PLANES_CAMERA) && !defined(SCREENSPACE)
    #define CLIP_PLANES_CAMERA_APPLY
    uniform camera_clipPlanes: array<vec4f, 8>;
    uniform camera_clipParams: vec2f;
#endif

// Whether the world space position is behind the plane, on the side opposite to the plane normal.
fn isBehindClipPlane(plane: vec4f, positionW: vec3f) -> bool {
    return dot(plane.xyz, positionW) + plane.w < 0.0;
}

// Discards the fragment at the world space position when it is clipped by either set of planes:
// when it is behind any of the planes of the set, or with intersection clipping, only when it is
// behind all of them.
fn applyClipPlanes(positionW: vec3f) {
    #ifdef CLIP_PLANES_MESH
    {
        let count: i32 = min(i32(uniform.clipParams.x), 8);
        var behindAny: bool = false;
        var behindAll: bool = count > 0;
        for (var i: i32 = 0; i < count; i++) {
            let behind: bool = isBehindClipPlane(uniform.clipPlanes[i], positionW);
            behindAny = behindAny || behind;
            behindAll = behindAll && behind;
        }
        if (select(behindAny, behindAll, uniform.clipParams.y > 0.5)) {
            discard;
        }
    }
    #endif

    #ifdef CLIP_PLANES_CAMERA_APPLY
    {
        let count: i32 = min(i32(uniform.camera_clipParams.x), 8);
        var behindAny: bool = false;
        var behindAll: bool = count > 0;
        for (var i: i32 = 0; i < count; i++) {
            let behind: bool = isBehindClipPlane(uniform.camera_clipPlanes[i], positionW);
            behindAny = behindAny || behind;
            behindAll = behindAll && behind;
        }
        if (select(behindAny, behindAll, uniform.camera_clipParams.y > 0.5)) {
            discard;
        }
    }
    #endif
}
`;
