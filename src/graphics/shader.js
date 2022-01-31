/** @typedef {import('./graphics-device.js').GraphicsDevice} GraphicsDevice */

/**
 * A shader is a program that is responsible for rendering graphical primitives on a device's
 * graphics processor. The shader is generated from a shader definition. This shader definition
 * specifies the code for processing vertices and fragments processed by the GPU. The language of
 * the code is GLSL (or more specifically ESSL, the OpenGL ES Shading Language). The shader
 * definition also describes how the PlayCanvas engine should map vertex buffer elements onto the
 * attributes specified in the vertex shader code.
 */
class Shader {
    /* eslint-disable jsdoc/check-types */
    /**
     * Creates a new Shader instance.
     *
     * @param {GraphicsDevice} graphicsDevice - The graphics device used to manage this shader.
     * @param {object} definition - The shader definition from which to build the shader.
     * @param {Object.<string, string>} definition.attributes - Object detailing the mapping of
     * vertex shader attribute names to semantics SEMANTIC_*. This enables the engine to match
     * vertex buffer data as inputs to the shader.
     * @param {string} definition.vshader - Vertex shader source (GLSL code).
     * @param {string} definition.fshader - Fragment shader source (GLSL code).
     * @param {boolean} [definition.useTransformFeedback] - Specifies that this shader outputs
     * post-VS data to a buffer.
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
        this.device = graphicsDevice;
        this.definition = definition;

        this.init();

        this.device.createShader(this);
    }
    /* eslint-enable jsdoc/check-types */

    /**
     * Initialize a shader back to its default state.
     *
     * @private
     */
    init() {
        this.attributes = [];
        this.uniforms = [];
        this.samplers = [];

        this.ready = false;
        this.failed = false;
    }

    /**
     * Frees resources associated with this shader.
     */
    destroy() {
        this.device.destroyShader(this);
    }

    /**
     * Called when the WebGL context was lost. It releases all context related resources.
     *
     * @ignore
     */
    loseContext() {
        this.init();
    }
}

export { Shader };
