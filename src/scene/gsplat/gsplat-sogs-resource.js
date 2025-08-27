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
        const { gsplatData } = this;
        const { meta } = gsplatData;

        this.configureMaterialDefines(material.defines);

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

        if (meta.version === 2) {
            ['scales', 'sh0', 'shN'].forEach((name) => {
                const v = meta[name];
                if (v) {
                    material.setParameter(`${name}_mins`, v.codebook[0]);
                    material.setParameter(`${name}_maxs`, v.codebook[255]);
                }
            });
        } else {
            ['scales', 'sh0'].forEach((name) => {
                const v = meta[name];
                if (v) {
                    material.setParameter(`${name}_mins`, Math.min(...v.mins.slice(0, 3)));
                    material.setParameter(`${name}_maxs`, Math.max(...v.maxs.slice(0, 3)));
                }
            });

            ['shN'].forEach((name) => {
                const v = meta[name];
                if (v) {
                    material.setParameter(`${name}_mins`, v.mins);
                    material.setParameter(`${name}_maxs`, v.maxs);
                }
            });
        }
    }

    evalTextureSize(count) {
        return new Vec2(this.gsplatData.means_l.width, this.gsplatData.means_l.height);
    }
}

export { GSplatSogsResource };
