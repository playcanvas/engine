import {
    ADDRESS_CLAMP_TO_EDGE,
    BlendState,
    CameraFrameEffect,
    Compute,
    ComputePass,
    DepthState,
    FILTER_NEAREST,
    FRAMERESOURCE_DEPTH,
    FRAMERESOURCE_SCENETARGET,
    Mat4,
    PIXELFORMAT_RG32U,
    RenderPassShaderQuad,
    SEMANTIC_POSITION,
    SHADERLANGUAGE_WGSL,
    Shader,
    ShaderUtils,
    StorageBuffer,
    Texture,
    Vec3,
    math
} from 'playcanvas';

import wgslParticle from './particle.wgsl';
import wgslParticlePS from './particle-ps.wgsl';
import wgslParticleVS from './particle-vs.wgsl';
import wgslSimulate from './simulate.wgsl';
import wgslSpawn from './spawn.wgsl';
import wgslVoxels from './voxels.wgsl';

/**
 * @import { CameraFrameEffectContext, CameraFrameEffectPasses, CameraFrameEffectResources, GraphicsDevice, RenderTarget, VoxelOccupancy } from 'playcanvas'
 */

// the size of a particle in the storage buffer, in bytes, see particle.wgsl
const PARTICLE_SIZE = 48;

// the most emissions a frame, see emit
const MAX_EMISSIONS = 16;

// the shader includes, by the names the shaders include them with
const includes = new Map([
    ['sceneParticleCS', wgslParticle],
    ['sceneParticleVoxelsCS', wgslVoxels]
]);

/**
 * A render pass drawing the particles into the scene, one instance of the quad for each live
 * particle, read from the storage buffer of the particles. It renders into the scene render target
 * without clearing it, and depth tests the particles against the scene and each other.
 */
class SceneParticlesRenderPass extends RenderPassShaderQuad {
    /** @type {StorageBuffer|null} */
    particles = null;

    // the ring buffer slot of the first particle drawn, and the number of slots
    first = 0;

    capacity = 0;

    // the view projection matrix of the camera, and its position
    viewProjection = new Float32Array(16);

    cameraPosition = new Float32Array(3);

    // the parameters of the look, see SceneParticlesEffect
    streak = 0;

    glow = 0;

    fire = 0;

    temperature = 1;

    cooling = 1;

    /**
     * @param {GraphicsDevice} device - The graphics device.
     * @param {number} colorBufferCount - The number of color buffers of the scene render target.
     */
    constructor(device, colorBufferCount) {
        super(device);

        this.shader = ShaderUtils.createShader(device, {
            uniqueName: 'SceneParticles',
            attributes: { aPosition: SEMANTIC_POSITION },
            vertexWGSL: wgslParticleVS,
            fragmentWGSL: wgslParticlePS,
            vertexIncludes: includes,
            fragmentIncludes: includes
        });

        this.depthState = DepthState.DEFAULT;

        // the scene can render more color buffers than its color, such as its depth for the
        // post-processing, which the particles leave alone
        const blendState = new BlendState();
        if (colorBufferCount > 1) {
            const noWrite = new BlendState();
            noWrite.setColorWrite(false, false, false, false);
            for (let i = 1; i < colorBufferCount; i++) {
                blendState.setAttachment(i, noWrite);
            }
        }
        this.blendState = blendState;

        const scope = device.scope;
        this.particlesId = scope.resolve('sceneParticles');
        this.viewProjectionId = scope.resolve('sceneParticleViewProjection');
        this.cameraPositionId = scope.resolve('sceneParticleCameraPosition');
        this.firstId = scope.resolve('sceneParticleFirst');
        this.capacityId = scope.resolve('sceneParticleCapacity');
        this.streakId = scope.resolve('sceneParticleStreak');
        this.glowId = scope.resolve('sceneParticleGlow');
        this.fireId = scope.resolve('sceneParticleFire');
        this.temperatureId = scope.resolve('sceneParticleTemperature');
        this.coolingId = scope.resolve('sceneParticleCooling');
    }

    execute() {
        if (!this.particles) {
            return;
        }

        this.particlesId.setValue(this.particles);
        this.viewProjectionId.setValue(this.viewProjection);
        this.cameraPositionId.setValue(this.cameraPosition);
        this.firstId.setValue(this.first);
        this.capacityId.setValue(this.capacity);
        this.streakId.setValue(this.streak);
        this.glowId.setValue(this.glow);
        this.fireId.setValue(this.fire);
        this.temperatureId.setValue(this.temperature);
        this.coolingId.setValue(this.cooling);

        // an instance of the quad for each live particle, see numInstances
        super.execute();
    }
}

/**
 * An effect of the {@link CameraFrame} turning the rendered scene into particles. Each call of
 * {@link SceneParticlesEffect#emit} spawns particles from the pixels of a circle of the view: each
 * particle takes the color of its pixel, and starts at the position the scene depth reconstructs
 * for it, leaving the surface along its normal. The particles then fly, fall, are carried by the
 * wind, swirl in a turbulent flow, bounce off the solid voxels of a {@link VoxelOccupancy}, and
 * come to rest on the surfaces facing against the gravity, until their lifetime ends. They can
 * also glow with the colors of fire instead of those of the scene, for sparks, embers or lava.
 *
 * The particles are spawned, simulated and drawn by compute shaders, so the effect requires
 * WebGPU.
 *
 * The particles spawn from the scene the frame rendered, after the scene renders and before it is
 * resolved, and are drawn into it, so the effects after it, such as the bloom, apply to them too.
 * They are hidden behind the scene by its depth. The gaussian splats only write the scene depth
 * when `app.scene.gsplat.sceneDepthWrite` is enabled.
 *
 * The particles are kept in a ring buffer of {@link SceneParticlesEffect#capacity} particles, a
 * new particle replacing the oldest, so a high rate of emission with a long lifetime shortens the
 * life of the particles. Changes to the parameters take effect at the next
 * {@link CameraFrame#update}.
 *
 * @example
 * app.scene.gsplat.sceneDepthWrite = true;
 *
 * const particles = new SceneParticlesEffect(app.graphicsDevice);
 * particles.voxels = new VoxelOccupancy(voxelJsonAsset.resource, voxelBinaryAsset.resource);
 * particles.wind.set(3, 0.5, 0);
 * cameraFrame.addEffect(particles);
 * cameraFrame.update();
 *
 * // each frame, a stream of particles from a circle at the center of the view
 * app.on('update', (dt) => {
 *     particles.emit(0.5, 0.5, 0.1, Math.round(100000 * dt));
 * });
 */
class SceneParticlesEffect extends CameraFrameEffect {
    /**
     * The lifetime of the particles, in seconds. Each particle lives between half of it and all of
     * it.
     */
    lifetime = 12;

    /**
     * The speed the particles leave the surface at, in world units per second.
     */
    speed = 3.5;

    /**
     * How much the particles spread out from the center of their emission, sideways along the
     * surface, and scatter. 0 sends them off along the normal of the surface.
     */
    spread = 1.2;

    /**
     * The size of the particles, relative to the pixel they spawn from: at 1 a particle covers
     * about its pixel.
     */
    size = 1.6;

    /**
     * The acceleration of gravity, in world units per second squared. The particles come to rest
     * on the surfaces facing against it.
     */
    gravity = new Vec3(0, -9.8, 0);

    /**
     * The velocity of the wind, in world units per second, which the air drag pulls the particles
     * toward.
     */
    wind = new Vec3();

    /**
     * The air drag, the rate per second the velocity of the particles approaches that of the wind.
     */
    drag = 0.3;

    /**
     * The strength of the turbulent flow the particles swirl in.
     */
    turbulence = 1.5;

    /**
     * The part of the speed into a voxel the particles keep when bouncing off it, from 0 to 1.
     */
    bounce = 0.45;

    /**
     * The part of the speed along a voxel the particles lose when bouncing off it, from 0 to 1.
     */
    friction = 0.15;

    /**
     * The position of the attractor, which pulls the particles into orbits around it, in place of
     * the gravity, while its {@link SceneParticlesEffect#attractorStrength} is above 0.
     */
    attractorPosition = new Vec3();

    /**
     * The strength of the attractor, 0 for none.
     */
    attractorStrength = 0;

    /**
     * The axis the particles orbit the attractor around, each tilted a little.
     */
    attractorAxis = new Vec3(0, 1, 0);

    /**
     * The solid voxels the particles collide with, or null for none. Without voxels the particles
     * pass through the scene, until their lifetime ends.
     *
     * @type {VoxelOccupancy|null}
     */
    voxels = null;

    /**
     * The glow of the particles as they leave the surface, and when they hit one.
     */
    glow = 0.3;

    /**
     * How long the particles stretch along their motion, in seconds of it.
     */
    streak = 0.006;

    /**
     * How much the particles take the colors of fire instead of the colors of the scene, from 0 to
     * 1.
     */
    fire = 0;

    /**
     * How hot the particles start in the colors of fire, from 0 for cold to 1 for white hot.
     */
    temperature = 1;

    /**
     * The rate per second the particles cool down in the colors of fire.
     */
    cooling = 1;

    /** @type {ComputePass|null} */
    _computePass = null;

    /** @type {SceneParticlesRenderPass|null} */
    _renderPass = null;

    /** @type {RenderTarget|null} */
    _sceneTarget = null;

    // the emissions requested since the last frame: x, y, radius and count of each
    _pending = new Float32Array(MAX_EMISSIONS * 4);

    _pendingCount = 0;

    _warnedEmissions = false;

    // the emissions of the frame, in the layout of the spawn shader
    _emissions = new Float32Array(MAX_EMISSIONS * 4);

    /**
     * The particles spawned in each frame, and when the longest living of them dies. The particles
     * which can still be alive are those spawned within the lifetime of the longest living of
     * them, a contiguous range of the ring buffer ending at its head, which is all that is
     * simulated and drawn.
     *
     * @type {{ expiry: number, count: number }[]}
     */
    _spawned = [];

    _head = 0;

    _liveCount = 0;

    _time = 0;

    _frame = 0;

    /** @type {Compute[]} */
    _computes = [];

    _viewProjection = new Mat4();

    /**
     * @param {GraphicsDevice} device - The graphics device.
     * @param {object} [options] - The options.
     * @param {number} [options.capacity] - The number of particles the effect keeps, 48 bytes of
     * GPU memory each. Defaults to 1048576.
     */
    constructor(device, options = {}) {
        // the scene depth, and the render target the scene renders to, for its color
        super(device, 'sceneParticles', { requires: [FRAMERESOURCE_DEPTH, FRAMERESOURCE_SCENETARGET] });

        this._capacity = options.capacity ?? 1024 * 1024;

        // a new buffer is zeroed, which is a dead particle
        this._particles = new StorageBuffer(device, this._capacity * PARTICLE_SIZE);

        /**
         * @param {string} name - The name of the compute.
         * @param {string} source - The WGSL source of the compute shader.
         * @returns {Compute} The compute.
         */
        const createCompute = (name, source) => {
            const shader = new Shader(device, {
                name,
                shaderLanguage: SHADERLANGUAGE_WGSL,
                cshader: source,
                cincludes: includes
            });
            const compute = new Compute(device, shader, name);
            compute.setParameter('particles', this._particles);
            compute.setParameter('particleCount', this._capacity);
            return compute;
        };
        this._spawn = createCompute('SceneParticlesSpawn', wgslSpawn);
        this._simulate = createCompute('SceneParticlesSimulate', wgslSimulate);

        // the volume texture of the voxels when there are none, an empty block
        this._noVoxels = new Texture(device, {
            name: 'SceneParticlesNoVoxels',
            width: 1,
            height: 1,
            depth: 1,
            volume: true,
            format: PIXELFORMAT_RG32U,
            mipmaps: false,
            minFilter: FILTER_NEAREST,
            magFilter: FILTER_NEAREST,
            addressU: ADDRESS_CLAMP_TO_EDGE,
            addressV: ADDRESS_CLAMP_TO_EDGE,
            addressW: ADDRESS_CLAMP_TO_EDGE,
            levels: [new Uint32Array(2)]
        });
    }

    destroy() {
        super.destroy();

        this._spawn.shader.destroy();
        this._spawn.destroy();
        this._simulate.shader.destroy();
        this._simulate.destroy();
        this._particles.destroy();
        this._noVoxels.destroy();
    }

    /**
     * The number of particles the effect keeps, see the options of the constructor.
     *
     * @type {number}
     */
    get capacity() {
        return this._capacity;
    }

    /**
     * The number of particles which can still be alive, those spawned within the lifetime of the
     * longest living of them.
     *
     * @type {number}
     */
    get count() {
        return Math.min(this._liveCount, this._capacity);
    }

    /**
     * Spawns particles from a circle of the view, from the scene of the next frame the camera
     * frame renders. The particles spawn from random pixels of the circle with something rendered
     * to them, and not from the pixels outside of the view, so a circle covering the view spawns
     * them from all of it. Up to 16 emissions can be made for a frame. While the effect is not
     * active, the emissions are ignored.
     *
     * @param {number} x - The horizontal position of the center of the circle, from 0 at the left
     * of the view to 1 at its right.
     * @param {number} y - The vertical position of the center of the circle, from 0 at the top of
     * the view to 1 at its bottom.
     * @param {number} radius - The radius of the circle, relative to the height of the view.
     * @param {number} count - The number of particles to spawn.
     * @example
     * // a burst of 100000 particles from under the mouse
     * particles.emit(mouse.x / canvas.clientWidth, mouse.y / canvas.clientHeight, 0.05, 100000);
     *
     * // particles from the whole view
     * particles.emit(0.5, 0.5, 2, 5000);
     */
    emit(x, y, radius, count) {
        if (count < 1 || !this.active) {
            return;
        }
        if (this._pendingCount >= MAX_EMISSIONS) {
            if (!this._warnedEmissions) {
                this._warnedEmissions = true;
                console.warn(
                    `SceneParticlesEffect#emit: more than ${MAX_EMISSIONS} emissions for a frame, the rest are ignored.`
                );
            }
            return;
        }
        const i = this._pendingCount++ * 4;
        this._pending[i] = x;
        this._pending[i + 1] = y;
        this._pending[i + 2] = radius;
        this._pending[i + 3] = Math.floor(count);
    }

    /**
     * Removes all particles.
     */
    clear() {
        this._spawned.length = 0;
        this._liveCount = 0;
        this._pendingCount = 0;
    }

    /**
     * @param {CameraFrameEffectResources} resources - The frame resources.
     * @param {CameraFrameEffectPasses} passes - The passes of the frame.
     */
    createPasses(resources, passes) {
        const sceneTarget = /** @type {RenderTarget} */ (resources.sceneTarget);
        this._sceneTarget = sceneTarget;

        const camera = this.cameraFrame.cameraComponent;
        this._spawn.setSceneDepthMap(camera.sceneDepthMapHandle);
        this._simulate.setSceneDepthMap(camera.sceneDepthMapHandle);

        this._computePass = new ComputePass(this.device);
        this._computePass.name = 'SceneParticlesCompute';
        passes.postScene.push(this._computePass);

        // the particles render over the scene, without clearing it
        this._renderPass = new SceneParticlesRenderPass(this.device, sceneTarget.colorBufferCount);
        this._renderPass.name = 'SceneParticlesRender';
        this._renderPass.init(sceneTarget);
        this._renderPass.particles = this._particles;
        this._renderPass.capacity = this._capacity;
        passes.postScene.push(this._renderPass);
    }

    destroyPasses() {
        this._computePass?.destroy();
        this._computePass = null;
        this._renderPass?.destroy();
        this._renderPass = null;
        this._sceneTarget = null;
    }

    update() {
        const spawn = this._spawn;
        const simulate = this._simulate;

        spawn.setParameter('speed', this.speed);
        spawn.setParameter('spread', this.spread);
        spawn.setParameter('lifetime', this.lifetime);
        spawn.setParameter('size', this.size);

        const { gravity, wind, attractorPosition, attractorAxis } = this;
        simulate.setParameter('gravity', [gravity.x, gravity.y, gravity.z]);
        simulate.setParameter('wind', [wind.x, wind.y, wind.z]);
        simulate.setParameter('drag', this.drag);
        simulate.setParameter('turbulence', this.turbulence);
        simulate.setParameter('bounce', this.bounce);
        simulate.setParameter('friction', this.friction);
        simulate.setParameter('attractor', [
            attractorPosition.x,
            attractorPosition.y,
            attractorPosition.z,
            this.attractorStrength
        ]);
        simulate.setParameter('attractorAxis', [attractorAxis.x, attractorAxis.y, attractorAxis.z]);

        // without voxels the grid is empty, of a placeholder voxel size keeping the offsets small
        const voxels = this.voxels;
        const min = voxels?.bounds.getMin();
        const texture = voxels ? voxels.getTexture(this.device) : this._noVoxels;
        const gridMin = voxels ? [min.x, min.y, min.z] : [0, 0, 0];
        const gridSize = voxels ? [voxels.gridSize.x, voxels.gridSize.y, voxels.gridSize.z] : [0, 0, 0];
        const voxelSize = voxels ? voxels.voxelSize : 0.05;
        for (const compute of [spawn, simulate]) {
            compute.setParameter('voxels', texture);
            compute.setParameter('voxelGridMin', gridMin);
            compute.setParameter('voxelGridSize', gridSize);
            compute.setParameter('voxelSize', voxelSize);
        }

        const pass = this._renderPass;
        if (pass) {
            pass.streak = this.streak;
            pass.glow = this.glow;
            pass.fire = this.fire;
            pass.temperature = this.temperature;
            pass.cooling = this.cooling;
        }
    }

    /**
     * @param {CameraFrameEffectContext} frame - The values of the frame.
     */
    frameUpdate(frame) {
        const spawn = this._spawn;
        const simulate = this._simulate;
        const capacity = this._capacity;
        const camera = this.cameraFrame.cameraComponent;
        const cameraPosition = camera.entity.getPosition();

        this._time += frame.dt;
        this._frame++;
        const time = this._time;
        const computes = this._computes;
        computes.length = 0;

        // the emissions of the frame, in texels of the scene, each ending at its total of particles
        const pending = this._pending;
        const emissions = this._emissions;
        let spawnCount = 0;
        let emissionCount = 0;
        for (let i = 0; i < this._pendingCount * 4; i += 4) {
            const count = Math.min(pending[i + 3], capacity / 4 - spawnCount);
            if (count <= 0) {
                break;
            }
            spawnCount += count;
            emissions[emissionCount * 4] = pending[i] * frame.renderWidth;
            emissions[emissionCount * 4 + 1] = pending[i + 1] * frame.renderHeight;
            emissions[emissionCount * 4 + 2] = pending[i + 2] * frame.renderHeight;
            emissions[emissionCount * 4 + 3] = spawnCount;
            emissionCount++;
        }
        this._pendingCount = 0;

        if (spawnCount > 0 && this._sceneTarget) {
            spawn.setParameter('sceneColor', this._sceneTarget.colorBuffer);
            spawn.setParameter('spawnStart', this._head);
            spawn.setParameter('frameSeed', this._frame);
            spawn.setParameter('emissions[0]', emissions);
            spawn.setParameter('emissionCount', emissionCount);
            spawn.setParameter('cameraPosition', [cameraPosition.x, cameraPosition.y, cameraPosition.z]);
            spawn.setParameter('texelSize', (2 * Math.tan(camera.fov * 0.5 * math.DEG_TO_RAD)) / frame.renderHeight);
            spawn.setupDispatchThreads(spawnCount);
            computes.push(spawn);

            this._spawned.push({ expiry: time + this.lifetime, count: spawnCount });
            this._liveCount += spawnCount;
            this._head = (this._head + spawnCount) % capacity;
        }

        // the range of the particles which can still be alive, including those just spawned
        const spawned = this._spawned;
        while (spawned.length && spawned[0].expiry < time) {
            this._liveCount -= /** @type {{ count: number }} */ (spawned.shift()).count;
        }
        const count = this.count;
        const first = (this._head - count + capacity) % capacity;

        // the particles hidden behind the scene are found by projecting them to the scene depth
        const viewProjection = this._viewProjection.mul2(camera.projectionMatrix, camera.viewMatrix);

        if (count > 0) {
            simulate.setParameter('firstParticle', first);
            simulate.setParameter('dt', Math.min(frame.dt, 1 / 30));
            simulate.setParameter('time', time);
            simulate.setParameter('viewProjection', viewProjection.data);
            simulate.setupDispatchThreads(count);
            computes.push(simulate);
        }

        if (this._computePass) {
            this._computePass.computes = computes;
        }

        // the particles render after the compute pass, so they are drawn as simulated this frame
        const pass = this._renderPass;
        if (pass) {
            pass.first = first;
            pass.numInstances = count;
            pass.viewProjection.set(viewProjection.data);
            pass.cameraPosition[0] = cameraPosition.x;
            pass.cameraPosition[1] = cameraPosition.y;
            pass.cameraPosition[2] = cameraPosition.z;
        }
    }
}

export { SceneParticlesEffect };
