export default /* glsl */`

// The clipping planes of the mesh instance, see MeshInstance#clippingPlanes, and of the camera, see
// CameraComponent#clippingPlanes. Each plane is in world space, stored as (normal, distance). Each
// params vector holds the number of planes, and 1 when only the fragments behind all of the planes
// are clipped. The planes of the camera do not clip screen space elements.
#ifdef CLIP_PLANES_MESH
    uniform vec4 clipPlanes[8];
    uniform vec2 clipParams;
#endif

#if defined(CLIP_PLANES_CAMERA) && !defined(SCREENSPACE)
    #define CLIP_PLANES_CAMERA_APPLY
    uniform vec4 camera_clipPlanes[8];
    uniform vec2 camera_clipParams;
#endif

// Whether the world space position is behind the plane, on the side opposite to the plane normal.
bool isBehindClipPlane(vec4 plane, vec3 positionW) {
    return dot(plane.xyz, positionW) + plane.w < 0.0;
}

// Discards the fragment at the world space position when it is clipped by either set of planes:
// when it is behind any of the planes of the set, or with intersection clipping, only when it is
// behind all of them.
void applyClipPlanes(vec3 positionW) {
    #ifdef CLIP_PLANES_MESH
    {
        int count = int(clipParams.x);
        bool behindAny = false;
        bool behindAll = count > 0;
        for (int i = 0; i < 8; i++) {
            if (i >= count) break;
            bool behind = isBehindClipPlane(clipPlanes[i], positionW);
            behindAny = behindAny || behind;
            behindAll = behindAll && behind;
        }
        if (clipParams.y > 0.5 ? behindAll : behindAny) {
            discard;
        }
    }
    #endif

    #ifdef CLIP_PLANES_CAMERA_APPLY
    {
        int count = int(camera_clipParams.x);
        bool behindAny = false;
        bool behindAll = count > 0;
        for (int i = 0; i < 8; i++) {
            if (i >= count) break;
            bool behind = isBehindClipPlane(camera_clipPlanes[i], positionW);
            behindAny = behindAny || behind;
            behindAll = behindAll && behind;
        }
        if (camera_clipParams.y > 0.5 ? behindAll : behindAny) {
            discard;
        }
    }
    #endif
}
`;
