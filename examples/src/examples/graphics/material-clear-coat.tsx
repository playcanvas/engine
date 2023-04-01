import * as pc from '../../../../';

class MaterialClearCoatExample {
    static CATEGORY = 'Graphics';
    static NAME = 'Material Clear Coat';
    static WEBGPU_ENABLED = true;

    example(canvas: HTMLCanvasElement, deviceType: string): void {

        const assets = {
            helipad: new pc.Asset('helipad-env-atlas', 'texture', { url: '/static/assets/cubemaps/helipad-env-atlas.png' }, { type: pc.TEXTURETYPE_RGBP }),
            'normal': new pc.Asset('normal', 'texture', { url: '/static/assets/textures/flakes5n.png' }),
            'diffuse': new pc.Asset('diffuse', 'texture', { url: '/static/assets/textures/flakes5c.png' }),
            'other': new pc.Asset('other', 'texture', { url: '/static/assets/textures/flakes5o.png' })
        };

        const gfxOptions = {
            deviceTypes: [deviceType],
            glslangUrl: '/static/lib/glslang/glslang.js',
            twgslUrl: '/static/lib/twgsl/twgsl.js'
        };

        pc.createGraphicsDevice(canvas, gfxOptions).then((device: pc.GraphicsDevice) => {

            const createOptions = new pc.AppOptions();
            createOptions.graphicsDevice = device;
            createOptions.mouse = new pc.Mouse(document.body);
            createOptions.touch = new pc.TouchDevice(document.body);

            createOptions.componentSystems = [
                // @ts-ignore
                pc.RenderComponentSystem,
                // @ts-ignore
                pc.CameraComponentSystem,
                // @ts-ignore
                pc.LightComponentSystem
            ];
            createOptions.resourceHandlers = [
                // @ts-ignore
                pc.TextureHandler
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

                // Create an entity with a camera component
                const camera = new pc.Entity();
                camera.addComponent("camera");
                camera.translate(0, 0, 3);
                app.root.addChild(camera);

                // Create an entity with a directional light component
                const light = new pc.Entity();
                light.addComponent("light", {
                    type: "directional",
                    color: new pc.Color(1, 0.8, 0.25)
                });
                app.root.addChild(light);
                light.setLocalEulerAngles(85, -100, 0);

                // function to create sphere
                const createSphere = function (x: number, y: number, z: number, material: pc.Material) {
                    const sphere = new pc.Entity();

                    sphere.addComponent("render", {
                        material: material,
                        type: "sphere"
                    });
                    sphere.setLocalPosition(x, y, z);
                    sphere.setLocalScale(0.7, 0.7, 0.7);
                    app.root.addChild(sphere);
                };

                const material = new pc.StandardMaterial();
                material.diffuseMap = assets.diffuse.resource;
                material.metalnessMap = assets.other.resource;
                material.metalnessMapChannel = 'r';
                material.glossMap = assets.other.resource;
                material.glossMapChannel = 'g';
                material.normalMap = assets.normal.resource;
                material.diffuse = new pc.Color(0.6, 0.6, 0.9);
                material.diffuseTint = true;
                material.metalness = 1.0;
                material.gloss = 0.9;
                material.bumpiness = 0.7;
                material.useMetalness = true;
                material.update();

                createSphere(-0.5, 0, 0, material);

                const clearCoatMaterial = new pc.StandardMaterial();
                clearCoatMaterial.diffuseMap = assets.diffuse.resource;
                clearCoatMaterial.metalnessMap = assets.other.resource;
                clearCoatMaterial.metalnessMapChannel = 'r';
                clearCoatMaterial.glossMap = assets.other.resource;
                clearCoatMaterial.glossMapChannel = 'g';
                clearCoatMaterial.normalMap = assets.normal.resource;
                clearCoatMaterial.diffuse = new pc.Color(0.6, 0.6, 0.9);
                clearCoatMaterial.diffuseTint = true;
                clearCoatMaterial.metalness = 1.0;
                clearCoatMaterial.gloss = 0.9;
                clearCoatMaterial.bumpiness = 0.7;
                clearCoatMaterial.useMetalness = true;
                clearCoatMaterial.clearCoat = 0.25;
                clearCoatMaterial.clearCoatGloss = 0.9;
                clearCoatMaterial.update();

                createSphere(0.5, 0, 0, clearCoatMaterial);

                // update things each frame
                let time = 0;
                app.on("update", function (dt) {
                    // rotate camera around the objects
                    time += dt;
                    camera.setLocalPosition(3 * Math.sin(time * 0.5), 0, 3 * Math.cos(time * 0.5));
                    camera.lookAt(pc.Vec3.ZERO);
                });
            });
        });
    }
}

export default MaterialClearCoatExample;
