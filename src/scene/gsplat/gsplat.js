import { FloatPacking } from '../../core/math/float-packing.js';
import { math } from '../../core/math/math.js';
import { Quat } from '../../core/math/quat.js';
import { Vec2 } from '../../core/math/vec2.js';
import { Mat3 } from '../../core/math/mat3.js';
import {
    ADDRESS_CLAMP_TO_EDGE, FILTER_NEAREST, PIXELFORMAT_R16F, PIXELFORMAT_R32F, PIXELFORMAT_RGBA16F, PIXELFORMAT_RGBA32F,
    PIXELFORMAT_RGBA8, SEMANTIC_ATTR13, TYPE_FLOAT32, TYPE_UINT32
} from '../../platform/graphics/constants.js';
import { Texture } from '../../platform/graphics/texture.js';
import { VertexFormat } from '../../platform/graphics/vertex-format.js';
import { Vec3 } from '../../core/math/vec3.js';

const _tmpVecA = new Vec3();
const _tmpVecB = new Vec3();
const _tmpVecC = new Vec3();
const _m0 = new Vec3();
const _m1 = new Vec3();
const _m2 = new Vec3();
const _s = new Vec3();
const _r = new Vec3();

/** @ignore */
class GSplat {
    device;

    numSplats;

    /** @type {VertexFormat} */
    vertexFormat;

    /**
     * True if half format should be used, false is float format should be used or undefined if none
     * are available.
     *
     * @type {boolean|undefined}
     */
    halfFormat;

    /** @type {Texture} */
    colorTexture;

    /** @type {Texture} */
    transformATexture;

    /** @type {Texture} */
    transformBTexture;

    /** @type {Texture} */
    transformCTexture;

    /** @type {Float32Array} */
    centers;

    /** @type {import('../../core/shape/bounding-box.js').BoundingBox} */
    aabb;

    /**
     * @param {import('../../platform/graphics/graphics-device.js').GraphicsDevice} device - The graphics device.
     * @param {number} numSplats - Number of splats.
     * @param {import('../../core/shape/bounding-box.js').BoundingBox} aabb - The bounding box.
     */
    constructor(device, numSplats, aabb) {
        this.device = device;
        this.numSplats = numSplats;
        this.aabb = aabb;

        this.vertexFormat = new VertexFormat(device, [
            { semantic: SEMANTIC_ATTR13, components: 1, type: device.isWebGL1 ? TYPE_FLOAT32 : TYPE_UINT32, asInt: !device.isWebGL1 }
        ]);

        // create data textures if any format is available
        this.halfFormat = this.getTextureFormat(device, true);

        if (this.halfFormat !== undefined) {
            const size = this.evalTextureSize(numSplats);
            this.colorTexture = this.createTexture(device, 'splatColor', PIXELFORMAT_RGBA8, size);
            this.transformATexture = this.createTexture(device, 'transformA', this.halfFormat ? PIXELFORMAT_RGBA16F : PIXELFORMAT_RGBA32F, size);
            this.transformBTexture = this.createTexture(device, 'transformB', this.halfFormat ? PIXELFORMAT_RGBA16F : PIXELFORMAT_RGBA32F, size);
            this.transformCTexture = this.createTexture(device, 'transformC', this.halfFormat ? PIXELFORMAT_R16F : PIXELFORMAT_R32F, size);
        }
    }

    destroy() {
        this.colorTexture?.destroy();
        this.transformATexture?.destroy();
        this.transformBTexture?.destroy();
        this.transformCTexture?.destroy();
    }

    /**
     * @param {import('../materials/material.js').Material} material - The material to set up for
     * the splat rendering.
     */
    setupMaterial(material) {

        if (this.colorTexture) {
            material.setParameter('splatColor', this.colorTexture);
            material.setParameter('transformA', this.transformATexture);
            material.setParameter('transformB', this.transformBTexture);
            material.setParameter('transformC', this.transformCTexture);

            const { width, height } = this.colorTexture;
            material.setParameter('tex_params', new Float32Array([width, height, 1 / width, 1 / height]));
        }
    }

    /**
     * Evaluates the texture size needed to store a given number of elements.
     * The function calculates a width and height that is close to a square
     * that can contain 'count' elements.
     *
     * @param {number} count - The number of elements to store in the texture.
     * @returns {Vec2} An instance of Vec2 representing the width and height of the texture.
     */
    evalTextureSize(count) {
        const width = Math.ceil(Math.sqrt(count));
        const height = Math.ceil(count / width);
        return new Vec2(width, height);
    }

    /**
     * Creates a new texture with the specified parameters.
     *
     * @param {import('../../platform/graphics/graphics-device.js').GraphicsDevice} device - The graphics device to use for the texture creation.
     * @param {string} name - The name of the texture to be created.
     * @param {number} format - The pixel format of the texture.
     * @param {Vec2} size - The size of the texture in a Vec2 object, containing width (x) and height (y).
     * @returns {Texture} The created texture instance.
     */
    createTexture(device, name, format, size) {
        return new Texture(device, {
            name: name,
            width: size.x,
            height: size.y,
            format: format,
            cubemap: false,
            mipmaps: false,
            minFilter: FILTER_NEAREST,
            magFilter: FILTER_NEAREST,
            addressU: ADDRESS_CLAMP_TO_EDGE,
            addressV: ADDRESS_CLAMP_TO_EDGE
        });
    }

    /**
     * Gets the most suitable texture format based on device capabilities.
     *
     * @param {import('../../platform/graphics/graphics-device.js').GraphicsDevice} device - The graphics device.
     * @param {boolean} preferHighPrecision - True to prefer high precision when available.
     * @returns {boolean|undefined} True if half format should be used, false is float format should
     * be used or undefined if none are available.
     */
    getTextureFormat(device, preferHighPrecision) {

        // on WebGL1 R32F is not supported, always use half precision
        if (device.isWebGL1)
            preferHighPrecision = false;

        const halfSupported = device.extTextureHalfFloat && device.textureHalfFloatUpdatable;
        const floatSupported = device.extTextureFloat;

        // true if half format should be used, false is float format should be used or undefined if none are available.
        let halfFormat;
        if (preferHighPrecision) {
            if (floatSupported) {
                halfFormat = false;
            } else if (halfSupported) {
                halfFormat = true;
            }
        } else {
            if (halfSupported) {
                halfFormat = true;
            } else if (floatSupported) {
                halfFormat = false;
            }
        }

        return halfFormat;
    }

    /**
     * Updates pixel data of this.colorTexture based on the supplied color components and opacity.
     * Assumes that the texture is using an RGBA format where RGB are color components influenced
     * by SH spherical harmonics and A is opacity after a sigmoid transformation.
     *
     * @param {Float32Array} c0 - The first color component SH coefficients.
     * @param {Float32Array} c1 - The second color component SH coefficients.
     * @param {Float32Array} c2 - The third color component SH coefficients.
     * @param {Float32Array} opacity - The opacity values to be transformed using a sigmoid function.
     */
    updateColorData(c0, c1, c2, opacity) {
        const SH_C0 = 0.28209479177387814;
        const texture = this.colorTexture;
        if (!texture)
            return;
        const data = texture.lock();

        /**
         * Calculates the sigmoid of a given value.
         *
         * @param {number} v - The value for which to compute the sigmoid function.
         * @returns {number} The result of the sigmoid function.
         */
        const sigmoid = (v) => {
            if (v > 0) {
                return 1 / (1 + Math.exp(-v));
            }

            const t = Math.exp(v);
            return t / (1 + t);
        };

        for (let i = 0; i < this.numSplats; ++i) {

            // colors
            if (c0 && c1 && c2) {
                data[i * 4 + 0] = math.clamp((0.5 + SH_C0 * c0[i]) * 255, 0, 255);
                data[i * 4 + 1] = math.clamp((0.5 + SH_C0 * c1[i]) * 255, 0, 255);
                data[i * 4 + 2] = math.clamp((0.5 + SH_C0 * c2[i]) * 255, 0, 255);
            }

            // opacity
            data[i * 4 + 3] = opacity ? math.clamp(sigmoid(opacity[i]) * 255, 0, 255) : 255;
        }

        texture.unlock();
    }

    /**
     * @param {Float32Array} x - The array containing the 'x' component of the center points.
     * @param {Float32Array} y - The array containing the 'y' component of the center points.
     * @param {Float32Array} z - The array containing the 'z' component of the center points.
     * @param {Float32Array} rot0 - The array containing the 'x' component of quaternion rotations.
     * @param {Float32Array} rot1 - The array containing the 'y' component of quaternion rotations.
     * @param {Float32Array} rot2 - The array containing the 'z' component of quaternion rotations.
     * @param {Float32Array} rot3 - The array containing the 'w' component of quaternion rotations.
     * @param {Float32Array} scale0 - The first scale component associated with the x-dimension.
     * @param {Float32Array} scale1 - The second scale component associated with the y-dimension.
     * @param {Float32Array} scale2 - The third scale component associated with the z-dimension.
     */
    updateTransformData(x, y, z, rot0, rot1, rot2, rot3, scale0, scale1, scale2) {

        const { halfFormat } = this;
        const float2Half = FloatPacking.float2Half;

        if (!this.transformATexture)
            return;

        const dataA = this.transformATexture.lock();
        const dataB = this.transformBTexture.lock();
        const dataC = this.transformCTexture.lock();

        const quat = new Quat();
        const mat = new Mat3();
        const cA = new Vec3();
        const cB = new Vec3();

        for (let i = 0; i < this.numSplats; i++) {

            // rotation
            quat.set(rot0[i], rot1[i], rot2[i], rot3[i]).normalize();
            if (quat.w < 0) {
                quat.conjugate();
            }
            _r.set(quat.x, quat.y, quat.z);
            this.quatToMat3(_r, mat);

            // scale
            _s.set(
                Math.exp(scale0[i]),
                Math.exp(scale1[i]),
                Math.exp(scale2[i])
            );

            this.computeCov3d(mat, _s, cA, cB);

            if (halfFormat) {

                dataA[i * 4 + 0] = float2Half(x[i]);
                dataA[i * 4 + 1] = float2Half(y[i]);
                dataA[i * 4 + 2] = float2Half(z[i]);
                dataA[i * 4 + 3] = float2Half(cB.x);

                dataB[i * 4 + 0] = float2Half(cA.x);
                dataB[i * 4 + 1] = float2Half(cA.y);
                dataB[i * 4 + 2] = float2Half(cA.z);
                dataB[i * 4 + 3] = float2Half(cB.y);

                dataC[i] = float2Half(cB.z);

            } else {

                dataA[i * 4 + 0] = x[i];
                dataA[i * 4 + 1] = y[i];
                dataA[i * 4 + 2] = z[i];
                dataA[i * 4 + 3] = cB.x;

                dataB[i * 4 + 0] = cA.x;
                dataB[i * 4 + 1] = cA.y;
                dataB[i * 4 + 2] = cA.z;
                dataB[i * 4 + 3] = cB.y;

                dataC[i] = cB.z;
            }
        }

        this.transformATexture.unlock();
        this.transformBTexture.unlock();
        this.transformCTexture.unlock();
    }

    /**
     * Convert quaternion rotation stored in Vec3 to a rotation matrix.
     *
     * @param {Vec3} R - Rotation stored in Vec3.
     * @param {Mat3} mat - The output rotation matrix.
     */
    quatToMat3(R, mat) {
        const x = R.x;
        const y = R.y;
        const z = R.z;
        const w = Math.sqrt(1.0 - R.dot(R));

        const d = mat.data;
        d[0] = 1.0 - 2.0 * (z * z + w * w);
        d[1] = 2.0 * (y * z + x * w);
        d[2] = 2.0 * (y * w - x * z);

        d[3] = 2.0 * (y * z - x * w);
        d[4] = 1.0 - 2.0 * (y * y + w * w);
        d[5] = 2.0 * (z * w + x * y);

        d[6] = 2.0 * (y * w + x * z);
        d[7] = 2.0 * (z * w - x * y);
        d[8] = 1.0 - 2.0 * (y * y + z * z);
    }

    /**
     * Evaluate the covariance values based on the rotation and scale.
     *
     * @param {Mat3} rot - The rotation matrix.
     * @param {Vec3} scale - The scale.
     * @param {Vec3} covA - The first covariance vector.
     * @param {Vec3} covB - The second covariance vector.
     */
    computeCov3d(rot, scale, covA, covB) {

        // scaled rotation matrix axis
        const r0 = rot.getX(_tmpVecA).mulScalar(scale.x);
        const r1 = rot.getY(_tmpVecB).mulScalar(scale.y);
        const r2 = rot.getZ(_tmpVecC).mulScalar(scale.z);

        // transpose the [r0, r1, r2] matrix
        _m0.set(r0.x, r1.x, r2.x);
        _m1.set(r0.y, r1.y, r2.y);
        _m2.set(r0.z, r1.z, r2.z);

        covA.set(
            _m0.dot(_m0),
            _m0.dot(_m1),
            _m0.dot(_m2)
        );

        covB.set(
            _m1.dot(_m1),
            _m1.dot(_m2),
            _m2.dot(_m2)
        );
    }
}

export { GSplat };
