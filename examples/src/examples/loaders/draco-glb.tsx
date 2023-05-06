import * as pc from '../../../../';

class DracoGlbExample {
    static CATEGORY = 'Loaders';
    static NAME = 'Draco GLB';
    static WEBGPU_ENABLED = true;

    example(canvas: HTMLCanvasElement, deviceType: string): void {

        pc.WasmModule.setConfig('DracoDecoderModule', {
            glueUrl: '/static/lib/draco/draco.wasm.js',
            wasmUrl: '/static/lib/draco/draco.wasm.wasm',
            fallbackUrl: '/static/lib/draco/draco.js'
        });

        pc.WasmModule.getInstance('DracoDecoderModule', demo);

        function demo() {

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

                const assets = {
                    heart: new pc.Asset('heart', 'container', { url: '/static/assets/models/heart_draco.glb' })
                };

                const assetListLoader = new pc.AssetListLoader(Object.values(assets), app.assets);
                assetListLoader.load(() => {

                    app.start();

                    app.scene.ambientLight = new pc.Color(0.2, 0.2, 0.2);

                    // create an instance using render component
                    const entity = assets.heart.resource.instantiateRenderEntity({
                        receiveShadows: false
                    });
                    app.root.addChild(entity);
                    entity.setLocalScale(20, 20, 20);

                    // Create an Entity with a camera component
                    const camera = new pc.Entity();
                    camera.addComponent("camera", {
                        clearColor: new pc.Color(0.2, 0.2, 0.2)
                    });
                    camera.translate(0, 0.5, 4);
                    app.root.addChild(camera);

                    // Create an entity with a omni light component
                    const light = new pc.Entity();
                    light.addComponent("light", {
                        type: "omni",
                        intensity: 3
                    });
                    light.setLocalPosition(1, 1, 5);
                    app.root.addChild(light);

                    app.on("update", function (dt) {
                        if (entity) {
                            entity.rotate(4 * dt, -20 * dt, 0);
                        }
                    });
                });
            });
        }
    }
}

export default DracoGlbExample;
