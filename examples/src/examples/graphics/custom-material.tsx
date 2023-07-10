import * as pc from '../../../../';
class CustomMaterialExample {
    static CATEGORY = 'Graphics';
    static NAME = 'Custom Material';
    static WEBGPU_ENABLED = true;

    example(canvas: HTMLCanvasElement, deviceType: string): void {

        const gfxOptions = {
            deviceTypes: [deviceType],
            glslangUrl: '/static/lib/glslang/glslang.js',
            twgslUrl: '/static/lib/twgsl/twgsl.js'
        };

        const assets = {
            orbitCamera: new pc.Asset('script', 'script', { url: '/static/scripts/camera/orbit-camera.js' }),
            helipad: new pc.Asset('helipad-env-atlas', 'texture', { url: '/static/assets/cubemaps/helipad-env-atlas.png' }, { type: pc.TEXTURETYPE_RGBP }),
            font: new pc.Asset('font', 'font', { url: '/static/assets/fonts/arial.json' }),
            color: new pc.Asset('color', 'texture', { url: '/static/assets/textures/seaside-rocks01-color.jpg' }),
            normal: new pc.Asset('normal', 'texture', { url: '/static/assets/textures/seaside-rocks01-normal.jpg' }),
            gloss: new pc.Asset('gloss', 'texture', { url: '/static/assets/textures/seaside-rocks01-gloss.jpg' })
        };

        pc.createGraphicsDevice(canvas, gfxOptions).then((device: pc.GraphicsDevice) => {

            const createOptions = new pc.AppOptions();
            createOptions.graphicsDevice = device;
            createOptions.mouse = new pc.Mouse(document.body);
            createOptions.touch = new pc.TouchDevice(document.body);
            createOptions.keyboard = new pc.Keyboard(document.body);

            createOptions.componentSystems = [
                // @ts-ignore
                pc.RenderComponentSystem,
                // @ts-ignore
                pc.CameraComponentSystem,
                // @ts-ignore
                pc.LightComponentSystem,
                // @ts-ignore
                pc.ScriptComponentSystem,
                // @ts-ignore
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

                const material = new pc.CustomMaterial();
                material.setParameter("texture_envAtlas", assets.helipad.resource);
                material.setParameter("material_reflectivity", 1.0);
                material.setParameter("material_normalMapIntensity", 1.0);
                material.setParameter("texture_diffuseMap", assets.color.resource);
                material.setParameter("texture_glossMap", assets.gloss.resource);
                material.setParameter("texture_normalMap", assets.normal.resource);
                const options = new pc.LitOptions();
                options.shadingModel = pc.SPECULAR_BLINN;
                options.useSpecular = true;
                options.useMetalness = true;
                options.occludeSpecular = 1;
                options.reflectionSource = 'envAtlas';
                options.reflectionEncoding = assets.helipad.resource.encoding;
                options.ambientSource = 'envAtlas';
                options.ambientEncoding = assets.helipad.resource.encoding;
                options.clusteredLightingEnabled = app.scene.clusteredLightingEnabled;
                options.normalMapEnabled = true;
                material.litOptions = options;

                const argumentsChunk = `
                uniform sampler2D texture_diffuseMap;
                uniform sampler2D texture_glossMap;
                uniform sampler2D texture_normalMap;
                uniform float material_normalMapIntensity;
                void evaluateFrontend() {
                    litArgs_emission = vec3(0, 0, 0);
                    litArgs_metalness = 0.5;
                    litArgs_specularity = vec3(1,1,1);
                    litArgs_specularityFactor = 1.0;
                    litArgs_gloss = texture2D(texture_glossMap, vUv0).r;

                    vec3 normalMap = texture2D(texture_normalMap, vUv0).xyz * 2.0 - 1.0;
                    litArgs_worldNormal = normalize(dTBN * mix(vec3(0,0,1), normalMap, material_normalMapIntensity));
                    litArgs_albedo = vec3(0.2) + texture2D(texture_diffuseMap, vUv0).xyz;

                    litArgs_ao = 0.0;
                    litArgs_opacity = 1.0;
                }`;
                material.argumentsChunk = argumentsChunk;
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
                app.on("update", function (dt: number) {
                    time += dt;
                    material.setParameter("material_normalMapIntensity", (Math.sin(time) + 1.0) * 0.5);
                });
            });
        });
    }
}

export default CustomMaterialExample;
