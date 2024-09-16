import { FloatPacking } from '../../core/math/float-packing.js';
import { Quat } from '../../core/math/quat.js';
import { Vec2 } from '../../core/math/vec2.js';
import { Vec3 } from '../../core/math/vec3.js';
import { Mat3 } from '../../core/math/mat3.js';
import {
    ADDRESS_CLAMP_TO_EDGE, FILTER_NEAREST, PIXELFORMAT_RGBA16F, PIXELFORMAT_RGBA32U,
    PIXELFORMAT_RGBA8
} from '../../platform/graphics/constants.js';
import { Texture } from '../../platform/graphics/texture.js';
import { BoundingBox } from '../../core/shape/bounding-box.js';
import { createGSplatMaterial } from './gsplat-material.js';

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

    /** @type {BoundingBox} */
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
     * @param {GraphicsDevice} device - The graphics device.
     * @param {GSplatData} gsplatData - The splat data.
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
     * @returns {Material} material - The material to set up for the splat rendering.
     */
    createMaterial(options) {
        const result = createGSplatMaterial(options);
        result.setParameter('splatColor', this.colorTexture);
        result.setParameter('transformA', this.transformATexture);
        result.setParameter('transformB', this.transformBTexture);
        result.setParameter('tex_params', new Float32Array([this.numSplats, this.colorTexture.width, 0, 0]));
        if (this.hasSH) {
            result.setDefine('USE_SH1', true);
            result.setDefine('USE_SH2', true);
            result.setDefine('USE_SH3', true);
            result.setParameter('splatSH_1to3', this.sh1to3Texture);
            result.setParameter('splatSH_4to7', this.sh4to7Texture);
            result.setParameter('splatSH_8to11', this.sh8to11Texture);
            result.setParameter('splatSH_12to15', this.sh12to15Texture);
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
     * Updates pixel data of this.colorTexture based on the supplied color components and opacity.
     * Assumes that the texture is using an RGBA format where RGB are color components influenced
     * by SH spherical harmonics and A is opacity after a sigmoid transformation.
     *
     * @param {GSplatData} gsplatData - The source data
     */
    updateColorData(gsplatData) {
        const texture = this.colorTexture;
        if (!texture) {
            return;
        }
        const data = texture.lock();

        const cr = gsplatData.getProp('f_dc_0');
        const cg = gsplatData.getProp('f_dc_1');
        const cb = gsplatData.getProp('f_dc_2');
        const ca = gsplatData.getProp('opacity');

        const SH_C0 = 0.28209479177387814;

        for (let i = 0; i < this.numSplats; ++i) {
            const r = (cr[i] * SH_C0 + 0.5) * 255;
            const g = (cg[i] * SH_C0 + 0.5) * 255;
            const b = (cb[i] * SH_C0 + 0.5) * 255;
            const a = 255 / (1 + Math.exp(-ca[i]));

            data[i * 4 + 0] = r < 0 ? 0 : r > 255 ? 255 : r;
            data[i * 4 + 1] = g < 0 ? 0 : g > 255 ? 255 : g;
            data[i * 4 + 2] = b < 0 ? 0 : b > 255 ? 255 : b;
            data[i * 4 + 3] = a < 0 ? 0 : a > 255 ? 255 : a;
        }

        texture.unlock();
    }

    /**
     * @param {GSplatData} gsplatData - The source data
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
        const sx = scale.x;
        const sy = scale.y;
        const sz = scale.z;

        const data = rot.data;
        const r00 = data[0] * sx; const r01 = data[1] * sx; const r02 = data[2] * sx;
        const r10 = data[3] * sy; const r11 = data[4] * sy; const r12 = data[5] * sy;
        const r20 = data[6] * sz; const r21 = data[7] * sz; const r22 = data[8] * sz;

        covA.x = r00 * r00 + r10 * r10 + r20 * r20;
        covA.y = r00 * r01 + r10 * r11 + r20 * r21;
        covA.z = r00 * r02 + r10 * r12 + r20 * r22;

        covB.x = r01 * r01 + r11 * r11 + r21 * r21;
        covB.y = r01 * r02 + r11 * r12 + r21 * r22;
        covB.z = r02 * r02 + r12 * r12 + r22 * r22;
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

        const t11 = (1 << 11) - 1;
        const t10 = (1 << 10) - 1;
        const pack = (r, g, b) => {
            const rb = Math.floor(r * t11 + 0.5);
            const gb = Math.floor(g * t10 + 0.5);
            const bb = Math.floor(b * t11 + 0.5);

            return (rb < 0 ? 0 : rb > t11 ? t11 : rb) << 21 |
                   (gb < 0 ? 0 : gb > t10 ? t10 : gb) << 11 |
                   (bb < 0 ? 0 : bb > t11 ? t11 : bb);
        };

        const float32 = new Float32Array(1);
        const uint32 = new Uint32Array(float32.buffer);

        // coefficients
        const c = [
            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0
        ];

        for (let i = 0; i < gsplatData.numSplats; ++i) {
            // get coefficients
            for (let j = 0; j < 45; ++j) {
                c[j] = src[j][i];
            }

            // calculate maximum absolute value
            let m = Math.abs(c[0]);
            for (let j = 1; j < 45; ++j) {
                const as = Math.abs(c[j]);
                if (as > m) m = as;
            }

            if (m === 0) {
                continue;
            }

            // normalize
            for (let j = 0; j < 45; ++j) {
                c[j] = (c[j] / m) * 0.5 + 0.5;
            }

            // pack
            float32[0] = m;

            sh1to3Data[i * 4 + 0] = uint32[0];
            sh1to3Data[i * 4 + 1] = pack(c[0], c[15], c[30]);
            sh1to3Data[i * 4 + 2] = pack(c[1], c[16], c[31]);
            sh1to3Data[i * 4 + 3] = pack(c[2], c[17], c[32]);

            sh4to7Data[i * 4 + 0] = pack(c[3], c[18], c[33]);
            sh4to7Data[i * 4 + 1] = pack(c[4], c[19], c[34]);
            sh4to7Data[i * 4 + 2] = pack(c[5], c[20], c[35]);
            sh4to7Data[i * 4 + 3] = pack(c[6], c[21], c[36]);

            sh8to11Data[i * 4 + 0] = pack(c[7], c[22], c[37]);
            sh8to11Data[i * 4 + 1] = pack(c[8], c[23], c[38]);
            sh8to11Data[i * 4 + 2] = pack(c[9], c[24], c[39]);
            sh8to11Data[i * 4 + 3] = pack(c[10], c[25], c[40]);

            sh12to15Data[i * 4 + 0] = pack(c[11], c[26], c[41]);
            sh12to15Data[i * 4 + 1] = pack(c[12], c[27], c[42]);
            sh12to15Data[i * 4 + 2] = pack(c[13], c[28], c[43]);
            sh12to15Data[i * 4 + 3] = pack(c[14], c[29], c[44]);
        }

        this.sh1to3Texture.unlock();
        this.sh4to7Texture.unlock();
        this.sh8to11Texture.unlock();
        this.sh12to15Texture.unlock();
    }
}

export { GSplat };
