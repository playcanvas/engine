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
     * Caller-provided bind group format (compute, group 0), or null if none was supplied.
     *
     * @type {import('../bind-group-format.js').BindGroupFormat|null}
     */
    computeBindGroupFormat = null;

    /**
     * Bind group format for resources auto-reflected from the compute shader source. Lives at
     * {@link computeReflectedGroupIndex}. Null when there is nothing to reflect.
     *
     * @type {import('../bind-group-format.js').BindGroupFormat|null}
     */
    computeReflectedBindGroupFormat = null;

    /**
     * Generated uniform buffer format holding the reflected loose uniforms, bound inside the
     * reflected bind group. Null when the shader declares no loose uniforms.
     *
     * @type {import('../uniform-buffer-format.js').UniformBufferFormat|null}
     */
    computeReflectedUniformBufferFormat = null;

    /**
     * Bind group index of the reflected resources (0 when no caller format, otherwise 1).
     *
     * @type {number}
     */
    computeReflectedGroupIndex = 0;

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

                if (definition.computeEntryPoint) {
                    this.computeEntryPoint = definition.computeEntryPoint;
                }

                this.processComputeWGSL();

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

    processComputeWGSL() {
        const shader = this.shader;
        const definition = shader.definition;

        // a caller-provided bind group format occupies group 0; otherwise reflected resources
        // start at group 0 (WebGPU pipeline layouts cannot have gaps)
        const callerBindGroupFormat = definition.computeBindGroupFormat ?? null;
        const reflectedGroupIndex = callerBindGroupFormat ? 1 : 0;

        // reflect simplified-syntax declarations into a separate bind group, leaving any
        // explicitly-bound resources (and the caller-provided format) untouched
        const processed = WebgpuShaderProcessorWGSL.runCompute(shader.device, definition.cshader, definition, shader, reflectedGroupIndex);

        // keep reference to processed shader in debug mode
        Debug.call(() => {
            this.processed = processed;
        });

        this._computeCode = processed.cshader;

        // caller-provided (group 0) resources
        this.computeBindGroupFormat = callerBindGroupFormat;
        this.computeUniformBufferFormats = definition.computeUniformBufferFormats;

        // reflected (engine-managed) resources and their generated uniform buffer
        this.computeReflectedGroupIndex = reflectedGroupIndex;
        this.computeReflectedBindGroupFormat = processed.computeBindGroupFormat;
        this.computeReflectedUniformBufferFormat = processed.computeUniformBufferFormat;
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
