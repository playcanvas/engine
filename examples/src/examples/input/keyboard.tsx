import * as pc from '../../../../';

class KeyboardExample {
    static CATEGORY = 'Input';
    static NAME = 'Keyboard';
    static WEBGPU_ENABLED = true;

    example(canvas: HTMLCanvasElement, deviceType: string): void {

        const assets = {
            'helipad': new pc.Asset('helipad-env-atlas', 'texture', { url: '/static/assets/cubemaps/helipad-env-atlas.png' }, { type: pc.TEXTURETYPE_RGBP }),
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
                pc.RenderComponentSystem,
                // @ts-ignore
                pc.CameraComponentSystem
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

                // set skybox
                app.scene.envAtlas = assets.helipad.resource;
                app.scene.toneMapping = pc.TONEMAP_ACES;
                app.scene.exposure = 1.6;
                app.scene.skyboxMip = 1;

                // Create an Entity with a camera component
                const camera = new pc.Entity();
                camera.addComponent("camera", {
                    clearColor: new pc.Color(0.4, 0.45, 0.5)
                });
                camera.translate(0, 7, 25);
                app.root.addChild(camera);

                const entity = assets.statue.resource.instantiateRenderEntity();
                app.root.addChild(entity);

                const keyboard = new pc.Keyboard(document.body);
                app.on("update", function () {
                    if (keyboard.isPressed(pc.KEY_LEFT)) {
                        entity.rotate(0, -1, 0);
                    }
                    if (keyboard.isPressed(pc.KEY_RIGHT)) {
                        entity.rotate(0, 1, 0);
                    }
                });
            });
        });
    }
}

export default KeyboardExample;
