export default /* glsl */`

// The clipping planes of the mesh instance, see MeshInstance#clippingPlanes. Each plane is in world
// space, stored as (normal, distance).
uniform vec4 clipPlanes[8];

// x: the number of planes, y: 1 when only the fragments behind all of the planes are clipped, see
// MeshInstance#clipIntersection
uniform vec2 clipParams;

// Discards the fragment at the world space position when it is clipped: when it is behind any of
// the clipping planes - on the side opposite to the plane normal - or with intersection clipping,
// only when it is behind all of them.
void applyClipPlanes(vec3 positionW) {
    int count = int(clipParams.x);
    bool behindAny = false;
    bool behindAll = count > 0;
    for (int i = 0; i < 8; i++) {
        if (i >= count) break;
        bool behind = dot(clipPlanes[i].xyz, positionW) + clipPlanes[i].w < 0.0;
        behindAny = behindAny || behind;
        behindAll = behindAll && behind;
    }

    if (clipParams.y > 0.5 ? behindAll : behindAny) {
        discard;
    }
}
`;
