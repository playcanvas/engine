import { FloatPacking } from '../../core/math/float-packing.js';
import { Quat } from '../../core/math/quat.js';
import { Vec2 } from '../../core/math/vec2.js';
import { Vec3 } from '../../core/math/vec3.js';
import {
    PIXELFORMAT_RGBA16F, PIXELFORMAT_R32U, PIXELFORMAT_RGBA32U
} from '../../platform/graphics/constants.js';
import { GSplatResourceBase } from './gsplat-resource-base.js';

/**
 * @import { GSplatData } from './gsplat-data.js'
 * @import { GraphicsDevice } from '../../platform/graphics/graphics-device.js'
 * @import { Texture } from '../../platform/graphics/texture.js';
 * @import { Material } from '../materials/material.js'
 */

const getSHData = (gsplatData, numCoeffs) => {
    const result = [];
    for (let i = 0; i < numCoeffs; ++i) {
        result.push(gsplatData.getProp(`f_rest_${i}`));
    }
    return result;
};

/** @ignore */
class GSplatResource extends GSplatResourceBase {
    /** @type {Texture} */
    colorTexture;

    /** @type {Texture} */
    transformATexture;

    /** @type {Texture} */
    transformBTexture;

    /** @type {0 | 1 | 2 | 3} */
    shBands;

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
        super(device, gsplatData);

        const numSplats = gsplatData.numSplats;

        const size = this.evalTextureSize(numSplats);
        this.colorTexture = this.createTexture('splatColor', PIXELFORMAT_RGBA16F, size);
        this.transformATexture = this.createTexture('transformA', PIXELFORMAT_RGBA32U, size);
        this.transformBTexture = this.createTexture('transformB', PIXELFORMAT_RGBA16F, size);

        // write texture data
        this.updateColorData(gsplatData);
        this.updateTransformData(gsplatData);

        // initialize SH data
        this.shBands = gsplatData.shBands;
        if (this.shBands > 0) {
            this.sh1to3Texture = this.createTexture('splatSH_1to3', PIXELFORMAT_RGBA32U, size);
            if (this.shBands > 1) {
                this.sh4to7Texture = this.createTexture('splatSH_4to7', PIXELFORMAT_RGBA32U, size);
                if (this.shBands > 2) {
                    this.sh8to11Texture = this.createTexture('splatSH_8to11', PIXELFORMAT_RGBA32U, size);
                    this.sh12to15Texture = this.createTexture('splatSH_12to15', PIXELFORMAT_RGBA32U, size);
                } else {
                    this.sh8to11Texture = this.createTexture('splatSH_8to11', PIXELFORMAT_R32U, size);
                }
            }

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

    configureMaterial(material) {
        material.setParameter('splatColor', this.colorTexture);
        material.setParameter('transformA', this.transformATexture);
        material.setParameter('transformB', this.transformBTexture);
        material.setParameter('numSplats', this.numSplats);
        material.setDefine('SH_BANDS', this.shBands);
        if (this.sh1to3Texture) material.setParameter('splatSH_1to3', this.sh1to3Texture);
        if (this.sh4to7Texture) material.setParameter('splatSH_4to7', this.sh4to7Texture);
        if (this.sh8to11Texture) material.setParameter('splatSH_8to11', this.sh8to11Texture);
        if (this.sh12to15Texture) material.setParameter('splatSH_12to15', this.sh12to15Texture);
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
        const float2Half = FloatPacking.float2Half;
        const data = texture.lock();

        const cr = gsplatData.getProp('f_dc_0');
        const cg = gsplatData.getProp('f_dc_1');
        const cb = gsplatData.getProp('f_dc_2');
        const ca = gsplatData.getProp('opacity');

        const SH_C0 = 0.28209479177387814;

        for (let i = 0; i < this.numSplats; ++i) {
            const r = (cr[i] * SH_C0 + 0.5);
            const g = (cg[i] * SH_C0 + 0.5);
            const b = (cb[i] * SH_C0 + 0.5);
            const a = 1 / (1 + Math.exp(-ca[i]));

            data[i * 4 + 0] = float2Half(r);
            data[i * 4 + 1] = float2Half(g);
            data[i * 4 + 2] = float2Half(b);
            data[i * 4 + 3] = float2Half(a);
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

        for (let i = 0; i < this.numSplats; i++) {
            iter.read(i);

            r.normalize();
            if (r.w < 0) {
                r.mulScalar(-1);
            }

            dataAFloat32[i * 4 + 0] = p.x;
            dataAFloat32[i * 4 + 1] = p.y;
            dataAFloat32[i * 4 + 2] = p.z;
            dataA[i * 4 + 3] = float2Half(r.x) | (float2Half(r.y) << 16);

            dataB[i * 4 + 0] = float2Half(s.x);
            dataB[i * 4 + 1] = float2Half(s.y);
            dataB[i * 4 + 2] = float2Half(s.z);
            dataB[i * 4 + 3] = float2Half(r.z);
        }

        this.transformATexture.unlock();
        this.transformBTexture.unlock();
    }

    /**
     * @param {GSplatData} gsplatData - The source data
     */
    updateSHData(gsplatData) {
        const sh1to3Data = this.sh1to3Texture.lock();
        const sh4to7Data = this.sh4to7Texture?.lock();
        const sh8to11Data = this.sh8to11Texture?.lock();
        const sh12to15Data = this.sh12to15Texture?.lock();

        const numCoeffs = {
            1: 3,
            2: 8,
            3: 15
        }[this.shBands];

        const src = getSHData(gsplatData, numCoeffs * 3);

        const t11 = (1 << 11) - 1;
        const t10 = (1 << 10) - 1;

        const float32 = new Float32Array(1);
        const uint32 = new Uint32Array(float32.buffer);

        // coefficients
        const c = new Array(numCoeffs * 3).fill(0);

        for (let i = 0; i < gsplatData.numSplats; ++i) {
            // extract coefficients
            for (let j = 0; j < numCoeffs; ++j) {
                c[j * 3] = src[j][i];
                c[j * 3 + 1] = src[j + numCoeffs][i];
                c[j * 3 + 2] = src[j + numCoeffs * 2][i];
            }

            // calc maximum value
            let max = c[0];
            for (let j = 1; j < numCoeffs * 3; ++j) {
                max = Math.max(max, Math.abs(c[j]));
            }

            if (max === 0) {
                continue;
            }

            // normalize
            for (let j = 0; j < numCoeffs; ++j) {
                c[j * 3 + 0] = Math.max(0, Math.min(t11, Math.floor((c[j * 3 + 0] / max * 0.5 + 0.5) * t11 + 0.5)));
                c[j * 3 + 1] = Math.max(0, Math.min(t10, Math.floor((c[j * 3 + 1] / max * 0.5 + 0.5) * t10 + 0.5)));
                c[j * 3 + 2] = Math.max(0, Math.min(t11, Math.floor((c[j * 3 + 2] / max * 0.5 + 0.5) * t11 + 0.5)));
            }

            // pack
            float32[0] = max;

            sh1to3Data[i * 4 + 0] = uint32[0];
            sh1to3Data[i * 4 + 1] = c[0] << 21 | c[1] << 11 | c[2];
            sh1to3Data[i * 4 + 2] = c[3] << 21 | c[4] << 11 | c[5];
            sh1to3Data[i * 4 + 3] = c[6] << 21 | c[7] << 11 | c[8];

            if (this.shBands > 1) {
                sh4to7Data[i * 4 + 0] = c[9] << 21 | c[10] << 11 | c[11];
                sh4to7Data[i * 4 + 1] = c[12] << 21 | c[13] << 11 | c[14];
                sh4to7Data[i * 4 + 2] = c[15] << 21 | c[16] << 11 | c[17];
                sh4to7Data[i * 4 + 3] = c[18] << 21 | c[19] << 11 | c[20];

                if (this.shBands > 2) {
                    sh8to11Data[i * 4 + 0] = c[21] << 21 | c[22] << 11 | c[23];
                    sh8to11Data[i * 4 + 1] = c[24] << 21 | c[25] << 11 | c[26];
                    sh8to11Data[i * 4 + 2] = c[27] << 21 | c[28] << 11 | c[29];
                    sh8to11Data[i * 4 + 3] = c[30] << 21 | c[31] << 11 | c[32];

                    sh12to15Data[i * 4 + 0] = c[33] << 21 | c[34] << 11 | c[35];
                    sh12to15Data[i * 4 + 1] = c[36] << 21 | c[37] << 11 | c[38];
                    sh12to15Data[i * 4 + 2] = c[39] << 21 | c[40] << 11 | c[41];
                    sh12to15Data[i * 4 + 3] = c[42] << 21 | c[43] << 11 | c[44];
                } else {
                    sh8to11Data[i] = c[21] << 21 | c[22] << 11 | c[23];
                }
            }
        }

        this.sh1to3Texture.unlock();
        this.sh4to7Texture?.unlock();
        this.sh8to11Texture?.unlock();
        this.sh12to15Texture?.unlock();
    }
}

export { GSplatResource };
