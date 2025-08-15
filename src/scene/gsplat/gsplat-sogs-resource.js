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

        ['packedTexture', 'sh0', 'sh_centroids', 'sh_codebooks'].forEach((name) => {
            if (gsplatData[name]) {
                material.setParameter(name, gsplatData[name]);
            }
        });

        ['means', 'scales', 'sh0'].forEach((name) => {
            const v = gsplatData.meta[name];
            if (v) {
                material.setParameter(`${name}_mins`, v.mins);
                material.setParameter(`${name}_maxs`, v.maxs);
            }
        });

        material.setParameter('scales_codebook[0]', gsplatData.meta.scales.codebook);
        material.setParameter('opacity_codebook[0]', gsplatData.meta.sh0.opacityCodebook);
        material.setParameter('sh0_codebook[0]', gsplatData.meta.sh0.codebook);
    }

    evalTextureSize(count) {
        return new Vec2(this.gsplatData.means_l.width, this.gsplatData.means_l.height);
    }
}

export { GSplatSogsResource };
