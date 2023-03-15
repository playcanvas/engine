import * as pc from '../../../../';

class ModelAssetExample {
    static CATEGORY = 'Graphics';
    static NAME = 'Model Asset';
    static WEBGPU_ENABLED = true;

    example(canvas: HTMLCanvasElement, deviceType: string): void {

        const assets = {
            'statue': new pc.Asset('statue', 'container', { url: '/static/assets/models/statue.glb' })
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
                pc.ModelComponentSystem,
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

                app.scene.ambientLight = new pc.Color(0.2, 0.2, 0.2);

                // create an entity with render assets
                const entity = assets.statue.resource.instantiateModelEntity({
                    castShadows: true
                });

                app.root.addChild(entity);

                // clone a small version of the entity
                const clone = entity.clone();
                clone.setLocalScale(0.2, 0.2, 0.2);
                clone.setLocalPosition(-4, 12, 0);
                app.root.addChild(clone);

                // Create an Entity with a camera component
                const camera = new pc.Entity();
                camera.addComponent("camera", {
                    clearColor: new pc.Color(0.4, 0.45, 0.5)
                });
                camera.translate(0, 7, 24);
                app.root.addChild(camera);

                // Create an Entity with a omni light component
                const light = new pc.Entity();
                light.addComponent("light", {
                    type: "omni",
                    color: new pc.Color(1, 1, 1),
                    range: 100,
                    castShadows: true
                });
                light.translate(5, 0, 15);
                app.root.addChild(light);

                app.on("update", function (dt) {
                    if (entity) {
                        entity.rotate(0, 10 * dt, 0);
                    }
                });
            });
        });
    }
}

export default ModelAssetExample;
