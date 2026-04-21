import { Debug } from '../../core/debug.js';
import { PIXELFORMAT_RGBA8, PIXELFORMAT_RGBA32F } from '../../platform/graphics/constants.js';
import { GSplatResourceBase } from './gsplat-resource-base.js';
import { GSplatFormat } from './gsplat-format.js';

/**
 * @import { GSplatSogData } from './gsplat-sog-data.js'
 */

class GSplatSogResource extends GSplatResourceBase {
    constructor(device, gsplatData) {
        super(device, gsplatData);

        const { meta, means_l } = gsplatData;
        const isV2 = meta.version === 2;
        const hasSH = gsplatData.shBands > 0;

        // splat texture dimensions come from the source means_l texture - used for the
        // splatTextureSize uniform and for sizing the order texture
        if (means_l) {
            this.streams.textureDimensions.set(means_l.width, means_l.height);
        }

        // register externally-owned source textures for auto-binding (owned by gsplatData,
        // not destroyed here)
        this.streams.textures.set('means_l', gsplatData.means_l);
        this.streams.textures.set('means_u', gsplatData.means_u);
        this.streams.textures.set('quats', gsplatData.quats);
        this.streams.textures.set('scales', gsplatData.scales);
        this.streams.textures.set('sh0', gsplatData.sh0);
        if (hasSH) {
            this.streams.textures.set('sh_labels', gsplatData.sh_labels);
            this.streams.textures.set('sh_centroids', gsplatData.sh_centroids);
        }
        if (isV2) {
            // V2 always declares the sogCodebook stream below, so the texture must exist or the
            // streams system would auto-create a default (wrong-sized) RGBA32F texture at bind.
            // Callers must invoke gsplatData.prepareCodebook() before constructing the resource.
            Debug.assert(gsplatData.codebookTexture, 'GSplatSogResource: V2 asset is missing codebookTexture - prepareCodebook() must be called first.');
            this.streams.textures.set('sogCodebook', gsplatData.codebookTexture);
        }

        // declare streams matching the registered textures; formats drive generated uniform
        // declarations and load functions for the read shader chunk
        const streams = [
            { name: 'means_l', format: PIXELFORMAT_RGBA8 },
            { name: 'means_u', format: PIXELFORMAT_RGBA8 },
            { name: 'quats', format: PIXELFORMAT_RGBA8 },
            { name: 'scales', format: PIXELFORMAT_RGBA8 },
            { name: 'sh0', format: PIXELFORMAT_RGBA8 }
        ];
        if (hasSH) {
            streams.push({ name: 'sh_labels', format: PIXELFORMAT_RGBA8 });
            streams.push({ name: 'sh_centroids', format: PIXELFORMAT_RGBA8 });
        }
        if (isV2) {
            streams.push({ name: 'sogCodebook', format: PIXELFORMAT_RGBA32F });
        }

        // Create format with streams and shader chunk include
        // Note: We don't call streams.init() as textures are externally managed by gsplatData
        this._format = new GSplatFormat(device, streams, {
            readGLSL: '#include "gsplatSogVS"',
            readWGSL: '#include "gsplatSogVS"'
        });

        // Populate parameters map with dequantization uniforms
        this._populateParameters();
    }

    /** @protected */
    _actualDestroy() {
        // Remove externally-owned textures without destroying them (they're owned by gsplatData)
        this.streams.textures.delete('means_l');
        this.streams.textures.delete('means_u');
        this.streams.textures.delete('quats');
        this.streams.textures.delete('scales');
        this.streams.textures.delete('sh0');
        this.streams.textures.delete('sh_labels');
        this.streams.textures.delete('sh_centroids');
        this.streams.textures.delete('sogCodebook');
        /** @type {GSplatSogData} */ (this.gsplatData).destroy();
        super._actualDestroy();
    }

    /**
     * Populates the parameters map with dequantization uniforms.
     * V1 needs per-axis/component min/max ranges. V2 derives everything from the codebook LUT
     * texture so only the means min/max are required.
     *
     * @private
     */
    _populateParameters() {
        const { meta } = /** @type {GSplatSogData} */ (this.gsplatData);

        // means
        if (meta.means) {
            this.parameters.set('means_mins', meta.means.mins);
            this.parameters.set('means_maxs', meta.means.maxs);
        }

        if (meta.version !== 2) {
            // V1: upload full min/max arrays for linear dequantization
            if (meta.scales) {
                this.parameters.set('scales_mins', meta.scales.mins);
                this.parameters.set('scales_maxs', meta.scales.maxs);
            }
            if (meta.sh0) {
                this.parameters.set('sh0_mins', meta.sh0.mins);
                this.parameters.set('sh0_maxs', meta.sh0.maxs);
            }
            if (meta.shN) {
                this.parameters.set('shN_mins', meta.shN.mins);
                this.parameters.set('shN_maxs', meta.shN.maxs);
            }
        }
    }

    configureMaterialDefines(defines) {
        const gsplatData = /** @type {GSplatSogData} */ (this.gsplatData);
        defines.set('SH_BANDS', gsplatData.shBands);
        if (gsplatData.meta.version === 2) {
            defines.set('SOG_V2', '');
        }
    }
}

export { GSplatSogResource };
