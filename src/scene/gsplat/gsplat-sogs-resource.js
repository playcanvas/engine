import { Vec2 } from '../../core/math/vec2.js';
import { GSplatResourceBase } from './gsplat-resource-base.js';

class GSplatSogsResource extends GSplatResourceBase {
    destroy() {
        this.gsplatData.destroy();
        super.destroy();
    }

    configureMaterial(material) {
        const { gsplatData } = this;

        material.setDefine('GSPLAT_SOGS_DATA', true);
        material.setDefine('SH_BANDS', this.gsplatData.shBands);

        ['packedTexture', 'packedSh0', 'packedShN'].forEach((name) => {
            if (gsplatData[name]) {
                material.setParameter(name, gsplatData[name]);
            }
        });

        ['means'].forEach((name) => {
            const v = gsplatData.meta[name];
            if (v) {
                material.setParameter(`${name}_mins`, v.mins);
                material.setParameter(`${name}_maxs`, v.maxs);
            }
        });

        material.setParameter('scales_mins', gsplatData.meta.scales.codebook[0]);
        material.setParameter('scales_maxs', gsplatData.meta.scales.codebook[255]);

        material.setParameter('sh0_mins', gsplatData.meta.sh0.codebook[0]);
        material.setParameter('sh0_maxs', gsplatData.meta.sh0.codebook[255]);

        material.setParameter('shN_mins', gsplatData.meta.shN.codebook[0]);
        material.setParameter('shN_maxs', gsplatData.meta.shN.codebook[255]);

        material.setParameter('shN_mins', gsplatData.meta.shN.codebook[0]);
        material.setParameter('shN_maxs', gsplatData.meta.shN.codebook[255]);
    }

    evalTextureSize(count) {
        return new Vec2(this.gsplatData.means_l.width, this.gsplatData.means_l.height);
    }
}

export { GSplatSogsResource };
