import { Vec2 } from '../../core/math/vec2.js';
import {
    ADDRESS_CLAMP_TO_EDGE, FILTER_NEAREST
} from '../../platform/graphics/constants.js';
import { Texture } from '../../platform/graphics/texture.js';
import { BoundingBox } from '../../core/shape/bounding-box.js';
import { createGSplatMaterial } from './gsplat-material.js';

class GSplatSogs {
    device;

    numSplats;

    numSplatsVisible;

    gsplatData;

    constructor(device, gsplatData) {
        this.device = device;
        this.gsplatData = gsplatData;

        const { meta } = gsplatData;

        this.numSplats = meta.means.shape[0];
        this.numSplatsVisible = this.numSplats;

        this.aabb = new BoundingBox();
        gsplatData.calcAabb(this.aabb);

        this.centers = new Float32Array(this.numSplats * 3);
        gsplatData.getCenters(this.centers);
    }

    destroy() {

    }

    createMaterial(options) {
        const { gsplatData } = this;

        const result = createGSplatMaterial(this.device, options);
        result.setDefine('GSPLAT_SOGS_DATA', true);
        result.setDefine('SH_BANDS', this.gsplatData.shBands);

        ['means_l', 'means_u', 'quats', 'scales', 'sh0', 'sh_centroids', 'sh_labels'].forEach((name) => {
            result.setParameter(name, gsplatData[name]);
        });

        ['means', 'scales', 'sh0', 'shN'].forEach((name) => {
            const v = gsplatData.meta[name];
            if (v) {
                result.setParameter(`${name}_mins`, v.mins);
                result.setParameter(`${name}_maxs`, v.maxs);
            }
        });

        return result;
    }

    evalTextureSize(count) {
        return new Vec2(this.gsplatData.means_l.width, this.gsplatData.means_l.height);
    }

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
}

export { GSplatSogs };
