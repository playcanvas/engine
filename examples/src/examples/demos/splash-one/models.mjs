// Models for the Splash One demo - the jets, the missiles, the ground targets and the ships. The
// player's stealth fighter and the enemy frigate are loaded from models built in Blender, the rest are
// procedural.
//
// Everything is built from a handful of primitives - a lathe for round bodies, extruded outlines for
// wings and fins, boxes and cylinders - into one vertex colored mesh per model, so a whole jet is a
// single draw call with a single material. The models are deliberately simple stand-ins, sized and
// oriented like real ones (meters, nose along -z), so they can be swapped for authored assets later
// without touching the game: the attachment points the game needs - nozzles, wingtips, pylons - are
// returned alongside each one.

import {
    Color,
    Entity,
    Mat4,
    Mesh,
    MeshInstance,
    PRIMITIVE_TRIANGLES,
    Quat,
    StandardMaterial,
    Vec3,
    math
} from 'playcanvas';

import { applyAtmosphere } from './atmosphere.mjs';

/**
 * @import { Asset, ContainerResource, GraphicsDevice } from 'playcanvas'
 */

const _p = new Vec3();
const _n = new Vec3();
const _a = new Vec3();
const _b = new Vec3();
const _c = new Vec3();
const _e1 = new Vec3();
const _e2 = new Vec3();
const _identity = new Mat4();

/**
 * Accumulates vertex colored geometry into one mesh.
 */
class MeshBuilder {
    /** @type {number[]} */
    positions = [];

    /** @type {number[]} */
    normals = [];

    /** @type {number[]} */
    colors = [];

    /** @type {number[]} */
    indices = [];

    /**
     * Adds a vertex.
     *
     * @param {Mat4} matrix - The transform to apply.
     * @param {number} x - The x coordinate.
     * @param {number} y - The y coordinate.
     * @param {number} z - The z coordinate.
     * @param {number} nx - The x component of the normal.
     * @param {number} ny - The y component of the normal.
     * @param {number} nz - The z component of the normal.
     * @param {number[]} color - The sRGB color, 0 to 255.
     * @returns {number} The index of the vertex.
     */
    vertex(matrix, x, y, z, nx, ny, nz, color) {
        matrix.transformPoint(_p.set(x, y, z), _p);
        matrix.transformVector(_n.set(nx, ny, nz), _n).normalize();
        this.positions.push(_p.x, _p.y, _p.z);
        this.normals.push(_n.x, _n.y, _n.z);
        this.colors.push(color[0], color[1], color[2], 255);
        return this.positions.length / 3 - 1;
    }

    /**
     * Adds a flat shaded triangle.
     *
     * @param {Mat4} matrix - The transform to apply.
     * @param {number[]} a - The first corner.
     * @param {number[]} b - The second corner.
     * @param {number[]} c - The third corner, counter clockwise when seen from the front.
     * @param {number[]} color - The sRGB color.
     */
    triangle(matrix, a, b, c, color) {
        _a.set(a[0], a[1], a[2]);
        _b.set(b[0], b[1], b[2]);
        _c.set(c[0], c[1], c[2]);
        _e1.sub2(_b, _a);
        _e2.sub2(_c, _a);
        _n.cross(_e1, _e2).normalize();
        const nx = _n.x;
        const ny = _n.y;
        const nz = _n.z;
        const i0 = this.vertex(matrix, a[0], a[1], a[2], nx, ny, nz, color);
        const i1 = this.vertex(matrix, b[0], b[1], b[2], nx, ny, nz, color);
        const i2 = this.vertex(matrix, c[0], c[1], c[2], nx, ny, nz, color);
        this.indices.push(i0, i1, i2);
    }

    /**
     * Adds a flat shaded quad.
     *
     * @param {Mat4} matrix - The transform to apply.
     * @param {number[]} a - The first corner.
     * @param {number[]} b - The second corner.
     * @param {number[]} c - The third corner.
     * @param {number[]} d - The fourth corner, counter clockwise when seen from the front.
     * @param {number[]} color - The sRGB color.
     */
    quad(matrix, a, b, c, d, color) {
        this.triangle(matrix, a, b, c, color);
        this.triangle(matrix, a, c, d, color);
    }

    /**
     * Adds a smooth body of revolution along the z axis, with an elliptical, slightly squared off
     * cross section.
     *
     * @param {Mat4} matrix - The transform to apply.
     * @param {number[][]} profile - Rings of [z, half width, half height, y offset], nose first.
     * @param {number} segments - The number of segments around.
     * @param {(ring: number, angle: number) => number[]} colorAt - The color of a vertex.
     * @param {number} [squareness] - The superellipse exponent of the cross section.
     * @param {boolean} [upperOnly] - Only build the upper half, as for a canopy.
     */
    lathe(matrix, profile, segments, colorAt, squareness = 2, upperOnly = false) {
        const base = this.positions.length / 3;
        const steps = upperOnly ? segments / 2 : segments;
        const exponent = 2 / squareness;

        for (let r = 0; r < profile.length; r++) {
            const [z, w, h, y] = profile[r];

            // the slope of the profile, which tilts the normals of a tapering section forward
            const prev = profile[Math.max(r - 1, 0)];
            const next = profile[Math.min(r + 1, profile.length - 1)];
            const dz = next[0] - prev[0];
            const dr = (next[1] + next[2] - (prev[1] + prev[2])) * 0.5;

            for (let s = 0; s <= steps; s++) {
                const angle = (s / segments) * Math.PI * 2;
                const cos = Math.cos(angle);
                const sin = Math.sin(angle);
                const cx = Math.sign(cos) * Math.pow(Math.abs(cos), exponent);
                const cy = Math.sign(sin) * Math.pow(Math.abs(sin), exponent);
                const nx = cx / Math.max(w, 0.001);
                const ny = cy / Math.max(h, 0.001);
                const length = Math.hypot(nx, ny) || 1;
                const slope = dz !== 0 ? -dr / dz : 0;
                this.vertex(matrix, cx * w, y + cy * h, z, nx / length, ny / length, slope, colorAt(r, angle));
            }
        }

        const stride = steps + 1;
        for (let r = 0; r < profile.length - 1; r++) {
            for (let s = 0; s < steps; s++) {
                const a = base + r * stride + s;
                const b = a + stride;
                this.indices.push(a, a + 1, b, a + 1, b + 1, b);
            }
        }
    }

    /**
     * Adds a flat plate with thickness, from an outline - a wing, a fin or a stabilizer. The outline
     * is in the plate's own x / z plane, counter clockwise seen from above, and must be convex.
     *
     * @param {Mat4} matrix - The transform to apply.
     * @param {number[][]} outline - The [x, z] corners of the outline.
     * @param {number} thickness - The thickness of the plate.
     * @param {number[]} color - The sRGB color.
     * @param {number[]} [edgeColor] - The color of the edges.
     */
    plate(matrix, outline, thickness, color, edgeColor = color) {
        const half = thickness * 0.5;
        const count = outline.length;
        for (let i = 1; i < count - 1; i++) {
            const a = outline[0];
            const b = outline[i];
            const c = outline[i + 1];
            this.triangle(matrix, [a[0], half, a[1]], [c[0], half, c[1]], [b[0], half, b[1]], color);
            this.triangle(matrix, [a[0], -half, a[1]], [b[0], -half, b[1]], [c[0], -half, c[1]], color);
        }

        // the edges are pinched to a ridge, so the plate reads as an airfoil rather than a slab
        for (let i = 0; i < count; i++) {
            const a = outline[i];
            const b = outline[(i + 1) % count];
            this.quad(
                matrix,
                [a[0], -half, a[1]],
                [a[0], half, a[1]],
                [b[0], half, b[1]],
                [b[0], -half, b[1]],
                edgeColor
            );
        }
    }

    /**
     * Adds a box.
     *
     * @param {Mat4} matrix - The transform to apply.
     * @param {number[]} center - The center of the box.
     * @param {number[]} size - The full size of the box.
     * @param {number[]} color - The sRGB color.
     * @param {number} [taper] - How much narrower the top is than the bottom, as a fraction.
     */
    box(matrix, center, size, color, taper = 0) {
        const [cx, cy, cz] = center;
        const hx = size[0] * 0.5;
        const hy = size[1] * 0.5;
        const hz = size[2] * 0.5;
        const tx = hx * (1 - taper);
        const tz = hz * (1 - taper);
        const p = [
            [cx - hx, cy - hy, cz - hz],
            [cx + hx, cy - hy, cz - hz],
            [cx + hx, cy - hy, cz + hz],
            [cx - hx, cy - hy, cz + hz],
            [cx - tx, cy + hy, cz - tz],
            [cx + tx, cy + hy, cz - tz],
            [cx + tx, cy + hy, cz + tz],
            [cx - tx, cy + hy, cz + tz]
        ];
        this.quad(matrix, p[0], p[1], p[2], p[3], color);
        this.quad(matrix, p[4], p[7], p[6], p[5], color);
        this.quad(matrix, p[0], p[4], p[5], p[1], color);
        this.quad(matrix, p[2], p[6], p[7], p[3], color);
        this.quad(matrix, p[1], p[5], p[6], p[2], color);
        this.quad(matrix, p[3], p[7], p[4], p[0], color);
    }

    /**
     * Adds a capped cylinder along the y axis.
     *
     * @param {Mat4} matrix - The transform to apply.
     * @param {number} radius - The radius.
     * @param {number} height - The height.
     * @param {number} segments - The number of segments around.
     * @param {number[]} color - The sRGB color.
     * @param {number} [topRadius] - The radius at the top, for a cone.
     */
    cylinder(matrix, radius, height, segments, color, topRadius = radius) {
        const half = height * 0.5;
        for (let s = 0; s < segments; s++) {
            const a0 = (s / segments) * Math.PI * 2;
            const a1 = ((s + 1) / segments) * Math.PI * 2;
            const b0 = [Math.cos(a0) * radius, -half, Math.sin(a0) * radius];
            const b1 = [Math.cos(a1) * radius, -half, Math.sin(a1) * radius];
            const t0 = [Math.cos(a0) * topRadius, half, Math.sin(a0) * topRadius];
            const t1 = [Math.cos(a1) * topRadius, half, Math.sin(a1) * topRadius];
            this.quad(matrix, b0, t0, t1, b1, color);
            this.triangle(matrix, [0, half, 0], t1, t0, color);
            this.triangle(matrix, [0, -half, 0], b0, b1, color);
        }
    }

    /**
     * Creates the mesh.
     *
     * @param {GraphicsDevice} device - The graphics device.
     * @returns {Mesh} The mesh.
     */
    build(device) {
        const mesh = new Mesh(device);
        mesh.setPositions(this.positions);
        mesh.setNormals(this.normals);
        mesh.setColors32(new Uint8Array(this.colors));
        mesh.setIndices(this.indices);
        mesh.update(PRIMITIVE_TRIANGLES);
        return mesh;
    }
}

/**
 * A transform matrix.
 *
 * @param {number} x - The x translation.
 * @param {number} y - The y translation.
 * @param {number} z - The z translation.
 * @param {number} [ex] - The rotation around x, in degrees.
 * @param {number} [ey] - The rotation around y, in degrees.
 * @param {number} [ez] - The rotation around z, in degrees.
 * @returns {Mat4} The matrix.
 */
const transform = (x, y, z, ex = 0, ey = 0, ez = 0) => {
    return new Mat4().setTRS(new Vec3(x, y, z), new Quat().setFromEulerAngles(ex, ey, ez), Vec3.ONE);
};

/**
 * Mirrors an outline across the x axis, keeping it counter clockwise.
 *
 * @param {number[][]} outline - The outline.
 * @returns {number[][]} The mirrored outline.
 */
const mirror = (outline) => outline.map(([x, z]) => [-x, z]).reverse();

/**
 * Creates a vertex colored material for the models.
 *
 * @param {number} metalness - The metalness.
 * @param {number} gloss - The glossiness.
 * @returns {StandardMaterial} The material.
 */
const createPaintMaterial = (metalness, gloss) => {
    const material = new StandardMaterial();
    material.diffuseVertexColor = true;
    material.vertexColorGamma = true;
    material.useMetalness = true;
    material.metalness = metalness;
    material.gloss = gloss;
    applyAtmosphere(material);
    material.update();
    return material;
};

/**
 * The materials shared by every model.
 *
 * @typedef {object} ModelMaterials
 * @property {StandardMaterial} paint - Painted airframes and vehicles.
 * @property {StandardMaterial} canopy - Tinted cockpit glass.
 * @property {StandardMaterial} burnt - A burnt out wreck.
 * @property {StandardMaterial} redLight - The left navigation light.
 * @property {StandardMaterial} greenLight - The right navigation light.
 * @property {StandardMaterial} whiteLight - The strobe.
 */

/**
 * Creates the materials shared by every model.
 *
 * @returns {ModelMaterials} The materials.
 */
export const createMaterials = () => {
    const canopy = new StandardMaterial();
    canopy.diffuse = new Color(0.02, 0.025, 0.03);
    canopy.useMetalness = true;
    canopy.metalness = 0.6;
    canopy.gloss = 0.95;
    canopy.specularityFactor = 1;
    applyAtmosphere(canopy);
    canopy.update();

    const burnt = createPaintMaterial(0.1, 0.15);
    burnt.diffuse = new Color(0.16, 0.15, 0.14);
    burnt.update();

    const light = (r, g, b) => {
        const material = new StandardMaterial();
        material.diffuse = new Color(0, 0, 0);
        material.emissive = new Color(r, g, b);
        material.emissiveIntensity = 30;
        material.update();
        return material;
    };

    return {
        paint: createPaintMaterial(0.35, 0.55),
        canopy,
        burnt,
        redLight: light(1, 0.05, 0.03),
        greenLight: light(0.05, 1, 0.2),
        whiteLight: light(1, 1, 1)
    };
};

/**
 * The paint scheme of a jet.
 *
 * @typedef {object} Livery
 * @property {number[]} body - The main color.
 * @property {number[]} belly - The underside.
 * @property {number[]} accent - The tail and wingtip markings.
 * @property {number[]} dark - Radome, intakes and nozzle.
 */

/** @type {Record<string, Livery>} */
export const LIVERIES = {
    // two tone air superiority gray
    player: {
        body: [140, 150, 162],
        belly: [178, 186, 194],
        accent: [86, 96, 112],
        dark: [46, 48, 54]
    },

    // a sand and rust aggressor scheme, with red tails, so the enemy reads at a glance
    enemy: {
        body: [148, 128, 96],
        belly: [178, 164, 136],
        accent: [168, 44, 32],
        dark: [44, 40, 36]
    }
};

/**
 * Where things attach to a jet, in its local space.
 *
 * @typedef {object} JetPoints
 * @property {Vec3[]} nozzles - The exhausts, where the flames go.
 * @property {number} nozzleRadius - The radius of an exhaust.
 * @property {Vec3[]} wingtips - The left and right wingtips, where the vapor trails come off.
 * @property {Vec3[]} pylons - The missile pylons, in firing order.
 */

/**
 * The model of a jet, ready to be added to the scene.
 *
 * @typedef {object} JetModel
 * @property {Entity} entity - The root of the model.
 * @property {JetPoints} points - Its attachment points.
 * @property {Entity[]} pylonMissiles - The missile on each pylon, hidden once it is fired.
 * @property {Entity[]} lights - The navigation lights - left, right and the tail strobe.
 * @property {(pitch: number, roll: number, yaw: number, brake: number, throttle: number, dt: number) => void} [animate] -
 * Moves the control surfaces for the controls, and the nozzles for the throttle, on a jet that has them.
 */

/**
 * Builds the airframe of a jet.
 *
 * @param {Livery} livery - Its paint scheme.
 * @param {boolean} twinTail - Twin canted tails and no canards (the player), or a single tall tail
 * with canards (the enemy) - a different silhouette, so the two are told apart at a distance.
 * @returns {{ airframe: MeshBuilder, canopy: MeshBuilder }} The geometry of the painted airframe, and
 * of its glass canopy.
 */
const buildAirframe = (livery, twinTail) => {
    const builder = new MeshBuilder();
    const { body, belly, accent, dark } = livery;
    const m = _identity;

    // the fuselage - [z, half width, half height, y offset], from the tip of the radome to the nozzle
    const fuselage = [
        [-8.6, 0.01, 0.01, 0.05],
        [-8.2, 0.16, 0.15, 0.05],
        [-7.4, 0.34, 0.32, 0.06],
        [-6.2, 0.56, 0.52, 0.08],
        [-4.8, 0.74, 0.7, 0.1],
        [-3.3, 0.86, 0.8, 0.1],
        [-1.8, 1.0, 0.8, 0.06],
        [0.0, 1.12, 0.76, 0.0],
        [2.0, 1.1, 0.72, 0.0],
        [4.0, 0.96, 0.66, 0.0],
        [5.6, 0.76, 0.6, 0.0],
        [6.6, 0.62, 0.56, 0.0]
    ];
    builder.lathe(
        m,
        fuselage,
        20,
        (ring, angle) => {
            if (ring <= 2) {
                return dark;
            }
            // lighter on the belly, the way real camouflage is countershaded
            return Math.sin(angle) < -0.25 ? belly : body;
        },
        2.6
    );

    // the canopy bubble
    const canopyBuilder = new MeshBuilder();
    canopyBuilder.lathe(
        m,
        [
            [-5.2, 0.05, 0.05, 0.68],
            [-4.6, 0.32, 0.34, 0.66],
            [-3.6, 0.44, 0.52, 0.64],
            [-2.4, 0.42, 0.48, 0.62],
            [-1.4, 0.24, 0.26, 0.62],
            [-0.8, 0.04, 0.04, 0.62]
        ],
        16,
        () => [255, 255, 255],
        2,
        true
    );

    // the nozzle, a dark ring closed off by the throat, so the open end of the body is never seen
    builder.lathe(
        m,
        [
            [6.5, 0.6, 0.55, 0.0],
            [7.2, 0.52, 0.5, 0.0]
        ],
        16,
        () => dark,
        2
    );
    builder.cylinder(transform(0, 0, 7.08, 90, 0, 0), 0.5, 0.04, 16, [24, 24, 26]);

    // main wings, a clipped delta, with the leading edge extension running forward along the body
    const wing = [
        [0.85, -1.2],
        [5.3, 2.7],
        [5.3, 3.7],
        [0.85, 4.2]
    ];
    builder.plate(transform(0, -0.12, 0), wing, 0.16, body, accent);
    builder.plate(transform(0, -0.12, 0), mirror(wing), 0.16, body, accent);
    const lerx = [
        [0.8, -4.6],
        [1.0, -1.2],
        [0.8, 0.4]
    ];
    builder.plate(transform(0, 0.02, 0), lerx, 0.1, body);
    builder.plate(transform(0, 0.02, 0), mirror(lerx), 0.1, body);

    // wingtip rails
    builder.box(m, [5.35, -0.12, 2.9], [0.14, 0.14, 2.6], accent);
    builder.box(m, [-5.35, -0.12, 2.9], [0.14, 0.14, 2.6], accent);

    // horizontal stabilizers
    const stabilizer = [
        [0.7, 4.4],
        [3.2, 6.1],
        [3.2, 6.9],
        [0.6, 7.0]
    ];
    builder.plate(transform(0, 0.0, 0), stabilizer, 0.1, body, accent);
    builder.plate(transform(0, 0.0, 0), mirror(stabilizer), 0.1, body, accent);

    // the intakes under the leading edge extensions, with dark mouths
    builder.box(m, [1.05, -0.38, -0.8], [0.62, 0.7, 3.4], body);
    builder.box(m, [-1.05, -0.38, -0.8], [0.62, 0.7, 3.4], body);
    builder.box(m, [1.05, -0.38, -2.52], [0.5, 0.56, 0.06], dark);
    builder.box(m, [-1.05, -0.38, -2.52], [0.5, 0.56, 0.06], dark);

    // the vertical tails, in the plate's x / z plane and rotated upright
    const tail = [
        [0.0, 3.0],
        [3.2, 5.4],
        [3.2, 6.4],
        [0.0, 6.9]
    ];
    const tailTip = [
        [2.5, 4.9],
        [3.2, 5.4],
        [3.2, 6.4],
        [2.5, 6.6]
    ];
    if (twinTail) {
        // canted outwards by twenty degrees each - the plate's x axis is turned to point up and out
        for (const side of [-1, 1]) {
            const cant = transform(side * 0.62, 0.45, 0, 0, 0, 90 - side * 20);
            builder.plate(cant, tail, 0.1, body, accent);
            builder.plate(cant, tailTip, 0.12, accent);
        }
    } else {
        const tallTail = [
            [0.0, 2.6],
            [3.9, 5.2],
            [3.9, 6.3],
            [0.0, 6.9]
        ];
        const tallTip = [
            [3.0, 4.6],
            [3.9, 5.2],
            [3.9, 6.3],
            [3.0, 6.5]
        ];
        const upright = transform(0, 0.5, 0, 0, 0, 90);
        builder.plate(upright, tallTail, 0.12, body, accent);
        builder.plate(upright, tallTip, 0.14, accent);

        // canards ahead of the wings
        const canard = [
            [0.75, -4.0],
            [2.2, -2.9],
            [2.2, -2.4],
            [0.75, -2.4]
        ];
        builder.plate(transform(0, 0.1, 0), canard, 0.08, body, accent);
        builder.plate(transform(0, 0.1, 0), mirror(canard), 0.08, body, accent);
    }

    // ventral fins, pointing down and out
    for (const side of [-1, 1]) {
        builder.plate(
            transform(side * 0.55, -0.62, 0, 0, 0, -90 + side * 20),
            [
                [0, 4.2],
                [0.6, 5.0],
                [0.6, 5.8],
                [0, 6.0]
            ],
            0.06,
            accent
        );
    }

    // pylons under the wings
    for (const x of [-3.7, -2.4, 2.4, 3.7]) {
        builder.box(m, [x, -0.32, 2.0], [0.1, 0.3, 1.6], dark);
    }

    return { airframe: builder, canopy: canopyBuilder };
};

/**
 * Builds the geometry of a missile.
 *
 * @returns {MeshBuilder} The geometry.
 */
const buildMissile = () => {
    const builder = new MeshBuilder();
    const white = [226, 226, 222];
    const gray = [96, 100, 104];
    const band = [190, 160, 40];

    builder.lathe(
        _identity,
        [
            [-1.55, 0.005, 0.005, 0],
            [-1.35, 0.06, 0.06, 0],
            [-1.1, 0.1, 0.1, 0],
            [1.4, 0.1, 0.1, 0],
            [1.5, 0.085, 0.085, 0]
        ],
        10,
        (ring) => {
            if (ring <= 1) {
                return gray;
            }
            return ring === 2 ? band : white;
        }
    );

    // cruciform fins - small canards near the nose and larger tail fins
    for (let i = 0; i < 4; i++) {
        const roll = 45 + i * 90;
        const m = transform(0, 0, 0, 0, 0, roll);
        builder.plate(
            m,
            [
                [0.08, -0.9],
                [0.24, -0.75],
                [0.24, -0.62],
                [0.08, -0.58]
            ],
            0.02,
            gray
        );
        builder.plate(
            m,
            [
                [0.08, 0.9],
                [0.32, 1.25],
                [0.32, 1.45],
                [0.08, 1.45]
            ],
            0.025,
            gray
        );
    }
    return builder;
};

/**
 * Creates a jet.
 *
 * @param {GraphicsDevice} device - The graphics device.
 * @param {ModelMaterials} materials - The shared materials.
 * @param {Livery} livery - Its paint scheme.
 * @param {boolean} twinTail - Whether it has the player's twin tail silhouette.
 * @param {Mesh} missileMesh - The missile mesh, for the missiles on its pylons.
 * @param {boolean} castShadows - Whether it casts a shadow.
 * @returns {JetModel} The jet.
 */
export const createJet = (device, materials, livery, twinTail, missileMesh, castShadows) => {
    const { airframe, canopy } = buildAirframe(livery, twinTail);
    const entity = new Entity('Jet');
    entity.addComponent('render', {
        meshInstances: [
            new MeshInstance(airframe.build(device), materials.paint),
            new MeshInstance(canopy.build(device), materials.canopy)
        ],
        castShadows
    });

    // the missiles hanging on the pylons, fired from the outside in, alternating sides
    const pylons = [
        new Vec3(-3.7, -0.55, 2.0),
        new Vec3(3.7, -0.55, 2.0),
        new Vec3(-2.4, -0.55, 2.0),
        new Vec3(2.4, -0.55, 2.0)
    ];
    const pylonMissiles = pylons.map((pylon) => {
        const missile = new Entity('PylonMissile');
        missile.addComponent('render', {
            meshInstances: [new MeshInstance(missileMesh, materials.paint)],
            castShadows
        });
        missile.setLocalPosition(pylon);
        entity.addChild(missile);
        return missile;
    });

    // navigation lights - red on the left wingtip, green on the right, and a white tail strobe
    const lights = [
        { material: materials.redLight, position: new Vec3(-5.36, -0.12, 1.5) },
        { material: materials.greenLight, position: new Vec3(5.36, -0.12, 1.5) },
        { material: materials.whiteLight, position: new Vec3(0, twinTail ? 0.6 : 4.4, twinTail ? 7.25 : 6.4) }
    ].map(({ material, position }) => {
        const light = new Entity('NavLight');
        light.addComponent('render', { type: 'sphere', material, castShadows: false });
        light.setLocalScale(0.16, 0.16, 0.16);
        light.setLocalPosition(position);
        entity.addChild(light);
        return light;
    });

    return {
        entity,
        points: {
            nozzles: [new Vec3(0, 0, 7.15)],
            nozzleRadius: 0.48,
            wingtips: [new Vec3(-5.36, -0.12, 3.8), new Vec3(5.36, -0.12, 3.8)],
            pylons
        },
        pylonMissiles,
        lights
    };
};

// --------------------------------------------------------------------------------------------
// the player's jet - an experimental fighter modeled in Blender, whose control surfaces and nozzles move

/**
 * A moving part of the model - one that turns about its hinge.
 *
 * @typedef {object} ControlSurface
 * @property {Entity} entity - The part, deflected by turning it about its local x axis.
 * @property {number} angle - Its current deflection, in degrees, positive trailing edge down.
 */

/**
 * Finds a moving part in the model. Each one hangs under a hinge node, whose x axis runs along the
 * hinge, with the part trailing back along -y, so a positive turn about x lowers its trailing edge -
 * or, for the petals of the nozzles, swings it out.
 *
 * @param {Entity} root - The model.
 * @param {string} name - The name of the part.
 * @returns {ControlSurface} The part.
 */
const findSurface = (root, name) => {
    const entity = /** @type {Entity} */ (root.findByName(name));
    return { entity, angle: 0 };
};

/**
 * Creates the player's jet from the experimental fighter model - a GLB built in Blender, with its
 * canards, flaps, elevons, ruddervators, air brake and nozzles as separate parts on their hinges, and
 * empty nodes marking where the nozzles, wingtips, pylons and lights are.
 *
 * @param {Asset} asset - The loaded container asset of the model.
 * @param {ModelMaterials} materials - The shared materials.
 * @param {Mesh} missileMesh - The missile mesh, for the missiles on its pylons.
 * @param {boolean} castShadows - Whether it casts a shadow.
 * @returns {JetModel} The jet.
 */
export const createPlayerJet = (asset, materials, missileMesh, castShadows) => {
    const entity = /** @type {ContainerResource} */ (asset.resource).instantiateRenderEntity({ castShadows });
    entity.name = 'PlayerJet';

    // the haze over the distance applies to the model's own materials too
    const seen = new Set();
    for (const render of entity.findComponents('render')) {
        for (const meshInstance of /** @type {any} */ (render).meshInstances) {
            const material = meshInstance.material;
            if (!seen.has(material)) {
                seen.add(material);
                applyAtmosphere(material);
                material.update();
            }
        }
    }

    // the attachment points, from the empty nodes of the model, in its own space
    /**
     * @param {string} name - The name of the point.
     * @returns {Vec3} Its position.
     */
    const point = (name) => /** @type {Entity} */ (entity.findByName(`point_${name}`)).getPosition().clone();

    const sides = ['L', 'R'];
    /**
     * @param {string} name - The name of the parts, without the side.
     * @returns {ControlSurface[]} The left and the right one.
     */
    const pair = (name) => sides.map((side) => findSurface(entity, `${name}_${side}`));
    const canards = pair('canard');
    const leflaps = pair('leflap');
    const innerElevons = pair('elevon_inner');
    const outerElevons = pair('elevon_outer');
    const ruddervators = pair('ruddervator');
    const nozzles = pair('nozzle');
    const airbrake = findSurface(entity, 'airbrake');
    // the petals of each nozzle, outer flaps alternating with inner seals
    const petals = sides.flatMap((side) => {
        const list = [];
        for (let i = 0; entity.findByName(`petal_${side}_${String(i).padStart(2, '0')}`); i++) {
            list.push(findSurface(entity, `petal_${side}_${String(i).padStart(2, '0')}`));
        }
        return list;
    });

    // the missiles hanging on the pylons, fired from the outside in, alternating sides
    const pylons = [0, 1, 2, 3].map((i) => point(`pylon_${i}`));
    const pylonMissiles = pylons.map((pylon) => {
        const missile = new Entity('PylonMissile');
        missile.addComponent('render', {
            meshInstances: [new MeshInstance(missileMesh, materials.paint)],
            castShadows
        });
        missile.setLocalPosition(pylon);
        entity.addChild(missile);
        return missile;
    });

    // navigation lights on the wingtips and a strobe on the spine between the engines
    const lights = [
        { material: materials.redLight, position: point('light_red') },
        { material: materials.greenLight, position: point('light_green') },
        { material: materials.whiteLight, position: point('light_strobe') }
    ].map(({ material, position }) => {
        const light = new Entity('NavLight');
        light.addComponent('render', { type: 'sphere', material, castShadows: false });
        light.setLocalScale(0.16, 0.16, 0.16);
        light.setLocalPosition(position);
        entity.addChild(light);
        return light;
    });

    /**
     * Moves the parts for the controls and the throttle, easing them there the way hydraulics move.
     *
     * @param {number} pitch - The pitch command, -1 to 1, positive nose up.
     * @param {number} roll - The roll command, -1 to 1, positive to the right.
     * @param {number} yaw - The yaw command, -1 to 1, positive nose right.
     * @param {number} brake - How far the air brake is out, 0 to 1.
     * @param {number} throttle - The throttle, zero idle, one full military power, above one the
     * afterburner.
     * @param {number} dt - The time step.
     */
    const animate = (pitch, roll, yaw, brake, throttle, dt) => {
        const ease = 1 - Math.exp(-14 * dt);
        /**
         * @param {ControlSurface} surface - The part.
         * @param {number} target - Its deflection, in degrees.
         * @param {number} [limit] - The most it can deflect, either way.
         * @param {number} [rate] - How quickly it gets there, 0 to 1 per step.
         */
        const move = (surface, target, limit = 32, rate = ease) => {
            surface.angle += (math.clamp(target, -limit, limit) - surface.angle) * rate;
            surface.entity.setLocalEulerAngles(surface.angle, 0, 0);
        };
        // The canards lift their leading edges to pull the nose up, the elevons raise their trailing
        // edges to pull it and differ side to side to roll, and the leading edge flaps droop as the
        // nose comes up. The V tails steer with both trailing edges to one side, and pitch with
        // them moving apart - a positive turn swings either one toward the right. With the air brake
        // out, the inner elevons drop, the outer ones rise and the tails splay out.
        const droop = Math.max(pitch, 0) * 14 + brake * 4;
        for (let i = 0; i < 2; i++) {
            const side = i === 0 ? -1 : 1;
            move(canards[i], pitch * 16 - side * roll * 6);
            move(leflaps[i], -droop);
            move(innerElevons[i], -pitch * 16 - side * roll * 12 + brake * 22);
            move(outerElevons[i], -pitch * 10 - side * roll * 22 - brake * 22);
            move(ruddervators[i], yaw * 20 - side * pitch * 12 + side * brake * 18);
            // the nozzles tilt with the pitch, to vector the thrust
            move(nozzles[i], -pitch * 10);
        }
        move(airbrake, -brake * 50, 55);

        // The nozzles close down at cruise and open wide for the afterburner - and part way at idle,
        // as real ones do - their actuators a little slower than the flight controls.
        const open = math.smoothstep(1, 1.5, throttle) + 0.45 * (1 - math.smoothstep(0.25, 0.6, throttle));
        const petalAngle = -7 + 10 * Math.min(open, 1);
        const petalRate = 1 - Math.exp(-5 * dt);
        for (let i = 0; i < petals.length; i++) {
            move(petals[i], petalAngle, 32, petalRate);
        }
    };

    return {
        entity,
        points: {
            nozzles: [point('nozzle_L'), point('nozzle_R')],
            nozzleRadius: 0.24,
            wingtips: [point('wingtip_L'), point('wingtip_R')],
            pylons
        },
        pylonMissiles,
        lights,
        animate
    };
};

/**
 * The enemy frigate's model.
 *
 * @typedef {object} ShipModel
 * @property {Entity} entity - The root of the model, on the waterline amidships, its bow along -z.
 * @property {Entity} turret - The gun's turret, which turns about its own y axis.
 * @property {Entity} barrel - The gun's barrel, which elevates about its own x axis.
 * @property {Vec3[]} cells - The tops of the missile cells, where its missiles leave from.
 * @property {Vec3} bow - The stem, at the waterline.
 * @property {Vec3} stern - The middle of the transom, at the waterline.
 * @property {Vec3} funnel - The top of the funnel.
 * @property {Vec3} center - The middle of the ship, above the deck, which missiles are aimed at.
 * @property {number} length - Its length.
 * @property {number} beam - Its width.
 * @property {number} radius - How big it is, for hits.
 */

// the materials of the loaded models the haze has been applied to
const hazed = new WeakSet();

/**
 * Creates the enemy stealth frigate - a faceted hull and superstructure with a pyramid mast, a gun and
 * a block of missile cells forward, and a hangar and a helicopter deck aft, built in Blender for this
 * example.
 *
 * @param {Asset} asset - The frigate's container asset.
 * @returns {ShipModel} The frigate.
 */
export const createFrigate = (asset) => {
    const entity = /** @type {ContainerResource} */ (asset.resource).instantiateRenderEntity({ castShadows: false });
    entity.name = 'Frigate';

    // the haze over the distance applies to the model's own materials too - shared by every ship
    for (const render of entity.findComponents('render')) {
        for (const meshInstance of /** @type {any} */ (render).meshInstances) {
            const material = meshInstance.material;
            if (!hazed.has(material)) {
                hazed.add(material);
                applyAtmosphere(material);
                material.update();
            }
        }
    }

    /**
     * @param {string} name - The name of the point.
     * @returns {Vec3} Its position in the model's space.
     */
    const point = (name) => /** @type {Entity} */ (entity.findByName(`point_${name}`)).getPosition().clone();
    const cells = [];
    for (let i = 0; entity.findByName(`point_vls_${i}`); i++) {
        cells.push(point(`vls_${i}`));
    }

    return {
        entity,
        turret: /** @type {Entity} */ (entity.findByName('turret')),
        barrel: /** @type {Entity} */ (entity.findByName('barrel')),
        cells,
        bow: point('bow'),
        stern: point('stern'),
        funnel: point('funnel'),
        center: point('deck'),
        length: 120,
        beam: 16.4,
        radius: 22
    };
};

/**
 * Creates the mesh shared by every missile.
 *
 * @param {GraphicsDevice} device - The graphics device.
 * @returns {Mesh} The mesh, nose along -z, 3 meters long.
 */
export const createMissileMesh = (device) => buildMissile().build(device);

/**
 * A ground target model.
 *
 * @typedef {object} GroundModel
 * @property {Entity} entity - The root of the model.
 * @property {Entity|null} turret - The part that turns to track the player, if any.
 * @property {Vec3|null} launchPoint - Where its missiles leave from, in the turret's space.
 * @property {number} radius - How big it is, for hits and for the blast when it goes up.
 */

const OLIVE = [86, 92, 62];
const OLIVE_DARK = [60, 64, 44];
const TRACK = [38, 38, 36];
const STEEL = [120, 124, 126];
const CONCRETE = [150, 148, 140];
const WARNING = [180, 150, 40];

/**
 * Creates a model entity from a builder.
 *
 * @param {GraphicsDevice} device - The graphics device.
 * @param {MeshBuilder} builder - The geometry.
 * @param {StandardMaterial} material - The material.
 * @param {string} name - The entity name.
 * @returns {Entity} The entity.
 */
const createModelEntity = (device, builder, material, name) => {
    const entity = new Entity(name);
    entity.addComponent('render', {
        meshInstances: [new MeshInstance(builder.build(device), material)],
        castShadows: false
    });
    return entity;
};

/**
 * Creates a mobile surface to air missile launcher - a six wheeled truck with a turning launcher of
 * four missile canisters.
 *
 * @param {GraphicsDevice} device - The graphics device.
 * @param {ModelMaterials} materials - The shared materials.
 * @returns {GroundModel} The launcher.
 */
export const createSamLauncher = (device, materials) => {
    const hull = new MeshBuilder();
    const m = _identity;
    hull.box(m, [0, 1.3, 0], [2.8, 1.0, 7.4], OLIVE);
    hull.box(m, [0, 2.3, -2.7], [2.6, 1.3, 1.9], OLIVE, 0.12);
    hull.box(m, [0, 2.45, -3.62], [2.2, 0.6, 0.06], TRACK);
    for (const z of [-2.6, 0.4, 2.6]) {
        for (const x of [-1.35, 1.35]) {
            hull.cylinder(transform(x, 0.6, z, 0, 0, 90), 0.6, 0.5, 10, TRACK);
        }
    }
    const entity = createModelEntity(device, hull, materials.paint, 'SamLauncher');

    const launcher = new MeshBuilder();
    launcher.box(m, [0, 0.25, 0], [2.4, 0.5, 2.4], OLIVE_DARK);
    const rack = transform(0, 1.2, 0, 35, 0, 0);
    for (const x of [-0.75, -0.25, 0.25, 0.75]) {
        launcher.box(rack, [x, 0, 0], [0.42, 0.42, 5.2], OLIVE);
        launcher.box(rack, [x, 0, -2.62], [0.36, 0.36, 0.04], WARNING);
    }
    launcher.box(m, [0, 0.9, 1.1], [0.5, 1.4, 0.5], OLIVE_DARK);
    const turret = createModelEntity(device, launcher, materials.paint, 'SamTurret');
    turret.setLocalPosition(0, 1.8, 1.6);
    entity.addChild(turret);

    return { entity, turret, launchPoint: new Vec3(0, 2.6, -2.2), radius: 5 };
};

/**
 * Creates a tank.
 *
 * @param {GraphicsDevice} device - The graphics device.
 * @param {ModelMaterials} materials - The shared materials.
 * @returns {GroundModel} The tank.
 */
export const createTank = (device, materials) => {
    const hull = new MeshBuilder();
    const m = _identity;
    hull.box(m, [0, 1.15, 0], [3.2, 1.0, 6.6], OLIVE, 0.06);
    hull.box(m, [1.55, 0.6, 0], [0.7, 1.1, 6.9], TRACK);
    hull.box(m, [-1.55, 0.6, 0], [0.7, 1.1, 6.9], TRACK);
    const entity = createModelEntity(device, hull, materials.paint, 'Tank');

    const turretBuilder = new MeshBuilder();
    turretBuilder.box(m, [0, 0.4, 0.3], [2.4, 0.8, 3.0], OLIVE_DARK, 0.18);
    turretBuilder.cylinder(transform(0, 0.45, -2.6, 90, 0, 0), 0.12, 4.2, 8, OLIVE_DARK);
    turretBuilder.box(m, [0.6, 0.95, 0.8], [0.5, 0.3, 0.6], OLIVE);
    const turret = createModelEntity(device, turretBuilder, materials.paint, 'TankTurret');
    turret.setLocalPosition(0, 1.65, 0.4);
    entity.addChild(turret);

    return { entity, turret, launchPoint: null, radius: 4.5 };
};

/**
 * Creates a radar station - a hut and a mast with a turning dish.
 *
 * @param {GraphicsDevice} device - The graphics device.
 * @param {ModelMaterials} materials - The shared materials.
 * @returns {GroundModel} The radar, whose turret is the dish.
 */
export const createRadar = (device, materials) => {
    const base = new MeshBuilder();
    const m = _identity;
    base.box(m, [0, 1.4, 0], [4.4, 2.8, 4.4], CONCRETE);
    base.box(m, [0, 2.9, 0], [4.8, 0.2, 4.8], STEEL);
    base.cylinder(transform(0, 5.2, 0), 0.3, 4.6, 10, STEEL);
    const entity = createModelEntity(device, base, materials.paint, 'Radar');

    // a flat array antenna, tilted back towards the sky
    const dish = new MeshBuilder();
    dish.box(transform(0, 1.3, 0, -18, 0, 0), [0, 0, 0], [6.2, 2.4, 0.3], STEEL);
    dish.box(transform(0, 1.3, 0, -18, 0, 0), [0, 0, -0.17], [5.8, 2.1, 0.06], [70, 74, 78]);
    dish.box(m, [0, 0.3, 0.3], [0.6, 0.8, 0.6], STEEL);
    const turret = createModelEntity(device, dish, materials.paint, 'RadarDish');
    turret.setLocalPosition(0, 7.4, 0);
    entity.addChild(turret);

    return { entity, turret, launchPoint: null, radius: 5.5 };
};

/**
 * Creates a pair of fuel tanks, which make a satisfying fireball.
 *
 * @param {GraphicsDevice} device - The graphics device.
 * @param {ModelMaterials} materials - The shared materials.
 * @returns {GroundModel} The tanks.
 */
export const createFuelTanks = (device, materials) => {
    const builder = new MeshBuilder();
    const m = _identity;
    for (const x of [-4.2, 4.2]) {
        builder.cylinder(transform(x, 2.6, 0), 3.4, 5.2, 18, [196, 198, 196]);
        builder.cylinder(transform(x, 5.7, 0), 3.4, 1.0, 18, [176, 178, 176], 2.2);
        builder.box(m, [x, 2.4, -3.45], [1.2, 0.5, 0.1], [160, 40, 30]);
    }
    builder.box(m, [0, 1.6, 0], [5.2, 0.5, 0.5], STEEL);
    builder.box(m, [0, 0.1, 0], [16, 0.2, 9], CONCRETE);
    const entity = createModelEntity(device, builder, materials.paint, 'FuelTanks');
    return { entity, turret: null, launchPoint: null, radius: 8 };
};
