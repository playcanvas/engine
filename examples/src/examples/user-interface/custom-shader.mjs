import * as pc from 'playcanvas';

/**
 * @typedef {{ 'shader.vert': string, 'shader.frag': string }} Files
 * @typedef {import('../../options.mjs').ExampleOptions<Files>} Options
 * @param {Options} options - The example options.
 * @returns {Promise<pc.AppBase>} The example application.
 */
async function example({ canvas, deviceType, files, assetPath, glslangPath, twgslPath }) {

    const assets = {
        "playcanvas": new pc.Asset("playcanvas", "texture", { url: assetPath + "textures/playcanvas.png" })
    };

    const gfxOptions = {
        deviceTypes: [deviceType],
        glslangUrl: glslangPath + 'glslang.js',
        twgslUrl: twgslPath + 'twgsl.js'
    };

    const device = await pc.createGraphicsDevice(canvas, gfxOptions);

    const createOptions = new pc.AppOptions();
    createOptions.graphicsDevice = device;
    createOptions.mouse = new pc.Mouse(document.body);
    createOptions.touch = new pc.TouchDevice(document.body);
    createOptions.elementInput = new pc.ElementInput(canvas);

    createOptions.componentSystems = [
        pc.RenderComponentSystem,
        pc.CameraComponentSystem,
        pc.ScreenComponentSystem,
        pc.ButtonComponentSystem,
        pc.ElementComponentSystem
    ];
    createOptions.resourceHandlers = [
        // @ts-ignore
        pc.TextureHandler,
        // @ts-ignore
        pc.FontHandler
    ];

    const app = new pc.AppBase(canvas);
    app.init(createOptions);

    // Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
    app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
    app.setCanvasResolution(pc.RESOLUTION_AUTO);

    // Ensure canvas is resized when window changes size
    const resize = () => app.resizeCanvas();
    window.addEventListener('resize', resize);
    app.on('destroy', () => {
        window.removeEventListener('resize', resize);
    });

    const assetListLoader = new pc.AssetListLoader(Object.values(assets), app.assets);
    assetListLoader.load(() => {

        app.start();

        // Create a camera
        const camera = new pc.Entity();
        camera.addComponent("camera", {
            clearColor: new pc.Color(30 / 255, 30 / 255, 30 / 255)
        });
        app.root.addChild(camera);

        // Create a 2D screen
        const screen = new pc.Entity();
        screen.addComponent("screen", {
            referenceResolution: new pc.Vec2(1280, 720),
            scaleBlend: 0.5,
            scaleMode: pc.SCALEMODE_BLEND,
            screenSpace: true
        });
        app.root.addChild(screen);

        // Create the shader from the vertex and fragment shader
        const shader = pc.createShaderFromCode(app.graphicsDevice, files['shader.vert'], files['shader.frag'], 'myUIShader', {
            vertex_position: pc.SEMANTIC_POSITION,
            vertex_texCoord0: pc.SEMANTIC_TEXCOORD0
        });

        // Create a new material with the new shader and additive alpha blending
        const material = new pc.Material();
        material.shader = shader;
        material.blendType = pc.BLEND_ADDITIVEALPHA;
        material.depthWrite = true;
        material.setParameter("uDiffuseMap", assets.playcanvas.resource);
        material.update();

        // Create the UI image element with the custom material
        const entity = new pc.Entity();
        entity.addComponent("element", {
            pivot: new pc.Vec2(0.5, 0.5),
            anchor: new pc.Vec4(0.5, 0.5, 0.5, 0.5),
            width: 350,
            height: 350,
            type: pc.ELEMENTTYPE_IMAGE
        });
        entity.element.material = material;
        screen.addChild(entity);

        // update the material's 'amount' parameter to animate the inverse effect
        let time = 0;
        app.on('update', (dt) => {
            time += dt;
            // animate the amount as a sine wave varying from 0 to 1
            material.setParameter("amount", (Math.sin(time * 4) + 1) * 0.5);
        });
    });
    return app;
}

class CustomShaderExample {
    static CATEGORY = 'User Interface';
    static WEBGPU_ENABLED = true;

    static FILES = {
        'shader.vert': /* glsl */`
/**
 * Simple Screen-Space Vertex Shader with one UV coordinate.
 * This shader is useful for simple UI shaders.
 * 
 * Usage: the following attributes must be configured when creating a new pc.Shader:
 *   vertex_position: pc.SEMANTIC_POSITION
 *   vertex_texCoord0: pc.SEMANTIC_TEXCOORD0
 */

// Default PlayCanvas uniforms
uniform mat4 matrix_viewProjection;
uniform mat4 matrix_model;

// Additional inputs
attribute vec3 vertex_position;
attribute vec2 vertex_texCoord0;

// Additional shader outputs
varying vec2 vUv0;

void main(void) {
    // UV is simply passed along as varying
    vUv0 = vertex_texCoord0;

    // Position for screen-space
    gl_Position = matrix_model * vec4(vertex_position, 1.0);
    gl_Position.zw = vec2(0.0, 1.0);
}`,
        'shader.frag': /* glsl */`
/**
 * Simple Color-Inverse Fragment Shader with intensity control.
 * 
 * Usage: the following parameters must be set:
 *   uDiffuseMap: image texture.
 *   amount: float that controls the amount of the inverse-color effect. 0 means none (normal color), while 1 means full inverse.
 *
 * Additionally, the Vertex shader that is paired with this Fragment shader must specify:
 *   varying vec2 vUv0: for the UV.
 */

// The following line is for setting the shader precision for floats. It is commented out because, ideally, it must be configured
// on a per-device basis before loading the Shader. Please check the accompanying TypeScript code and look for 'app.graphicsDevice.precision'.

// precision mediump float;

// Additional varying from vertex shader
varying vec2 vUv0;

// Custom Parameters (must be set from code via material.setParameter())
uniform sampler2D uDiffuseMap;
uniform float amount;

void main(void)
{
    vec4 color = texture2D(uDiffuseMap, vUv0);
    vec3 roloc = 1.0 - color.rgb;
    gl_FragColor = vec4(mix(color.rgb, roloc, amount), color.a);
}`
    };

    static example = example;
}

export { CustomShaderExample };
