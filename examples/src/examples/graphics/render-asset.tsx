import * as pc from '../../../../';

class RenderAssetExample {
    static CATEGORY = 'Graphics';
    static NAME = 'Render Asset';
    static WEBGPU_ENABLED = true;

    example(canvas: HTMLCanvasElement, deviceType: string): void {

        const assets = {
            'helipad': new pc.Asset('helipad-env-atlas', 'texture', { url: '/static/assets/cubemaps/helipad-env-atlas.png' }, { type: pc.TEXTURETYPE_RGBP }),
            'statue': new pc.Asset('statue', 'container', { url: '/static/assets/models/statue.glb' }),
            'cube': new pc.Asset('cube', 'container', { url: '/static/assets/models/playcanvas-cube.glb' })
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

                const cubeEntities: pc.Entity[] = [];

                // get the instance of the cube it set up with render component and add it to scene
                cubeEntities[0] = assets.cube.resource.instantiateRenderEntity();
                cubeEntities[0].setLocalPosition(7, 12, 0);
                cubeEntities[0].setLocalScale(3, 3, 3);
                app.root.addChild(cubeEntities[0]);

                // clone another copy of it and add it to scene
                cubeEntities[1] = cubeEntities[0].clone() as pc.Entity;
                cubeEntities[1].setLocalPosition(-7, 12, 0);
                cubeEntities[1].setLocalScale(3, 3, 3);
                app.root.addChild(cubeEntities[1]);

                // get the instance of the statue and set up with render component
                const statueEntity = assets.statue.resource.instantiateRenderEntity();
                app.root.addChild(statueEntity);

                // Create an Entity with a camera component
                const camera = new pc.Entity();
                camera.addComponent("camera", {
                    clearColor: new pc.Color(0.2, 0.1, 0.1),
                    farClip: 100
                });
                camera.translate(-20, 15, 20);
                camera.lookAt(0, 7, 0);
                app.root.addChild(camera);

                // set skybox
                app.scene.envAtlas = assets.helipad.resource;
                app.scene.toneMapping = pc.TONEMAP_ACES;
                app.scene.skyboxMip = 1;

                // spin the meshes
                app.on("update", function (dt) {

                    if (cubeEntities[0]) {
                        cubeEntities[0].rotate(3 * dt, 10 * dt, 6 * dt);
                    }

                    if (cubeEntities[1]) {
                        cubeEntities[1].rotate(-7 * dt, 5 * dt, -2 * dt);
                    }

                    if (statueEntity) {
                        statueEntity.rotate(0, -12 * dt, 0);
                    }

                });
            });
        }).catch(console.error);
    }
}

export default RenderAssetExample;
