import bakeDirLmEndPS from './lightmapper/frag/bakeDirLmEnd.mjs';
import bakeLmEndPS from './lightmapper/frag/bakeLmEnd.mjs';
import dilatePS from './lightmapper/frag/dilate.mjs';
import bilateralDeNoisePS from './lightmapper/frag/bilateralDeNoise.mjs';

const shaderChunksLightmapper = {
    bakeDirLmEndPS,
    bakeLmEndPS,
    dilatePS,
    bilateralDeNoisePS
};

export { shaderChunksLightmapper };
