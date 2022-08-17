import { Debug } from '../../core/debug.js';
import { ShaderProcessor } from '../shader-processor.js';

/** @typedef {import('../graphics-device.js').GraphicsDevice} GraphicsDevice */
/** @typedef {import('../shader.js').Shader} Shader */

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
     * @param {Shader} shader - The shader.
     */
    constructor(shader) {
        /** @type {Shader} */
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
     * @param {Shader} shader - The shader to free.
     */
    destroy(shader) {
        this._vertexCode = null;
        this._fragmentCode = null;
    }

    process() {
        // process the shader source to allow for uniforms
        const processed = ShaderProcessor.run(this.shader.device, this.shader.definition);

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
     * Restore shader after the context has been obtained.
     *
     * @param {GraphicsDevice} device - The graphics device.
     * @param {Shader} shader - The shader to restore.
     */
    restoreContext(device, shader) {
    }
}

export { WebgpuShader };
