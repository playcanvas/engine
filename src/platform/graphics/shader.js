import { TRACEID_SHADER_ALLOC } from '../../core/constants.js';
import { Debug } from '../../core/debug.js';
import { platform } from '../../core/platform.js';
import { Preprocessor } from '../../core/preprocessor.js';
import { DebugGraphics } from './debug-graphics.js';

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
     * @type {import('./uniform-buffer-format.js').UniformBufferFormat}
     * @ignore
     */
    meshUniformBufferFormat;

    /**
     * Format of the bind group for the mesh bind group.
     *
     * @type {import('./bind-group-format.js').BindGroupFormat}
     * @ignore
     */
    meshBindGroupFormat;

    /**
     * Creates a new Shader instance.
     *
     * Consider {@link createShaderFromCode} as a simpler and more powerful way to create
     * a shader.
     *
     * @param {import('./graphics-device.js').GraphicsDevice} graphicsDevice - The graphics device
     * used to manage this shader.
     * @param {object} definition - The shader definition from which to build the shader.
     * @param {string} [definition.name] - The name of the shader.
     * @param {Object<string, string>} [definition.attributes] - Object detailing the mapping of
     * vertex shader attribute names to semantics SEMANTIC_*. This enables the engine to match
     * vertex buffer data as inputs to the shader. When not specified, rendering without
     * vertex buffer is assumed.
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
        } else {
            Debug.assert(definition.vshader, 'No vertex shader has been specified when creating a shader.');
            Debug.assert(definition.fshader, 'No fragment shader has been specified when creating a shader.');

            // pre-process shader sources
            definition.vshader = Preprocessor.run(definition.vshader, definition.vincludes);

            // Strip unused color attachments from fragment shader.
            // Note: this is only needed for iOS 15 on WebGL2 where there seems to be a bug where color attachments that are not
            // written to generate metal linking errors. This is fixed on iOS 16, and iOS 14 does not support WebGL2.
            const stripUnusedColorAttachments = graphicsDevice.isWebGL2 && (platform.name === 'osx' || platform.name === 'ios');
            definition.fshader = Preprocessor.run(definition.fshader, definition.fincludes, stripUnusedColorAttachments);
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
        return `Shader Id ${this.id} ${this.name}`;
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
