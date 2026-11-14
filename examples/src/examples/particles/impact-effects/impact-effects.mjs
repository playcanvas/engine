import {
    BLEND_ADDITIVE,
    BLEND_NONE,
    BLEND_NORMAL,
    CURVE_LINEAR,
    Color,
    Curve,
    CurveSet,
    EMITTERSHAPE_BOX,
    EMITTERSHAPE_SPHERE,
    PARTICLEORIENTATION_EMITTER,
    Vec3
} from 'playcanvas';

/**
 * @import { Mesh, Texture } from 'playcanvas'
 * @import { EffectDefinition, EffectLayer } from './particle-effects.mjs'
 * @import { EffectResources } from './effect-resources.mjs'
 */

// Each effect faces along the surface normal it hits: +Y of the emitters points away from the
// surface, so local velocities push particles out of it. Gravity and rising smoke are world space
// velocities.
//
// Sizes are in meters, at the scale of the scene: the room is 16 meters wide. The scale of a sprite
// particle is half its width, as its quad spans -1 to 1 before it is scaled.
//
// The options of a layer are the data of a particle system component, passed to
// entity.addComponent('particlesystem', options). They could be loaded from JSON instead, in the
// format the PlayCanvas Editor saves: curves as { type, keys } and vectors as [x, y, z] arrays.

/**
 * @param {...number} keys - Pairs of time and value.
 * @returns {Curve} A linear curve.
 */
const curve = (...keys) => {
    const result = new Curve(keys);
    result.type = CURVE_LINEAR;
    return result;
};

/**
 * @param {number[]} x - Pairs of time and value of the x curve.
 * @param {number[]} y - Pairs of time and value of the y curve.
 * @param {number[]} z - Pairs of time and value of the z curve.
 * @returns {CurveSet} A set of three linear curves.
 */
const curves = (x, y, z) => {
    const result = new CurveSet([x, y, z]);
    result.type = CURVE_LINEAR;
    return result;
};

/**
 * @param {number} x - The x value.
 * @param {number} y - The y value.
 * @param {number} z - The z value.
 * @returns {CurveSet} A constant vector or color.
 */
const constant = (x, y, z) => curves([0, x], [0, y], [0, z]);

/**
 * @param {...number[]} stops - Color stops, each an array of time, red, green and blue.
 * @returns {CurveSet} A color gradient over the lifetime.
 */
const gradient = (...stops) =>
    curves(
        stops.flatMap(([t, r]) => [t, r]),
        stops.flatMap(([t, , g]) => [t, g]),
        stops.flatMap(([t, , , b]) => [t, b])
    );

/**
 * @param {number} acceleration - The downwards acceleration.
 * @param {number} lifetime - The lifetime of the particles.
 * @returns {CurveSet} The world velocity of a falling particle over its lifetime.
 */
const gravity = (acceleration, lifetime) => curves([0, 0], [0, 0, 1, -acceleration * lifetime], [0, 0]);

/**
 * @param {Texture} texture - An 8x8 flipbook texture.
 * @returns {object} The particle options that play the flipbook once over each particle's life.
 */
const flipbook = (texture) => ({
    colorMap: texture,
    animTilesX: 8,
    animTilesY: 8,
    animNumFrames: 64,
    animSpeed: 1,
    animLoop: false
});

/**
 * Creates the definitions of the impact effects: bullet hits on metal and stone, an explosion
 * and a magic burst.
 *
 * @param {EffectResources} res - The textures and meshes of the effects.
 * @returns {Record<string, EffectDefinition>} The effects, by name.
 */
const createImpactEffects = (res) => {
    /**
     * A single short flash, at a random angle.
     *
     * @param {object} o - The options.
     * @param {Texture} o.texture - The texture.
     * @param {number[]} o.color - The color.
     * @param {number} o.size - The size.
     * @param {number} o.lifetime - The lifetime.
     * @param {number} o.intensity - The brightness, above 1 to bloom.
     * @param {boolean} [o.rotate] - True for a random angle. Defaults to true.
     * @returns {EffectLayer} The layer.
     */
    const flash = ({ texture, color, size, lifetime, intensity, rotate = true }) => ({
        name: 'Flash',
        options: {
            numParticles: 1,
            lifetime,
            rate: 0,
            colorMap: texture,
            blendType: BLEND_ADDITIVE,
            depthWrite: false,
            startAngle: 0,
            startAngle2: rotate ? 360 : 0,
            scaleGraph: curve(0, size * 0.7, 1, size),
            colorGraph: constant(color[0], color[1], color[2]),
            alphaGraph: curve(0, 1, 1, 0),
            intensity
        }
    });

    /**
     * Hot sparks thrown out of the surface, stretched along their motion and falling.
     *
     * @param {object} o - The options.
     * @param {number} o.count - The number of sparks.
     * @param {number[]} o.speed - The range of the speed away from the surface.
     * @param {number} o.spread - The largest sideways speed.
     * @param {number} o.lifetime - The lifetime.
     * @param {number} o.size - The width.
     * @param {number} o.intensity - The brightness, above 1 to bloom.
     * @returns {EffectLayer} The layer.
     */
    const sparks = ({ count, speed, spread, lifetime, size, intensity }) => ({
        name: 'Sparks',
        options: {
            numParticles: count,
            lifetime,
            rate: 0,
            colorMap: res.glow,
            blendType: BLEND_ADDITIVE,
            depthWrite: false,
            localVelocityGraph: constant(-spread, speed[0], -spread),
            localVelocityGraph2: constant(spread, speed[1], spread),
            velocityGraph: gravity(9.8, lifetime),
            alignToMotion: true,
            stretch: 0.08,
            scaleGraph: curve(0, size, 1, size * 0.3),
            scaleGraph2: curve(0, size * 0.5, 1, size * 0.2),
            colorGraph: gradient([0, 1, 0.95, 0.8], [0.3, 1, 0.65, 0.25], [1, 0.9, 0.25, 0.05]),
            alphaGraph: curve(0, 1, 0.7, 1, 1, 0),
            intensity
        }
    });

    /**
     * A puff of smoke or dust from the smoke flipbook, bursting out of the surface and slowing
     * down as it grows.
     *
     * @param {object} o - The options.
     * @param {string} o.name - The name of the layer.
     * @param {number} o.count - The number of puffs.
     * @param {number[]} o.color - The tint.
     * @param {number[]} o.size - The start and end size.
     * @param {number[]} o.speed - The range of the initial speed away from the surface.
     * @param {number} o.spread - The largest initial sideways speed.
     * @param {number} o.lifetime - The lifetime.
     * @param {number} o.opacity - The opacity.
     * @param {number} [o.rise] - The speed the puff rises in the world. Defaults to 0.
     * @param {number} [o.delay] - The delay. Defaults to 0.
     * @returns {EffectLayer} The layer.
     */
    const puff = ({ name, count, color, size, speed, spread, lifetime, opacity, rise = 0, delay = 0 }) => ({
        name,
        delay,
        options: {
            ...flipbook(res.smoke),
            numParticles: count,
            lifetime,
            rate: 0,
            emitterShape: EMITTERSHAPE_SPHERE,
            emitterRadius: size[0] * 0.3,
            blendType: BLEND_NORMAL,
            depthWrite: false,
            localVelocityGraph: curves(
                [0, -spread, 0.3, -spread * 0.15, 1, 0],
                [0, speed[0], 0.3, speed[0] * 0.15, 1, 0],
                [0, -spread, 0.3, -spread * 0.15, 1, 0]
            ),
            localVelocityGraph2: curves(
                [0, spread, 0.3, spread * 0.15, 1, 0],
                [0, speed[1], 0.3, speed[1] * 0.15, 1, 0],
                [0, spread, 0.3, spread * 0.15, 1, 0]
            ),
            velocityGraph: constant(0, rise, 0),
            startAngle: 0,
            startAngle2: 360,
            rotationSpeedGraph: curve(0, -30),
            rotationSpeedGraph2: curve(0, 30),
            scaleGraph: curve(0, size[0], 0.4, size[1] * 0.8, 1, size[1]),
            scaleGraph2: curve(0, size[0] * 0.8, 0.4, size[1] * 0.6, 1, size[1] * 0.75),
            colorGraph: constant(color[0], color[1], color[2]),
            alphaGraph: curve(0, 0, 0.05, opacity, 1, opacity),
            depthSoftening: 0.08
        }
    });

    /**
     * Solid mesh pieces thrown out of the surface, tumbling as they fall.
     *
     * @param {object} o - The options.
     * @param {string} o.name - The name of the layer.
     * @param {Mesh} o.mesh - The mesh of a piece.
     * @param {number} o.count - The number of pieces.
     * @param {number[]} o.color - The color.
     * @param {number} o.size - The largest size.
     * @param {number[]} o.speed - The range of the speed away from the surface.
     * @param {number} o.spread - The largest sideways speed.
     * @param {number} o.lifetime - The lifetime.
     * @returns {EffectLayer} The layer.
     */
    const debris = ({ name, mesh, count, color, size, speed, spread, lifetime }) => ({
        name,
        options: {
            numParticles: count,
            lifetime,
            rate: 0,
            mesh,
            colorMap: res.white,
            blendType: BLEND_NONE,
            depthWrite: true,
            lighting: true,
            halfLambert: true,
            localVelocityGraph: constant(-spread, speed[0], -spread),
            localVelocityGraph2: constant(spread, speed[1], spread),
            velocityGraph: gravity(14, lifetime),
            startAngle: 0,
            startAngle2: 360,
            rotationSpeedGraph: curve(0, -720),
            rotationSpeedGraph2: curve(0, 720),
            scaleGraph: curve(0, size, 0.85, size, 1, 0),
            scaleGraph2: curve(0, size * 0.5, 0.85, size * 0.5, 1, 0),
            colorGraph: constant(color[0], color[1], color[2])
        }
    });

    /**
     * A ring expanding across the surface.
     *
     * @param {number[]} color - The color.
     * @param {number} size - The final size.
     * @param {number} lifetime - The lifetime.
     * @param {number} intensity - The brightness, above 1 to bloom.
     * @param {number} [delay] - The delay. Defaults to 0.
     * @returns {EffectLayer} The layer.
     */
    const shockwave = (color, size, lifetime, intensity, delay = 0) => ({
        name: 'Shockwave',
        delay,
        // lifted off the surface, so it doesn't intersect it
        position: new Vec3(0, 0.05, 0),
        options: {
            numParticles: 1,
            lifetime,
            rate: 0,
            colorMap: res.halo,
            blendType: BLEND_ADDITIVE,
            depthWrite: false,
            // lies flat on the surface: the particle normal is +Y of the emitter
            orientation: PARTICLEORIENTATION_EMITTER,
            particleNormal: new Vec3(0, 1, 0),
            scaleGraph: curve(0, size * 0.1, 0.4, size * 0.75, 1, size),
            colorGraph: constant(color[0], color[1], color[2]),
            alphaGraph: curve(0, 1, 1, 0),
            intensity
        }
    });

    /**
     * Small glowing motes that drift up and twinkle.
     *
     * @param {object} o - The options.
     * @param {string} o.name - The name of the layer.
     * @param {Texture} o.texture - The texture.
     * @param {number} o.count - The number of motes.
     * @param {number} o.spawnTime - The seconds over which they spawn.
     * @param {number} o.radius - The radius of the area they spawn in.
     * @param {number[]} o.rise - The range of their speed upwards.
     * @param {number} o.lifetime - The lifetime.
     * @param {number} o.size - The size.
     * @param {CurveSet} o.color - The color over the lifetime.
     * @param {number} o.intensity - The brightness, above 1 to bloom.
     * @param {number} [o.delay] - The delay. Defaults to 0.
     * @param {boolean} [o.flat] - True to spawn on a flat disc instead of a sphere. Defaults to false.
     * @returns {EffectLayer} The layer.
     */
    const motes = ({
        name,
        texture,
        count,
        spawnTime,
        radius,
        rise,
        lifetime,
        size,
        color,
        intensity,
        delay = 0,
        flat = false
    }) => ({
        name,
        delay,
        options: {
            numParticles: count,
            lifetime,
            rate: spawnTime / count,
            emitterShape: flat ? EMITTERSHAPE_BOX : EMITTERSHAPE_SPHERE,
            emitterExtents: new Vec3(radius * 2, 0, radius * 2),
            emitterRadius: radius,
            colorMap: texture,
            blendType: BLEND_ADDITIVE,
            depthWrite: false,
            localVelocityGraph: constant(-0.3, rise[0], -0.3),
            localVelocityGraph2: constant(0.3, rise[1], 0.3),
            startAngle: 0,
            startAngle2: 360,
            rotationSpeedGraph: curve(0, -90),
            rotationSpeedGraph2: curve(0, 90),
            scaleGraph: curve(0, size, 1, size * 0.3),
            scaleGraph2: curve(0, size * 0.5, 1, size * 0.15),
            colorGraph: color,
            // twinkle
            alphaGraph: curve(0, 0, 0.1, 1, 0.25, 0.3, 0.4, 1, 0.55, 0.3, 0.7, 1, 1, 0),
            intensity
        }
    });

    return {
        'bullet-metal': {
            maxInstances: 24,
            light: { color: new Color(1, 0.65, 0.35), intensity: 3, range: 2.5, duration: 0.08, offset: 0.2 },
            // bare steel shows around the hole
            decals: [
                {
                    mesh: res.quad,
                    texture: res.bulletHole,
                    color: new Color(0.9, 0.92, 0.95),
                    size: [0.3, 0.38],
                    duration: 10,
                    fade: 2
                }
            ],
            layers: [
                flash({ texture: res.star, color: [1, 0.85, 0.6], size: 0.35, lifetime: 0.06, intensity: 8 }),
                flash({ texture: res.glow, color: [1, 0.6, 0.3], size: 0.4, lifetime: 0.08, intensity: 4 }),
                sparks({ count: 36, speed: [3, 8], spread: 3.5, lifetime: 0.5, size: 0.025, intensity: 8 }),
                puff({
                    name: 'Smoke',
                    count: 3,
                    color: [0.55, 0.55, 0.58],
                    size: [0.05, 0.3],
                    speed: [0.3, 0.8],
                    spread: 0.15,
                    lifetime: 1.2,
                    opacity: 0.45,
                    rise: 0.3
                })
            ]
        },

        'bullet-stone': {
            maxInstances: 24,
            // pale chipped stone shows around the hole
            decals: [
                {
                    mesh: res.quad,
                    texture: res.bulletHole,
                    color: new Color(0.95, 0.88, 0.78),
                    size: [0.32, 0.4],
                    duration: 10,
                    fade: 2
                }
            ],
            layers: [
                flash({ texture: res.spike, color: [1, 0.8, 0.55], size: 0.2, lifetime: 0.05, intensity: 6 }),
                puff({
                    name: 'Dust',
                    count: 5,
                    color: [0.62, 0.56, 0.48],
                    size: [0.08, 0.6],
                    speed: [0.8, 2],
                    spread: 0.6,
                    lifetime: 1.6,
                    opacity: 0.75,
                    rise: 0.15
                }),
                debris({
                    name: 'Chips',
                    mesh: res.chip,
                    count: 12,
                    color: [0.45, 0.42, 0.38],
                    size: 0.05,
                    speed: [2, 4],
                    spread: 1.5,
                    lifetime: 1
                }),
                sparks({ count: 5, speed: [2, 4], spread: 1.5, lifetime: 0.2, size: 0.015, intensity: 4 })
            ]
        },

        explosion: {
            maxInstances: 6,
            shake: 0.7,
            light: {
                color: new Color(1, 0.55, 0.25),
                intensity: 14,
                range: 12,
                duration: 1,
                offset: 1,
                flicker: 0.25
            },
            decals: [
                // a scorch mark, and hot embers glowing on it as they cool down
                {
                    mesh: res.quad,
                    texture: res.scorch,
                    color: new Color(1, 1, 1),
                    size: [4.5, 5.5],
                    duration: 14,
                    fade: 4,
                    delay: 0.1
                },
                {
                    mesh: res.quad,
                    texture: res.scorch,
                    color: new Color(1, 0.35, 0.08),
                    size: [2.5, 3],
                    duration: 4,
                    fade: 3.5,
                    delay: 0.1,
                    glow: 3
                }
            ],
            layers: [
                flash({ texture: res.glow, color: [1, 0.85, 0.6], size: 3, lifetime: 0.15, intensity: 6 }),
                flash({
                    texture: res.streak,
                    color: [1, 0.7, 0.4],
                    size: 4,
                    lifetime: 0.25,
                    intensity: 3,
                    rotate: false
                }),
                {
                    // the fireball flipbook cools from fire into dark smoke. The intensity above 1
                    // makes its fire bloom.
                    name: 'Fireball',
                    options: {
                        ...flipbook(res.explosion),
                        numParticles: 7,
                        lifetime: 1.7,
                        rate: 0,
                        emitterShape: EMITTERSHAPE_SPHERE,
                        emitterRadius: 0.35,
                        blendType: BLEND_NORMAL,
                        depthWrite: false,
                        radialSpeedGraph: curve(0, 2.5, 0.3, 0.3, 1, 0),
                        radialSpeedGraph2: curve(0, 1.2, 0.3, 0.2, 1, 0),
                        localVelocityGraph: constant(0, 0.4, 0),
                        localVelocityGraph2: constant(0, 1.2, 0),
                        startAngle: 0,
                        startAngle2: 360,
                        rotationSpeedGraph: curve(0, -20),
                        rotationSpeedGraph2: curve(0, 20),
                        scaleGraph: curve(0, 0.9, 1, 1.7),
                        scaleGraph2: curve(0, 0.7, 1, 1.3),
                        // fades into the lighter smoke column, instead of ending as a dark cloud
                        alphaGraph: curve(0, 1, 0.55, 1, 1, 0),
                        intensity: 3,
                        depthSoftening: 0.1
                    }
                },
                {
                    // starts as the fireball turns to smoke, and keeps rising
                    name: 'Smoke',
                    delay: 0.5,
                    options: {
                        ...flipbook(res.smoke),
                        numParticles: 12,
                        lifetime: 4.5,
                        rate: 0.03,
                        emitterShape: EMITTERSHAPE_SPHERE,
                        emitterRadius: 0.6,
                        blendType: BLEND_NORMAL,
                        depthWrite: false,
                        localVelocityGraph: curves([0, -0.2], [0, 1.2, 1, 0.3], [0, -0.2]),
                        localVelocityGraph2: curves([0, 0.2], [0, 2, 1, 0.6], [0, 0.2]),
                        startAngle: 0,
                        startAngle2: 360,
                        rotationSpeedGraph: curve(0, -15),
                        rotationSpeedGraph2: curve(0, 15),
                        scaleGraph: curve(0, 1, 1, 2.6),
                        scaleGraph2: curve(0, 0.8, 1, 2),
                        colorGraph: gradient([0, 0.55, 0.5, 0.46], [1, 0.62, 0.62, 0.66]),
                        alphaGraph: curve(0, 0, 0.08, 0.5, 1, 0.5),
                        depthSoftening: 0.12
                    }
                },
                {
                    // dust kicked up and pushed out along the ground
                    name: 'Ground Dust',
                    options: {
                        ...flipbook(res.smoke),
                        numParticles: 14,
                        lifetime: 2.4,
                        rate: 0,
                        emitterShape: EMITTERSHAPE_BOX,
                        emitterExtents: new Vec3(0.8, 0, 0.8),
                        blendType: BLEND_NORMAL,
                        depthWrite: false,
                        radialSpeedGraph: curve(0, 5, 0.3, 0.9, 1, 0),
                        radialSpeedGraph2: curve(0, 3, 0.3, 0.6, 1, 0),
                        localVelocityGraph: constant(0, 0.15, 0),
                        localVelocityGraph2: constant(0, 0.45, 0),
                        startAngle: 0,
                        startAngle2: 360,
                        scaleGraph: curve(0, 0.4, 1, 1.4),
                        scaleGraph2: curve(0, 0.3, 1, 1.1),
                        colorGraph: constant(0.42, 0.36, 0.29),
                        alphaGraph: curve(0, 0, 0.05, 0.7, 1, 0.6),
                        depthSoftening: 0.08
                    }
                },
                {
                    name: 'Sparks',
                    options: {
                        numParticles: 70,
                        lifetime: 1.3,
                        rate: 0,
                        emitterShape: EMITTERSHAPE_SPHERE,
                        emitterRadius: 0.2,
                        colorMap: res.glow,
                        blendType: BLEND_ADDITIVE,
                        depthWrite: false,
                        radialSpeedGraph: curve(0, 5),
                        radialSpeedGraph2: curve(0, 11),
                        localVelocityGraph: constant(0, 1.5, 0),
                        localVelocityGraph2: constant(0, 4, 0),
                        velocityGraph: gravity(9.8, 1.3),
                        alignToMotion: true,
                        stretch: 0.05,
                        scaleGraph: curve(0, 0.025, 1, 0.008),
                        scaleGraph2: curve(0, 0.015, 1, 0.005),
                        colorGraph: gradient([0, 1, 0.9, 0.6], [0.3, 1, 0.55, 0.15], [1, 0.8, 0.15, 0.03]),
                        alphaGraph: curve(0, 1, 0.75, 1, 1, 0),
                        intensity: 6
                    }
                },
                motes({
                    name: 'Embers',
                    texture: res.glow,
                    count: 40,
                    spawnTime: 1,
                    radius: 1,
                    rise: [0.3, 1.2],
                    lifetime: 2.5,
                    size: 0.025,
                    color: gradient([0, 1, 0.6, 0.2], [1, 0.9, 0.2, 0.05]),
                    intensity: 6,
                    delay: 0.3
                }),
                debris({
                    name: 'Debris',
                    mesh: res.chip,
                    count: 22,
                    color: [0.22, 0.2, 0.18],
                    size: 0.08,
                    speed: [3, 7],
                    spread: 3.5,
                    lifetime: 1.6
                }),
                shockwave([1, 0.7, 0.45], 3.5, 0.4, 2)
            ]
        },

        magic: {
            maxInstances: 8,
            light: { color: new Color(0.45, 0.6, 1), intensity: 5, range: 6, duration: 1.2, offset: 0.5, flicker: 0.2 },
            decals: [
                {
                    mesh: res.quad,
                    texture: res.rune,
                    color: new Color(0.4, 0.7, 1),
                    size: [2.6, 3],
                    duration: 2.2,
                    fade: 1.2,
                    glow: 4
                }
            ],
            layers: [
                flash({ texture: res.glow, color: [0.5, 0.75, 1], size: 1, lifetime: 0.3, intensity: 4 }),
                flash({ texture: res.star, color: [0.8, 0.9, 1], size: 0.9, lifetime: 0.25, intensity: 6 }),
                {
                    name: 'Orbs',
                    options: {
                        numParticles: 40,
                        lifetime: 1.5,
                        rate: 0,
                        // a thin shell, so all orbs start at the same distance and burst out evenly
                        emitterShape: EMITTERSHAPE_SPHERE,
                        emitterRadius: 0.15,
                        emitterRadiusInner: 0.12,
                        colorMap: res.glow,
                        blendType: BLEND_ADDITIVE,
                        depthWrite: false,
                        radialSpeedGraph: curve(0, 4.5, 0.25, 0.5, 1, 0),
                        radialSpeedGraph2: curve(0, 2.5, 0.25, 0.3, 1, 0),
                        localVelocityGraph: constant(0, 0.2, 0),
                        localVelocityGraph2: constant(0, 1, 0),
                        alignToMotion: true,
                        stretch: 0.04,
                        scaleGraph: curve(0, 0.08, 1, 0),
                        scaleGraph2: curve(0, 0.05, 1, 0),
                        colorGraph: gradient([0, 0.6, 0.95, 1], [1, 0.65, 0.35, 1]),
                        intensity: 5
                    }
                },
                motes({
                    name: 'Sparkles',
                    texture: res.spike,
                    count: 30,
                    spawnTime: 0.75,
                    radius: 0.8,
                    rise: [0.3, 1.2],
                    lifetime: 1.6,
                    size: 0.12,
                    color: constant(0.8, 0.9, 1),
                    intensity: 6
                }),
                motes({
                    name: 'Motes',
                    texture: res.glow,
                    count: 50,
                    spawnTime: 1,
                    radius: 0.9,
                    rise: [0.6, 1.8],
                    lifetime: 1.6,
                    size: 0.04,
                    color: gradient([0, 0.5, 0.85, 1], [1, 0.7, 0.4, 1]),
                    intensity: 6,
                    flat: true
                }),
                shockwave([0.5, 0.8, 1], 2.4, 0.6, 3),
                shockwave([0.7, 0.45, 1], 1.6, 0.6, 3, 0.12)
            ]
        }
    };
};

export { createImpactEffects };
