import { Vec3 } from '../../core/math/vec3.js';
import { Quat } from '../../core/math/quat.js';
import { Color } from '../../core/math/color.js';
import { GSplatData } from './gsplat-data.js';

const SH_C0 = 0.28209479177387814;

const opacityToLogit = (v) => {
    if (v <= 0) return -40;
    if (v >= 1) return 40;
    return Math.log(v / (1 - v));
};

export class GSplatProcedural {
    /**
     * Create GSplatData from an image URL. This samples the image (optionally subsampled)
     * and creates one splat per non-transparent pixel.
     *
     * @param {object} opts - Options object
     * @param {string} opts.url - Image URL
     * @param {number} opts.splatRadius - Base radius/scale for each splat
     * @param {number} opts.subsample - Subsampling factor (integer >= 1)
     * @returns {Promise<GSplatData>} Promise resolving to GSplatData
     */
    static async generateImage(opts) {
        const { url: imageUrl, splatRadius = 1, subsample = 1 } = opts || {};
        if (!imageUrl) throw new Error('GSplatProcedural.generateImage: `url` is required');
        const subsampleVal = Math.max(1, Math.floor(subsample || 1));

        const loadImage = (src) => {
            return new Promise((resolve, reject) => {
                const imgEl = new Image();
                imgEl.crossOrigin = 'anonymous';
                imgEl.onload = () => resolve(imgEl);
                imgEl.onerror = () => reject(new Error(`Failed to load image: ${src}`));
                imgEl.src = src;
            });
        };

        const img = await loadImage(imageUrl);

        const srcW = img.width;
        const srcH = img.height;
        const destW = Math.max(1, Math.round(srcW / subsampleVal));
        const destH = Math.max(1, Math.round(srcH / subsampleVal));

        const canvas = document.createElement('canvas');
        canvas.width = destW;
        canvas.height = destH;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            throw new Error('Failed to create canvas context');
        }
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, destW, destH);

        const imgData = ctx.getImageData(0, 0, destW, destH);
        const rgba = imgData.data;

        const xArr = [];
        const yArr = [];
        const zArr = [];
        const scaleLog0 = [];
        const scaleLog1 = [];
        const scaleLog2 = [];
        const rotX = [];
        const rotY = [];
        const rotZ = [];
        const rotW = [];
        const fdcR = [];
        const fdcG = [];
        const fdcB = [];
        const opacityArr = [];

        const center = new Vec3();
        const scales = new Vec3();
        const quat = new Quat();
        const color = new Color();

        for (let y = 0; y < destH; ++y) {
            for (let x = 0; x < destW; ++x) {
                const off = (y * destW + x) * 4;
                const a = rgba[off + 3];
                if (a === 0) {
                    continue;
                }

                color.set(rgba[off + 0] / 255, rgba[off + 1] / 255, rgba[off + 2] / 255, 1);

                center.set(x - 0.5 * (destW - 1), 0.5 * (destH - 1) - y, 0);

                scales.set(splatRadius, splatRadius, splatRadius);
                quat.set(0, 0, 0, 1);

                xArr.push(center.x);
                yArr.push(center.y);
                zArr.push(center.z);

                scaleLog0.push(Math.log(scales.x));
                scaleLog1.push(Math.log(scales.y));
                scaleLog2.push(Math.log(scales.z));
                rotX.push(quat.x);
                rotY.push(quat.y);
                rotZ.push(quat.z);
                rotW.push(quat.w);

                fdcR.push((color.r - 0.5) / SH_C0);
                fdcG.push((color.g - 0.5) / SH_C0);
                fdcB.push((color.b - 0.5) / SH_C0);

                opacityArr.push(opacityToLogit(a / 255));
            }
        }

        const numSplats = xArr.length;

        const makeStorage = (arr) => {
            const out = new Float32Array(numSplats);
            for (let i = 0; i < numSplats; ++i) out[i] = arr[i] ?? 0;
            return out;
        };

        const properties = [
            { name: 'x', type: 'float', byteSize: 4, storage: makeStorage(xArr) },
            { name: 'y', type: 'float', byteSize: 4, storage: makeStorage(yArr) },
            { name: 'z', type: 'float', byteSize: 4, storage: makeStorage(zArr) },
            { name: 'f_dc_0', type: 'float', byteSize: 4, storage: makeStorage(fdcR) },
            { name: 'f_dc_1', type: 'float', byteSize: 4, storage: makeStorage(fdcG) },
            { name: 'f_dc_2', type: 'float', byteSize: 4, storage: makeStorage(fdcB) },
            { name: 'opacity', type: 'float', byteSize: 4, storage: makeStorage(opacityArr) },
            { name: 'scale_0', type: 'float', byteSize: 4, storage: makeStorage(scaleLog0) },
            { name: 'scale_1', type: 'float', byteSize: 4, storage: makeStorage(scaleLog1) },
            { name: 'scale_2', type: 'float', byteSize: 4, storage: makeStorage(scaleLog2) },
            { name: 'rot_0', type: 'float', byteSize: 4, storage: makeStorage(rotW) },
            { name: 'rot_1', type: 'float', byteSize: 4, storage: makeStorage(rotX) },
            { name: 'rot_2', type: 'float', byteSize: 4, storage: makeStorage(rotY) },
            { name: 'rot_3', type: 'float', byteSize: 4, storage: makeStorage(rotZ) }
        ];

        const elements = [
            {
                name: 'vertex',
                count: numSplats,
                properties
            }
        ];

        return new GSplatData(elements, []);
    }
}
