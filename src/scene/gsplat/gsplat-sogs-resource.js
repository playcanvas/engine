import { Vec2 } from '../../core/math/vec2.js';
import { PIXELFORMAT_RGBA32U } from '../../platform/graphics/constants.js';
import { GSplatResourceBase } from './gsplat-resource-base.js';
import { GSplatFormat } from './gsplat-format.js';

class GSplatSogsResource extends GSplatResourceBase {
    constructor(device, gsplatData) {
        super(device, gsplatData);

        // Set texture size for splatTextureSize uniform
        // Use means_l if available, otherwise try packedTexture (for LOD assets)
        const sizeTexture = gsplatData.means_l || gsplatData.packedTexture;
        this.textureSize = sizeTexture ? sizeTexture.width : 0;

        // Add textures to map for auto-binding (textures are managed by gsplatData)
        if (gsplatData.packedTexture) {
            this.textures.set('packedTexture', gsplatData.packedTexture);
        }

        // Define streams for textures that use splatUV
        const streams = [
            { name: 'packedTexture', format: PIXELFORMAT_RGBA32U }
        ];

        // Create format with streams and shader chunk include
        this.format = new GSplatFormat(device, streams, {
            readGLSL: '#include "gsplatSogsVS"',
            readWGSL: '#include "gsplatSogsVS"'
        });
    }

    destroy() {
        this.gsplatData.destroy();
        super.destroy();
    }

    configureMaterialDefines(defines) {
        defines.set('SH_BANDS', this.gsplatData.shBands);
    }

    configureMaterial(material) {
        // Call base to inject format's shader chunks and bind textures from map
        super.configureMaterial(material);

        const { gsplatData } = this;
        const { meta } = gsplatData;

        // packedTexture is handled via this.textures map in base class
        // Bind remaining textures that aren't in the map
        ['packedSh0', 'packedShN'].forEach((name) => {
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
        const tex = this.gsplatData.means_l || this.gsplatData.packedTexture;
        return tex ? new Vec2(tex.width, tex.height) : new Vec2(0, 0);
    }
}

export { GSplatSogsResource };
