import { Debug, DebugHelper } from '../../../core/debug.js';
import { SHADERLANGUAGE_WGSL } from '../constants.js';
import { DebugGraphics } from '../debug-graphics.js';

import { ShaderProcessor } from '../shader-processor.js';
import { WebgpuDebug } from './webgpu-debug.js';

/**
 * A WebGPU implementation of the Shader.
 *
 * @ignore
 */
class WebgpuShader {
    /**
     * Transpiled vertex shader code.
     *
     * @type {string|null}
     */
    _vertexCode = null;

    /**
     * Transpiled fragment shader code.
     *
     * @type {string|null}
     */
    _fragmentCode = null;

    /**
     * Compute shader code.
     *
     * @type {string|null}
     */
    _computeCode = null;

    /**
     * Name of the vertex entry point function.
     */
    vertexEntryPoint = 'main';

    /**
     * Name of the fragment entry point function.
     */
    fragmentEntryPoint = 'main';

    /**
     * Name of the compute entry point function.
     */
    computeEntryPoint = 'main';

    /**
     * @param {import('../shader.js').Shader} shader - The shader.
     */
    constructor(shader) {
        /** @type {import('../shader.js').Shader} */
        this.shader = shader;

        const definition = shader.definition;
        Debug.assert(definition);

        if (definition.shaderLanguage === SHADERLANGUAGE_WGSL) {

            this._vertexCode = definition.vshader ?? null;
            this._fragmentCode = definition.fshader ?? null;
            this._computeCode = definition.cshader ?? null;

            this.meshUniformBufferFormat = definition.meshUniformBufferFormat;
            this.meshBindGroupFormat = definition.meshBindGroupFormat;

            this.computeUniformBufferFormats = definition.computeUniformBufferFormats;
            this.computeBindGroupFormat = definition.computeBindGroupFormat;

            this.vertexEntryPoint = 'vertexMain';
            this.fragmentEntryPoint = 'fragmentMain';
            shader.ready = true;

        } else {

            if (definition.processingOptions) {
                this.process();
            }
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

    createShaderModule(code, shaderType) {
        const device = this.shader.device;
        const wgpu = device.wgpu;

        WebgpuDebug.validate(device);

        const shaderModule = wgpu.createShaderModule({
            code: code
        });
        DebugHelper.setLabel(shaderModule, `${shaderType}:${this.shader.label}`);

        WebgpuDebug.end(device, {
            shaderType,
            source: code,
            shader: this.shader
        });

        return shaderModule;
    }

    getVertexShaderModule() {
        return this.createShaderModule(this._vertexCode, 'Vertex');
    }

    getFragmentShaderModule() {
        return this.createShaderModule(this._fragmentCode, 'Fragment');
    }

    getComputeShaderModule() {
        return this.createShaderModule(this._computeCode, 'Compute');
    }

    process() {
        const shader = this.shader;

        // process the shader source to allow for uniforms
        const processed = ShaderProcessor.run(shader.device, shader.definition, shader);

        // keep reference to processed shaders in debug mode
        Debug.call(() => {
            this.processed = processed;
        });

        this._vertexCode = this.transpile(processed.vshader, 'vertex', shader.definition.vshader);
        this._fragmentCode = this.transpile(processed.fshader, 'fragment', shader.definition.fshader);

        if (!(this._vertexCode && this._fragmentCode)) {
            shader.failed = true;
        } else {
            shader.ready = true;
        }

        shader.meshUniformBufferFormat = processed.meshUniformBufferFormat;
        shader.meshBindGroupFormat = processed.meshBindGroupFormat;
    }

    transpile(src, shaderType, originalSrc) {
        try {
            const spirv = this.shader.device.glslang.compileGLSL(src, shaderType);
            const wgsl = this.shader.device.twgsl.convertSpirV2WGSL(spirv);
            return wgsl;
        } catch (err) {
            console.error(`Failed to transpile webgl ${shaderType} shader [${this.shader.label}] to WebGPU while rendering ${DebugGraphics.toString()}, error:\n [${err.stack}]`, {
                processed: src,
                original: originalSrc,
                shader: this.shader,
                error: err,
                stack: err.stack
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
