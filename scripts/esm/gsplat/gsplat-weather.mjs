import { Script, Vec3, BoundingBox, GSplatFormat, GSplatContainer, PIXELFORMAT_RGBA8 } from 'playcanvas';

/**
 * @import { Entity } from 'playcanvas'
 */

/**
 * Procedural infinite weather particle system using Gaussian splats. Creates a camera-relative
 * volume of particles that appear fixed in world space, falling and drifting infinitely.
 *
 * Each particle occupies a cell in a 3D grid. Its world position is derived from a hash of
 * the world-space cell coordinate (baseCell + gridOffset). The entity is snapped to
 * baseCell * cellSize so that the static sort centers align with the hashed world positions,
 * giving correct depth ordering with both CPU and GPU sorting.
 *
 * @example
 * const weatherEntity = new pc.Entity('Weather');
 * weatherEntity.addComponent('script');
 * const weather = weatherEntity.script.create(GsplatWeather);
 * weather.followEntity = cameraEntity;
 * weather.speed = 1.2;
 * weather.drift = 0.15;
 * app.root.addChild(weatherEntity);
 */
class GsplatWeather extends Script {
    static scriptName = 'gsplatWeather';

    // --- Grid configuration (read at initialize; call rebuild() after changing) ---

    /**
     * World-space half-extents of the particle volume (x, y, z). The total volume
     * is extents * 2 in each axis, centered on the followed entity.
     *
     * @type {Vec3}
     * @attribute
     */
    extents = new Vec3(12, 12, 12);

    /**
     * Particle density — number of particles per world unit along each axis.
     * Higher values produce more particles in the same volume.
     *
     * @attribute
     * @range [0.5, 4]
     */
    density = 2;

    // --- Runtime properties (updated every frame as uniforms) ---

    /**
     * Entity to follow. Particle volume always surrounds this entity's position.
     * Typically set to the camera entity.
     *
     * @type {Entity|null}
     */
    followEntity = null;

    /**
     * Fall speed multiplier.
     *
     * @attribute
     * @range [0, 40]
     */
    speed = 1.0;

    /**
     * Per-particle horizontal drift intensity.
     *
     * @attribute
     * @range [0, 1]
     */
    drift = 0.15;

    /**
     * Overall opacity multiplier.
     *
     * @attribute
     * @range [0, 1]
     */
    opacity = 0.8;

    /**
     * Particle color as [r, g, b] in 0..1 range.
     *
     * @type {number[]}
     * @attribute
     */
    color = [1, 1, 1];

    /**
     * Minimum particle size in world units.
     *
     * @attribute
     * @range [0.0001, 0.04]
     */
    particleMinSize = 0.006;

    /**
     * Maximum particle size in world units.
     *
     * @attribute
     * @range [0.0001, 0.04]
     */
    particleMaxSize = 0.012;

    /**
     * Vertical elongation multiplier. 1 = round (snow), higher values stretch
     * particles vertically (rain streaks).
     *
     * @attribute
     * @range [1, 20]
     */
    elongate = 1.0;

    // --- Private state ---

    /** @private */
    _container = null;

    /** @private */
    _format = null;

    /** @private */
    _time = 0;

    /** @private */
    _baseCellArray = [0, 0, 0];

    /** @private */
    _camPosArray = [0, 0, 0];

    /** @private */
    _gridHalfArray = [0, 0, 0];

    /** @private */
    _particleSizeArray = [0, 0];

    /**
     * Cell size derived from density. Clamped to avoid division by zero.
     *
     * @type {number}
     * @ignore
     */
    get cellSize() {
        return 1 / Math.max(this.density, 0.1);
    }

    /**
     * Number of grid half-cells per axis, derived from extents and density.
     * Clamped to 1..128 to fit the RGBA8 texture encoding.
     *
     * @param {number} extent - Half-extent in world units.
     * @returns {number} Half-cell count.
     * @private
     */
    _halfCells(extent) {
        return Math.min(128, Math.max(1, Math.floor(extent * Math.max(this.density, 0.1))));
    }

    /**
     * Total number of particles in the grid.
     *
     * @type {number}
     */
    get numParticles() {
        const hx = this._halfCells(this.extents.x);
        const hy = this._halfCells(this.extents.y);
        const hz = this._halfCells(this.extents.z);
        return hx * 2 * hy * 2 * hz * 2;
    }

    initialize() {
        this._format = new GSplatFormat(this.app.graphicsDevice, [
            { name: 'data', format: PIXELFORMAT_RGBA8 }
        ], {
            readGLSL: /* glsl */`
                uniform float uTime;
                uniform float uCellSize;
                uniform vec3 uGridHalf;
                uniform vec3 uBaseCell;
                uniform vec3 uCameraPos;
                uniform float uSpeed;
                uniform float uDrift;
                uniform float uOpacity;
                uniform vec3 uColor;
                uniform vec2 uParticleSize;
                uniform float uElongate;

                vec3 weatherLocalPos;
                vec3 weatherWC;
                vec4 sd;

                float weatherHash(vec3 p) {
                    return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453);
                }

                vec3 getCenter() {
                    sd = loadData();

                    float dx = floor(sd.r * 255.0 + 0.5) - uGridHalf.x;
                    float dz = floor(sd.b * 255.0 + 0.5) - uGridHalf.z;
                    float dy = floor(sd.g * 255.0 + 0.5);

                    vec3 worldCell = uBaseCell + vec3(dx, dy - uGridHalf.y, dz);
                    weatherWC = worldCell;

                    vec3 col = vec3(worldCell.x, 0.0, worldCell.z);

                    float fx = weatherHash(col + vec3(1.0, 0.0, 0.0));
                    float fz = weatherHash(col + vec3(0.0, 0.0, 3.0));

                    fx += (weatherHash(worldCell + vec3(4.0, 0.0, 0.0)) - 0.5) * 0.4;
                    fz += (weatherHash(worldCell + vec3(0.0, 0.0, 5.0)) - 0.5) * 0.4;

                    float spd = mix(0.3, 0.8, weatherHash(col)) * uSpeed;

                    float gridYf = uGridHalf.y * 2.0;
                    float colY = (dy + weatherHash(worldCell + vec3(0.0, 2.0, 0.0))) / gridYf;
                    colY = fract(colY - uTime * spd / gridYf);

                    float phase = weatherHash(col + vec3(7.0, 0.0, 0.0)) * 6.28318;
                    fx += sin(uTime * 0.8 + phase) * uDrift;
                    fz += cos(uTime * 0.6 + phase) * uDrift;

                    weatherLocalPos = vec3(
                        (dx + fx) * uCellSize,
                        (-uGridHalf.y + colY * gridYf) * uCellSize,
                        (dz + fz) * uCellSize
                    );
                    return weatherLocalPos;
                }

                vec4 getColor() {
                    vec3 camOffset = uCameraPos - uBaseCell * uCellSize;
                    float dist = length(weatherLocalPos - camOffset);
                    float maxDist = min(uGridHalf.x, uGridHalf.z) * uCellSize * 0.9;
                    float fade = 1.0 - smoothstep(maxDist * 0.6, maxDist, dist);
                    float alpha = mix(0.5, 0.9, weatherHash(weatherWC + 20.0)) * fade * uOpacity;
                    return vec4(uColor, alpha);
                }

                vec3 getScale() {
                    float size = mix(uParticleSize.x, uParticleSize.y, weatherHash(weatherWC + 10.0));
                    return vec3(size, size * uElongate, size);
                }

                vec4 getRotation() { return vec4(0.0, 0.0, 0.0, 1.0); }
            `,
            readWGSL: /* wgsl */`
                uniform uTime: f32;
                uniform uCellSize: f32;
                uniform uGridHalf: vec3f;
                uniform uBaseCell: vec3f;
                uniform uCameraPos: vec3f;
                uniform uSpeed: f32;
                uniform uDrift: f32;
                uniform uOpacity: f32;
                uniform uColor: vec3f;
                uniform uParticleSize: vec2f;
                uniform uElongate: f32;

                var<private> weatherLocalPos: vec3f;
                var<private> weatherWC: vec3f;
                var<private> sd: vec4f;

                fn weatherHash(p: vec3f) -> f32 {
                    return fract(sin(dot(p, vec3f(127.1, 311.7, 74.7))) * 43758.5453);
                }

                fn getCenter() -> vec3f {
                    sd = loadData();

                    let dx = floor(sd.r * 255.0 + 0.5) - uniform.uGridHalf.x;
                    let dz = floor(sd.b * 255.0 + 0.5) - uniform.uGridHalf.z;
                    let dy = floor(sd.g * 255.0 + 0.5);

                    let worldCell = uniform.uBaseCell + vec3f(dx, dy - uniform.uGridHalf.y, dz);
                    weatherWC = worldCell;

                    let col = vec3f(worldCell.x, 0.0, worldCell.z);

                    var fx = weatherHash(col + vec3f(1.0, 0.0, 0.0));
                    var fz = weatherHash(col + vec3f(0.0, 0.0, 3.0));

                    fx = fx + (weatherHash(worldCell + vec3f(4.0, 0.0, 0.0)) - 0.5) * 0.4;
                    fz = fz + (weatherHash(worldCell + vec3f(0.0, 0.0, 5.0)) - 0.5) * 0.4;

                    let spd = mix(0.3, 0.8, weatherHash(col)) * uniform.uSpeed;

                    let gridYf = uniform.uGridHalf.y * 2.0;
                    var colY = (dy + weatherHash(worldCell + vec3f(0.0, 2.0, 0.0))) / gridYf;
                    colY = fract(colY - uniform.uTime * spd / gridYf);

                    let phase = weatherHash(col + vec3f(7.0, 0.0, 0.0)) * 6.28318;
                    fx = fx + sin(uniform.uTime * 0.8 + phase) * uniform.uDrift;
                    fz = fz + cos(uniform.uTime * 0.6 + phase) * uniform.uDrift;

                    weatherLocalPos = vec3f(
                        (dx + fx) * uniform.uCellSize,
                        (-uniform.uGridHalf.y + colY * gridYf) * uniform.uCellSize,
                        (dz + fz) * uniform.uCellSize
                    );
                    return weatherLocalPos;
                }

                fn getColor() -> vec4f {
                    let camOffset = uniform.uCameraPos - uniform.uBaseCell * uniform.uCellSize;
                    let dist = length(weatherLocalPos - camOffset);
                    let maxDist = min(uniform.uGridHalf.x, uniform.uGridHalf.z) * uniform.uCellSize * 0.9;
                    let fade = 1.0 - smoothstep(maxDist * 0.6, maxDist, dist);
                    let alpha = mix(0.5, 0.9, weatherHash(weatherWC + 20.0)) * fade * uniform.uOpacity;
                    return vec4f(uniform.uColor, alpha);
                }

                fn getScale() -> vec3f {
                    let size = mix(uniform.uParticleSize.x, uniform.uParticleSize.y, weatherHash(weatherWC + 10.0));
                    return vec3f(size, size * uniform.uElongate, size);
                }

                fn getRotation() -> vec4f { return vec4f(0.0, 0.0, 0.0, 1.0); }
            `
        });

        this._buildContainer();
    }

    /**
     * Rebuild the particle system. Call after changing grid configuration properties
     * (extents, density).
     */
    rebuild() {
        this._buildContainer();
    }

    /** @private */
    _buildContainer() {
        if (this._container) {
            this._container.destroy();
            this._container = null;
        }

        const device = this.app.graphicsDevice;
        const halfX = this._halfCells(this.extents.x);
        const halfY = this._halfCells(this.extents.y);
        const halfZ = this._halfCells(this.extents.z);
        const gridX = halfX * 2;
        const gridY = halfY * 2;
        const gridZ = halfZ * 2;
        const cs = this.cellSize;
        const maxSplats = gridX * gridY * gridZ;

        this._container = new GSplatContainer(device, maxSplats, this._format);

        const texData = this._container.getTexture('data').lock();
        const centers = this._container.centers;
        let idx = 0;
        for (let x = 0; x < gridX; x++) {
            for (let y = 0; y < gridY; y++) {
                for (let z = 0; z < gridZ; z++) {
                    texData[idx * 4 + 0] = x;
                    texData[idx * 4 + 1] = y;
                    texData[idx * 4 + 2] = z;
                    texData[idx * 4 + 3] = Math.random() * 255;

                    centers[idx * 3 + 0] = (x - halfX + 0.5) * cs;
                    centers[idx * 3 + 1] = (y - halfY + 0.5) * cs;
                    centers[idx * 3 + 2] = (z - halfZ + 0.5) * cs;
                    idx++;
                }
            }
        }
        this._container.getTexture('data').unlock();

        const halfExtX = halfX * cs;
        const halfExtY = halfY * cs;
        const halfExtZ = halfZ * cs;
        this._container.aabb = new BoundingBox(Vec3.ZERO, new Vec3(halfExtX, halfExtY, halfExtZ));
        this._container.update(maxSplats, true);

        if (!this.entity.gsplat) {
            this.entity.addComponent('gsplat', {
                resource: this._container,
                unified: true
            });
        } else {
            this.entity.gsplat.resource = this._container;
        }
    }

    update(dt) {
        if (!this._container || !this.entity.gsplat) return;

        this._time += dt;

        const cs = this.cellSize;
        let camX = 0, camY = 0, camZ = 0;

        if (this.followEntity) {
            const pos = this.followEntity.getPosition();
            camX = pos.x;
            camY = pos.y;
            camZ = pos.z;
        } else {
            const pos = this.entity.getPosition();
            camX = pos.x;
            camY = pos.y;
            camZ = pos.z;
        }

        const bcX = Math.floor(camX / cs);
        const bcY = Math.floor(camY / cs);
        const bcZ = Math.floor(camZ / cs);

        this.entity.setPosition(bcX * cs, bcY * cs, bcZ * cs);

        this._baseCellArray[0] = bcX;
        this._baseCellArray[1] = bcY;
        this._baseCellArray[2] = bcZ;

        this._camPosArray[0] = camX;
        this._camPosArray[1] = camY;
        this._camPosArray[2] = camZ;

        this._gridHalfArray[0] = this._halfCells(this.extents.x);
        this._gridHalfArray[1] = this._halfCells(this.extents.y);
        this._gridHalfArray[2] = this._halfCells(this.extents.z);

        this._particleSizeArray[0] = this.particleMinSize;
        this._particleSizeArray[1] = this.particleMaxSize;

        const gs = this.entity.gsplat;
        gs.setParameter('uTime', this._time);
        gs.setParameter('uCellSize', cs);
        gs.setParameter('uGridHalf', this._gridHalfArray);
        gs.setParameter('uBaseCell', this._baseCellArray);
        gs.setParameter('uCameraPos', this._camPosArray);
        gs.setParameter('uSpeed', this.speed);
        gs.setParameter('uDrift', this.drift);
        gs.setParameter('uOpacity', this.opacity);
        gs.setParameter('uColor', this.color);
        gs.setParameter('uParticleSize', this._particleSizeArray);
        gs.setParameter('uElongate', this.elongate);
    }

    destroy() {
        if (this._container) {
            this._container.destroy();
            this._container = null;
        }
    }
}

export { GsplatWeather };
