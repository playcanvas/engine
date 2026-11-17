import { Asset, BoxGeometry, Mesh, PIXELFORMAT_SRGBA8, PlaneGeometry, Texture, Vec2, Vec3 } from 'playcanvas';

/**
 * @import { GraphicsDevice } from 'playcanvas'
 */

/**
 * The textures and meshes used by the impact effects.
 *
 * @typedef {object} EffectResources
 * @property {Texture} smoke - An 8x8 flipbook of a billowing smoke puff, with baked lighting.
 * @property {Texture} explosion - An 8x8 flipbook of a fireball cooling into smoke.
 * @property {Texture} glow - A soft round glow.
 * @property {Texture} star - A star shaped flash.
 * @property {Texture} spike - A thin four pointed glint.
 * @property {Texture} streak - A horizontal lens streak.
 * @property {Texture} halo - A soft ring, for shockwaves.
 * @property {Texture} scorch - A scorch mark decal.
 * @property {Texture} bulletHole - A bullet hole decal.
 * @property {Texture} rune - A rune circle decal.
 * @property {Texture} white - A plain white texture, for mesh particles, which need a color map.
 * @property {Mesh} chip - A small box, for stone chips and debris.
 * @property {Mesh} quad - A unit plane facing +Y, for decals.
 * @property {() => void} destroy - Destroys the generated resources.
 */

/**
 * @param {string} name - The name of the asset.
 * @param {string} url - The url of the texture.
 * @returns {Asset} A texture asset in sRGB, which particle color maps need.
 */
const texture = (name, url) => new Asset(name, 'texture', { url }, { srgb: true });

/**
 * The texture assets of the impact effects, to load before calling
 * {@link createEffectResources}. The flipbooks and decals are generated, see
 * `assets/textures/vfx/vfx-textures.txt`.
 */
const effectAssets = {
    smoke: texture('smoke-flipbook', './assets/textures/vfx/smoke-flipbook.webp'),
    explosion: texture('explosion-flipbook', './assets/textures/vfx/explosion-flipbook.webp'),
    scorch: texture('scorch-decal', './assets/textures/vfx/scorch-decal.webp'),
    bulletHole: texture('bullet-hole-decal', './assets/textures/vfx/bullet-hole-decal.webp'),
    rune: texture('rune-decal', './assets/textures/vfx/rune-decal.webp'),
    glow: texture('glow', './assets/textures/lens-flare/glow_soft.png'),
    star: texture('star', './assets/textures/lens-flare/spike_6.png'),
    spike: texture('spike', './assets/textures/lens-flare/spike_4.png'),
    streak: texture('streak', './assets/textures/lens-flare/anamorphic_streak.png'),
    halo: texture('halo', './assets/textures/lens-flare/halo.png')
};

/**
 * Creates the resources of the impact effects, from the loaded {@link effectAssets} and a few
 * generated meshes.
 *
 * @param {GraphicsDevice} device - The graphics device.
 * @returns {EffectResources} The resources.
 */
const createEffectResources = (device) => {
    const white = new Texture(device, {
        name: 'White',
        width: 4,
        height: 4,
        format: PIXELFORMAT_SRGBA8,
        mipmaps: false
    });
    white.lock().fill(255);
    white.unlock();

    const chip = Mesh.fromGeometry(device, new BoxGeometry({ halfExtents: new Vec3(0.5, 0.35, 0.45) }));
    const quad = Mesh.fromGeometry(device, new PlaneGeometry({ halfExtents: new Vec2(0.5, 0.5) }));

    /** @type {Record<string, Texture>} */
    const textures = {};
    for (const [name, asset] of Object.entries(effectAssets)) {
        textures[name] = /** @type {Texture} */ (asset.resource);
    }

    return {
        smoke: textures.smoke,
        explosion: textures.explosion,
        glow: textures.glow,
        star: textures.star,
        spike: textures.spike,
        streak: textures.streak,
        halo: textures.halo,
        scorch: textures.scorch,
        bulletHole: textures.bulletHole,
        rune: textures.rune,
        white,
        chip,
        quad,
        destroy: () => {
            white.destroy();
            chip.destroy();
            quad.destroy();
        }
    };
};

export { effectAssets, createEffectResources };
