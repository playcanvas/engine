import * as pc from '../../../../';

class MeshMorphManyExample {
    static CATEGORY = 'Graphics';
    static NAME = 'Mesh Morph Many';

    example(canvas: HTMLCanvasElement, deviceType: string): void {

        const assets = {
            helipad: new pc.Asset('helipad-env-atlas', 'texture', { url: '/static/assets/cubemaps/helipad-env-atlas.png' }, { type: pc.TEXTURETYPE_RGBP, mipmaps: false }),
            morph: new pc.Asset('glb', 'container', { url: '/static/assets/models/morph-stress-test.glb' })
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
            createOptions.keyboard = new pc.Keyboard(document.body);

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
                pc.TextureHandler,
                // @ts-ignore
                pc.ContainerHandler
            ];

            const app = new pc.AppBase(canvas);
            app.init(createOptions);

            // Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
            app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
            app.setCanvasResolution(pc.RESOLUTION_AUTO);

            const assetListLoader = new pc.AssetListLoader(Object.values(assets), app.assets);
            assetListLoader.load(() => {

                app.start();

                // setup skydome
                app.scene.skyboxMip = 2;
                app.scene.exposure = 1.2;
                app.scene.envAtlas = assets.helipad.resource;

                // create an instance of the morph target model
                const morphEntity = assets.morph.resource.instantiateRenderEntity();
                app.root.addChild(morphEntity);

                // get the morph instance, which we apply the weights to
                const morphInstance = morphEntity.render.meshInstances[1].morphInstance;

                // Create an entity with a directional light component
                const light = new pc.Entity();
                light.addComponent("light", {
                    type: "directional",
                    castShadows: true,
                    shadowBias: 0.5,
                    normalOffsetBias: 0.2,
                    shadowDistance: 25
                });
                app.root.addChild(light);
                light.setLocalEulerAngles(45, 45, 0);

                // Create an entity with a camera component
                const camera = new pc.Entity();
                camera.addComponent("camera");
                app.root.addChild(camera);

                // position the camera
                camera.setLocalPosition(0, 4, 9);
                camera.lookAt(pc.Vec3.ZERO);

                // update function called once per frame
                let time = 0;
                app.on("update", function (dt) {
                    time += dt;

                    // modify weights of all morph targets along sin curve
                    const targetsCount = morphInstance.morph.targets.length;
                    for (let i = 0; i < targetsCount; i++) {
                        morphInstance.setWeight(i, Math.abs(Math.sin(time + i * 0.4)));
                    }

                    // debug display the morph target textures blended together
                    if (morphInstance.texturePositions) {
                        // @ts-ignore
                        app.drawTexture(-0.7, -0.7, 0.4, 0.4, morphInstance.texturePositions);
                    }
                });
            });
        });
    }
}

export default MeshMorphManyExample;
