import * as pc from '../../../../';

class TextAutoFontSizeExample {
    static CATEGORY = 'User Interface';
    static NAME = 'Text Auto Font Size';
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
                pc.ElementComponentSystem,
                // @ts-ignore
                pc.LayoutGroupComponentSystem,
                // @ts-ignore
                pc.ScrollViewComponentSystem,
                // @ts-ignore
                pc.ScrollbarComponentSystem
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

                // Create a container entity with an image component
                const autoFontSizeContainer = new pc.Entity();
                autoFontSizeContainer.addComponent("element", {
                    pivot: new pc.Vec2(0.5, 0.5),
                    anchor: new pc.Vec4(0.5, 0.5, 0.5, 0.5),
                    width: 220,
                    height: 50,
                    color: new pc.Color(60 / 255, 60 / 255, 60 / 255),
                    type: pc.ELEMENTTYPE_IMAGE
                });
                // Create a text element with auto font size, and place it inside the container
                const autoFontSizeText = new pc.Entity();
                autoFontSizeText.addComponent("element", {
                    // place the text taking the entire parent space
                    pivot: new pc.Vec2(0.5, 0.5),
                    anchor: new pc.Vec4(0, 0, 1, 1),
                    margin: new pc.Vec4(0, 0, 0, 0),
                    fontAsset: assets.font.id,
                    autoWidth: false,
                    autoHeight: false,
                    autoFitWidth: true,
                    autoFitHeight: true,
                    minFontSize: 10,
                    maxFontSize: 100,
                    text: "Auto font size!",
                    type: pc.ELEMENTTYPE_TEXT
                });
                screen.addChild(autoFontSizeContainer);
                autoFontSizeContainer.addChild(autoFontSizeText);

                // update the container's size to showcase the auto-sizing feature
                let time = 0;
                app.on('update', (dt) => {
                    time += dt;
                    autoFontSizeContainer.element.width = 280 + (Math.sin(time) * 80);
                    autoFontSizeContainer.element.height = 60 + (Math.sin(time * 0.5) * 50);
                });
            });
        });
    }
}

export default TextAutoFontSizeExample;
