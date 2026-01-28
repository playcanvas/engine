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
        if (gsplatData.packedSh0) {
            this.streams.textures.set('packedSh0', gsplatData.packedSh0);
        }
        if (gsplatData.packedShN) {
            this.streams.textures.set('packedShN', gsplatData.packedShN);
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

        // Populate parameters map with dequantization uniforms
        this._populateParameters();
    }

    /**
     * @protected
     */
    _actualDestroy() {
        // Remove externally-owned textures without destroying them (they're owned by gsplatData)
        this.streams.textures.delete('packedTexture');
        this.streams.textures.delete('packedSh0');
        this.streams.textures.delete('packedShN');
        this.gsplatData.destroy();
        super._actualDestroy();
    }

    /**
     * Populates the parameters map with dequantization uniforms for SOG format.
     *
     * @private
     */
    _populateParameters() {
        const { meta } = this.gsplatData;

        // means
        if (meta.means) {
            this.parameters.set('means_mins', meta.means.mins);
            this.parameters.set('means_maxs', meta.means.maxs);
        }

        // scales, sh0, shN - version-dependent logic
        if (meta.version === 2) {
            ['scales', 'sh0', 'shN'].forEach((name) => {
                const v = meta[name];
                if (v) {
                    this.parameters.set(`${name}_mins`, v.codebook[0]);
                    this.parameters.set(`${name}_maxs`, v.codebook[255]);
                }
            });
        } else {
            ['scales', 'sh0'].forEach((name) => {
                const v = meta[name];
                if (v) {
                    this.parameters.set(`${name}_mins`, Math.min(...v.mins.slice(0, 3)));
                    this.parameters.set(`${name}_maxs`, Math.max(...v.maxs.slice(0, 3)));
                }
            });

            ['shN'].forEach((name) => {
                const v = meta[name];
                if (v) {
                    this.parameters.set(`${name}_mins`, v.mins);
                    this.parameters.set(`${name}_maxs`, v.maxs);
                }
            });
        }
    }

    configureMaterialDefines(defines) {
        defines.set('SH_BANDS', this.gsplatData.shBands);
    }
}

export { GSplatSogResource };
