import { Debug } from '../../../core/debug.js';

import { ShaderProcessor } from '../shader-processor.js';

/**
 * A WebGPU implementation of the Shader.
 *
 * @ignore
 */
class WebgpuShader {
    /**
     * Transpiled vertex shader code.
     *
     * @type {Uint32Array}
     */
    _vertexCode;

    /**
     * Transpiled fragment shader code.
     *
     * @type {Uint32Array}
     */
    _fragmentCode;

    /**
     * @param {import('../shader.js').Shader} shader - The shader.
     */
    constructor(shader) {
        /** @type {import('../shader.js').Shader} */
        this.shader = shader;

        const definition = shader.definition;
        Debug.assert(definition);

        if (definition.processingOptions) {
            this.process();
        }
    }

    /**
     * Free the WebGPU resources associated with a shader.
     *
     * @param {import('../shader.js').Shader} shader - The shader to free.
     */
    destroy(shader) {
        this._vertexCode = null;
        this._fragmentCode = null;
    }

    process() {
        // process the shader source to allow for uniforms
        const processed = ShaderProcessor.run(this.shader.device, this.shader.definition);

        // keep reference to processed shaders in debug mode
        Debug.call(() => {
            this.processed = processed;
        });

        this._vertexCode = this.transpile(processed.vshader, 'vertex', this.shader.definition.vshader);
        this._fragmentCode = this.transpile(processed.fshader, 'fragment', this.shader.definition.fshader);

        this.shader.meshUniformBufferFormat = processed.meshUniformBufferFormat;
        this.shader.meshBindGroupFormat = processed.meshBindGroupFormat;
    }

    transpile(src, shaderType, originalSrc) {
        try {
            return this.shader.device.glslang.compileGLSL(src, shaderType);
        } catch (err) {
            console.error(`Failed to transpile webgl ${shaderType} shader to WebGPU: [${err.message}]`, {
                processed: src,
                original: originalSrc
            });
        }
    }

    get vertexCode() {
        Debug.assert(this._vertexCode);
        return this._vertexCode;
    }

    get fragmentCode() {
        Debug.assert(this._fragmentCode);
        return this._fragmentCode;
    }

    /**
     * Dispose the shader when the context has been lost.
     */
    loseContext() {
    }

    /**
     * Restore shader after the context has been obtained.
     *
     * @param {import('../graphics-device.js').GraphicsDevice} device - The graphics device.
     * @param {import('../shader.js').Shader} shader - The shader to restore.
     */
    restoreContext(device, shader) {
    }
}

export { WebgpuShader };
