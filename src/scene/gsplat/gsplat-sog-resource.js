import { PIXELFORMAT_RGBA32U } from '../../platform/graphics/constants.js';
import { GSplatResourceBase } from './gsplat-resource-base.js';
import { GSplatFormat } from './gsplat-format.js';

class GSplatSogResource extends GSplatResourceBase {
    constructor(device, gsplatData) {
        super(device, gsplatData);

        // Set texture dimensions for splatTextureSize uniform and order texture creation
        // Use means_l if available, otherwise try packedTexture (for LOD assets)
        const sizeTexture = gsplatData.means_l || gsplatData.packedTexture;
        if (sizeTexture) {
            this.streams.textureDimensions.set(sizeTexture.width, sizeTexture.height);
        }

        // Add external textures to streams for auto-binding (textures are managed by gsplatData, not destroyed here)
        if (gsplatData.packedTexture) {
            this.streams.textures.set('packedTexture', gsplatData.packedTexture);
        }

        // Define streams for textures that use splatUV
        const streams = [
            { name: 'packedTexture', format: PIXELFORMAT_RGBA32U }
        ];

        // Create format with streams and shader chunk include
        // Note: We don't call streams.init() as textures are externally managed by gsplatData
        this._format = new GSplatFormat(device, streams, {
            readGLSL: '#include "gsplatSogVS"',
            readWGSL: '#include "gsplatSogVS"'
        });
    }

    destroy() {
        // Remove externally-owned textures without destroying them (they're owned by gsplatData)
        this.streams.textures.delete('packedTexture');
        this.gsplatData.destroy();
        super.destroy();
    }

    configureMaterialDefines(defines) {
        defines.set('SH_BANDS', this.gsplatData.shBands);
    }

    configureMaterial(material, workBufferModifier = null, formatDeclarations) {
        // Call base to inject format's shader chunks and bind textures from map
        super.configureMaterial(material, workBufferModifier, formatDeclarations);

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
}

export { GSplatSogResource };
