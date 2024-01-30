import * as pc from 'playcanvas';

/**
 * @typedef {{ 'shader.vert': string, 'shader.frag': string }} Files
 * @typedef {import('../../options.mjs').ExampleOptions<Files>} Options
 * @param {Options} options - The example options.
 * @returns {Promise<pc.AppBase>} The example application.
 */
async function example({ canvas, deviceType, glslangPath, twgslPath, files, assetPath }) {
    const gfxOptions = {
        deviceTypes: [deviceType],
        glslangUrl: glslangPath + 'glslang.js',
        twgslUrl: twgslPath + 'twgsl.js'
    };

    const device = await pc.createGraphicsDevice(canvas, gfxOptions);
    const createOptions = new pc.AppOptions();
    createOptions.graphicsDevice = device;

    createOptions.componentSystems = [
        pc.RenderComponentSystem,
        pc.CameraComponentSystem
    ];
    createOptions.resourceHandlers = [
        // @ts-ignore
        pc.TextureHandler,
        // @ts-ignore
        pc.ContainerHandler,
    ];

    const app = new pc.AppBase(canvas);
    app.init(createOptions);

    const assets = {
        statue: new pc.Asset('statue', 'container', { url: assetPath + 'models/statue.glb' })
    };

    const assetListLoader = new pc.AssetListLoader(Object.values(assets), app.assets);
    assetListLoader.load(() => {

        // Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
        app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
        app.setCanvasResolution(pc.RESOLUTION_AUTO);

        // Ensure canvas is resized when window changes size
        const resize = () => app.resizeCanvas();
        window.addEventListener('resize', resize);
        app.on('destroy', () => {
            window.removeEventListener('resize', resize);
        });

        // Create an Entity with a camera component
        const camera = new pc.Entity();
        camera.addComponent("camera", {
            clearColor: new pc.Color(0.1, 0.1, 0.1)
        });
        camera.translate(0, 7, 24);

        // Add entity into scene hierarchy
        app.root.addChild(camera);
        app.start();

        // Create a new Entity
        const entity = assets.statue.resource.instantiateRenderEntity();
        app.root.addChild(entity);

        // Create the shader definition and shader from the vertex and fragment shaders
        const shader = pc.createShaderFromCode(app.graphicsDevice, files['shader.vert'], files['shader.frag'], 'myShader', {
            aPosition: pc.SEMANTIC_POSITION,
            aUv0: pc.SEMANTIC_TEXCOORD0
        });

        // Create a new material with the new shader
        const material = new pc.Material();
        material.shader = shader;

        // find all render components
        const renderComponents = entity.findComponents('render');

        // for all render components
        renderComponents.forEach(function (/** @type {pc.RenderComponent} */ render) {

            // For all meshes in the render component, assign new material
            render.meshInstances.forEach(function (meshInstance) {
                meshInstance.material = material;
            });

            // set it to render as points
            render.renderStyle = pc.RENDERSTYLE_POINTS;
        });

        let currentTime = 0;
        app.on("update", function (dt) {

            // Update the time and pass it to shader
            currentTime += dt;
            material.setParameter('uTime', currentTime);

            // Rotate the model
            entity.rotate(0, 15 * dt, 0);
        });
    });
    return app;
}

export class PointCloudExample {
    static CATEGORY = 'Graphics';
    static FILES = {
        'shader.vert': /* glsl */`
// Attributes per vertex: position
attribute vec4 aPosition;

uniform mat4   matrix_viewProjection;
uniform mat4   matrix_model;

// time
uniform float uTime;

// Color to fragment program
varying vec4 outColor;

void main(void)
{
    // Transform the geometry
    mat4 modelViewProj = matrix_viewProjection * matrix_model;
    gl_Position = modelViewProj * aPosition;

    // vertex in world space
    vec4 vertexWorld = matrix_model * aPosition;

    // use sine way to generate intensity value based on time and also y-coordinate of model
    float intensity = abs(sin(0.6 * vertexWorld.y + uTime * 1.0));

    // intensity smoothly drops to zero for smaller values than 0.9
    intensity = smoothstep(0.9, 1.0, intensity);

    // point size depends on intensity
    // WebGPU doesn't support setting gl_PointSize to anything besides a constant 1.0
    #ifndef WEBGPU
        gl_PointSize = clamp(12.0 * intensity, 1.0, 64.0);
    #endif

    // color mixes red and yellow based on intensity
    outColor = mix(vec4(1.0, 1.0, 0.0, 1.0), vec4(0.9, 0.0, 0.0, 1.0), intensity);
}`,
        'shader.frag': /* glsl */`
precision lowp float;
varying vec4 outColor;

void main(void)
{
    // just output color supplied by vertex shader
    gl_FragColor = outColor;
}`
    };
    static example = example;
}
