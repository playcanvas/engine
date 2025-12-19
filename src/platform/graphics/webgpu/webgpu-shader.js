import { Debug, DebugHelper } from '../../../core/debug.js';
import { StringIds } from '../../../core/string-ids.js';
import { SHADERLANGUAGE_WGSL } from '../constants.js';
import { DebugGraphics } from '../debug-graphics.js';
import { ShaderProcessorGLSL } from '../shader-processor-glsl.js';
import { WebgpuDebug } from './webgpu-debug.js';
import { WebgpuShaderProcessorWGSL } from './webgpu-shader-processor-wgsl.js';

/**
 * @import { GraphicsDevice } from '../graphics-device.js'
 * @import { Shader } from '../shader.js'
 */

// Shared StringIds instance for content-based compute shader keys
const computeShaderIds = new StringIds();

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
     * Cached content-based key for compute shader.
     *
     * @type {number|undefined}
     * @private
     */
    _computeKey;

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
     * @param {Shader} shader - The shader.
     */
    constructor(shader) {
        /** @type {Shader} */
        this.shader = shader;

        const definition = shader.definition;
        Debug.assert(definition);

        if (definition.shaderLanguage === SHADERLANGUAGE_WGSL) {

            if (definition.cshader) {

                this._computeCode = definition.cshader ?? null;
                this.computeUniformBufferFormats = definition.computeUniformBufferFormats;
                this.computeBindGroupFormat = definition.computeBindGroupFormat;
                if (definition.computeEntryPoint) {
                    this.computeEntryPoint = definition.computeEntryPoint;
                }

            } else {

                this.vertexEntryPoint = 'vertexMain';
                this.fragmentEntryPoint = 'fragmentMain';

                if (definition.processingOptions) {

                    this.processWGSL();

                } else {

                    this._vertexCode = definition.vshader ?? null;
                    this._fragmentCode = definition.fshader ?? null;

                    shader.meshUniformBufferFormat = definition.meshUniformBufferFormat;
                    shader.meshBindGroupFormat = definition.meshBindGroupFormat;
                }
            }

            shader.ready = true;

        } else {

            if (definition.processingOptions) {
                this.processGLSL();
            }
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

    createShaderModule(code, shaderType) {
        const device = this.shader.device;
        const wgpu = device.wgpu;

        WebgpuDebug.validate(device);

        const shaderModule = wgpu.createShaderModule({
            code: code
        });
        DebugHelper.setLabel(shaderModule, `${shaderType}:${this.shader.label}`);

        WebgpuDebug.endShader(device, shaderModule, code, 6, {
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

    processGLSL() {
        const shader = this.shader;

        // process the shader source to allow for uniforms
        const processed = ShaderProcessorGLSL.run(shader.device, shader.definition, shader);

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
        shader.attributes = processed.attributes;
    }

    processWGSL() {
        const shader = this.shader;

        // process the shader source to allow for uniforms
        const processed = WebgpuShaderProcessorWGSL.run(shader.device, shader.definition, shader);

        // keep reference to processed shaders in debug mode
        Debug.call(() => {
            this.processed = processed;
        });

        this._vertexCode = processed.vshader;
        this._fragmentCode = processed.fshader;

        shader.meshUniformBufferFormat = processed.meshUniformBufferFormat;
        shader.meshBindGroupFormat = processed.meshBindGroupFormat;
        shader.attributes = processed.attributes;
    }

    transpile(src, shaderType, originalSrc) {

        // make sure shader transpilers are available
        const device = this.shader.device;
        if (!device.glslang || !device.twgsl) {
            console.error(`Cannot transpile shader [${this.shader.label}] - shader transpilers (glslang/twgsl) are not available. Make sure to provide glslangUrl and twgslUrl when creating the device.`, {
                shader: this.shader
            });
            return null;
        }

        // transpile
        try {
            const spirv = device.glslang.compileGLSL(src, shaderType);
            const wgsl = device.twgsl.convertSpirV2WGSL(spirv);
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
     * Content-based key for compute shader caching. Returns the same key for identical
     * shader code and entry point combinations, regardless of how many Shader instances exist.
     *
     * @type {number}
     * @ignore
     */
    get computeKey() {
        if (this._computeKey === undefined) {
            const keyString = `${this._computeCode}|${this.computeEntryPoint}`;
            this._computeKey = computeShaderIds.get(keyString);
        }
        return this._computeKey;
    }

    /**
     * Dispose the shader when the context has been lost.
     */
    loseContext() {
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
