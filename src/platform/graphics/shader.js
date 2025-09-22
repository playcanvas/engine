import { TRACEID_SHADER_ALLOC } from '../../core/constants.js';
import { Debug } from '../../core/debug.js';
import { platform } from '../../core/platform.js';
import { Preprocessor } from '../../core/preprocessor.js';
import { SHADERLANGUAGE_GLSL, SHADERLANGUAGE_WGSL } from './constants.js';
import { DebugGraphics } from './debug-graphics.js';
import { ShaderDefinitionUtils } from './shader-definition-utils.js';

/**
 * @import { BindGroupFormat } from './bind-group-format.js'
 * @import { GraphicsDevice } from './graphics-device.js'
 * @import { UniformBufferFormat } from './uniform-buffer-format.js'
 */

let id = 0;

/**
 * A shader is a program that is responsible for rendering graphical primitives on a device's
 * graphics processor. The shader is generated from a shader definition. This shader definition
 * specifies the code for processing vertices and fragments processed by the GPU. The language of
 * the code is GLSL (or more specifically ESSL, the OpenGL ES Shading Language). The shader
 * definition also describes how the PlayCanvas engine should map vertex buffer elements onto the
 * attributes specified in the vertex shader code.
 *
 * @category Graphics
 */
class Shader {
    /**
     * Format of the uniform buffer for mesh bind group.
     *
     * @type {UniformBufferFormat}
     * @ignore
     */
    meshUniformBufferFormat;

    /**
     * Format of the bind group for the mesh bind group.
     *
     * @type {BindGroupFormat}
     * @ignore
     */
    meshBindGroupFormat;

    /**
     * The attributes that this shader code uses. The location is the key, the value is the name.
     * These attributes are queried / extracted from the final shader.
     *
     * @type {Map<number, string>}
     * @ignore
     */
    attributes = new Map();

    /**
     * Creates a new Shader instance.
     *
     * Consider {@link ShaderUtils#createShader} as a simpler and more powerful way to create
     * a shader.
     *
     * @param {GraphicsDevice} graphicsDevice - The graphics device used to manage this shader.
     * @param {object} definition - The shader definition from which to build the shader.
     * @param {string} [definition.name] - The name of the shader.
     * @param {Object<string, string>} [definition.attributes] - Object detailing the mapping of
     * vertex shader attribute names to semantics SEMANTIC_*. This enables the engine to match
     * vertex buffer data as inputs to the shader. When not specified, rendering without vertex
     * buffer is assumed.
     * @param {string[]} [definition.feedbackVaryings] - A list of shader output variable
     * names that will be captured when using transform feedback. This setting is only effective
     * if the {@link definition.useTransformFeedback} property is enabled.
     * @param {string} [definition.vshader] - Vertex shader source (GLSL code). Optional when
     * compute shader is specified.
     * @param {string} [definition.fshader] - Fragment shader source (GLSL code). Optional when
     * useTransformFeedback or compute shader is specified.
     * @param {string} [definition.cshader] - Compute shader source (WGSL code). Only supported on
     * WebGPU platform.
     * @param {Map<string, string>} [definition.vincludes] - A map containing key-value pairs of
     * include names and their content. These are used for resolving #include directives in the
     * vertex shader source.
     * @param {Map<string, string>} [definition.fincludes] - A map containing key-value pairs
     * of include names and their content. These are used for resolving #include directives in the
     * fragment shader source.
     * @param {Map<string, string>} [definition.cincludes] - A map containing key-value pairs
     * of include names and their content. These are used for resolving #include directives in the
     * compute shader source.
     * @param {boolean} [definition.useTransformFeedback] - Specifies that this shader outputs
     * post-VS data to a buffer.
     * @param {string | string[]} [definition.fragmentOutputTypes] - Fragment shader output types,
     * which default to vec4. Passing a string will set the output type for all color attachments.
     * Passing an array will set the output type for each color attachment.
     * @param {string} [definition.shaderLanguage] - Specifies the shader language of vertex and
     * fragment shaders. Defaults to {@link SHADERLANGUAGE_GLSL}.
     * @example
     * // Create a shader that renders primitives with a solid red color
     *
     * // Vertex shader
     * const vshader = `
     * attribute vec3 aPosition;
     *
     * void main(void) {
     *     gl_Position = vec4(aPosition, 1.0);
     * }
     * `;
     *
     * // Fragment shader
     * const fshader = `
     * precision ${graphicsDevice.precision} float;
     *
     * void main(void) {
     *     gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0);
     * }
     * `;
     *
     * const shaderDefinition = {
     *     attributes: {
     *         aPosition: pc.SEMANTIC_POSITION
     *     },
     *     vshader,
     *     fshader
     * };
     *
     * const shader = new pc.Shader(graphicsDevice, shaderDefinition);
     */
    constructor(graphicsDevice, definition) {
        this.id = id++;
        this.device = graphicsDevice;
        this.definition = definition;
        this.name = definition.name || 'Untitled';
        this.init();

        if (definition.cshader) {
            Debug.assert(graphicsDevice.supportsCompute, 'Compute shaders are not supported on this device.');
            Debug.assert(!definition.vshader && !definition.fshader, 'Vertex and fragment shaders are not supported when creating a compute shader.');

            // pre-process compute shader source
            definition.cshader = Preprocessor.run(definition.cshader, definition.cincludes, {
                sourceName: `compute shader for ${this.label}`,
                stripDefines: true
            });

        } else {
            Debug.assert(definition.vshader, 'No vertex shader has been specified when creating a shader.');
            Debug.assert(definition.fshader, 'No fragment shader has been specified when creating a shader.');

            // keep reference to unmodified shaders in debug mode
            Debug.call(() => {
                this.vUnmodified = definition.vshader;
                this.fUnmodified = definition.fshader;
            });

            const wgsl = definition.shaderLanguage === SHADERLANGUAGE_WGSL;

            // pre-process vertex shader source
            definition.vshader = Preprocessor.run(definition.vshader, definition.vincludes, {
                sourceName: `vertex shader for ${this.label}`,
                stripDefines: wgsl
            });

            // if no attributes are specified, try to extract the default names after the shader has been pre-processed
            if (definition.shaderLanguage === SHADERLANGUAGE_GLSL) {
                definition.attributes ??= ShaderDefinitionUtils.collectAttributes(definition.vshader);
            }

            // Strip unused color attachments from fragment shader.
            // Note: this is only needed for iOS 15 on WebGL2 where there seems to be a bug where color attachments that are not
            // written to generate metal linking errors. This is fixed on iOS 16, and iOS 14 does not support WebGL2.
            const stripUnusedColorAttachments = graphicsDevice.isWebGL2 && (platform.name === 'osx' || platform.name === 'ios');

            // pre-process fragment shader source
            definition.fshader = Preprocessor.run(definition.fshader, definition.fincludes, {
                stripUnusedColorAttachments,
                stripDefines: wgsl,
                sourceName: `fragment shader for ${this.label}`
            });

            if (!definition.vshader || !definition.fshader) {
                Debug.error(`Shader: Failed to create shader ${this.label}. Vertex or fragment shader source is empty.`, this);
                this.failed = true;
                return;
            }
        }

        this.impl = graphicsDevice.createShaderImpl(this);

        Debug.trace(TRACEID_SHADER_ALLOC, `Alloc: ${this.label}, stack: ${DebugGraphics.toString()}`, {
            instance: this
        });
    }

    /**
     * Initialize a shader back to its default state.
     *
     * @private
     */
    init() {
        this.ready = false;
        this.failed = false;
    }

    /** @ignore */
    get label() {
        return `Shader Id ${this.id} (${this.definition.shaderLanguage === SHADERLANGUAGE_WGSL ? 'WGSL' : 'GLSL'}) ${this.name}`;
    }

    /**
     * Frees resources associated with this shader.
     */
    destroy() {
        Debug.trace(TRACEID_SHADER_ALLOC, `DeAlloc: Id ${this.id} ${this.name}`);
        this.device.onDestroyShader(this);
        this.impl.destroy(this);
    }

    /**
     * Called when the WebGL context was lost. It releases all context related resources.
     *
     * @ignore
     */
    loseContext() {
        this.init();
        this.impl.loseContext();
    }

    /** @ignore */
    restoreContext() {
        this.impl.restoreContext(this.device, this);
    }
}

export { Shader };
