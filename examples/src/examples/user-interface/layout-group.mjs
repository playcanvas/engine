import * as pc from 'playcanvas';

/**
 * @param {import('../../options.mjs').ExampleOptions} options - The example options.
 * @returns {Promise<pc.AppBase>} The example application.
 */
async function example({ canvas, deviceType, assetPath, glslangPath, twgslPath }) {

    const assets = {
        'font': new pc.Asset('font', 'font', { url: assetPath + 'fonts/courier.json' })
    };

    const gfxOptions = {
        deviceTypes: [deviceType],
        glslangUrl: glslangPath + 'glslang.js',
        twgslUrl: twgslPath + 'twgsl.js'
    };

    const device = await pc.createGraphicsDevice(canvas, gfxOptions);
    const createOptions = new pc.AppOptions();
    createOptions.graphicsDevice = device;
    createOptions.mouse = new pc.Mouse(document.body);
    createOptions.touch = new pc.TouchDevice(document.body);
    createOptions.elementInput = new pc.ElementInput(canvas);

    createOptions.componentSystems = [
        pc.RenderComponentSystem,
        pc.CameraComponentSystem,
        pc.ScreenComponentSystem,
        pc.ButtonComponentSystem,
        pc.ElementComponentSystem,
        pc.LayoutGroupComponentSystem,
        pc.LayoutChildComponentSystem
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

    // Ensure canvas is resized when window changes size
    const resize = () => app.resizeCanvas();
    window.addEventListener('resize', resize);
    app.on('destroy', () => {
        window.removeEventListener('resize', resize);
    });

    const assetListLoader = new pc.AssetListLoader(Object.values(assets), app.assets);
    assetListLoader.load(() => {

        app.start();

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

        // Create Layout Group Entity
        const group = new pc.Entity();
        group.addComponent("element", {
            // a Layout Group needs a 'group' element component
            type: pc.ELEMENTTYPE_GROUP,
            anchor: [0.5, 0.5, 0.5, 0.5],
            pivot: [0.5, 0.5],
            // the element's width and height dictate the group's bounds
            width: 350,
            height: 150
        });
        group.addComponent("layoutgroup", {
            orientation: pc.ORIENTATION_HORIZONTAL,
            spacing: new pc.Vec2(10, 10),
            // fit_both for width and height, making all child elements take the entire space
            widthFitting: pc.FITTING_BOTH,
            heightFitting: pc.FITTING_BOTH,
            // wrap children
            wrap: true
        });
        screen.addChild(group);

        // create 15 children to show off the layout group
        for (let i = 0; i < 15; ++i) {
            // create a random-colored panel
            const child = new pc.Entity();
            child.addComponent("element", {
                anchor: [0.5, 0.5, 0.5, 0.5],
                pivot: [0.5, 0.5],
                color: new pc.Color(Math.random(), Math.random(), Math.random()),
                type: pc.ELEMENTTYPE_IMAGE
            });
            child.addComponent("layoutchild", {
                excludeFromLayout: false
            });
            group.addChild(child);

            // add a text label
            const childLabel = new pc.Entity();
            childLabel.addComponent("element", {
                // center-position and attach to the borders of parent
                // meaning this text element will scale along with parent
                anchor: [0, 0, 1, 1],
                margin: [0, 0, 0, 0],
                pivot: [0.5, 0.5],
                color: new pc.Color(1, 1, 1),
                fontAsset: assets.font.id,
                text: `${i + 1}`,
                type: pc.ELEMENTTYPE_TEXT,
                // auto font size
                autoWidth: false,
                autoHeight: false,
                autoFitWidth: true,
                autoFitHeight: true
            });
            child.addChild(childLabel);
        }
    });
    return app;
}

class LayoutGroupExample {
    static CATEGORY = 'User Interface';
    static WEBGPU_ENABLED = true;
    static example = example;
}

export { LayoutGroupExample };
