import { Vec2 } from '../../core/math/vec2.js';
import { GSplatResourceBase } from './gsplat-resource-base.js';

class GSplatSogsResource extends GSplatResourceBase {
    destroy() {
        this.gsplatData.destroy();
        super.destroy();
    }

    configureMaterialDefines(defines) {
        defines.set('GSPLAT_SOGS_DATA', true);
        defines.set('SH_BANDS', this.gsplatData.shBands);
    }

    configureMaterial(material) {
        this.configureMaterialDefines(material.defines);

        const { gsplatData } = this;

        ['packedTexture', 'sh0', 'sh_centroids'].forEach((name) => {
            if (gsplatData[name]) {
                material.setParameter(name, gsplatData[name]);
            }
        });

        ['means', 'scales', 'sh0', 'shN'].forEach((name) => {
            const v = gsplatData.meta[name];
            if (v) {
                material.setParameter(`${name}_mins`, v.mins);
                material.setParameter(`${name}_maxs`, v.maxs);
            }
        });
    }

    evalTextureSize(count) {
        return new Vec2(this.gsplatData.means_l.width, this.gsplatData.means_l.height);
    }
}

export { GSplatSogsResource };
