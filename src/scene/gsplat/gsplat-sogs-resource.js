import { Vec2 } from '../../core/math/vec2.js';
import { GSplatResourceBase } from './gsplat-resource-base.js';

class GSplatSogsResource extends GSplatResourceBase {
    destroy() {
        this.gsplatData.destroy();
        super.destroy();
    }

    configureMaterial(material) {
        const { gsplatData } = this;
        const { meta } = gsplatData;

        material.setDefine('GSPLAT_SOGS_DATA', true);
        material.setDefine('SH_BANDS', gsplatData.shBands);

        ['packedTexture', 'packedSh0', 'packedShN'].forEach((name) => {
            if (gsplatData[name]) {
                material.setParameter(name, gsplatData[name]);
            }
        });

        ['means'].forEach((name) => {
            const v = meta[name];
            if (v) {
                material.setParameter(`${name}_mins`, v.mins);
                material.setParameter(`${name}_maxs`, v.maxs);
            }
        });

        ['scales', 'sh0', 'shN'].forEach((name) => {
            const v = meta[name];
            if (v) {
                material.setParameter(`${name}_mins`, v.codebook[0]);
                material.setParameter(`${name}_maxs`, v.codebook[255]);
            }
        });
    }

    evalTextureSize(count) {
        return new Vec2(this.gsplatData.means_l.width, this.gsplatData.means_l.height);
    }
}

export { GSplatSogsResource };
