import { TRACEID_SHADER_ALLOC } from '../../core/constants.js';
import { Debug } from '../../core/debug.js';
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
 */
class Shader {
    /**
     * Format of the uniform buffer for mesh bind group.
     *
     * @type {import('./uniform-buffer-format.js').UniformBufferFormat}
     */
    meshUniformBufferFormat;

    /**
     * Format of the bind group for the mesh bind group.
     *
     * @type {import('./bind-group-format.js').BindGroupFormat}
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
     * verex buffer is assumed.
     * @param {string} definition.vshader - Vertex shader source (GLSL code).
     * @param {string} [definition.fshader] - Fragment shader source (GLSL code). Optional when
     * useTransformFeedback is specified.
     * @param {boolean} [definition.useTransformFeedback] - Specifies that this shader outputs
     * post-VS data to a buffer.
     * @param {string} [definition.shaderLanguage] - Specifies the shader language of vertex and
     * fragment shaders. Defaults to {@link SHADERLANGUAGE_GLSL}.
     * @example
     * // Create a shader that renders primitives with a solid red color
     * var shaderDefinition = {
     *     attributes: {
     *         aPosition: pc.SEMANTIC_POSITION
     *     },
     *     vshader: [
     *         "attribute vec3 aPosition;",
     *         "",
     *         "void main(void)",
     *         "{",
     *         "    gl_Position = vec4(aPosition, 1.0);",
     *         "}"
     *     ].join("\n"),
     *     fshader: [
     *         "precision " + graphicsDevice.precision + " float;",
     *         "",
     *         "void main(void)",
     *         "{",
     *         "    gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0);",
     *         "}"
     *     ].join("\n")
     * };
     *
     * var shader = new pc.Shader(graphicsDevice, shaderDefinition);
     */
    constructor(graphicsDevice, definition) {
        this.id = id++;
        this.device = graphicsDevice;
        this.definition = definition;
        this.name = definition.name || 'Untitled';

        Debug.assert(definition.vshader, 'No vertex shader has been specified when creating a shader.');
        Debug.assert(definition.fshader, 'No fragment shader has been specified when creating a shader.');

        // pre-process shader sources
        definition.vshader = Preprocessor.run(definition.vshader);
        definition.fshader = Preprocessor.run(definition.fshader);

        this.init();

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

    restoreContext() {
        this.impl.restoreContext(this.device, this);
    }
}

export { Shader };
