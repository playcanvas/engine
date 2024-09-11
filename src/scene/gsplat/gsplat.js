import { FloatPacking } from '../../core/math/float-packing.js';
import { math } from '../../core/math/math.js';
import { Quat } from '../../core/math/quat.js';
import { Vec2 } from '../../core/math/vec2.js';
import { Vec3 } from '../../core/math/vec3.js';
import { Vec4 } from '../../core/math/vec4.js';
import { Mat3 } from '../../core/math/mat3.js';
import {
    ADDRESS_CLAMP_TO_EDGE, FILTER_NEAREST, PIXELFORMAT_RGBA16F, PIXELFORMAT_RGBA32U,
    PIXELFORMAT_RGBA8
} from '../../platform/graphics/constants.js';
import { Texture } from '../../platform/graphics/texture.js';
import { BoundingBox } from '../../core/shape/bounding-box.js';
import { createGSplatMaterial } from './gsplat-material.js';

const _tmpVecA = new Vec3();
const _tmpVecB = new Vec3();
const _tmpVecC = new Vec3();
const _m0 = new Vec3();
const _m1 = new Vec3();
const _m2 = new Vec3();

const getSHData = (gsplatData) => {
    const result = [];
    for (let i = 0; i < 45; ++i) {
        result.push(gsplatData.getProp(`f_rest_${i}`));
    }
    return result;
};

/** @ignore */
class GSplat {
    device;

    numSplats;

    /** @type {Float32Array} */
    centers;

    /** @type {import('../../core/shape/bounding-box.js').BoundingBox} */
    aabb;

    /** @type {Texture} */
    colorTexture;

    /** @type {Texture} */
    transformATexture;

    /** @type {Texture} */
    transformBTexture;

    /** @type {Boolean} */
    hasSH;

    /** @type {Texture | undefined} */
    sh1to3Texture;

    /** @type {Texture | undefined} */
    sh4to7Texture;

    /** @type {Texture | undefined} */
    sh8to11Texture;

    /** @type {Texture | undefined} */
    sh12to15Texture;

    /**
     * @param {import('../../platform/graphics/graphics-device.js').GraphicsDevice} device - The graphics device.
     * @param {import('./gsplat-data.js').GSplatData} gsplatData - The splat data.
     */
    constructor(device, gsplatData) {
        const numSplats = gsplatData.numSplats;

        this.device = device;
        this.numSplats = numSplats;

        this.centers = new Float32Array(gsplatData.numSplats * 3);
        gsplatData.getCenters(this.centers);

        this.aabb = new BoundingBox();
        gsplatData.calcAabb(this.aabb);

        const size = this.evalTextureSize(numSplats);
        this.colorTexture = this.createTexture('splatColor', PIXELFORMAT_RGBA8, size);
        this.transformATexture = this.createTexture('transformA', PIXELFORMAT_RGBA32U, size);
        this.transformBTexture = this.createTexture('transformB', PIXELFORMAT_RGBA16F, size);

        // write texture data
        this.updateColorData(gsplatData);
        this.updateTransformData(gsplatData);

        // initialize SH data
        this.hasSH = getSHData(gsplatData).every(x => x);
        if (this.hasSH) {
            this.sh1to3Texture = this.createTexture('splatSH_1to3', PIXELFORMAT_RGBA32U, size);
            this.sh4to7Texture = this.createTexture('splatSH_4to7', PIXELFORMAT_RGBA32U, size);
            this.sh8to11Texture = this.createTexture('splatSH_8to11', PIXELFORMAT_RGBA32U, size);
            this.sh12to15Texture = this.createTexture('splatSH_12to15', PIXELFORMAT_RGBA32U, size);

            this.updateSHData(gsplatData);
        }
    }

    destroy() {
        this.colorTexture?.destroy();
        this.transformATexture?.destroy();
        this.transformBTexture?.destroy();
        this.sh1to3Texture?.destroy();
        this.sh4to7Texture?.destroy();
        this.sh8to11Texture?.destroy();
        this.sh12to15Texture?.destroy();
    }

    /**
     * @returns {import('../materials/material.js').Material} material - The material to set up for
     * the splat rendering.
     */
    createMaterial(options) {
        const result = createGSplatMaterial({
            ...(this.hasSH ? { defines: ['USE_SH1', 'USE_SH2', 'USE_SH3'] } : {}),
            ...options
        });
        result.setParameter('splatColor', this.colorTexture);
        result.setParameter('transformA', this.transformATexture);
        result.setParameter('transformB', this.transformBTexture);
        result.setParameter('tex_params', new Float32Array([this.numSplats, this.colorTexture.width, 0, 0]));
        if (this.hasSH) {
            result.setParameter(`splatSH_1to3`, this.sh1to3Texture);
            result.setParameter(`splatSH_4to7`, this.sh4to7Texture);
            result.setParameter(`splatSH_8to11`, this.sh8to11Texture);
            result.setParameter(`splatSH_12to15`, this.sh12to15Texture);
        }
        return result;
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
     * @param {string} name - The name of the texture to be created.
     * @param {number} format - The pixel format of the texture.
     * @param {Vec2} size - The size of the texture in a Vec2 object, containing width (x) and height (y).
     * @returns {Texture} The created texture instance.
     */
    createTexture(name, format, size) {
        return new Texture(this.device, {
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
        if (device.isWebGL1) {
            preferHighPrecision = false;
        }

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
     * @param {import('./gsplat-data.js').GSplatData} gsplatData - The source data
     */
    updateColorData(gsplatData) {
        const texture = this.colorTexture;
        if (!texture) {
            return;
        }
        const data = texture.lock();

        const c = new Vec4();
        const iter = gsplatData.createIter(null, null, null, c);

        for (let i = 0; i < this.numSplats; ++i) {
            iter.read(i);

            data[i * 4 + 0] = math.clamp(c.x * 255, 0, 255);
            data[i * 4 + 1] = math.clamp(c.y * 255, 0, 255);
            data[i * 4 + 2] = math.clamp(c.z * 255, 0, 255);
            data[i * 4 + 3] = math.clamp(c.w * 255, 0, 255);
        }

        texture.unlock();
    }

    /**
     * @param {import('./gsplat-data.js').GSplatData} gsplatData - The source data
     */
    updateTransformData(gsplatData) {

        const float2Half = FloatPacking.float2Half;

        if (!this.transformATexture) {
            return;
        }

        const dataA = this.transformATexture.lock();
        const dataAFloat32 = new Float32Array(dataA.buffer);
        const dataB = this.transformBTexture.lock();

        const p = new Vec3();
        const r = new Quat();
        const s = new Vec3();
        const iter = gsplatData.createIter(p, r, s);

        const mat = new Mat3();
        const cA = new Vec3();
        const cB = new Vec3();

        for (let i = 0; i < this.numSplats; i++) {
            iter.read(i);

            r.normalize();
            mat.setFromQuat(r);

            this.computeCov3d(mat, s, cA, cB);

            dataAFloat32[i * 4 + 0] = p.x;
            dataAFloat32[i * 4 + 1] = p.y;
            dataAFloat32[i * 4 + 2] = p.z;
            dataA[i * 4 + 3] = float2Half(cB.x) | (float2Half(cB.y) << 16);

            dataB[i * 4 + 0] = float2Half(cA.x);
            dataB[i * 4 + 1] = float2Half(cA.y);
            dataB[i * 4 + 2] = float2Half(cA.z);
            dataB[i * 4 + 3] = float2Half(cB.z);
        }

        this.transformATexture.unlock();
        this.transformBTexture.unlock();
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

    /**
     * @param {import('./gsplat-data.js').GSplatData} gsplatData - The source data
     */
    updateSHData(gsplatData) {
        const sh1to3Data = this.sh1to3Texture.lock();
        const sh4to7Data = this.sh4to7Texture.lock();
        const sh8to11Data = this.sh8to11Texture.lock();
        const sh12to15Data = this.sh12to15Texture.lock();

        const src = getSHData(gsplatData);

        /**
         * @param {number} value 
         * @param {number} bits 
         * @returns number
         */
        const packUnorm = (value, bits) => {
            const t = (1 << bits) - 1;
            return Math.max(0, Math.min(t, Math.floor(value * t + 0.5)));
        };

        /**
         * @param {number} coef 
         * @param {number} idx 
         * @param {number} m 
         * @returns number
         */
        const pack = (coef, idx, m) => {
            const r = src[coef     ][idx] / m;
            const g = src[coef + 15][idx] / m;
            const b = src[coef + 30][idx] / m;

            return packUnorm(r * 0.5 + 0.5, 11) << 21 |
                   packUnorm(g * 0.5 + 0.5, 10) << 11 |
                   packUnorm(b * 0.5 + 0.5, 11);
        };

        const float32 = new Float32Array(1);
        const uint32 = new Uint32Array(float32.buffer);

        for (let i = 0; i < gsplatData.numSplats; ++i) {
            let m = Math.abs(src[0][i]);
            for (let j = 1; j < 45; ++j) {
                m = Math.max(m, Math.abs(src[j][i]));
            }

            if (m === 0) {
                continue;
            }

            float32[0] = m;

            sh1to3Data[i * 4 + 0] = uint32[0];
            sh1to3Data[i * 4 + 1] = pack(0, i, m);
            sh1to3Data[i * 4 + 2] = pack(1, i, m);
            sh1to3Data[i * 4 + 3] = pack(2, i, m);

            sh4to7Data[i * 4 + 0] = pack(3, i, m);
            sh4to7Data[i * 4 + 1] = pack(4, i, m);
            sh4to7Data[i * 4 + 2] = pack(5, i, m);
            sh4to7Data[i * 4 + 3] = pack(6, i, m);

            sh8to11Data[i * 4 + 0] = pack(7, i, m);
            sh8to11Data[i * 4 + 1] = pack(8, i, m);
            sh8to11Data[i * 4 + 2] = pack(9, i, m);
            sh8to11Data[i * 4 + 3] = pack(10, i, m);

            sh12to15Data[i * 4 + 0] = pack(11, i, m);
            sh12to15Data[i * 4 + 1] = pack(12, i, m);
            sh12to15Data[i * 4 + 2] = pack(13, i, m);
            sh12to15Data[i * 4 + 3] = pack(14, i, m);
        }

        this.sh1to3Texture.unlock();
        this.sh4to7Texture.unlock();
        this.sh8to11Texture.unlock();
        this.sh12to15Texture.unlock();
    }
}

export { GSplat };
