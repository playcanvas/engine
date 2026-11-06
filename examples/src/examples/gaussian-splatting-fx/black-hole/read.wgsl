// Read code of the black hole's splats. Each splat is one image of a source: a clump of gas in the
// disk, or a star or a nebula far behind. This moves the source along its orbit, then to the place
// that image of it is seen at, stretched along the arc the lensing draws it into. It runs for every
// splat each frame, as the splats are copied to the work buffer.

uniform bhTime: f32;
uniform bhCameraPosition: vec3f;
uniform bhInflow: f32;
uniform bhBrightness: f32;
uniform bhTemperature: f32;
uniform bhDoppler: f32;
uniform bhLensing: f32;
uniform bhRing: f32;
uniform bhBackground: f32;
uniform bhDiskOpacity: f32;
uniform bhFalloff: f32;
uniform bhFocal: f32;        // focal length of the camera, in screen heights
uniform bhInnerRadius: f32;  // inner edge of the disk, the innermost stable orbit
uniform bhLensRange: vec3f;  // of the lensing table: smallest radius, log of the radius range, largest angle
var bhLensTable: texture_2d<f32>;

const PI: f32 = 3.14159265;
const SQRT_HALF: f32 = 0.70710678;

// shape of the disk splats against their size: long along the orbit, flat in the disk
const DISK_ALONG: f32 = 2.0;
const DISK_ACROSS: f32 = 0.7;
const DISK_FLAT: f32 = 0.12;

// size on screen, in screen heights, the disk splats fade out at
const DISK_FADE: f32 = 0.025;

// the lensing table, interpolated by hand as float textures may not be filterable
fn lensFetch(x: i32, y: i32) -> vec2f {
    return textureLoad(bhLensTable, vec2i(x, y), 0).xy;
}
fn lensLookup(psi: f32, r: f32) -> vec2f {
    let size = vec2i(textureDimensions(bhLensTable));
    let range = uniform.bhLensRange;
    let fx = clamp(psi / range.z, 0.0, 1.0) * f32(size.x - 1);
    let fy = clamp(log(max(r, range.x) / range.x) / range.y, 0.0, 1.0) * f32(size.y - 1);
    let x0 = i32(floor(fx));
    let y0 = i32(floor(fy));
    let x1 = min(x0 + 1, size.x - 1);
    let y1 = min(y0 + 1, size.y - 1);
    let tx = fx - floor(fx);
    let ty = fy - floor(fy);
    let a = mix(lensFetch(x0, y0), lensFetch(x1, y0), tx);
    let b = mix(lensFetch(x0, y1), lensFetch(x1, y1), tx);
    return mix(a, b, ty);
}

// the step in angle between two columns of the table
fn lensStep() -> f32 {
    return uniform.bhLensRange.z / f32(textureDimensions(bhLensTable).x - 1u);
}

fn kelvinToRgb(kelvin: f32) -> vec3f {
    let t = kelvin / 100.0;
    var c: vec3f;
    if (t <= 66.0) {
        c = vec3f(255.0, 99.4708025861 * log(t) - 161.1195681661,
            select(138.5177312231 * log(max(t - 10.0, 1e-3)) - 305.0447927307, 0.0, t <= 19.0));
    } else {
        c = vec3f(329.698727446 * pow(t - 60.0, -0.1332047592), 288.1221695283 * pow(t - 60.0, -0.0755148492), 255.0);
    }
    return clamp(c / 255.0, vec3f(0.0), vec3f(1.0));
}

struct BhImage {
    center: vec3f,
    rotation: vec4f,
    scale: vec3f,
    color: vec4f
}
var<private> bhImage: BhImage;
var<private> bhReady: bool = false;
var<private> bhDir: vec3f;

// rotation taking the x, y, z axes to the columns of an orthonormal basis, as x, y, z, w
fn basisToQuat(x: vec3f, y: vec3f, z: vec3f) -> vec4f {
    let tr = x.x + y.y + z.z;
    if (tr > 0.0) {
        let s = sqrt(tr + 1.0) * 2.0;
        return vec4f((y.z - z.y) / s, (z.x - x.z) / s, (x.y - y.x) / s, 0.25 * s);
    }
    if (x.x > y.y && x.x > z.z) {
        let s = sqrt(1.0 + x.x - y.y - z.z) * 2.0;
        return vec4f(0.25 * s, (y.x + x.y) / s, (z.x + x.z) / s, (y.z - z.y) / s);
    }
    if (y.y > z.z) {
        let s = sqrt(1.0 + y.y - x.x - z.z) * 2.0;
        return vec4f((y.x + x.y) / s, 0.25 * s, (z.y + y.z) / s, (z.x - x.z) / s);
    }
    let s = sqrt(1.0 + z.z - x.x - y.y) * 2.0;
    return vec4f((z.x + x.z) / s, (z.y + y.z) / s, 0.25 * s, (x.y - y.x) / s);
}

fn capLength(v: vec2f, cap: f32) -> vec2f {
    return v * min(1.0, cap / max(length(v), 1e-6));
}

// the disk: the camera sees a ray leaving the source at the impact parameter b, as if from far
// away. The primary image is moved from the true position of the source by how much the lensing
// shifts it, the others are placed behind the hole, at the angle b / distance from it.
fn diskImage(p: vec3f, image: f32, size: f32) {
    let r = max(length(p), 1.01);
    let pn = p / r;
    let cam = uniform.bhCameraPosition;
    let dist = length(cam);
    let o = cam / dist;
    let cosPsi = clamp(dot(pn, o), -1.0, 1.0);
    let sinPsi = sqrt(max(1.0 - cosPsi * cosPsi, 0.0));
    let psi1 = acos(cosPsi);
    var e = p - dot(p, o) * o;
    let el = length(e);
    e = select(normalize(cross(o, vec3f(0.0, 1.0, 0.0001))), e / max(el, 1e-6), el > 1e-5);

    var psi = psi1;
    var side = 1.0;
    if (image == 1.0) {
        psi = 2.0 * PI - psi1;
        side = -1.0;
    } else if (image == 2.0) {
        psi = 2.0 * PI + psi1;
    }

    // how far off the hole the image is seen, how that changes with the radius and the angle
    // of the source, and how much the image is stretched around the hole
    let lens = lensLookup(psi, r);
    let h = lensStep();
    let dbdpsi = (lensLookup(psi + h, r).x - lensLookup(psi - h, r).x) / (2.0 * h);
    let dbdr = (lensLookup(psi, r * 1.05).x - lensLookup(psi, r / 1.05).x) / (r * (1.05 - 1.0 / 1.05));
    let beta = r * sinPsi;
    let tangentLens = lens.x / max(beta, 1e-3);
    let lensing = uniform.bhLensing;

    let axisR = side * e;
    let axisT = cross(o, axisR);
    if (image == 0.0) {
        let z = dot(p, o);
        let k = (dist - z) / dist;
        bhImage.center = p + e * (lens.x - beta) * k * lensing;
    } else {
        let k = (dist + r) / dist;
        bhImage.center = axisR * lens.x * k - o * r;
    }

    // direction the light leaves the source at, for the doppler shift
    let toCam = select(normalize(o - cosPsi * pn), e, sinPsi < 1e-4);
    let cosA = mix(cosPsi, lens.y, lensing);
    let sinA = sqrt(max(1.0 - cosA * cosA, 0.0));
    bhDir = cosA * pn + sinA * toCam * side;

    // the splat is a flat streak of gas along its orbit, in the plane of the disk, drawn as the
    // lens maps it: how far its image moves out from the hole (by b) and around it, for a move
    // of the source along each of its axes. Seen edge on it is thin, so the disk does not pile
    // up hundreds of splats deep.
    let outward = mix(e, dbdr * pn - side * dbdpsi * toCam / r, lensing);
    let around = axisT * mix(1.0, side * tangentLens, lensing);
    let radial = normalize(vec3f(p.x, 0.0, p.z));
    let orbit = vec3f(-radial.z, 0.0, radial.x);
    // a splat is straight while the arc it is part of bends around the hole, so the lens only
    // stretches each of its axes up to a seventh of its distance from the hole. The cap holds
    // part way through turning the lensing on or off too, when the stretch toward the line from
    // the camera through the hole is only partly applied but still huge.
    let cap = max(0.15 * lens.x / size, DISK_ALONG);
    let ao = capLength(vec2f(dot(outward, orbit), dot(around, orbit)) * DISK_ALONG, cap);
    let ar = capLength(vec2f(dot(outward, radial), dot(around, radial)) * DISK_ACROSS, cap);
    let an = capLength(vec2f(outward.y, around.y) * DISK_FLAT, cap);

    // its covariance on the sky, in the axisR, axisT basis, and the axes of that
    let a = ao.x * ao.x + ar.x * ar.x + an.x * an.x;
    let c = ao.y * ao.y + ar.y * ar.y + an.y * an.y;
    let b = ao.x * ao.y + ar.x * ar.y + an.x * an.y;
    let theta = 0.5 * atan2(2.0 * b, a - c);
    let mid = 0.5 * (a + c);
    let spread = length(vec2f(0.5 * (a - c), b));
    let axis1 = axisR * cos(theta) + axisT * sin(theta);
    let axis2 = axisT * cos(theta) - axisR * sin(theta);
    bhImage.rotation = basisToQuat(axis1, axis2, o).wxyz;
    bhImage.scale = size * vec3f(sqrt(mid + spread), sqrt(max(mid - spread, 0.0)), DISK_FLAT);
}

// far away sources: here the camera is the near end of the ray, so the table is read from the
// radius of the camera, which gives the direction the camera looks in to see the source
fn farImage(p: vec3f, image: f32, size: f32) {
    let cam = uniform.bhCameraPosition;
    let dist = length(cam);
    let o = cam / dist;
    let s = normalize(p);
    let cosPsi = clamp(dot(s, o), -1.0, 1.0);
    let sinPsi = sqrt(max(1.0 - cosPsi * cosPsi, 0.0));
    let psi1 = acos(cosPsi);
    let t = select(normalize(s - cosPsi * o), normalize(cross(o, vec3f(0.0, 1.0, 0.0001))), sinPsi < 1e-5);

    var psi = psi1;
    var side = 1.0;
    if (image == 1.0) {
        psi = 2.0 * PI - psi1;
        side = -1.0;
    } else if (image == 2.0) {
        psi = 2.0 * PI + psi1;
    }

    let h = lensStep();
    let lens = lensLookup(psi, dist);
    let redshift = sqrt(1.0 - 1.0 / dist);
    let sinA = clamp(lens.x * redshift / dist, 0.0, 1.0);
    let alpha = atan2(sinA, lens.y);
    let lp = lensLookup(psi + h, dist);
    let lm = lensLookup(psi - h, dist);
    let alphaP = atan2(clamp(lp.x * redshift / dist, 0.0, 1.0), lp.y);
    let alphaM = atan2(clamp(lm.x * redshift / dist, 0.0, 1.0), lm.y);
    let radialLens = clamp(abs(alphaP - alphaM) / (2.0 * h), 0.02, 8.0);
    let along = distance(p, cam) * (PI - alpha);
    let tangentLens = clamp(min(sin(alpha) / max(sinPsi, 1e-3), 0.25 * along / size), 0.02, 8.0);
    let lensing = uniform.bhLensing;

    let lensed = normalize(cos(alpha) * o + sin(alpha) * t * side);
    let view = normalize(mix(s, lensed, lensing));
    bhImage.center = cam + view * distance(p, cam);

    // away from the hole on the sky, across it, and the view direction
    let toHole = -o;
    let axisR = normalize(view * dot(toHole, view) - toHole + vec3f(1e-6, 0.0, 0.0));
    let axisT = cross(view, axisR);
    bhImage.rotation = basisToQuat(axisR, axisT, view).wxyz;
    bhImage.scale = size * vec3f(mix(1.0, radialLens, lensing), mix(1.0, tangentLens, lensing), 1.0);
}

fn computeImage() {
    let src = loadBhSource();      // spawn radius, angle, height, kind
    let look = loadBhLook();       // size, intensity, life phase, image
    let tint = loadBhColor().rgb;
    let kind = src.w;
    let image = look.w;
    let t = uniform.bhTime;

    // the secondary and photon ring images only exist with the lensing; part way through turning
    // it on or off they are between where the source is and where its image is, so they fade in
    // only near the end
    let lensed = smoothstep(0.6, 1.0, uniform.bhLensing);
    var visible = 1.0;
    if (image == 1.0) {
        visible = lensed;
    } else if (image == 2.0) {
        visible = lensed * uniform.bhRing;
    }

    if (kind == 0.0) {
        // gas spiralling in from its spawn radius to the inner edge of the disk, on orbits
        // turning at the Kepler rate, then starting over
        let r0 = src.x;
        let inner = uniform.bhInnerRadius;
        let eps = uniform.bhInflow;
        let r015 = pow(r0, 1.5);
        let life = (2.0 / 3.0) * (r015 - pow(inner, 1.5)) / (eps * SQRT_HALF);
        let tau = fract(look.z + t / life) * life;
        let r = pow(max(r015 - 1.5 * eps * SQRT_HALF * tau, 0.0), 2.0 / 3.0);
        let angle = src.y - log(r / r0) / eps;
        let p = vec3f(r * cos(angle), src.z * r, r * sin(angle));
        diskImage(p, image, look.x);

        // fade in at birth and out at the inner edge, and fade out the splats close enough to
        // the camera to cover a large part of the screen
        let screenSize = sqrt(bhImage.scale.x * bhImage.scale.y) * uniform.bhFocal /
            max(distance(bhImage.center, uniform.bhCameraPosition), 1e-3);
        let fade = smoothstep(0.0, 0.04, tau / life) * smoothstep(inner, inner + 0.5, r) *
            (1.0 - smoothstep(0.5 * DISK_FADE, 1.5 * DISK_FADE, screenSize));

        // orbit speed and the direction the light leaves the gas at give the doppler shift,
        // added to the redshift of climbing out of the hole
        let beta = clamp(sqrt(0.5 / max(r - 1.0, 0.1)), 0.0, 0.99);
        let gamma = 1.0 / sqrt(1.0 - beta * beta);
        let v = normalize(vec3f(-p.z, 0.0, p.x));
        let g = sqrt(1.0 - 1.0 / r) / (gamma * (1.0 - beta * dot(v, bhDir)));
        let shift = mix(1.0, g, uniform.bhDoppler);

        // hotter toward the inner edge, and the hotter the brighter, less steeply than the
        // fourth power of a black body so the outer disk still glows
        let kelvin = uniform.bhTemperature * pow(r / inner, -0.75) * shift;
        let heat = 0.03 + pow(kelvin / uniform.bhTemperature, uniform.bhFalloff);
        let rgb = kelvinToRgb(kelvin) * tint;
        bhImage.color = vec4f(rgb * look.y * heat * uniform.bhBrightness * pow(shift, 1.5), visible * fade * uniform.bhDiskOpacity);
    } else {
        // far away, at rest
        let p = vec3f(src.x * cos(src.y), src.z, src.x * sin(src.y));
        farImage(p, image, look.x);
        bhImage.color = vec4f(tint * look.y * uniform.bhBackground, visible * select(1.0, 0.12, kind == 2.0));
    }
    bhReady = true;
}

fn getCenter() -> vec3f {
    if (!bhReady) { computeImage(); }
    return bhImage.center;
}
fn getColor() -> vec4f {
    if (!bhReady) { computeImage(); }
    return bhImage.color;
}
fn getScale() -> vec3f {
    if (!bhReady) { computeImage(); }
    return bhImage.scale;
}
fn getRotation() -> vec4f {
    if (!bhReady) { computeImage(); }
    return bhImage.rotation;
}
