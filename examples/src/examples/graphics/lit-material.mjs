import * as pc from 'playcanvas';

/**
 * @param {import('../../options.mjs').ExampleOptions} options - The example options.
 * @returns {Promise<pc.AppBase>} The example application.
 */
async function example({ canvas, deviceType, assetPath, scriptsPath, glslangPath, twgslPath }) {

    const assets = {
        orbitCamera: new pc.Asset('script', 'script', { url: scriptsPath + 'camera/orbit-camera.js' }),
        helipad: new pc.Asset('helipad-env-atlas', 'texture', { url: assetPath + 'cubemaps/helipad-env-atlas.png' }, { type: pc.TEXTURETYPE_RGBP, mipmaps: false }),
        font: new pc.Asset('font', 'font', { url: assetPath + 'fonts/arial.json' }),
        color: new pc.Asset('color', 'texture', { url: assetPath + 'textures/seaside-rocks01-color.jpg' }),
        normal: new pc.Asset('normal', 'texture', { url: assetPath + 'textures/seaside-rocks01-normal.jpg' }),
        gloss: new pc.Asset('gloss', 'texture', { url: assetPath + 'textures/seaside-rocks01-gloss.jpg' })
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
        pc.LightComponentSystem,
        pc.ScriptComponentSystem,
        pc.ElementComponentSystem
    ];
    createOptions.resourceHandlers = [
        // @ts-ignore
        pc.TextureHandler,
        // @ts-ignore
        pc.ContainerHandler,
        // @ts-ignore
        pc.ScriptHandler,
        // @ts-ignore
        pc.JsonHandler,
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

        app.scene.envAtlas = assets.helipad.resource;

        // Create an Entity with a camera component
        const camera = new pc.Entity();
        camera.addComponent("camera", {
            clearColor: new pc.Color(0.4, 0.45, 0.5)
        });
        camera.addComponent("script");
        camera.script.create("orbitCamera", {
            attributes: {
                inertiaFactor: 0.2,
                distanceMin: 2,
                distanceMax: 15
            }
        });
        camera.script.create("orbitCameraInputMouse");
        camera.script.create("orbitCameraInputTouch");
        camera.translate(0, 1, 4);
        camera.lookAt(0, 0, 0);
        app.root.addChild(camera);

        // Create an Entity with a omni light component and a sphere model component.
        const light = new pc.Entity();
        light.addComponent("light", {
            type: "omni",
            color: pc.Color.WHITE,
            intensity: 1,
            range: 10
        });
        light.translate(0, 1, 0);
        app.root.addChild(light);

        const material = new pc.LitMaterial();
        material.setParameter("texture_envAtlas", assets.helipad.resource);
        material.setParameter("material_reflectivity", 1.0);
        material.setParameter("material_normalMapIntensity", 1.0);
        material.setParameter("texture_diffuseMap", assets.color.resource);
        material.setParameter("texture_glossMap", assets.gloss.resource);
        material.setParameter("texture_normalMap", assets.normal.resource);
        material.shadingModel = pc.SPECULAR_BLINN;
        material.useSkybox = true;
        material.hasSpecular = true;
        material.hasSpecularityFactor = true;
        material.hasNormals = true;
        material.hasMetalness = true;
        material.occludeSpecular = pc.SPECOCC_AO;

        const argumentsChunk = `
        uniform sampler2D texture_diffuseMap;
        uniform sampler2D texture_glossMap;
        uniform sampler2D texture_normalMap;
        uniform float material_normalMapIntensity;
        uniform vec3 material_specularRgb;
        void evaluateFrontend() {
            litArgs_emission = vec3(0, 0, 0);
            litArgs_metalness = 0.5;
            litArgs_specularity = material_specularRgb;
            litArgs_specularityFactor = 1.0;
            litArgs_gloss = texture2D(texture_glossMap, vUv0).r;

            litArgs_ior = 0.1;

            vec3 normalMap = texture2D(texture_normalMap, vUv0).xyz * 2.0 - 1.0;
            litArgs_worldNormal = normalize(dTBN * mix(vec3(0,0,1), normalMap, material_normalMapIntensity));
            litArgs_albedo = vec3(0.5) + texture2D(texture_diffuseMap, vUv0).xyz;

            litArgs_ao = 0.0;
            litArgs_opacity = 1.0;
        }`;
        material.shaderChunk = argumentsChunk;
        material.update();

        // create primitive
        const primitive = new pc.Entity();
        primitive.addComponent('render', {
            type: "sphere",
            material: material
        });

        // set position and scale and add it to scene
        app.root.addChild(primitive);

        let time = 0;
        app.on("update", function (/** @type {number} */dt) {
            time += dt;
            material.setParameter("material_specularRgb", [(Math.sin(time) + 1.0) * 0.5, (Math.cos(time * 0.5) + 1.0) * 0.5, (Math.sin(time * 0.7) + 1.0) * 0.5]);
            material.setParameter("material_normalMapIntensity", (Math.sin(time) + 1.0) * 0.5);
        });
    });
    return app;
}

class LitMaterialExample {
    static CATEGORY = 'Graphics';
    static HIDDEN = true;
    static WEBGPU_ENABLED = true;
    static example = example;
}

export { LitMaterialExample };
