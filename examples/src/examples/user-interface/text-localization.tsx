import * as pc from '../../../../';

class TextLocalizationExample {
    static CATEGORY = 'User Interface';
    static NAME = 'Text Localization';
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

                app.i18n.addData({
                    header: {
                        version: 1
                    },
                    data: [{
                        info: {
                            locale: 'en-US'
                        },
                        messages: {
                            "HELLO": "Hi"
                        }
                    }, {
                        info: {
                            locale: 'fr-FR'
                        },
                        messages: {
                            "HELLO": "Salut"
                        }
                    }, {
                        info: {
                            locale: 'es-ES'
                        },
                        messages: {
                            "HELLO": "Hola"
                        }
                    }, {
                        info: {
                            locale: 'pt-BR'
                        },
                        messages: {
                            "HELLO": "Oi!"
                        }
                    }]
                });

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

                // Create a basic text element
                const text = new pc.Entity();
                text.addComponent("element", {
                    anchor: [0.5, 0.5, 0.5, 0.5],
                    autoWidth: false,
                    fontAsset: assets.font.id,
                    fontSize: 128,
                    pivot: [0.5, 0.5],
                    key: "HELLO",
                    type: pc.ELEMENTTYPE_TEXT,
                    width: 640
                });
                screen.addChild(text);

                function createButton(labelText: string, x: number, y: number) {
                    // Create a simple button
                    const button = new pc.Entity();
                    button.addComponent("button", {
                        imageEntity: button
                    });
                    button.addComponent("element", {
                        anchor: [0.5, 0.5, 0.5, 0.5],
                        height: 40,
                        pivot: [0.5, 0.5],
                        type: pc.ELEMENTTYPE_IMAGE,
                        width: 128,
                        useInput: true
                    });

                    // Create a label for the button
                    const label = new pc.Entity();
                    label.addComponent("element", {
                        anchor: [0.5, 0.5, 0.5, 0.5],
                        color: new pc.Color(0, 0, 0),
                        fontAsset: assets.font.id,
                        fontSize: 32,
                        height: 64,
                        pivot: [0.5, 0.5],
                        text: labelText,
                        type: pc.ELEMENTTYPE_TEXT,
                        width: 128,
                        wrapLines: true
                    });
                    button.addChild(label);

                    // Change the locale to the button text
                    button.button.on('click', function () {
                        app.i18n.locale = labelText;
                    });

                    button.setLocalPosition(x, y, 0);

                    return button;
                }

                screen.addChild(createButton("en-US", -225, -100));
                screen.addChild(createButton("fr-FR", -75, -100));
                screen.addChild(createButton("es-ES", 75, -100));
                screen.addChild(createButton("pt-BR", 225, -100));
            });
        });
    }
}

export default TextLocalizationExample;
