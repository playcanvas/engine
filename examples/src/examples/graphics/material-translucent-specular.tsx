import * as pc from '../../../../';

class MaterialTranslucentSpecularExample {
    static CATEGORY = 'Graphics';
    static NAME = 'Material Translucent Specular';
    static WEBGPU_ENABLED = true;

    example(canvas: HTMLCanvasElement, deviceType: string): void {

        const assets = {
            helipad: new pc.Asset('helipad-env-atlas', 'texture', { url: '/static/assets/cubemaps/helipad-env-atlas.png' }, { type: pc.TEXTURETYPE_RGBP }),
            'font': new pc.Asset('font', 'font', { url: '/static/assets/fonts/arial.json' })
        };

        const gfxOptions = {
            deviceTypes: [deviceType],
            glslangUrl: '/static/lib/glslang/glslang.js',
            twgslUrl: '/static/lib/twgsl/twgsl.js'
        };

        pc.createGraphicsDevice(canvas, gfxOptions).then((device: pc.GraphicsDevice) => {

            const createOptions = new pc.AppOptions();
            createOptions.graphicsDevice = device;

            createOptions.componentSystems = [
                // @ts-ignore
                pc.RenderComponentSystem,
                // @ts-ignore
                pc.CameraComponentSystem,
                // @ts-ignore
                pc.LightComponentSystem,
                // @ts-ignore
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

            const assetListLoader = new pc.AssetListLoader(Object.values(assets), app.assets);
            assetListLoader.load(() => {
                app.start();

                app.scene.toneMapping = pc.TONEMAP_ACES;
                app.scene.envAtlas = assets.helipad.resource;
                app.scene.skyboxMip = 1;
                app.scene.skyboxIntensity = 1;

                // Create an entity with a camera component
                const camera = new pc.Entity();
                camera.addComponent("camera");
                camera.translate(0, 0, 8);
                camera.rotate(0, 0, 0);
                app.root.addChild(camera);

                // Create an entities with a directional light components
                for (let i = 0; i < 3; i++) {
                    const light = new pc.Entity();
                    light.addComponent("light", {
                        type: "directional"
                    });
                    app.root.addChild(light);
                    light.rotateLocal(60 + 10 * i, 30 + 90 * i, 0);
                }

                const NUM_SPHERES_X = 10;
                const NUM_SPHERES_Z = 5;

                const createSphere = function (x: number, y: number, z: number) {
                    const material = new pc.StandardMaterial();
                    material.diffuse = new pc.Color(0.7, 0.7, 0.7);
                    material.specular = new pc.Color(1, 1, 1);
                    material.metalness = 0.0;
                    material.gloss = ((z) / (NUM_SPHERES_Z - 1) * 0.5) + 0.5;
                    material.useMetalness = true;
                    material.blendType = pc.BLEND_NORMAL;
                    material.opacity = (x >= 5) ? ((x - 5) / 5 + 0.2) * ((x - 5) / 5 + 0.2) : (x / 5 + 0.2) * (x / 5 + 0.2);
                    material.opacityFadesSpecular = !(x >= 5);
                    material.alphaWrite = false;

                    material.update();

                    const sphere = new pc.Entity();

                    sphere.addComponent("render", {
                        material: material,
                        type: "sphere"
                    });
                    sphere.setLocalPosition(x - (NUM_SPHERES_X - 1) * 0.5, z - (NUM_SPHERES_Z - 1) * 0.5, 0);
                    sphere.setLocalScale(0.7, 0.7, 0.7);
                    app.root.addChild(sphere);
                };

                const createText = function (fontAsset: pc.Asset, message: string, x: number, y: number, z: number, rotx: number, roty: number) {
                    // Create a text element-based entity
                    const text = new pc.Entity();
                    text.addComponent("element", {
                        anchor: [0.5, 0.5, 0.5, 0.5],
                        fontAsset: fontAsset,
                        fontSize: 0.5,
                        pivot: [0.5, 0.5],
                        text: message,
                        type: pc.ELEMENTTYPE_TEXT
                    });
                    text.setLocalPosition(x, y, z);
                    text.setLocalEulerAngles(rotx, roty, 0);
                    app.root.addChild(text);
                };

                for (let i = 0; i < NUM_SPHERES_Z; i++) {
                    for (let j = 0; j < NUM_SPHERES_X; j++) {
                        createSphere(j, 0, i);
                    }
                }

                createText(assets.font, 'Spec Fade On', -NUM_SPHERES_X * 0.25, ((NUM_SPHERES_Z + 1) * -0.5), 0, -0, 0);
                createText(assets.font, 'Spec Fade Off', NUM_SPHERES_X * 0.25, ((NUM_SPHERES_Z + 1) * -0.5), 0, -0, 0);
            });
        });
    }
}

export default MaterialTranslucentSpecularExample;
