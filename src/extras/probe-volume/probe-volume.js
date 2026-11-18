import { Debug } from '../../core/debug.js';
import { FloatPacking } from '../../core/math/float-packing.js';
import { Vec3 } from '../../core/math/vec3.js';
import { BoundingBox } from '../../core/shape/bounding-box.js';
import {
    ADDRESS_CLAMP_TO_EDGE, FILTER_LINEAR, FILTER_NEAREST, PIXELFORMAT_RG16F, PIXELFORMAT_RGBA16F,
    PIXELFORMAT_RGBA8, SHADERLANGUAGE_GLSL, SHADERLANGUAGE_WGSL
} from '../../platform/graphics/constants.js';
import { Texture } from '../../platform/graphics/texture.js';
import { ShaderChunks } from '../../scene/shader-lib/shader-chunks.js';
import { probeVolumeChunkGLSL, probeVolumeChunkWGSL } from './probe-volume-chunks.js';

/**
 * @import { GraphicsDevice } from '../../platform/graphics/graphics-device.js'
 * @import { Material } from '../../scene/materials/material.js'
 */

// the floats stored for each probe: L0 and the three L1 coefficients of each color channel
const FLOATS_PER_PROBE = 12;

// the magic number and the version of the serialized data, and the flags of its optional parts
const MAGIC = 0x56504350; // 'PCPV'
const VERSION = 3;
const HEADER_SIZE = 56;
const FLAG_VALIDITY = 1;
const FLAG_OFFSETS = 2;
const FLAG_VISIBILITY = 4;

const SQRT3 = Math.sqrt(3);

/**
 * Converts a half float, as stored in 16 bits, to a float.
 *
 * @param {number} half - The bits of the half float.
 * @returns {number} The float.
 * @ignore
 */
const halfToFloat = (half) => {
    const sign = half & 0x8000 ? -1 : 1;
    const exponent = (half >> 10) & 0x1f;
    const mantissa = half & 0x3ff;
    if (exponent === 0) {
        return sign * mantissa * 2 ** -24;
    }
    if (exponent === 31) {
        return mantissa ? NaN : sign * Infinity;
    }
    return sign * (1 + mantissa / 1024) * 2 ** (exponent - 15);
};

/**
 * A regular grid of light probes covering a box, providing the ambient lighting of the surfaces of
 * the materials it is applied to. The box is divided into cells, with a probe at the center of each
 * cell. Each probe stores the incoming radiance at its position as L1 spherical harmonics, and the
 * surfaces interpolate the eight probes around them. Outside the box, the ambient lighting blends
 * back to the ambient of the environment.
 *
 * The probe data is produced by {@link ProbeVolumeBaker}, at runtime or ahead of time, and can be
 * saved with {@link ProbeVolume#serialize} and restored with {@link ProbeVolume.deserialize}.
 * Restored probes work on any device, including the devices which cannot bake them, see
 * {@link ProbeVolumeBaker.isSupported}.
 *
 * The baker can also find the invalid probes, which are inside geometry and would darken the
 * surfaces around them. With {@link ProbeVolume#leakReduction}, the surfaces ignore those, and
 * favor the probes in front of them over the probes behind them, which reduces light leaking
 * through walls.
 *
 * The baker can also capture the visibility of the probes, the distances to the surfaces around
 * them, which the surfaces use to ignore the probes they are hidden from, see
 * {@link ProbeVolume#visibility}. This removes most of the remaining leaking, such as on the floor
 * along a wall with probes on both sides, at the cost of a filtered fetch for each of the eight
 * probes around a surface.
 *
 * The spherical harmonics of the probes form a lighting, see {@link ProbeVolume#getData}. A volume
 * can hold several lightings, baked under different lighting, such as at different times of the
 * day, and shows one of them, see {@link ProbeVolume#activeLighting}. The validity, the offsets
 * and the visibility of the probes depend only on the geometry, and are shared by the lightings.
 *
 * The volume provides its data to shaders through the global uniforms of the graphics device, so
 * one volume is active at a time.
 *
 * @example
 * // a volume, lighting a material
 * const volume = new ProbeVolume(app.graphicsDevice, {
 *     aabb: new BoundingBox(new Vec3(0, 1.5, 0), new Vec3(5, 1.5, 4)),
 *     resolution: [10, 3, 8]
 * });
 * volume.applyToMaterial(material);
 * material.update();
 *
 * // bake its probes, and save them
 * const baker = new ProbeVolumeBaker(app, volume);
 * await baker.bakeLighting();
 * baker.destroy();
 * const buffer = volume.serialize();
 *
 * // later, restore them
 * const restored = ProbeVolume.deserialize(app.graphicsDevice, buffer);
 * @category Graphics
 */
class ProbeVolume {
    /**
     * The graphics device.
     *
     * @type {GraphicsDevice}
     */
    device;

    /**
     * The box covered by the probes.
     *
     * @type {BoundingBox}
     * @private
     */
    _aabb = new BoundingBox();

    /**
     * The number of probes along each axis.
     *
     * @type {number[]}
     * @private
     */
    _resolution;

    /**
     * The pixel format of the probe texture.
     *
     * @type {number}
     * @private
     */
    _format;

    /**
     * The lightings of the volume, each the spherical harmonics of all probes.
     *
     * @type {Float32Array[]}
     * @private
     */
    _lightings;

    /**
     * The index of the lighting shown.
     *
     * @private
     */
    _activeLighting = 0;

    /**
     * The validity of all probes, 1 for a valid probe and 0 for an invalid one.
     *
     * @type {Uint8Array}
     * @private
     */
    _validity;

    /**
     * The offsets of the positions the probes were captured at from their positions, or null.
     *
     * @type {Float32Array|null}
     * @private
     */
    _offsets = null;

    /**
     * The 3D texture holding the probes.
     *
     * @type {Texture|null}
     * @private
     */
    _texture = null;

    /**
     * The 3D texture holding the probes the cameras of a bake capture with, while all other cameras
     * show the probes of {@link _texture}, or null. It stores half floats in any format.
     *
     * @type {Texture|null}
     * @private
     */
    _captureTexture = null;

    /**
     * The encoding of the texels of {@link _captureTexture}, half floats.
     *
     * @private
     */
    _captureEncoding = new Float32Array([0, 1]);

    /**
     * The parameters and the blend uniforms of the cameras of a bake, which capture with the probes
     * enabled and at their baked intensity, whatever the volume shows.
     *
     * @private
     */
    _captureParams = new Float32Array(4);

    /** @private */
    _captureBlend = new Float32Array(3);

    /**
     * Whether the probes were set, see {@link hasData}.
     *
     * @private
     */
    _hasData = false;

    /**
     * The 3D texture holding for each probe, in red, green and blue, its offset, see
     * {@link offsets}, and in alpha, the validity of the eight probes of the cell it is the first
     * corner of.
     *
     * @type {Texture|null}
     * @private
     */
    _validityTexture = null;

    /**
     * The visibility of all probes, or null.
     *
     * @type {Float32Array|null}
     * @private
     */
    _visibility = null;

    /**
     * The number of texels along a side of the octahedral maps of the visibility, or 0.
     *
     * @private
     */
    _visibilitySize = 0;

    /**
     * The texture holding the octahedral maps of the visibility of the probes, in tiles with a
     * border of one texel, or a single texel without visibility.
     *
     * @type {Texture|null}
     * @private
     */
    _visibilityTexture = null;

    /**
     * The number of tiles along a row of the visibility texture.
     *
     * @private
     */
    _visibilityTilesPerRow = 1;

    /**
     * The scale of L0 of 8-bit texels.
     *
     * @private
     */
    _l0Scale = 1;

    /** @private */
    _normalBias = 0.5;

    /** @private */
    _intensity = 1;

    /** @private */
    _shSharpening = true;

    /** @private */
    _leakReduction = true;

    /** @private */
    _useVisibility = true;

    /** @private */
    _reflectionOcclusion = true;

    /** @private */
    _blendDistance = 1;

    /** @private */
    _enabled = true;

    /** @private */
    _uniformMin = new Float32Array(3);

    /** @private */
    _uniformMax = new Float32Array(3);

    /** @private */
    _uniformInvSize = new Float32Array(3);

    /** @private */
    _uniformCount = new Float32Array(3);

    /** @private */
    _uniformCellSize = new Float32Array(3);

    /** @private */
    _uniformParams = new Float32Array(4);

    /** @private */
    _uniformBlend = new Float32Array(3);

    /** @private */
    _uniformEncoding = new Float32Array(2);

    /** @private */
    _uniformVisibility = new Float32Array(4);

    /** @private */
    _uniformVisibilityInvSize = new Float32Array(2);

    /**
     * Create a new ProbeVolume instance.
     *
     * @param {GraphicsDevice} device - The graphics device.
     * @param {object} options - The options.
     * @param {BoundingBox} options.aabb - The box covered by the probes. It is divided into cells,
     * with a probe at the center of each cell, and typically matches the interior of a building or
     * a room, so that the probes light it up to its walls.
     * @param {number[]} options.resolution - The number of cells, and so of probes, along the x, y
     * and z axes, each at least 1.
     * @param {number} [options.format] - The pixel format of the probe texture, either
     * {@link PIXELFORMAT_RGBA16F} or {@link PIXELFORMAT_RGBA8}. 8-bit texels use half the memory,
     * but store the coefficients relative to L0, which the hardware filtering interpolates only
     * approximately. Defaults to {@link PIXELFORMAT_RGBA16F}.
     */
    constructor(device, options) {
        Debug.assert(options.resolution.every(count => Number.isInteger(count) && count >= 1), 'ProbeVolume: the resolution needs at least one probe on each axis.');

        this.device = device;
        this._aabb.copy(options.aabb);
        this._resolution = options.resolution.slice();
        this._format = options.format ?? PIXELFORMAT_RGBA16F;
        this._lightings = [new Float32Array(this.probeCount * FLOATS_PER_PROBE)];
        this._validity = new Uint8Array(this.probeCount).fill(1);

        // the chunk replaces the ambient modifier of the lit shaders, and applies to the materials
        // with the PROBE_VOLUME define, see applyToMaterial
        ShaderChunks.get(device, SHADERLANGUAGE_GLSL).set('ambientModifierPS', probeVolumeChunkGLSL);
        ShaderChunks.get(device, SHADERLANGUAGE_WGSL).set('ambientModifierPS', probeVolumeChunkWGSL);

        const [nx, ny, nz] = this._resolution;
        this._validityTexture = new Texture(device, {
            name: 'ProbeVolumeValidity',
            width: nx,
            height: ny,
            depth: nz,
            volume: true,
            format: PIXELFORMAT_RGBA8,
            mipmaps: false,
            minFilter: FILTER_NEAREST,
            magFilter: FILTER_NEAREST,
            addressU: ADDRESS_CLAMP_TO_EDGE,
            addressV: ADDRESS_CLAMP_TO_EDGE,
            addressW: ADDRESS_CLAMP_TO_EDGE
        });

        this._updateTexture();
        this._uploadValidity();
        this._updateVisibilityTexture();
        this._updateUniforms();
    }

    /**
     * Frees the textures of the volume.
     */
    destroy() {
        this._texture?.destroy();
        this._texture = null;
        this._captureTexture?.destroy();
        this._captureTexture = null;
        this._validityTexture?.destroy();
        this._validityTexture = null;
        this._visibilityTexture?.destroy();
        this._visibilityTexture = null;
    }

    /**
     * The box covered by the probes. Do not modify it.
     *
     * @type {BoundingBox}
     */
    get aabb() {
        return this._aabb;
    }

    /**
     * The number of probes along the x, y and z axes. Do not modify it.
     *
     * @type {number[]}
     */
    get resolution() {
        return this._resolution;
    }

    /**
     * The total number of probes.
     *
     * @type {number}
     */
    get probeCount() {
        const [nx, ny, nz] = this._resolution;
        return nx * ny * nz;
    }

    /**
     * The pixel format of the probe texture, see the constructor. It can be changed at any time,
     * which encodes the probes again from their data, without baking them again.
     *
     * @type {number}
     */
    set format(value) {
        if (this._format !== value) {
            this._format = value;
            this._updateTexture();
            this._updateUniforms();
        }
    }

    get format() {
        return this._format;
    }

    /**
     * The 3D texture holding the probes.
     *
     * @type {Texture}
     * @ignore
     */
    get texture() {
        return this._texture;
    }

    /**
     * The number of lightings of the volume, see {@link getData}. A volume has one lighting when
     * created, and {@link setData} adds more.
     *
     * @type {number}
     */
    get lightingCount() {
        return this._lightings.length;
    }

    /**
     * The index of the lighting the volume shows, see {@link lightingCount}. Defaults to 0.
     *
     * @type {number}
     * @example
     * // show the lighting baked at night
     * volume.activeLighting = 1;
     */
    set activeLighting(value) {
        Debug.assert(Number.isInteger(value) && value >= 0 && value < this._lightings.length, `ProbeVolume#activeLighting: no lighting ${value}.`);
        if (this._activeLighting !== value) {
            this._activeLighting = value;
            this._uploadData();
            this._updateUniforms();
        }
    }

    get activeLighting() {
        return this._activeLighting;
    }

    /**
     * Returns a lighting of the volume: the spherical harmonics of the probes, the L0 and the three
     * L1 coefficients (x, y and z) of the incoming radiance, for each of the red, green and blue
     * channels of each probe. Probes are ordered along x, then y, then z. Do not modify it, use
     * {@link setData} instead.
     *
     * @param {number} [index] - The index of the lighting, see {@link lightingCount}. Defaults to
     * 0.
     * @returns {Float32Array} The spherical harmonics of the probes.
     */
    getData(index = 0) {
        Debug.assert(index >= 0 && index < this._lightings.length, `ProbeVolume#getData: no lighting ${index}.`);
        return this._lightings[index];
    }

    /**
     * The validity of the probes, 1 for a valid probe and 0 for an invalid one, in the order of
     * the probes, see {@link getData}. Do not modify it.
     *
     * @type {Uint8Array}
     * @ignore
     */
    get validity() {
        return this._validity;
    }

    /**
     * The offsets of the positions the probes were captured at from their positions, three floats
     * for each probe in the order of the probes, see {@link getData}, or null if the probes were
     * captured at their positions. The probes are interpolated at their positions, while the leak
     * reduction and the visibility use the positions they were captured at, so that a probe moved
     * out of a wall counts as being on the side of the wall it was moved to. Do not modify it.
     *
     * @type {Float32Array|null}
     * @ignore
     */
    get offsets() {
        return this._offsets;
    }

    /**
     * Sets the offsets of the probes, see {@link offsets}, and uploads them. An offset is limited
     * to half a cell along each axis.
     *
     * @param {ArrayLike<number>|null} offsets - The offsets, or null.
     * @ignore
     */
    setOffsets(offsets) {
        this._offsets = offsets ? new Float32Array(offsets) : null;
        this._uploadValidity();
    }

    /**
     * The distance, in world units, a surface is offset along its normal when sampling the probes.
     * This reduces the darkening of the surfaces by the probes behind them. Defaults to 0.5.
     *
     * @type {number}
     */
    set normalBias(value) {
        this._normalBias = value;
        this._updateUniforms();
    }

    get normalBias() {
        return this._normalBias;
    }

    /**
     * The multiplier of the ambient lighting of the probes. Defaults to 1.
     *
     * @type {number}
     */
    set intensity(value) {
        this._intensity = value;
        this._updateUniforms();
    }

    get intensity() {
        return this._intensity;
    }

    /**
     * Whether to sharpen the lighting reconstructed from the L1 spherical harmonics of the probes,
     * which on their own give a soft, washed out result. A quadratic zonal harmonic along the
     * dominant direction of the light is estimated from how directional the L1 coefficients are
     * (ZH3, Roughton et al., I3D 2024), which brings the result close to L2 without storing more
     * data: the surfaces facing directional light get brighter, and the surfaces facing away from
     * it darker. Defaults to true.
     *
     * @type {boolean}
     */
    set shSharpening(value) {
        this._shSharpening = value;
        this._updateUniforms();
    }

    get shSharpening() {
        return this._shSharpening;
    }

    /**
     * Whether the surfaces ignore the invalid probes, and favor the probes in front of them over
     * the probes behind them, which reduces light leaking through walls. Defaults to true.
     *
     * @type {boolean}
     */
    set leakReduction(value) {
        this._leakReduction = value;
        this._updateUniforms();
    }

    get leakReduction() {
        return this._leakReduction;
    }

    /**
     * Whether the surfaces ignore the probes they are hidden from, using the visibility of the
     * probes, captured by the baker. For each of the eight probes around a surface, it bounds
     * the probability that the probe sees the surface, from the mean and the variance of the
     * distances the probe sees in its direction (Chebyshev's inequality, as in DDGI). This removes
     * most of the leaking through walls, at the cost of a filtered fetch for each of the probes.
     * Has no effect when the volume has no visibility. Defaults to true.
     *
     * @type {boolean}
     */
    set visibility(value) {
        this._useVisibility = value;
        this._updateUniforms();
    }

    get visibility() {
        return this._useVisibility;
    }

    /**
     * Whether the probes occlude the reflections of the environment where they are darker than
     * it, such as inside a closed room, which would otherwise reflect the sky. The reflections are
     * scaled by the ratio of the luminance of the ambient lighting of the probes to that of the
     * environment, up to 1. Defaults to true.
     *
     * @type {boolean}
     */
    set reflectionOcclusion(value) {
        this._reflectionOcclusion = value;
        this._updateUniforms();
    }

    get reflectionOcclusion() {
        return this._reflectionOcclusion;
    }

    /**
     * The visibility of the probes, see {@link setVisibility}, or null. Do not modify it.
     *
     * @type {Float32Array|null}
     * @ignore
     */
    get visibilityData() {
        return this._visibility;
    }

    /**
     * The number of texels along a side of the octahedral maps of the visibility of the probes, or
     * 0 without visibility.
     *
     * @type {number}
     * @ignore
     */
    get visibilitySize() {
        return this._visibilitySize;
    }

    /**
     * The distance, in world units, over which the ambient lighting blends from the probes to the
     * ambient of the environment outside of the box. Defaults to 1.
     *
     * @type {number}
     */
    set blendDistance(value) {
        this._blendDistance = value;
        this._updateUniforms();
    }

    get blendDistance() {
        return this._blendDistance;
    }

    /**
     * Whether the probes provide the ambient lighting. When disabled, the materials use the
     * ambient of the environment. Defaults to true.
     *
     * @type {boolean}
     */
    set enabled(value) {
        this._enabled = value;
        this._updateUniforms();
    }

    get enabled() {
        return this._enabled;
    }

    /**
     * Returns the world position of a probe, the center of its cell.
     *
     * @param {number} index - The index of the probe.
     * @param {Vec3} result - The vector receiving the position.
     * @returns {Vec3} The position.
     * @ignore
     */
    getProbePosition(index, result) {
        const [nx, ny, nz] = this._resolution;
        const ix = index % nx;
        const iy = Math.floor(index / nx) % ny;
        const iz = Math.floor(index / (nx * ny));

        const min = this._aabb.getMin();
        const max = this._aabb.getMax();
        return result.set(
            min.x + (max.x - min.x) * (ix + 0.5) / nx,
            min.y + (max.y - min.y) * (iy + 0.5) / ny,
            min.z + (max.z - min.z) * (iz + 0.5) / nz
        );
    }

    /**
     * Returns the size of the cells of the probes.
     *
     * @param {Vec3} result - The vector receiving the size.
     * @returns {Vec3} The size.
     * @ignore
     */
    getCellSize(result) {
        const [nx, ny, nz] = this._resolution;
        const size = this._aabb.halfExtents;
        return result.set(2 * size.x / nx, 2 * size.y / ny, 2 * size.z / nz);
    }

    /**
     * Sets a lighting of the volume, the spherical harmonics of the probes, see {@link getData} for
     * the layout. Setting the lighting at the index {@link lightingCount} adds a lighting. The
     * lighting shown, see {@link activeLighting}, is uploaded to the probe texture.
     *
     * @param {Float32Array} data - The spherical harmonics of the probes.
     * @param {number} [index] - The index of the lighting, up to {@link lightingCount}. Defaults
     * to 0.
     */
    setData(data, index = 0) {
        const lightings = this._lightings;
        Debug.assert(Number.isInteger(index) && index >= 0 && index <= lightings.length, `ProbeVolume#setData: the index ${index} is beyond the ${lightings.length} lightings.`);
        Debug.assert(data.length === lightings[0].length, `ProbeVolume#setData: expected ${lightings[0].length} floats, got ${data.length}.`);
        if (index === lightings.length) {
            lightings.push(new Float32Array(data.length));
        }
        lightings[index].set(data);
        this._hasData = true;
        if (index === this._activeLighting) {
            this._uploadData();
        }
        this._updateUniforms();
    }

    /**
     * Whether the probes were set, by {@link setData}, a bake or {@link ProbeVolume.deserialize}.
     * Until then, the volume shows the ambient lighting of the environment.
     *
     * @type {boolean}
     */
    get hasData() {
        return this._hasData;
    }

    /**
     * Sets the spherical harmonics of the probes the cameras of a bake capture with, which differ
     * from the probes shown while they are baked, see {@link useBakeData}. Null releases them.
     *
     * @param {Float32Array|null} data - The spherical harmonics of the probes, see {@link getData},
     * or null.
     * @ignore
     */
    setBakeData(data) {
        if (data) {
            Debug.assert(data.length === this._lightings[0].length, `ProbeVolume#setBakeData: expected ${this._lightings[0].length} floats, got ${data.length}.`);
            this._captureTexture ??= this._createProbeTexture('ProbeVolumeCapture', PIXELFORMAT_RGBA16F);
            this._encodeProbes(this._captureTexture, data, false);
        } else {
            this._captureTexture?.destroy();
            this._captureTexture = null;
            this._updateUniforms();
        }
    }

    /**
     * Binds the probes for the camera about to render: the probes set by {@link setBakeData}
     * for a camera of a bake, enabled and at their baked intensity, so that the settings of the
     * volume do not change the bake, and the probes of the volume for all other cameras.
     *
     * @param {boolean} capture - Whether the camera captures probes for a bake.
     * @ignore
     */
    useBakeData(capture) {
        const scope = this.device.scope;
        if (capture && this._captureTexture) {
            this._captureParams.set(this._uniformParams);
            this._captureParams[1] = 1;
            this._captureBlend.set(this._uniformBlend);
            this._captureBlend[1] = 1;
            scope.resolve('probeVolumeTexture').setValue(this._captureTexture);
            scope.resolve('probeVolumeEncoding').setValue(this._captureEncoding);
            scope.resolve('probeVolumeParams').setValue(this._captureParams);
            scope.resolve('probeVolumeBlend').setValue(this._captureBlend);
        } else {
            scope.resolve('probeVolumeTexture').setValue(this._texture);
            scope.resolve('probeVolumeEncoding').setValue(this._uniformEncoding);
            scope.resolve('probeVolumeParams').setValue(this._uniformParams);
            scope.resolve('probeVolumeBlend').setValue(this._uniformBlend);
        }
    }

    /**
     * Sets the validity of the probes, 1 for a valid probe and 0 for an invalid one, in the order
     * of the probes, see {@link getData}. Null makes all probes valid.
     *
     * @param {ArrayLike<number>|null} validity - The validity of the probes.
     * @ignore
     */
    setValidity(validity) {
        if (validity) {
            Debug.assert(validity.length === this.probeCount, `ProbeVolume#setValidity: expected ${this.probeCount} values, got ${validity.length}.`);
            for (let i = 0; i < validity.length; i++) {
                this._validity[i] = validity[i] ? 1 : 0;
            }
        } else {
            this._validity.fill(1);
        }
        this._uploadValidity();
    }

    /**
     * Sets the visibility of the probes, and uploads it. For each probe, in the order of the
     * probes, an octahedral map of the directions around the probe (Cigolle et al., JCGT
     * 2014), of size by size texels in rows along x, and for each texel, the mean and the mean
     * squared distance from the probe to the closest surface around its direction. Null removes
     * the visibility.
     *
     * @param {Float32Array|null} data - The visibility of the probes, two floats for each texel.
     * @param {number} [size] - The number of texels along a side of the octahedral maps.
     * @ignore
     */
    setVisibility(data, size = 0) {
        if (data) {
            Debug.assert(size > 0 && data.length === this.probeCount * size * size * 2, `ProbeVolume#setVisibility: expected ${this.probeCount * size * size * 2} floats, got ${data.length}.`);
            this._visibility = new Float32Array(data);
            this._visibilitySize = size;
        } else {
            this._visibility = null;
            this._visibilitySize = 0;
        }
        this._updateVisibilityTexture();
        this._updateUniforms();
    }

    /**
     * The number of invalid probes.
     *
     * @type {number}
     * @ignore
     */
    get invalidProbeCount() {
        let count = 0;
        for (let i = 0; i < this._validity.length; i++) {
            count += this._validity[i] ? 0 : 1;
        }
        return count;
    }

    /**
     * Applies the probe lighting to a material, which then takes its ambient lighting from the
     * probes, or removes it, so that the material takes its ambient lighting from the environment.
     * The material is lit by the probe volume active at the time, as a volume provides its data
     * through global uniforms. Call {@link Material#update} afterwards.
     *
     * @param {Material} material - The material.
     * @param {boolean} [apply] - True to apply the probe lighting, false to remove it. Defaults to
     * true.
     * @example
     * volume.applyToMaterial(material);
     * material.update();
     */
    applyToMaterial(material, apply = true) {
        material.setDefine('PROBE_VOLUME', apply);
    }

    /**
     * Serializes the placement, the validity, the offsets and the visibility of the probes, and
     * their lightings, see {@link ProbeVolume.deserialize}. The visibility is stored as half
     * floats. The data shared by the lightings comes first, followed by each lighting.
     *
     * @returns {ArrayBuffer} The serialized data.
     */
    serialize() {
        const probeCount = this.probeCount;
        const validityBytes = Math.ceil(probeCount / 4) * 4;
        const offsetsBytes = this._offsets ? this._offsets.byteLength : 0;
        const visibilityBytes = this._visibility ? 4 + this._visibility.length * 2 : 0;
        const lightingBytes = probeCount * FLOATS_PER_PROBE * 4;
        const buffer = new ArrayBuffer(HEADER_SIZE + validityBytes + offsetsBytes + visibilityBytes + lightingBytes * this._lightings.length);
        const header = new DataView(buffer, 0, HEADER_SIZE);
        const min = this._aabb.getMin();
        const max = this._aabb.getMax();

        header.setUint32(0, MAGIC, true);
        header.setUint32(4, VERSION, true);
        this._resolution.forEach((count, i) => header.setUint32(8 + i * 4, count, true));
        [min.x, min.y, min.z, max.x, max.y, max.z].forEach((value, i) => header.setFloat32(20 + i * 4, value, true));
        header.setUint32(44, FLOATS_PER_PROBE, true);
        header.setUint32(48, FLAG_VALIDITY | (this._offsets ? FLAG_OFFSETS : 0) | (this._visibility ? FLAG_VISIBILITY : 0), true);
        header.setUint32(52, this._lightings.length, true);

        let offset = HEADER_SIZE;
        new Uint8Array(buffer, offset, probeCount).set(this._validity);
        offset += validityBytes;
        if (this._offsets) {
            new Float32Array(buffer, offset, this._offsets.length).set(this._offsets);
            offset += offsetsBytes;
        }
        if (this._visibility) {
            new DataView(buffer, offset, 4).setUint32(0, this._visibilitySize, true);
            const halves = new Uint16Array(buffer, offset + 4, this._visibility.length);
            for (let i = 0; i < halves.length; i++) {
                halves[i] = FloatPacking.float2Half(this._visibility[i]);
            }
            offset += visibilityBytes;
        }

        // the lightings, after the data they share; the visibility, an even number of half floats,
        // keeps the floats aligned
        this._lightings.forEach((lighting) => {
            new Float32Array(buffer, offset, lighting.length).set(lighting);
            offset += lightingBytes;
        });
        return buffer;
    }

    /**
     * Creates a probe volume from data produced by {@link ProbeVolume#serialize}, with all its
     * lightings, showing the first one.
     *
     * @param {GraphicsDevice} device - The graphics device.
     * @param {ArrayBuffer} buffer - The serialized data.
     * @param {object} [options] - The options.
     * @param {number} [options.format] - The pixel format of the probe texture, see the
     * constructor.
     * @returns {ProbeVolume} The probe volume.
     */
    static deserialize(device, buffer, options = {}) {
        const header = new DataView(buffer, 0, HEADER_SIZE);
        Debug.assert(header.getUint32(0, true) === MAGIC && header.getUint32(4, true) === VERSION, 'ProbeVolume.deserialize: unknown data.');
        Debug.assert(header.getUint32(44, true) === FLOATS_PER_PROBE, 'ProbeVolume.deserialize: unsupported probe data.');

        const resolution = [0, 1, 2].map(i => header.getUint32(8 + i * 4, true));
        const v = [0, 1, 2, 3, 4, 5].map(i => header.getFloat32(20 + i * 4, true));
        const flags = header.getUint32(48, true);
        const lightingCount = header.getUint32(52, true);
        Debug.assert(lightingCount >= 1, 'ProbeVolume.deserialize: the data has no lighting.');
        const aabb = new BoundingBox();
        aabb.setMinMax(new Vec3(v[0], v[1], v[2]), new Vec3(v[3], v[4], v[5]));

        const volume = new ProbeVolume(device, { aabb, resolution, format: options.format });
        const probeCount = volume.probeCount;

        let offset = HEADER_SIZE;
        if (flags & FLAG_VALIDITY) {
            volume.setValidity(new Uint8Array(buffer, offset, probeCount));
            offset += Math.ceil(probeCount / 4) * 4;
        }
        if (flags & FLAG_OFFSETS) {
            volume.setOffsets(new Float32Array(buffer, offset, probeCount * 3));
            offset += probeCount * 3 * 4;
        }
        if (flags & FLAG_VISIBILITY) {
            const size = new DataView(buffer, offset, 4).getUint32(0, true);
            const halves = new Uint16Array(buffer, offset + 4, probeCount * size * size * 2);
            volume.setVisibility(Float32Array.from(halves, halfToFloat), size);
            offset += 4 + halves.byteLength;
        }
        for (let i = 0; i < lightingCount; i++) {
            volume.setData(new Float32Array(buffer, offset, probeCount * FLOATS_PER_PROBE), i);
            offset += probeCount * FLOATS_PER_PROBE * 4;
        }
        return volume;
    }

    /**
     * (Re)creates the probe texture in the current format, and uploads the probes to it.
     *
     * @private
     */
    _updateTexture() {
        this._texture?.destroy();
        this._texture = this._createProbeTexture('ProbeVolume', this._format);
        this._uploadData();
    }

    /**
     * Creates a texture holding the probes: three sub-volumes stacked along the depth, for the red,
     * green and blue channels.
     *
     * @param {string} name - The name of the texture.
     * @param {number} format - The pixel format of the texture.
     * @returns {Texture} The texture.
     * @private
     */
    _createProbeTexture(name, format) {
        const [nx, ny, nz] = this._resolution;
        return new Texture(this.device, {
            name,
            width: nx,
            height: ny,
            depth: nz * 3,
            volume: true,
            format,
            mipmaps: false,
            minFilter: FILTER_LINEAR,
            magFilter: FILTER_LINEAR,
            addressU: ADDRESS_CLAMP_TO_EDGE,
            addressV: ADDRESS_CLAMP_TO_EDGE,
            addressW: ADDRESS_CLAMP_TO_EDGE
        });
    }

    /**
     * Encodes the probes into the texels of the probe texture, and uploads them.
     *
     * @private
     */
    _uploadData() {
        const data = this._lightings[this._activeLighting];
        const eightBit = this._format === PIXELFORMAT_RGBA8;

        // 8-bit texels store L0 relative to the brightest L0 of the probes
        if (eightBit) {
            let maxL0 = 0;
            for (let i = 0; i < data.length; i += 4) {
                maxL0 = Math.max(maxL0, data[i]);
            }
            this._l0Scale = Math.max(maxL0, 1e-6);
        }

        this._encodeProbes(this._texture, data, eightBit);
    }

    /**
     * Encodes probes into the texels of a probe texture, and uploads them.
     *
     * @param {Texture} texture - The texture, see {@link _createProbeTexture}.
     * @param {Float32Array} data - The spherical harmonics of the probes, see {@link getData}.
     * @param {boolean} eightBit - Whether the texture stores 8-bit texels, relative to the scale of
     * L0, or half floats.
     * @private
     */
    _encodeProbes(texture, data, eightBit) {
        const [nx, ny, nz] = this._resolution;
        const probeCount = this.probeCount;

        const texels = texture.lock();
        for (let probe = 0; probe < probeCount; probe++) {
            const ix = probe % nx;
            const iy = Math.floor(probe / nx) % ny;
            const iz = Math.floor(probe / (nx * ny));

            for (let channel = 0; channel < 3; channel++) {
                const src = (probe * 3 + channel) * 4;
                const dst = (ix + nx * (iy + ny * (iz + nz * channel))) * 4;
                const l0 = data[src];

                if (eightBit) {
                    // sqrt(L0 / scale), and L1 relative to its largest possible magnitude, sqrt(3) * L0
                    const invL1 = l0 > 0 ? 1 / (SQRT3 * l0) : 0;
                    texels[dst] = Math.round(Math.sqrt(Math.max(l0, 0) / this._l0Scale) * 255);
                    for (let i = 1; i < 4; i++) {
                        const ratio = Math.min(Math.max(data[src + i] * invL1, -1), 1);
                        texels[dst + i] = Math.round((ratio * 0.5 + 0.5) * 255);
                    }
                } else {
                    for (let i = 0; i < 4; i++) {
                        texels[dst + i] = FloatPacking.float2Half(data[src + i]);
                    }
                }
            }
        }
        texture.unlock();
    }

    /**
     * Uploads, for each probe, in red, green and blue its offset, in units of its cell, each
     * component mapped from -0.5..0.5 to 1..255, with 128 for no offset, and in alpha the validity
     * of the eight probes of the cell it is the first corner of, as the bits of a byte. The probes
     * outside of the grid count as valid, as the cells at its border do not interpolate them.
     *
     * @private
     */
    _uploadValidity() {
        const texture = this._validityTexture;
        if (!texture) {
            return;
        }
        const [nx, ny, nz] = this._resolution;
        const validity = this._validity;
        const isValid = (x, y, z) => x >= nx || y >= ny || z >= nz || validity[x + nx * (y + ny * z)] !== 0;
        const offsets = this._offsets;
        const cellSize = this.getCellSize(new Vec3());
        const cell = [cellSize.x, cellSize.y, cellSize.z];

        const texels = texture.lock();
        for (let z = 0; z < nz; z++) {
            for (let y = 0; y < ny; y++) {
                for (let x = 0; x < nx; x++) {
                    const probe = x + nx * (y + ny * z);
                    let mask = 0;
                    for (let corner = 0; corner < 8; corner++) {
                        if (isValid(x + (corner & 1), y + ((corner >> 1) & 1), z + ((corner >> 2) & 1))) {
                            mask |= 1 << corner;
                        }
                    }
                    for (let axis = 0; axis < 3; axis++) {
                        const offset = offsets && cell[axis] > 0 ? offsets[probe * 3 + axis] / cell[axis] : 0;
                        texels[probe * 4 + axis] = 128 + Math.round(Math.max(-0.5, Math.min(0.5, offset)) * 254);
                    }
                    texels[probe * 4 + 3] = mask;
                }
            }
        }
        texture.unlock();
    }

    /**
     * (Re)creates the visibility texture, an atlas of the octahedral maps of the probes, each in a
     * tile with a border of one texel repeating the texels across the edges of the map, so that
     * the filtering wraps around them. Without visibility, the texture is a single texel.
     *
     * @private
     */
    _updateVisibilityTexture() {
        this._visibilityTexture?.destroy();

        const data = this._visibility;
        const size = this._visibilitySize;
        const tile = size + 2;
        const probeCount = this.probeCount;
        const tilesPerRow = data ? Math.ceil(Math.sqrt(probeCount)) : 1;
        const width = data ? tilesPerRow * tile : 1;
        const height = data ? Math.ceil(probeCount / tilesPerRow) * tile : 1;
        this._visibilityTilesPerRow = tilesPerRow;

        this._visibilityTexture = new Texture(this.device, {
            name: 'ProbeVolumeVisibility',
            width,
            height,
            format: PIXELFORMAT_RG16F,
            mipmaps: false,
            minFilter: FILTER_LINEAR,
            magFilter: FILTER_LINEAR,
            addressU: ADDRESS_CLAMP_TO_EDGE,
            addressV: ADDRESS_CLAMP_TO_EDGE
        });

        const texels = this._visibilityTexture.lock();
        if (data) {
            for (let probe = 0; probe < probeCount; probe++) {
                const x0 = (probe % tilesPerRow) * tile;
                const y0 = Math.floor(probe / tilesPerRow) * tile;
                for (let y = 0; y < tile; y++) {
                    for (let x = 0; x < tile; x++) {

                        // the texel of the map, which across an edge of the octahedral map is the
                        // texel mirrored along the edge
                        let i = x - 1;
                        let j = y - 1;
                        if (i < 0 || i >= size) {
                            i = i < 0 ? 0 : size - 1;
                            j = size - 1 - j;
                        }
                        if (j < 0 || j >= size) {
                            j = j < 0 ? 0 : size - 1;
                            i = size - 1 - i;
                        }

                        const src = ((probe * size + j) * size + i) * 2;
                        const dst = ((y0 + y) * width + x0 + x) * 2;
                        texels[dst] = FloatPacking.float2Half(data[src]);
                        texels[dst + 1] = FloatPacking.float2Half(data[src + 1]);
                    }
                }
            }
        }
        this._visibilityTexture.unlock();
    }

    /**
     * Sets the global uniforms the probe chunk reads.
     *
     * @private
     */
    _updateUniforms() {
        const scope = this.device.scope;
        const min = this._aabb.getMin();
        const max = this._aabb.getMax();
        const [nx, ny, nz] = this._resolution;

        this._uniformMin.set([min.x, min.y, min.z]);
        this._uniformMax.set([max.x, max.y, max.z]);

        // the inverse of the size of the box, zero along the axes of no extent
        const inverse = size => (size > 0 ? 1 / size : 0);
        this._uniformInvSize.set([inverse(max.x - min.x), inverse(max.y - min.y), inverse(max.z - min.z)]);
        this._uniformCount.set([nx, ny, nz]);
        this._uniformCellSize.set([(max.x - min.x) / nx, (max.y - min.y) / ny, (max.z - min.z) / nz]);
        this._uniformParams.set([this._normalBias, this._intensity, this._shSharpening ? 1 : 0, this._leakReduction ? 1 : 0]);
        this._uniformBlend.set([this._blendDistance > 0 ? 1 / this._blendDistance : 1e6, this._enabled && this._hasData ? 1 : 0, this._reflectionOcclusion ? 1 : 0]);
        this._uniformEncoding.set([this._format === PIXELFORMAT_RGBA8 ? 1 : 0, this._l0Scale]);

        const visibilityTexture = this._visibilityTexture;
        this._uniformVisibility.set([this._useVisibility && this._visibility ? 1 : 0, this._visibilityTilesPerRow, this._visibilitySize, 0]);
        this._uniformVisibilityInvSize.set([1 / visibilityTexture.width, 1 / visibilityTexture.height]);

        scope.resolve('probeVolumeTexture').setValue(this._texture);
        scope.resolve('probeVolumeValidity').setValue(this._validityTexture);
        scope.resolve('probeVolumeMin').setValue(this._uniformMin);
        scope.resolve('probeVolumeMax').setValue(this._uniformMax);
        scope.resolve('probeVolumeInvSize').setValue(this._uniformInvSize);
        scope.resolve('probeVolumeCount').setValue(this._uniformCount);
        scope.resolve('probeVolumeCellSize').setValue(this._uniformCellSize);
        scope.resolve('probeVolumeParams').setValue(this._uniformParams);
        scope.resolve('probeVolumeBlend').setValue(this._uniformBlend);
        scope.resolve('probeVolumeEncoding').setValue(this._uniformEncoding);
        scope.resolve('probeVolumeVisibility').setValue(visibilityTexture);
        scope.resolve('probeVolumeVisibilityParams').setValue(this._uniformVisibility);
        scope.resolve('probeVolumeVisibilityInvSize').setValue(this._uniformVisibilityInvSize);
    }
}

export { ProbeVolume, halfToFloat };
