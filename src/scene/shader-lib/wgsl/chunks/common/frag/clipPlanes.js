export default /* wgsl */`

// The clipping planes of the mesh instance, see MeshInstance#clippingPlanes. Each plane is in world
// space, stored as (normal, distance).
uniform clipPlanes: array<vec4f, 8>;

// x: the number of planes, y: 1 when only the fragments behind all of the planes are clipped, see
// MeshInstance#clipIntersection
uniform clipParams: vec2f;

// Discards the fragment at the world space position when it is clipped: when it is behind any of
// the clipping planes - on the side opposite to the plane normal - or with intersection clipping,
// only when it is behind all of them.
fn applyClipPlanes(positionW: vec3f) {
    let count: i32 = min(i32(uniform.clipParams.x), 8);
    var behindAny: bool = false;
    var behindAll: bool = count > 0;
    for (var i: i32 = 0; i < count; i++) {
        let plane: vec4f = uniform.clipPlanes[i];
        let behind: bool = dot(plane.xyz, positionW) + plane.w < 0.0;
        behindAny = behindAny || behind;
        behindAll = behindAll && behind;
    }

    if (select(behindAny, behindAll, uniform.clipParams.y > 0.5)) {
        discard;
    }
}
`;
