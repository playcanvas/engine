import * as pc from 'playcanvas';

/**
 * @typedef {{ 'shader.vert': string, 'shader.frag': string }} Files
 * @typedef {import('../../options.mjs').ExampleOptions<Files>} Options
 * @param {Options} options - The example options.
 * @returns {Promise<pc.AppBase>} The example application.
 */
async function example({ canvas, deviceType, files, assetPath, glslangPath, twgslPath }) {

    const assets = {
        'statue': new pc.Asset('statue', 'container', { url: assetPath + 'models/statue.glb' }),
        'clouds': new pc.Asset('clouds', 'texture', { url: assetPath + 'textures/clouds.jpg' })
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
        camera.translate(0, 7, 24);

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
        material.setParameter('uHeightMap', assets.clouds.resource);

        // create a hierarchy of entities with render components, representing the statue model
        const entity = assets.statue.resource.instantiateRenderEntity();
        app.root.addChild(entity);

        /**
         * Set the new material on all meshes in the model, and use original texture from the model on the new material
         * @type {pc.Texture}
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
            time += 0.2 * dt;

            // reverse time
            let t = time % 2;
            if (t > 1) {
                t = 1 - (t - 1);
            }

            // set time parameter for the shader
            material.setParameter('uTime', t);
            material.update();
        });
    });
    return app;
}

export class ShaderBurnExample {
    static CATEGORY = 'Graphics';
    static WEBGPU_ENABLED = true;

    static FILES = {
        'shader.vert': /* glsl */`
attribute vec3 aPosition;
attribute vec2 aUv0;

uniform mat4 matrix_model;
uniform mat4 matrix_viewProjection;

varying vec2 vUv0;

void main(void)
{
    vUv0 = aUv0;
    gl_Position = matrix_viewProjection * matrix_model * vec4(aPosition, 1.0);
}`,
        'shader.frag': /* glsl */`
precision mediump float;

varying vec2 vUv0;

uniform sampler2D uDiffuseMap;
uniform sampler2D uHeightMap;
uniform float uTime;

void main(void)
{
    float height = texture2D(uHeightMap, vUv0).r;
    vec4 color = texture2D(uDiffuseMap, vUv0);
    if (height < uTime) {
    discard;
    }
    if (height < (uTime + uTime * 0.1)) {
    color = vec4(1.0, 0.2, 0.0, 1.0);
    }
    gl_FragColor = color;
}`
    };
    static example = example;
}
