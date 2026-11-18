import { Debug } from '../../core/debug.js';
import { Color } from '../../core/math/color.js';
import { Quat } from '../../core/math/quat.js';
import { Vec3 } from '../../core/math/vec3.js';
import { Vec4 } from '../../core/math/vec4.js';
import { BoundingBox } from '../../core/shape/bounding-box.js';
import { Entity } from '../../framework/entity.js';
import {
    ADDRESS_CLAMP_TO_EDGE, CULLFACE_NONE, FILTER_LINEAR, FILTER_NEAREST, PIXELFORMAT_RGBA16F,
    PIXELFORMAT_RGBA32F, PIXELFORMAT_RGBA8, PRIMITIVE_TRIANGLES, RENDERTARGET_ORIGIN_BOTTOM,
    RENDERTARGET_ORIGIN_TOP, SEMANTIC_POSITION, SHADERLANGUAGE_GLSL, SHADERLANGUAGE_WGSL
} from '../../platform/graphics/constants.js';
import { RenderTarget } from '../../platform/graphics/render-target.js';
import { Texture } from '../../platform/graphics/texture.js';
import {
    ASPECT_MANUAL, BLEND_NONE, EVENT_PRERENDER, GAMMA_NONE, LAYERID_SKYBOX, LAYERID_WORLD,
    LIGHTTYPE_DIRECTIONAL, PROJECTION_ORTHOGRAPHIC, TONEMAP_NONE
} from '../../scene/constants.js';
import { GraphNode } from '../../scene/graph-node.js';
import { drawQuadWithShader } from '../../scene/graphics/quad-render-utils.js';
import { Layer } from '../../scene/layer.js';
import { LitMaterial } from '../../scene/materials/lit-material.js';
import { Mesh } from '../../scene/mesh.js';
import { MeshInstance } from '../../scene/mesh-instance.js';
import { ShaderChunks } from '../../scene/shader-lib/shader-chunks.js';
import { ShaderUtils } from '../../scene/shader-lib/shader-utils.js';
import {
    projectShaderGLSL, projectShaderWGSL, gbufferOutputGLSL, gbufferOutputWGSL,
    lightingFrontendGLSL, lightingFrontendWGSL, lightingTransformGLSL, lightingTransformWGSL
} from './probe-volume-bake-shaders.js';
import { PROBESOURCE_GBUFFER } from './constants.js';
import { halfToFloat } from './probe-volume.js';

/**
 * @import { AppBase } from '../../framework/app-base.js'
 * @import { CameraComponent } from '../../framework/components/camera/component.js'
 * @import { GraphicsDevice } from '../../platform/graphics/graphics-device.js'
 * @import { Light } from '../../scene/light.js'
 * @import { Material } from '../../scene/materials/material.js'
 * @import { Shader } from '../../platform/graphics/shader.js'
 * @import { ProbeVolume } from './probe-volume.js'
 */

/**
 * @typedef {object} CaptureRig
 * @property {Entity} entity - The entity holding the six face cameras, at the capture position.
 * @property {CameraComponent[]} cameras - The cameras of the six faces.
 * @ignore
 */

/**
 * @typedef {object} ProbeVolumeGeometryResult
 * @property {number} probeCount - The number of probes.
 * @property {number} invalidProbes - The number of invalid probes, inside geometry.
 * @property {number} movedProbes - The number of probes captured at an offset position, which
 * made them valid.
 * @ignore
 */

// the rotations of the cameras capturing the six faces of a probe, see cubemapFaceDirection of the
// bake shaders for the directions they see along
const faceRotations = [
    new Quat().setFromEulerAngles(0, 90, 0),
    new Quat().setFromEulerAngles(0, -90, 0),
    new Quat().setFromEulerAngles(-90, 0, 180),
    new Quat().setFromEulerAngles(90, 0, 180),
    new Quat().setFromEulerAngles(0, 180, 0),
    new Quat().setFromEulerAngles(0, 0, 0)
];

// the floats stored for each probe, see ProbeVolume#data
const FLOATS_PER_PROBE = 12;

// the maximum width of the render target receiving the octahedral maps of the probes
const VISIBILITY_TARGET_WIDTH = 2048;

// the width of the texture of the positions of the probes
const POSITIONS_WIDTH = 1024;

// the shader passes of the lit materials writing the geometry the probes see, with and without the
// emission
const GEOMETRY_PASS = 'probe_gbuffer';
const GEOMETRY_EMISSIVE_PASS = 'probe_gbuffer_emissive';

// the shader pass of the quad lighting the geometry
const LIGHTING_PASS = 'probe_lighting';

const radianceClearColor = new Color(0, 0, 0, 1);
const geometryClearColor = new Color(0, 0, 0, 0);

const _position = new Vec3();
const _cellSize = new Vec3();
const _rect = new Vec4();

/**
 * Bakes the light probes of a {@link ProbeVolume} in two steps.
 *
 * {@link ProbeVolumeBaker#captureGeometry} captures, for each probe, the geometry it sees: the
 * scene is rendered from the probe into the six square faces of its tile of an atlas, with the lit
 * materials writing their albedo, normal, distance and emission instead of a color. The geometry
 * gives the validity of the probes, their virtual offsets and their visibility, and is kept for
 * the lighting.
 *
 * {@link ProbeVolumeBaker#bakeLighting} computes the lighting of the probes, from one of two
 * sources:
 *
 * - {@link PROBESOURCE_GBUFFER}: the captured geometry, lit by the lighting of the engine without
 * rendering the scene. A quad covering the atlas is drawn with a lit material, which lights each
 * texel as the surface the probe saw through it. This takes a frame for each bounce, so the
 * lighting can be baked again quickly after it changed, such as after the sun moved.
 * - {@link PROBESOURCE_SCENE}: the scene rendered lit from each probe, a few probes each frame.
 *
 * Each bounce lights the scene with the probes of the previous one. The radiance of the faces is
 * then projected onto the spherical harmonics of the probes.
 *
 * The geometry stays in memory until the baker is destroyed, for the lighting to be baked again.
 *
 * Baking needs a device which renders to half float or float textures, see
 * {@link ProbeVolumeBaker.isSupported}: all WebGPU devices, and the WebGL2 devices with the float
 * color buffer extensions. Probes baked ahead of time load on any device.
 *
 * @example
 * const baker = new ProbeVolumeBaker(app, volume, { layers: [worldLayer.id, LAYERID_SKYBOX] });
 * await baker.captureGeometry();
 * await baker.bakeLighting({ bounces: 2 });
 *
 * // after the sun moved, bake the lighting again from the captured geometry
 * await baker.bakeLighting({ bounces: 2 });
 * baker.destroy();
 * @category Graphics
 */
class ProbeVolumeBaker {
    /**
     * The application.
     *
     * @type {AppBase}
     */
    app;

    /**
     * The number of probes captured each frame. It can be changed at any time, including during a
     * capture.
     *
     * @type {number}
     */
    probesPerFrame;

    /**
     * @type {ProbeVolume}
     * @private
     */
    _volume;

    /** @private */
    _faceSize;

    /**
     * @type {number[]}
     * @private
     */
    _layers;

    /** @private */
    _emissive;

    /** @private */
    _baking = false;

    /**
     * The formats of the textures a bake renders to, see {@link ProbeVolumeBaker._getFormats}.
     *
     * @type {{ cubemapFormat: number, targetFormat: number }|null}
     * @private
     */
    _formats = null;

    /** @private */
    _nearClip = 0.05;

    /** @private */
    _farClip = 1000;

    /**
     * The layout of the atlases: the size of a face, the probes in a row, the size of the atlas.
     *
     * @type {{ faceSize: number, probesPerRow: number, width: number, height: number }|null}
     * @private
     */
    _atlas = null;

    /**
     * Whether the rows of the atlas textures are stored in the opposite order to the rows of the
     * viewports rendering them.
     *
     * @type {boolean}
     * @private
     */
    _atlasFlipY = false;

    /**
     * The render target of the geometry the probes see.
     *
     * @type {RenderTarget|null}
     * @private
     */
    _geometryTarget = null;

    /**
     * The render target of the radiance the probes see.
     *
     * @type {RenderTarget|null}
     * @private
     */
    _radianceTarget = null;

    /**
     * The cubemap of the sky, seen through the texels without geometry.
     *
     * @type {Texture|null}
     * @private
     */
    _skyCubemap = null;

    /**
     * The positions the probes are captured at, with their virtual offsets.
     *
     * @type {Float32Array|null}
     * @private
     */
    _positions = null;

    /**
     * The texture of the positions of the probes, for the lighting of the geometry.
     *
     * @type {Texture|null}
     * @private
     */
    _positionsTexture = null;

    /**
     * The validity of the probes.
     *
     * @type {Uint8Array|null}
     * @private
     */
    _probeValid = null;

    /**
     * The rigs of cameras capturing the probes.
     *
     * @type {CaptureRig[]}
     * @private
     */
    _rigs = [];

    /**
     * Create a new ProbeVolumeBaker instance.
     *
     * @param {AppBase} app - The application, whose scene is baked.
     * @param {ProbeVolume} [volume] - The probe volume.
     * @param {object} [options] - The options.
     * @param {number} [options.faceSize] - The number of texels along a side of a face of a probe.
     * Defaults to 8.
     * @param {number[]} [options.layers] - The ids of the layers the probes capture. Defaults to the
     * world and skybox layers.
     * @param {boolean} [options.emissive] - Whether the geometry includes the emission of the
     * surfaces. Defaults to false.
     * @param {number} [options.probesPerFrame] - The number of probes captured each frame. Defaults
     * to 32.
     * @param {number} [options.nearClip] - The near clip distance of the capture cameras. Defaults
     * to 0.05.
     * @param {number} [options.farClip] - The far clip distance of the capture cameras. Defaults to
     * 1000.
     */
    constructor(app, volume, options = {}) {
        this.app = app;
        this._volume = volume;
        this._faceSize = options.faceSize ?? 8;
        this._layers = (options.layers ?? [LAYERID_WORLD, LAYERID_SKYBOX]).slice();
        this._emissive = options.emissive ?? false;
        this.probesPerFrame = options.probesPerFrame ?? 32;
        this._nearClip = options.nearClip ?? 0.05;
        this._farClip = options.farClip ?? 1000;
    }

    /**
     * Returns whether a graphics device can bake probes. Baking renders the scene to half float or
     * float textures. WebGPU devices always support them. WebGL2 devices need the float color
     * buffer extensions (EXT_color_buffer_float or EXT_color_buffer_half_float), which some older
     * or low-end mobile devices do not support. On those devices, the probes can still be baked
     * ahead of time and loaded with {@link ProbeVolume.deserialize}; only baking is not supported.
     * The null graphics device, which renders nothing, cannot bake either.
     *
     * @param {GraphicsDevice} device - The graphics device.
     * @returns {boolean} True if the device can bake probes.
     */
    static isSupported(device) {
        return !device.isNull && ProbeVolumeBaker._getFormats(device) !== null;
    }

    /**
     * Returns the formats of the textures a bake renders to: half floats preferred for the
     * radiance and the geometry, and full floats preferred for the precision of the render
     * targets receiving the projections.
     *
     * @param {GraphicsDevice} device - The graphics device.
     * @returns {{ cubemapFormat: number, targetFormat: number }|null} The formats, or null if the
     * device cannot bake probes.
     * @private
     */
    static _getFormats(device) {
        const cubemapFormat = device.getRenderableHdrFormat([PIXELFORMAT_RGBA16F, PIXELFORMAT_RGBA32F], true, 1, true);
        const targetFormat = device.getRenderableHdrFormat([PIXELFORMAT_RGBA32F, PIXELFORMAT_RGBA16F], false);
        return cubemapFormat !== undefined && targetFormat !== undefined ? { cubemapFormat, targetFormat } : null;
    }

    /**
     * The probe volume the baker bakes.
     *
     * @type {ProbeVolume}
     */
    get volume() {
        return this._volume;
    }

    /**
     * The number of texels along a side of a face of a probe, see the constructor.
     *
     * @type {number}
     */
    get faceSize() {
        return this._faceSize;
    }

    /**
     * The ids of the layers the probes capture, see the constructor. Do not modify it.
     *
     * @type {number[]}
     */
    get layers() {
        return this._layers;
    }

    /**
     * Whether the geometry includes the emission of the surfaces, see the constructor.
     *
     * @type {boolean}
     */
    get emissive() {
        return this._emissive;
    }

    /**
     * Whether a capture or a bake is in progress.
     *
     * @type {boolean}
     */
    get baking() {
        return this._baking;
    }

    /**
     * Whether the geometry of the probes has been captured.
     *
     * @type {boolean}
     */
    get hasGeometry() {
        return this._geometryTarget !== null && this._positions !== null;
    }

    /**
     * Destroys the resources of the baker: the geometry, the atlases and the cameras.
     */
    destroy() {
        this._destroyGeometry();
        this._rigs.forEach(rig => rig.entity.destroy());
        this._rigs.length = 0;
    }

    /**
     * Captures the geometry each probe sees, and sets the validity, the virtual offsets and the
     * visibility of the volume. The capture takes a number of frames.
     *
     * @param {object} [options] - The options.
     * @param {boolean} [options.validity] - Whether to find the invalid probes, which see more back
     * faces than the validity threshold. Defaults to true.
     * @param {number} [options.validityThreshold] - The fraction of the sphere around a probe
     * covered by back faces above which the probe is invalid. Defaults to 0.25.
     * @param {boolean} [options.virtualOffset] - Whether to capture the invalid probes at a position
     * moved out of the geometry, through the closest back face, by up to 0.45 of a cell. The probes
     * are still interpolated at their positions in the grid, but the leak reduction and the
     * visibility use the positions they were captured at. Defaults to true.
     * @param {boolean} [options.visibility] - Whether to compute the visibility of the probes.
     * Defaults to true.
     * @param {number} [options.visibilitySize] - The number of texels along a side of the
     * octahedral map of the visibility of each probe. Defaults to 16.
     * @param {Function} [options.onProgress] - Called with the progress, from 0 to 1.
     * @returns {Promise<ProbeVolumeGeometryResult>} The result of the capture.
     */
    async captureGeometry(options = {}) {
        this._begin();
        try {
            return await this._captureGeometry(options);
        } finally {
            this._baking = false;
        }
    }

    /**
     * Bakes the lighting of the probes, and sets the data of the volume. Captures the geometry
     * first, if it was not captured yet.
     *
     * @param {object} [options] - The options.
     * @param {string} [options.source] - The source of the lighting: {@link PROBESOURCE_GBUFFER}
     * to light the captured geometry, or {@link PROBESOURCE_SCENE} to render the scene lit from
     * each probe. Defaults to {@link PROBESOURCE_GBUFFER}.
     * @param {number} [options.bounces] - The number of indirect bounces after the direct lighting.
     * Defaults to 1.
     * @param {boolean} [options.dilation] - Whether to fill the invalid probes from their valid
     * neighbors. Defaults to true.
     * @param {BoundingBox|null} [options.shadowBounds] - The shadow bounds of the directional
     * lights while baking, see {@link LightComponent#shadowBounds}. Defaults to the box of the
     * volume, expanded by its blend distance.
     * @param {number} [options.index] - The index of the lighting of the volume to set, up to
     * {@link ProbeVolume#lightingCount}, which adds a lighting, see {@link ProbeVolume#setData}.
     * Defaults to 0.
     * @param {Function} [options.onProgress] - Called with the progress, from 0 to 1.
     * @returns {Promise<{ dilatedProbes: number }>} The result of the bake.
     */
    async bakeLighting(options = {}) {
        if (!this.hasGeometry) {
            await this.captureGeometry();
        }
        this._begin();
        const volume = this.volume;
        volume.setBakeData(new Float32Array(volume.probeCount * FLOATS_PER_PROBE));
        try {
            return await this._bakeLighting(options);
        } finally {
            volume.setBakeData(null);
            this._baking = false;
        }
    }

    /**
     * Checks the device can bake, and starts a capture or a bake.
     *
     * @private
     */
    _begin() {
        Debug.assert(!this._baking, 'ProbeVolumeBaker: a capture or bake is already in progress.');
        const formats = ProbeVolumeBaker._getFormats(this.app.graphicsDevice);
        if (!formats) {
            throw new Error('ProbeVolumeBaker: the device cannot bake probes, as it does not render to float textures, see ProbeVolumeBaker.isSupported.');
        }
        this._formats = formats;
        this._baking = true;
    }

    /**
     * Captures the geometry, see {@link captureGeometry}.
     *
     * @param {object} options - The options, see {@link captureGeometry}.
     * @returns {Promise<ProbeVolumeGeometryResult>} The result.
     * @private
     */
    async _captureGeometry(options) {
        const volume = this.volume;
        const probeCount = volume.probeCount;
        const validity = options.validity ?? true;
        const virtualOffset = validity && (options.virtualOffset ?? true);
        const threshold = options.validityThreshold ?? 0.25;
        const visibility = options.visibility ?? true;
        const visibilitySize = options.visibilitySize ?? 16;
        const onProgress = options.onProgress ?? (() => {});

        this._destroyGeometry();
        this._createAtlases();
        this._createRigs();
        this._registerGeometryChunks();

        // the positions the probes are captured at
        const positions = new Float32Array(probeCount * 3);
        for (let i = 0; i < probeCount; i++) {
            volume.getProbePosition(i, _position);
            positions.set([_position.x, _position.y, _position.z], i * 3);
        }

        const result = { probeCount, invalidProbes: 0, movedProbes: 0 };
        const probeValid = new Uint8Array(probeCount).fill(1);
        const allProbes = Array.from({ length: probeCount }, (value, i) => i);

        // the materials render their back faces, which make probes invalid, and the transparent ones
        // don't render, as the geometry can't be blended
        const passName = this._emissive ? GEOMETRY_EMISSIVE_PASS : GEOMETRY_PASS;
        const restore = this._prepareGeometryMaterials(passName);
        try {
            const capture = (probes, capturePositions, progressStart, progressEnd) => this._captureTiles(this._geometryTarget, probes, capturePositions, {
                shaderPass: passName,
                layers: this._layers.filter(id => id !== LAYERID_SKYBOX),
                clearColor: geometryClearColor
            }, p => onProgress(progressStart + (progressEnd - progressStart) * p));

            await capture(allProbes, positions, 0, 0.7);

            if (validity) {
                const pixels = await this._project('VALIDITY', 1, volume.resolution[0]);

                if (virtualOffset) {

                    // the invalid probes to move out through the closest back face, by up to 0.45 of
                    // a cell, so that a moved probe stays closer to its own position than to the
                    // positions of its neighbors (DDGI)
                    volume.getCellSize(_cellSize);
                    const cell = Math.min(_cellSize.x, _cellSize.y, _cellSize.z);
                    const maxOffset = cell * 0.45;
                    const margin = cell * 0.1;

                    const offsets = new Float32Array(probeCount * 3);
                    const moved = [];
                    for (let probe = 0; probe < probeCount; probe++) {
                        if (pixels[probe * 4] > threshold) {
                            const x = pixels[probe * 4 + 1];
                            const y = pixels[probe * 4 + 2];
                            const z = pixels[probe * 4 + 3];
                            const distance = Math.sqrt(x * x + y * y + z * z);
                            if (distance > 0 && distance + margin <= maxOffset) {
                                const scale = (distance + margin) / distance;
                                offsets.set([x * scale, y * scale, z * scale], probe * 3);
                                moved.push(probe);
                            }
                        }
                    }

                    if (moved.length) {

                        // the geometry at the moved positions, kept for the moves which made the
                        // probes valid, and captured again at the grid positions for the others
                        const movedPositions = positions.map((value, i) => value + offsets[i]);
                        await capture(moved, movedPositions, 0.7, 0.8);
                        const movedPixels = await this._project('VALIDITY', 1, volume.resolution[0]);
                        const reverted = [];
                        moved.forEach((probe) => {
                            if (movedPixels[probe * 4] <= threshold) {
                                pixels[probe * 4] = movedPixels[probe * 4];
                                positions.set(movedPositions.subarray(probe * 3, probe * 3 + 3), probe * 3);
                                result.movedProbes++;
                            } else {
                                offsets.fill(0, probe * 3, probe * 3 + 3);
                                reverted.push(probe);
                            }
                        });
                        if (reverted.length) {
                            await capture(reverted, positions, 0.8, 0.85);
                        }
                    }
                    volume.setOffsets(result.movedProbes > 0 ? offsets : null);
                }

                for (let probe = 0; probe < probeCount; probe++) {
                    if (pixels[probe * 4] > threshold) {
                        probeValid[probe] = 0;
                        result.invalidProbes++;
                    }
                }
            }
        } finally {
            restore();
        }

        volume.setValidity(probeValid);
        this._probeValid = probeValid;
        this._positions = positions;
        this._updatePositionsTexture();

        // the visibility of the probes, at the positions the probes are captured at
        if (visibility) {
            volume.setVisibility(await this._captureVisibility(visibilitySize), visibilitySize);
        } else {
            volume.setVisibility(null);
        }
        onProgress(1);

        return result;
    }

    /**
     * Bakes the lighting, see {@link bakeLighting}.
     *
     * @param {object} options - The options, see {@link bakeLighting}.
     * @returns {Promise<{ dilatedProbes: number }>} The result.
     * @private
     */
    async _bakeLighting(options) {
        const volume = this.volume;
        const source = options.source ?? PROBESOURCE_GBUFFER;
        const index = options.index ?? 0;
        const bounces = options.bounces ?? 1;
        const dilation = options.dilation ?? true;
        const onProgress = options.onProgress ?? (() => {});
        const result = { dilatedProbes: 0 };

        // the directional lights render a single shadow map for all cameras, which the lighting of
        // the geometry needs, as its camera isn't at the probes
        let shadowBounds = options.shadowBounds;
        if (shadowBounds === undefined) {
            shadowBounds = new BoundingBox();
            shadowBounds.copy(volume.aabb);
            shadowBounds.halfExtents.addScalar(volume.blendDistance);
        }
        const shadowLights = this._setShadowBounds(this._layers, shadowBounds);

        // the cameras of the bake light with the probes of the previous bounce, all other cameras
        // show the probes of the volume
        const captureCameras = new Set();
        // the sky, seen through the texels without geometry, rendered for each bake, so that the
        // lighting follows changes of the environment, such as its intensity
        if (source === PROBESOURCE_GBUFFER) {
            await this._captureSky();
        }
        const lighting = source === PROBESOURCE_GBUFFER ? this._createLighting() : null;
        if (lighting) {
            captureCameras.add(lighting.camera.camera);
        } else {
            this._rigs.forEach(rig => rig.cameras.forEach(camera => captureCameras.add(camera)));
        }
        const prerenderHandle = this.app.scene.on(EVENT_PRERENDER, (camera) => {
            volume.useBakeData(captureCameras.has(camera));
        });

        // a pass renders the radiance of the probes, and projects it onto their spherical harmonics,
        // which the next pass lights the scene with
        const allProbes = Array.from({ length: volume.probeCount }, (value, i) => i);
        const runPass = async (pass) => {
            const progressStart = pass / (bounces + 1);
            if (lighting) {
                await this._renderLighting(lighting);
            } else {
                await this._captureTiles(this._radianceTarget, allProbes, this._positions, {
                    shaderPass: null,
                    layers: this._layers,
                    clearColor: radianceClearColor
                }, p => onProgress(progressStart + p / (bounces + 1)));
            }

            const pixels = await this._project(null, 3, volume.resolution[0]);
            const data = this._unpack(pixels, volume);
            if (dilation) {
                result.dilatedProbes = this._dilate(data, this._probeValid, volume.resolution);
            }
            if (pass === bounces) {
                volume.setData(data, index);
            } else {
                volume.setBakeData(data);
            }
            onProgress((pass + 1) / (bounces + 1));
        };

        try {
            const passes = Array.from({ length: bounces + 1 }, (value, i) => i);
            await passes.reduce((previous, pass) => previous.then(() => runPass(pass)), Promise.resolve());
        } finally {
            prerenderHandle.off();
            shadowLights.forEach(({ light, bounds }) => {
                light.shadowBounds = bounds;
            });
            if (lighting) {
                this._destroyLighting(lighting);
            }
        }
        return result;
    }

    /**
     * Creates the atlases of the geometry and the radiance of the probes.
     *
     * @private
     */
    _createAtlases() {
        const device = this.app.graphicsDevice;
        const size = this._faceSize;
        const probeCount = this.volume.probeCount;
        const maxSize = device.maxTextureSize;
        const probesPerRow = Math.max(1, Math.min(probeCount, Math.floor(maxSize / (size * 3))));
        const width = probesPerRow * size * 3;
        const height = Math.ceil(probeCount / probesPerRow) * size * 2;
        if (height > maxSize) {
            throw new Error(`ProbeVolumeBaker: the atlas of ${probeCount} probes of face size ${size} exceeds the maximum texture size ${maxSize}.`);
        }
        this._atlas = { faceSize: size, probesPerRow, width, height };

        const createTexture = (name, format) => new Texture(device, {
            name,
            width,
            height,
            format,
            mipmaps: false,
            minFilter: FILTER_NEAREST,
            magFilter: FILTER_NEAREST,
            addressU: ADDRESS_CLAMP_TO_EDGE,
            addressV: ADDRESS_CLAMP_TO_EDGE
        });

        // the albedo and the hit flag, the back face flag, the distance and the octahedral normal,
        // and the emission
        const colorBuffers = [
            createTexture('ProbeVolumeGeometry0', PIXELFORMAT_RGBA8),
            createTexture('ProbeVolumeGeometry1', PIXELFORMAT_RGBA16F)
        ];
        if (this._emissive) {
            colorBuffers.push(createTexture('ProbeVolumeGeometry2', PIXELFORMAT_RGBA16F));
        }
        this._geometryTarget = new RenderTarget({
            name: 'ProbeVolumeGeometry',
            colorBuffers,
            depth: true,
            origin: RENDERTARGET_ORIGIN_BOTTOM
        });

        this._radianceTarget = new RenderTarget({
            name: 'ProbeVolumeRadiance',
            colorBuffer: createTexture('ProbeVolumeRadiance', this._formats.cubemapFormat),
            depth: true,
            origin: RENDERTARGET_ORIGIN_BOTTOM
        });
    }

    /**
     * Destroys the geometry and the atlases.
     *
     * @private
     */
    _destroyGeometry() {
        [this._geometryTarget, this._radianceTarget].forEach((target) => {
            if (target) {
                const buffers = target._colorBuffers ?? [target.colorBuffer];
                target.destroy();
                buffers.forEach(buffer => buffer?.destroy());
            }
        });
        this._geometryTarget = null;
        this._radianceTarget = null;
        this._skyCubemap?.destroy();
        this._skyCubemap = null;
        this._positionsTexture?.destroy();
        this._positionsTexture = null;
        this._positions = null;
        this._atlas = null;
    }

    /**
     * Creates the rigs of cameras capturing the probes, if not created yet.
     *
     * @private
     */
    _createRigs() {
        const count = Math.max(1, Math.min(this.probesPerFrame, this.volume.probeCount));
        while (this._rigs.length < count) {
            const entity = new Entity(`ProbeVolumeCapture${this._rigs.length}`);
            const cameras = faceRotations.map((rotation, face) => {
                const faceEntity = new Entity(`Face${face}`);
                faceEntity.addComponent('camera', {
                    fov: 90,
                    aspectRatioMode: ASPECT_MANUAL,
                    aspectRatio: 1,
                    nearClip: this._nearClip,
                    farClip: this._farClip,
                    priority: -100,
                    toneMapping: TONEMAP_NONE,
                    gammaCorrection: GAMMA_NONE
                });
                faceEntity.setLocalRotation(rotation);
                entity.addChild(faceEntity);
                return faceEntity.camera;
            });
            entity.enabled = false;
            this.app.root.addChild(entity);
            this._rigs.push({ entity, cameras });
        }
    }

    /**
     * Registers the output chunk of the lit materials writing the geometry in the geometry passes.
     * It only applies in those passes, so it leaves the other passes of the materials as they were.
     *
     * @private
     */
    _registerGeometryChunks() {
        const device = this.app.graphicsDevice;
        ShaderChunks.get(device, SHADERLANGUAGE_GLSL).set('outputPS', gbufferOutputGLSL);
        ShaderChunks.get(device, SHADERLANGUAGE_WGSL).set('outputPS', gbufferOutputWGSL);
    }

    /**
     * Makes the opaque materials of the captured layers render their back faces in the geometry
     * pass, and the transparent ones skip it.
     *
     * @param {string} passName - The name of the geometry pass.
     * @returns {Function} Restores the materials and the mesh instances.
     * @private
     */
    _prepareGeometryMaterials(passName) {
        // the index of the pass, allocated by a camera
        const passIndex = this._rigs[0].cameras[0].setShaderPass(passName);
        this._rigs[0].cameras[0].setShaderPass(null);

        /** @type {Map<Material, number>} */
        const culls = new Map();
        /** @type {Map<MeshInstance, number>} */
        const masks = new Map();
        this._layers.forEach((id) => {
            this.app.scene.layers.getLayerById(id)?.meshInstances.forEach((meshInstance) => {
                const material = meshInstance.material;
                if (!material) {
                    return;
                }
                if (material.blendType !== BLEND_NONE) {
                    if (!masks.has(meshInstance)) {
                        masks.set(meshInstance, meshInstance.shaderPassMask);
                        meshInstance.shaderPassMask &= ~(1 << passIndex);
                    }
                } else if (!culls.has(material)) {
                    culls.set(material, material.cull);
                    material.cull = CULLFACE_NONE;
                }
            });
        });

        return () => {
            culls.forEach((cull, material) => {
                material.cull = cull;
            });
            masks.forEach((mask, meshInstance) => {
                meshInstance.shaderPassMask = mask;
            });
        };
    }

    /**
     * Renders the sky into a cubemap from the center of the volume, for the texels without
     * geometry.
     *
     * @returns {Promise<void>} Resolves once rendered.
     * @private
     */
    async _captureSky() {
        const device = this.app.graphicsDevice;
        const size = 32;
        const cubemap = new Texture(device, {
            name: 'ProbeVolumeSky',
            width: size,
            height: size,
            format: this._formats.cubemapFormat,
            cubemap: true,
            mipmaps: false,
            minFilter: FILTER_LINEAR,
            magFilter: FILTER_LINEAR,
            addressU: ADDRESS_CLAMP_TO_EDGE,
            addressV: ADDRESS_CLAMP_TO_EDGE
        });

        const entity = new Entity('ProbeVolumeSkyCapture');
        const renderTargets = [];
        faceRotations.forEach((rotation, face) => {
            const renderTarget = new RenderTarget({ colorBuffer: cubemap, face, depth: true, origin: RENDERTARGET_ORIGIN_TOP });
            renderTargets.push(renderTarget);
            const faceEntity = new Entity(`Face${face}`);
            faceEntity.addComponent('camera', {
                fov: 90,
                aspectRatioMode: ASPECT_MANUAL,
                aspectRatio: 1,
                priority: -100,
                toneMapping: TONEMAP_NONE,
                gammaCorrection: GAMMA_NONE,
                layers: [LAYERID_SKYBOX],
                renderTarget
            });
            faceEntity.setLocalRotation(rotation);
            entity.addChild(faceEntity);
        });
        entity.setPosition(this.volume.aabb.center);
        this.app.root.addChild(entity);

        await this._nextFrame();
        await this._nextFrame();

        entity.destroy();
        renderTargets.forEach(renderTarget => renderTarget.destroy());
        this._skyCubemap?.destroy();
        this._skyCubemap = cubemap;
    }

    /**
     * Resolves at the next update of the application, after the frame before it rendered.
     *
     * @returns {Promise<void>} Resolves at the next update.
     * @private
     */
    _nextFrame() {
        return new Promise((resolve) => {
            this.app.once('update', () => resolve());
        });
    }

    /**
     * Renders the probes into their tiles of an atlas, a few probes each frame.
     *
     * @param {RenderTarget} target - The atlas.
     * @param {number[]} probes - The indices of the probes.
     * @param {Float32Array} positions - The positions of all probes.
     * @param {{ shaderPass: string|null, layers: number[], clearColor: Color }} setup - The shader
     * pass, layers and clear color of the cameras.
     * @param {Function} onProgress - Called each frame with the progress.
     * @returns {Promise<void>} Resolves once all probes rendered.
     * @private
     */
    _captureTiles(target, probes, positions, setup, onProgress) {
        const { width, height, faceSize } = this._atlas;
        const rigs = this._rigs;
        rigs.forEach((rig) => {
            rig.cameras.forEach((camera) => {
                camera.renderTarget = target;
                camera.layers = setup.layers;
                camera.clearColor = setup.clearColor;
                camera.setShaderPass(setup.shaderPass);
            });
        });

        return new Promise((resolve, reject) => {
            let next = 0;
            const handle = this.app.on('update', () => {
                try {
                    // the probes assigned in the previous frame have rendered
                    if (next >= probes.length) {
                        handle.off();
                        rigs.forEach((rig) => {
                            rig.entity.enabled = false;
                        });
                        resolve();
                        return;
                    }

                    rigs.forEach((rig) => {
                        if (next < probes.length) {
                            const probe = probes[next++];
                            rig.entity.setPosition(positions[probe * 3], positions[probe * 3 + 1], positions[probe * 3 + 2]);
                            rig.cameras.forEach((camera, face) => {
                                this._tileRect(probe, face, _rect);
                                const rect = new Vec4(_rect.x / width, _rect.y / height, faceSize / width, faceSize / height);
                                camera.rect = rect;
                                camera.scissorRect = rect;
                            });
                            rig.entity.enabled = true;
                        } else {
                            rig.entity.enabled = false;
                        }
                    });
                    onProgress(next / probes.length);
                } catch (error) {
                    handle.off();
                    reject(error);
                }
            });
        });
    }

    /**
     * Sets the viewport rectangle of a face of the tile of a probe, in texels of the atlas.
     *
     * @param {number} probe - The index of the probe.
     * @param {number} face - The face.
     * @param {Vec4} rect - The rectangle, set.
     * @private
     */
    _tileRect(probe, face, rect) {
        const { faceSize, probesPerRow } = this._atlas;
        const x = (probe % probesPerRow) * faceSize * 3 + (face % 3) * faceSize;
        const y = Math.floor(probe / probesPerRow) * faceSize * 2 + Math.floor(face / 3) * faceSize;
        rect.set(x, y, faceSize, faceSize);
    }

    /**
     * Returns the parameters of the atlases for the shaders: the face size, the probes in a row,
     * the height and whether the rows are flipped.
     *
     * @returns {Float32Array} The parameters.
     * @private
     */
    _atlasParams() {
        const { faceSize, probesPerRow, height } = this._atlas;
        return new Float32Array([faceSize, probesPerRow, height, this._atlasFlipY ? 1 : 0]);
    }

    /**
     * Projects the tiles of all probes with the projection shader into a render target, a row of
     * probes for each row of the target, and reads it back.
     *
     * @param {string|null} mode - 'VALIDITY', 'VISIBILITY', or null for the spherical harmonics.
     * @param {number} texelsPerProbe - The texels the projection of a probe writes.
     * @param {number} probesPerRow - The probes in a row of the target.
     * @returns {Promise<Float32Array>} The texels of the target.
     * @private
     */
    async _project(mode, texelsPerProbe, probesPerRow) {
        const device = this.app.graphicsDevice;
        const probeCount = this.volume.probeCount;
        const rows = Math.ceil(probeCount / probesPerRow);
        const target = this._createTarget(`ProbeVolumeProject${mode ?? ''}`, probesPerRow * texelsPerProbe, rows);
        const shader = this._createShader(mode);

        const radiance = mode === null;
        device.scope.resolve('probeAtlas0').setValue(radiance ? this._radianceTarget.colorBuffer : this._geometryTarget.getColorBuffer(0));
        device.scope.resolve('probeAtlas1').setValue(this._geometryTarget.getColorBuffer(1));
        device.scope.resolve('probeAtlasParams').setValue(this._atlasParams());
        device.scope.resolve('probeLayoutParams').setValue([texelsPerProbe, probeCount, 0, 0]);
        for (let row = 0; row < rows; row++) {
            device.scope.resolve('probeRowStart').setValue(row * probesPerRow);
            _rect.set(0, row, probesPerRow * texelsPerProbe, 1);
            drawQuadWithShader(device, target, shader, _rect, _rect, 'ProbeVolumeProject');
        }

        const texture = target.colorBuffer;
        const pixels = await texture.read(0, 0, texture.width, texture.height, { renderTarget: target, immediate: true });
        this._destroyTarget(target);
        return pixels instanceof Uint16Array ? Float32Array.from(pixels, halfToFloat) : /** @type {Float32Array} */ (pixels);
    }

    /**
     * Computes the visibility of the probes from the distances of their geometry, filtered into an
     * octahedral map for each probe.
     *
     * @param {number} size - The number of texels along a side of the octahedral maps.
     * @returns {Promise<Float32Array>} The visibility, see {@link ProbeVolume#setVisibility}.
     * @private
     */
    async _captureVisibility(size) {
        const device = this.app.graphicsDevice;
        const volume = this.volume;
        const probeCount = volume.probeCount;
        const texels = size * size;
        const probesPerRow = Math.max(1, Math.min(Math.floor(VISIBILITY_TARGET_WIDTH / texels), probeCount));

        // only the distances up to the probes around a surface matter, so they are clamped to well
        // beyond the diagonal of a cell, which keeps them precise in half floats
        volume.getCellSize(_cellSize);
        device.scope.resolve('probeVisibilitySize').setValue(size);
        device.scope.resolve('probeVisibilityMaxDistance').setValue(_cellSize.length() * 1.5);

        const pixels = await this._project('VISIBILITY', texels, probesPerRow);

        // the mean and the mean squared distance of each texel of each map
        const width = probesPerRow * texels;
        const data = new Float32Array(probeCount * texels * 2);
        for (let probe = 0; probe < probeCount; probe++) {
            const src = (Math.floor(probe / probesPerRow) * width + (probe % probesPerRow) * texels) * 4;
            for (let texel = 0; texel < texels; texel++) {
                data[(probe * texels + texel) * 2] = pixels[src + texel * 4];
                data[(probe * texels + texel) * 2 + 1] = pixels[src + texel * 4 + 1];
            }
        }
        return data;
    }

    /**
     * Updates the texture of the positions of the probes.
     *
     * @private
     */
    _updatePositionsTexture() {
        const probeCount = this.volume.probeCount;
        const width = Math.min(POSITIONS_WIDTH, probeCount);
        const height = Math.ceil(probeCount / width);
        const data = new Float32Array(width * height * 4);
        for (let i = 0; i < probeCount; i++) {
            data.set(this._positions.subarray(i * 3, i * 3 + 3), i * 4);
        }
        this._positionsTexture?.destroy();
        this._positionsTexture = new Texture(this.app.graphicsDevice, {
            name: 'ProbeVolumePositions',
            width,
            height,
            format: PIXELFORMAT_RGBA32F,
            mipmaps: false,
            minFilter: FILTER_NEAREST,
            magFilter: FILTER_NEAREST,
            levels: [data]
        });
    }

    /**
     * Creates the quad lighting the geometry: a lit material whose front end reads the geometry,
     * on a layer of its own lit by the lights of the captured layers, rendered by an orthographic
     * camera whose frustum encloses the volume, so that the lights around it are not culled.
     *
     * @returns {{ camera: Entity, layer: Layer, meshInstance: MeshInstance, lights: object[] }} The
     * quad.
     * @private
     */
    _createLighting() {
        const app = this.app;
        const device = app.graphicsDevice;
        const volume = this.volume;

        const material = new LitMaterial();
        material.shaderChunkGLSL = lightingFrontendGLSL;
        material.shaderChunkWGSL = lightingFrontendWGSL;
        material.getShaderChunks(SHADERLANGUAGE_GLSL).set('transformVS', lightingTransformGLSL);
        material.getShaderChunks(SHADERLANGUAGE_WGSL).set('transformVS', lightingTransformWGSL);
        material.useSkybox = true;
        material.useFog = false;
        material.hasSpecular = false;
        material.hasNormals = false;

        // the quad is placed in clip space, bypassing the projection, which flips the winding when
        // rendering to textures on some graphics APIs
        material.cull = CULLFACE_NONE;
        if (this._emissive) {
            material.setDefine('PROBE_GBUFFER_EMISSIVE', true);
        }
        volume.applyToMaterial(material);
        material.setParameter('probeGeometry0', this._geometryTarget.getColorBuffer(0));
        material.setParameter('probeGeometry1', this._geometryTarget.getColorBuffer(1));
        if (this._emissive) {
            material.setParameter('probeGeometry2', this._geometryTarget.getColorBuffer(2));
        }
        material.setParameter('probeSkyCubemap', this._skyCubemap);
        material.setParameter('probePositions', this._positionsTexture);
        material.setParameter('probeAtlasParams', this._atlasParams());
        material.setParameter('material_reflectivity', 0);
        material.update();

        // a quad covering the viewport, at any camera
        const mesh = new Mesh(device);
        mesh.setPositions([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0]);
        mesh.setNormals([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1]);
        mesh.setUvs(0, [0, 0, 1, 0, 1, 1, 0, 1]);
        mesh.setIndices([0, 1, 2, 0, 2, 3]);
        mesh.update(PRIMITIVE_TRIANGLES);
        const meshInstance = new MeshInstance(mesh, material, new GraphNode('ProbeVolumeLighting'));
        meshInstance.cull = false;
        meshInstance.castShadows = false;

        const layer = new Layer({ name: 'ProbeVolumeLighting' });
        layer.addMeshInstances([meshInstance]);
        app.scene.layers.push(layer);

        // the lights of the captured layers light the quad
        const lights = [];
        this._layers.forEach((id) => {
            app.scene.layers.getLayerById(id)?._lights.forEach((light) => {
                if (!lights.some(entry => entry.light === light)) {
                    const entry = { light };
                    layer.addLight(/** @type {any} */ (entry));
                    lights.push(entry);
                }
            });
        });

        // an orthographic camera enclosing a sphere around the volume, so the lights are not culled
        const radius = volume.aabb.halfExtents.length() * 2 + 10;
        const camera = new Entity('ProbeVolumeLightingCamera');
        camera.addComponent('camera', {
            projection: PROJECTION_ORTHOGRAPHIC,
            orthoHeight: radius,
            aspectRatioMode: ASPECT_MANUAL,
            aspectRatio: 1,
            nearClip: 0.1,
            farClip: radius * 2 + 1,
            priority: -100,
            toneMapping: TONEMAP_NONE,
            gammaCorrection: GAMMA_NONE,
            clearColor: radianceClearColor,
            layers: [layer.id],
            renderTarget: this._radianceTarget
        });
        camera.camera.setShaderPass(LIGHTING_PASS);
        camera.setPosition(volume.aabb.center.x, volume.aabb.center.y, volume.aabb.center.z + radius + 0.5);
        camera.enabled = false;
        app.root.addChild(camera);

        return { camera, layer, meshInstance, lights };
    }

    /**
     * Renders the quad lighting the geometry into the radiance atlas.
     *
     * @param {{ camera: Entity }} lighting - The quad.
     * @returns {Promise<void>} Resolves once rendered.
     * @private
     */
    async _renderLighting(lighting) {
        await this._nextFrame();
        lighting.camera.enabled = true;
        await this._nextFrame();
        lighting.camera.enabled = false;
    }

    /**
     * Destroys the quad lighting the geometry.
     *
     * @param {{ camera: Entity, layer: Layer, meshInstance: MeshInstance, lights: object[] }} lighting - The
     * quad.
     * @private
     */
    _destroyLighting(lighting) {
        lighting.camera.destroy();
        lighting.lights.forEach(entry => lighting.layer.removeLight(/** @type {any} */ (entry)));
        this.app.scene.layers.remove(lighting.layer);
        lighting.layer.removeMeshInstances([lighting.meshInstance]);
        const material = lighting.meshInstance.material;
        lighting.meshInstance.mesh.destroy();
        lighting.meshInstance.destroy();
        material.destroy();
    }

    /**
     * Fits the shadows of the shadow casting directional lights of the captured layers to the
     * shadow bounds, which renders each as a single shadow map for all cameras.
     *
     * @param {number[]} layers - The ids of the captured layers.
     * @param {BoundingBox|null} bounds - The shadow bounds, or null to keep the shadows fitted to
     * each camera.
     * @returns {{ light: Light, bounds: BoundingBox|null }[]} The lights fitted to the bounds, with
     * their own shadow bounds, to restore after the bake.
     * @private
     */
    _setShadowBounds(layers, bounds) {
        /** @type {Set<Light>} */
        const lights = new Set();
        if (bounds) {
            layers.forEach((id) => {
                this.app.scene.layers.getLayerById(id)?._lights.forEach((light) => {
                    if (light.type === LIGHTTYPE_DIRECTIONAL && light.castShadows) {
                        lights.add(light);
                    }
                });
            });
        }
        return Array.from(lights, (light) => {
            const own = light.shadowBounds?.clone() ?? null;
            light.shadowBounds = bounds;
            return { light, bounds: own };
        });
    }

    /**
     * Creates a render target receiving the results of the projections of the probes. Viewport
     * rectangles address its rows the same way on all graphics APIs.
     *
     * @param {string} name - The name of the render target.
     * @param {number} width - The width.
     * @param {number} height - The height.
     * @returns {RenderTarget} The render target.
     * @private
     */
    _createTarget(name, width, height) {
        const colorBuffer = new Texture(this.app.graphicsDevice, {
            name,
            width,
            height,
            format: this._formats.targetFormat,
            mipmaps: false,
            minFilter: FILTER_NEAREST,
            magFilter: FILTER_NEAREST
        });
        return new RenderTarget({
            name,
            colorBuffer,
            depth: false,
            origin: RENDERTARGET_ORIGIN_BOTTOM
        });
    }

    /**
     * Destroys a render target created by {@link _createTarget}, and its texture.
     *
     * @param {RenderTarget} target - The render target.
     * @private
     */
    _destroyTarget(target) {
        const texture = target.colorBuffer;
        target.destroy();
        texture.destroy();
    }

    /**
     * Creates the shader projecting the tiles of the probes.
     *
     * @param {string|null} mode - 'VALIDITY', 'VISIBILITY', or null for the spherical harmonics.
     * @returns {Shader} The shader.
     * @private
     */
    _createShader(mode) {
        const defines = new Map();
        if (mode) {
            defines.set(mode, '');
        }
        return ShaderUtils.createShader(this.app.graphicsDevice, {
            uniqueName: `ProbeVolumeProjectTiles${mode ?? ''}`,
            attributes: { aPosition: SEMANTIC_POSITION },
            vertexChunk: 'quadVS',
            fragmentGLSL: projectShaderGLSL,
            fragmentWGSL: projectShaderWGSL,
            fragmentDefines: defines
        });
    }

    /**
     * Converts the texels of the spherical harmonics read back from the render target to the
     * layout of {@link ProbeVolume#data}.
     *
     * @param {Float32Array} pixels - The texels.
     * @param {ProbeVolume} volume - The probe volume.
     * @returns {Float32Array} The spherical harmonics of the probes.
     * @private
     */
    _unpack(pixels, volume) {
        const probeCount = volume.probeCount;
        const data = new Float32Array(probeCount * FLOATS_PER_PROBE);
        for (let probe = 0; probe < probeCount; probe++) {
            data.set(pixels.subarray(probe * FLOATS_PER_PROBE, probe * FLOATS_PER_PROBE + FLOATS_PER_PROBE), probe * FLOATS_PER_PROBE);
        }
        return data;
    }

    /**
     * Fills the spherical harmonics of the invalid probes from their valid neighbors, weighted by
     * the inverse square of their distance, repeatedly, so that the probes surrounded by invalid
     * probes are filled from the probes filled before them.
     *
     * @param {Float32Array} data - The spherical harmonics of the probes, modified in place.
     * @param {Uint8Array} validity - The validity of the probes.
     * @param {number[]} resolution - The number of probes along each axis.
     * @returns {number} The number of filled probes.
     * @private
     */
    _dilate(data, validity, resolution) {
        const [nx, ny, nz] = resolution;
        const filled = Uint8Array.from(validity);
        const sum = new Float32Array(FLOATS_PER_PROBE);
        let filledCount = 0;

        for (let iteration = 0; iteration < 4; iteration++) {
            const newlyFilled = [];
            for (let probe = 0; probe < filled.length; probe++) {
                if (filled[probe]) {
                    continue;
                }
                const ix = probe % nx;
                const iy = Math.floor(probe / nx) % ny;
                const iz = Math.floor(probe / (nx * ny));

                sum.fill(0);
                let weightSum = 0;
                for (let dz = -1; dz <= 1; dz++) {
                    for (let dy = -1; dy <= 1; dy++) {
                        for (let dx = -1; dx <= 1; dx++) {
                            const x = ix + dx;
                            const y = iy + dy;
                            const z = iz + dz;
                            if (x < 0 || y < 0 || z < 0 || x >= nx || y >= ny || z >= nz) {
                                continue;
                            }
                            const neighbor = x + nx * (y + ny * z);
                            if (neighbor !== probe && filled[neighbor]) {
                                const weight = 1 / (dx * dx + dy * dy + dz * dz);
                                for (let i = 0; i < FLOATS_PER_PROBE; i++) {
                                    sum[i] += data[neighbor * FLOATS_PER_PROBE + i] * weight;
                                }
                                weightSum += weight;
                            }
                        }
                    }
                }

                if (weightSum > 0) {
                    for (let i = 0; i < FLOATS_PER_PROBE; i++) {
                        data[probe * FLOATS_PER_PROBE + i] = sum[i] / weightSum;
                    }
                    newlyFilled.push(probe);
                }
            }

            if (newlyFilled.length === 0) {
                break;
            }
            newlyFilled.forEach((probe) => {
                filled[probe] = 1;
            });
            filledCount += newlyFilled.length;
        }
        return filledCount;
    }
}

export { ProbeVolumeBaker };
