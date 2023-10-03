import { LitShaderOptions } from '../shader-lib/programs/lit-shader-options.js';

class LitMaterialOptions {
    // array of booleans indicating which UV channels are used by the material
    usedUvs;

    // custom shader chunk to be added to the shader
    shaderChunk;

    // lit options
    litOptions = new LitShaderOptions();
}

export { LitMaterialOptions };
