import { Vec2 } from '../../core/math/vec2.js';
import { createGSplatMaterial } from './gsplat-material.js';
import { GSplatResourceBase } from './gsplat-resource-base.js';

class GSplatSogsResource extends GSplatResourceBase {
    device;

    destroy() {
        this.gsplatData.destroy();
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
}

export { GSplatSogsResource };
