import * as pc from 'playcanvas';

/**
 * @param {import('../../app/example.mjs').ControlOptions} options - The options.
 * @returns {JSX.Element} The returned JSX Element.
 */
function controls({ observer, ReactPCUI, React, jsx, fragment }) {
    const { BindingTwoWay, Panel, Label, Button } = ReactPCUI;
    return fragment(
        jsx(Panel, { headerText: 'WebGPU' },
            jsx(Button, {
                text: 'Add',
                onClick: () => observer.emit('add:webgpu')
            }),
            jsx(Button, {
                text: 'Remove',
                onClick: () => observer.emit('remove:webgpu')
            }),
            jsx(Label, {
                binding: new BindingTwoWay(),
                link: { observer, path: 'webgpu' },
                value: observer.get('webgpu')
            })
        ),
        jsx(Panel, { headerText: 'WebGL 2' },
            jsx(Button, {
                text: 'Add',
                onClick: () => observer.emit('add:webgl2')
            }),
            jsx(Button, {
                text: 'Remove',
                onClick: () => observer.emit('remove:webgl2')
            }),
            jsx(Label, {
                binding: new BindingTwoWay(),
                link: { observer, path: 'webgl2' },
                value: observer.get('webgl2')
            })
        ),
        jsx(Panel, { headerText: 'WebGL 1' },
            jsx(Button, {
                text: 'Add',
                onClick: () => observer.emit('add:webgl1')
            }),
            jsx(Button, {
                text: 'Remove',
                onClick: () => observer.emit('remove:webgl1')
            }),
            jsx(Label, {
                binding: new BindingTwoWay(),
                link: { observer, path: 'webgl1' },
                value: observer.get('webgl1')
            })
        ),
        jsx(Panel, { headerText: 'Null' },
            jsx(Button, {
                text: 'Add',
                onClick: () => observer.emit('add:null')
            }),
            jsx(Button, {
                text: 'Remove',
                onClick: () => observer.emit('remove:null')
            }),
            jsx(Label, {
                binding: new BindingTwoWay(),
                link: { observer, path: 'null' },
                value: observer.get('null')
            })
        )
    );
}

/**
 * @param {import('../../options.mjs').ExampleOptions} options - The example options.
 * @returns {Promise<null>} The example application.
 */
async function example({ glslangPath, twgslPath, data }) {
    /**
     * @param {string} deviceType - The device type.
     * @returns {Promise<pc.AppBase>} The example application.
     */
    const createApp = async function(deviceType) {

        const assets = {
            font: new pc.Asset('font', 'font', { url: assetPath + 'fonts/courier.json' })
        };

        let canvas = document.createElement('canvas');
        canvas.id = `app-${Math.random().toString(36).substring(7)}`; // generate a random id
        document.getElementById('appInner')?.appendChild(canvas);

        // Don't use createGraphicsDevice as it automatically falls back, which we don't want
        let device;
        if (deviceType === 'webgpu') {
            device = new pc.WebgpuGraphicsDevice(canvas, {});
            try {
                await device.initWebGpu(glslangPath + 'glslang.js', twgslPath + 'twgsl.js');
            } catch (err) {
                throw err;
            }
        } else if (deviceType === 'webgl1' || deviceType === 'webgl2') {
            device = new pc.WebglGraphicsDevice(canvas, {
                preferWebGl2: deviceType === 'webgl2'
            });
        } else {
            device = new pc.NullGraphicsDevice(canvas, {});
        }

        const createOptions = new pc.AppOptions();
        createOptions.graphicsDevice = device;

        createOptions.componentSystems = [
            pc.RenderComponentSystem,
            pc.CameraComponentSystem,
            pc.LightComponentSystem,
            pc.ScreenComponentSystem,
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
        app.start();

        const assetListLoader = new pc.AssetListLoader(Object.values(assets), app.assets);
        assetListLoader.load(() => {

            app.setCanvasFillMode(pc.FILLMODE_NONE);
            app.setCanvasResolution(pc.RESOLUTION_AUTO);

            // Ensure canvas is resized when window changes size
            const resize = () => app.resizeCanvas();
            window.addEventListener('resize', resize);
            app.on('destroy', () => {
                window.removeEventListener('resize', resize);
            });

            // create box entity
            const box = new pc.Entity('cube');
            box.addComponent('render', {
                type: 'box'
            });
            app.root.addChild(box);

            // create camera entity
            const clearValue = 0.3 + Math.random() * 0.3;
            const camera = new pc.Entity('camera');
            camera.addComponent('camera', {
                clearColor: new pc.Color(clearValue, clearValue, clearValue)
            });
            app.root.addChild(camera);
            camera.setPosition(0, -0.4, 3);

            // create directional light entity
            const light = new pc.Entity('light');
            light.addComponent('light');
            app.root.addChild(light);
            light.setEulerAngles(45, 0, 0);

            // Create a 2D screen
            const screen = new pc.Entity();
            screen.addComponent("screen", {
                referenceResolution: new pc.Vec2(1280, 720),
                scaleBlend: 0.5,
                scaleMode: pc.SCALEMODE_BLEND,
                screenSpace: true
            });
            app.root.addChild(screen);

            // device type as text
            const text = app.graphicsDevice.isWebGL1 ? 'WebGL 1' : app.graphicsDevice.isWebGL2 ? 'WebGL 2' : 'WebGPU';

            // Text with outline to identify the platform
            const textOutline = new pc.Entity();
            textOutline.setLocalPosition(0, -100, 0);
            textOutline.addComponent("element", {
                pivot: new pc.Vec2(0.5, 0.5),
                anchor: new pc.Vec4(0.5, -0.2, 0.5, 0.5),
                fontAsset: assets.font.id,
                fontSize: 130,
                text: text,
                color: new pc.Color(1, 0.9, 0.9),
                outlineColor: new pc.Color(0, 0, 0),
                outlineThickness: 1,
                type: pc.ELEMENTTYPE_TEXT
            });
            screen.addChild(textOutline);

            // rotate the box according to the delta time since the last frame
            app.on('update', (/** @type {number} */ dt) => box.rotate(10 * dt, 20 * dt, 30 * dt));
        });

        return app;
    };

    const apps = {
        webgpu: [],
        webgl2: [],
        webgl1: [],
        null: []
    };

    // Add event listers for adding and removing apps
    for (const deviceType in apps) {
        data.set(deviceType, 0);

        data.on(`add:${deviceType}`, () => {
            createApp(deviceType).then((app) => {
                apps[deviceType].push(app);
                data.set(deviceType, apps[deviceType].length);
            }).catch((err) => {
                console.error(err);
            });
        });

        data.on(`remove:${deviceType}`, () => {
            const app = apps[deviceType].pop();
            if (app && app.graphicsDevice) {
                const canvas = app.graphicsDevice.canvas;
                app.destroy();
                canvas.remove();
                data.set(deviceType, apps[deviceType].length);
            }
        });
    }

    // Make sure to remove all apps when the example is destroyed or hot reloaded
    const removeAll = () => {
        for (const deviceType in apps) {
            while (apps[deviceType].length) {
                data.emit(`remove:${deviceType}`);
            }
        }
    };

    window.addEventListener('destroy', removeAll);
    window.addEventListener('hotReload', removeAll);

    // Start with a webgl2 and webgpu app
    data.emit('add:webgl2');
    data.emit('add:webgpu');

    return null;
}

class MultiApplicationExample {
    static CATEGORY = 'Misc';
    static NO_CANVAS = true;
    static NO_MINISTATS = true;
    static NO_DEVICE_SELECTOR = true;
    static controls = controls;
    static example = example;
}

export { MultiApplicationExample };
