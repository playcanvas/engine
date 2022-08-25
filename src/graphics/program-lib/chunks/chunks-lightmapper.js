import bakeDirLmEndPS from './lightmapper/frag/bakeDirLmEnd.js';
import bakeLmEndPS from './lightmapper/frag/bakeLmEnd.js';
import dilatePS from './lightmapper/frag/dilate.js';
import bilateralDeNoisePS from './lightmapper/frag/bilateralDeNoise.js';

const shaderChunksLightmapper = {
    bakeDirLmEndPS,
    bakeLmEndPS,
    dilatePS,
    bilateralDeNoisePS
};

export { shaderChunksLightmapper };
