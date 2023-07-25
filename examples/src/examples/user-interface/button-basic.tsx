import * as pc from '../../../../';

class ButtonBasicExample {
    static CATEGORY = 'User Interface';
    static NAME = 'Button Basic';
    static WEBGPU_ENABLED = true;

    example(canvas: HTMLCanvasElement, deviceType: string): void {

        const assets = {
            'font': new pc.Asset('font', 'font', { url: '/static/assets/fonts/courier.json' })
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
            createOptions.elementInput = new pc.ElementInput(canvas);

            createOptions.componentSystems = [
                // @ts-ignore
                pc.RenderComponentSystem,
                // @ts-ignore
                pc.CameraComponentSystem,
                // @ts-ignore
                pc.ScreenComponentSystem,
                // @ts-ignore
                pc.ButtonComponentSystem,
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

                window.addEventListener("resize", function () {
                    app.resizeCanvas(canvas.width, canvas.height);
                });

                // Create a camera
                const camera = new pc.Entity();
                camera.addComponent("camera", {
                    clearColor: new pc.Color(30 / 255, 30 / 255, 30 / 255)
                });
                app.root.addChild(camera);

                // Create a 2D screen
                const screen = new pc.Entity();
                screen.addComponent("screen", {
                    referenceResolution: new pc.Vec2(1280, 720),
                    scaleBlend: 0.5,
                    scaleMode: pc.SCALEMODE_BLEND,
                    screenSpace: true
                });
                app.root.addChild(screen);

                // Button
                const button = new pc.Entity();
                button.addComponent("button", {
                    imageEntity: button
                });
                button.addComponent("element", {
                    anchor: [0.5, 0.5, 0.5, 0.5],
                    height: 40,
                    pivot: [0.5, 0.5],
                    type: pc.ELEMENTTYPE_IMAGE,
                    width: 175,
                    useInput: true
                });
                screen.addChild(button);

                // Create a label for the button
                const label = new pc.Entity();
                label.addComponent("element", {
                    anchor: [0.5, 0.5, 0.5, 0.5],
                    color: new pc.Color(0, 0, 0),
                    fontAsset: assets.font.id,
                    fontSize: 32,
                    height: 64,
                    pivot: [0.5, 0.5],
                    text: "CLICK ME",
                    type: pc.ELEMENTTYPE_TEXT,
                    width: 128,
                    wrapLines: true
                });
                button.addChild(label);

                // Change the background color every time the button is clicked
                button.button.on('click', function () {
                    camera.camera.clearColor = new pc.Color(Math.random(), Math.random(), Math.random());
                });
            });
        });
    }
}

export default ButtonBasicExample;
