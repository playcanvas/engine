import * as pc from 'playcanvas';

/**
 * @typedef {{ 'shader.vert': string, 'shader.frag': string }} Files
 * @typedef {import('../../options.mjs').ExampleOptions<Files>} Options
 * @param {Options} options - The example options.
 * @returns {Promise<pc.AppBase>} The example application.
 */
async function example({ canvas, deviceType, files, assetPath, glslangPath, twgslPath }) {

    const assets = {
        'statue': new pc.Asset('statue', 'container', { url: assetPath + 'models/statue.glb' })
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
    createOptions.keyboard = new pc.Keyboard(document.body);

    createOptions.componentSystems = [
        pc.RenderComponentSystem,
        pc.CameraComponentSystem,
        pc.LightComponentSystem
    ];
    createOptions.resourceHandlers = [
        // @ts-ignore
        pc.TextureHandler,
        // @ts-ignore
        pc.ContainerHandler
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

        app.scene.ambientLight = new pc.Color(0.2, 0.2, 0.2);

        // Create an Entity with a camera component
        const camera = new pc.Entity();
        camera.addComponent("camera", {
            clearColor: new pc.Color(0.4, 0.45, 0.5)
        });
        camera.translate(0, 7, 25);

        // Create an Entity with a omni light component and a sphere model component.
        const light = new pc.Entity();
        light.addComponent("light", {
            type: "omni",
            color: new pc.Color(1, 1, 1),
            radius: 10
        });
        light.translate(0, 1, 0);

        // Add entities into scene hierarchy
        app.root.addChild(camera);
        app.root.addChild(light);

        // Create the shader from the vertex and fragment shaders
        const shader = pc.createShaderFromCode(app.graphicsDevice, files['shader.vert'], files['shader.frag'], 'myShader', {
            aPosition: pc.SEMANTIC_POSITION,
            aUv0: pc.SEMANTIC_TEXCOORD0
        });

        // Create a new material with the new shader
        const material = new pc.Material();
        material.shader = shader;

        // create a hierarchy of entities with render components, representing the statue model
        const entity = assets.statue.resource.instantiateRenderEntity();
        app.root.addChild(entity);

        /**
         * Set the new material on all meshes in the model, and use original texture from the model on the new material
         * @type {pc.Texture|null}
         */
        let originalTexture = null;
        /** @type {Array<pc.RenderComponent>} */
        const renders = entity.findComponents("render");
        renders.forEach((render) => {
            const meshInstances = render.meshInstances;
            for (let i = 0; i < meshInstances.length; i++) {
                const meshInstance = meshInstances[i];
                if (!originalTexture) {
                    /** @type {pc.StandardMaterial} */
                    const originalMaterial = meshInstance.material;
                    originalTexture = originalMaterial.diffuseMap;
                }
                meshInstance.material = material;
            }
        });

        // material is set up, update it
        material.setParameter('uDiffuseMap', originalTexture);
        material.update();

        let time = 0;
        app.on("update", function (dt) {
            time += dt;

            // set time parameter for the shader
            material.setParameter('uTime', time);
            material.update();
        });
    });
    return app;
}

export class ShaderWobbleExample {
    static CATEGORY = 'Graphics';
    static WEBGPU_ENABLED = true;

    static FILES = {
        'shader.vert': /* glsl */`
attribute vec3 aPosition;
attribute vec2 aUv0;

uniform mat4 matrix_model;
uniform mat4 matrix_viewProjection;
uniform float uTime;

varying vec2 vUv0;

void main(void)
{
    vec4 pos = matrix_model * vec4(aPosition, 1.0);
    pos.x += sin(uTime + pos.y * 4.0) * 0.1;
    pos.y += cos(uTime + pos.x * 4.0) * 0.1;
    vUv0 = aUv0;
    gl_Position = matrix_viewProjection * pos;
}`,
        'shader.frag': /* glsl */`
precision mediump float;

uniform sampler2D uDiffuseMap;

varying vec2 vUv0;

void main(void)
{
    gl_FragColor = texture2D(uDiffuseMap, vUv0);
}`
    };
    static example = example;
}
