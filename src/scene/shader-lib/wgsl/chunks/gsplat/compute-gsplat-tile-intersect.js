// Two tile intersection strategies: uncomment one.
// StopThePop is measurably faster on the tile count pass with little visible quality loss.
// TILE_INTERSECT_STOPTHEPOP: Closest-point Gaussian evaluation (faster, ~10 ops).
//   Based on "StopThePop: Sorted Gaussian Splatting for View-Consistent Real-time Rendering"
//   (Radl et al., 2024) https://github.com/r4dl/StopThePop-Rasterization
//   Clamps center to tile bounds, evaluates Gaussian power at that point.
//   Slightly approximate for highly elongated ellipses.
// TILE_INTERSECT_FLASHGS: Exact conic-edge intersection (slower, ~25 ops).
//   Based on "FlashGS: Efficient 3D Gaussian Splatting for Large-scale and High-resolution Rendering"
//   (Feng et al., 2024) https://github.com/InternLandMark/FlashGS
//   Solves quadratic intersections along the two closest tile edges.
//   Mathematically exact for arbitrary ellipses.
export const computeGsplatTileIntersectSource = /* wgsl */`

#define TILE_INTERSECT_STOPTHEPOP

#ifdef TILE_INTERSECT_STOPTHEPOP

// Clamp center to tile bounds and evaluate the Gaussian power at that point.
// If the power is below the cutoff threshold, the splat doesn't visibly
// contribute to this tile. Faster than exact edge intersection but can
// produce rare false negatives for extremely elongated ellipses.
fn tileIntersectsEllipse(
    tileMin: vec2f, tileMax: vec2f, center: vec2f,
    coeffX: f32, coeffY: f32, coeffXY: f32,
    radiusFactor: f32
) -> bool {
    let closest = clamp(center, tileMin, tileMax);
    let dx = closest - center;
    let power = coeffX * dx.x * dx.x + coeffXY * dx.x * dx.y + coeffY * dx.y * dx.y;
    return power > -radiusFactor * 0.5;
}

#else // TILE_INTERSECT_FLASHGS

// Tests if the quadratic a*t^2 + b*t + c = 0 has a root in the interval [l-d, r-d].
fn segmentIntersectsEllipse(a: f32, b: f32, c: f32, d: f32, l: f32, r: f32) -> bool {
    let delta = b * b - 4.0 * a * c;
    let t1 = (l - d) * (2.0 * a) + b;
    let t2 = (r - d) * (2.0 * a) + b;
    return delta >= 0.0 && (t1 <= 0.0 || t1 * t1 <= delta) && (t2 >= 0.0 || t2 * t2 <= delta);
}

// Tests if the Gaussian cutoff ellipse intersects a tile rectangle.
// Exact conic-edge intersection: solves the quadratic along the two closest
// tile edges to determine if the cutoff ellipse crosses them.
fn tileIntersectsEllipse(
    tileMin: vec2f, tileMax: vec2f, center: vec2f,
    coeffX: f32, coeffY: f32, coeffXY: f32,
    radiusFactor: f32
) -> bool {
    if (center.x >= tileMin.x && center.x <= tileMax.x &&
        center.y >= tileMin.y && center.y <= tileMax.y) {
        return true;
    }

    // Convert to positive-definite conic: cx*dx^2 + 2*cy*dx*dy + cz*dy^2 = w
    let cx = -2.0 * coeffX;
    let cy = -coeffXY;
    let cz = -2.0 * coeffY;
    let w = radiusFactor;

    // Test closest horizontal edge
    var dx: f32;
    if (center.x * 2.0 < tileMin.x + tileMax.x) {
        dx = center.x - tileMin.x;
    } else {
        dx = center.x - tileMax.x;
    }
    if (segmentIntersectsEllipse(cz, -2.0 * cy * dx, cx * dx * dx - w, center.y, tileMin.y, tileMax.y)) {
        return true;
    }

    // Test closest vertical edge
    var dy: f32;
    if (center.y * 2.0 < tileMin.y + tileMax.y) {
        dy = center.y - tileMin.y;
    } else {
        dy = center.y - tileMax.y;
    }
    if (segmentIntersectsEllipse(cx, -2.0 * cy * dy, cz * dy * dy - w, center.x, tileMin.x, tileMax.x)) {
        return true;
    }

    return false;
}

#endif
`;
