/**
 * @class
 * @name Shader
 * @classdesc A shader is a program that is responsible for rendering graphical primitives on a device's
 * graphics processor. The shader is generated from a shader definition. This shader definition specifies
 * the code for processing vertices and fragments processed by the GPU. The language of the code is GLSL
 * (or more specifically ESSL, the OpenGL ES Shading Language). The shader definition also describes how
 * the PlayCanvas engine should map vertex buffer elements onto the attributes specified in the vertex
 * shader code.
 * @description Creates a new shader object.
 * @param {GraphicsDevice} graphicsDevice - The graphics device used to manage this shader.
 * @param {object} definition - The shader definition from which to build the shader.
 * @param {object} definition.attributes - Object detailing the mapping of vertex shader attribute names
 * to semantics SEMANTIC_*. This enables the engine to match vertex buffer data as inputs to the
 * shader.
 * @param {string} definition.vshader - Vertex shader source (GLSL code).
 * @param {string} definition.fshader - Fragment shader source (GLSL code).
 * @param {boolean} [definition.useTransformFeedback] - Specifies that this shader outputs post-VS data to a buffer.
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
class Shader {
    constructor(graphicsDevice, definition) {
        this.device = graphicsDevice;
        this.definition = definition;

        this.init();

        this.device.createShader(this);
    }

    init() {
        this.attributes = [];
        this.uniforms = [];
        this.samplers = [];

        this.ready = false;
        this.failed = false;
    }

    /**
     * @function
     * @name Shader#destroy
     * @description Frees resources associated with this shader.
     */
    destroy() {
        this.device.destroyShader(this);
    }

    // called when context was lost, function releases all context related resources
    loseContext() {
        this.init();
    }
}

export { Shader };
