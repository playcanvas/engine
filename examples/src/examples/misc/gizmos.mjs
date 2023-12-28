import * as pc from 'playcanvas';

/**
 * @param {import('../../app/example.mjs').ControlOptions} options - The options.
 * @returns {JSX.Element} The returned JSX Element.
 */
function controls({ observer, ReactPCUI, React, jsx, fragment }) {
    const { BindingTwoWay, LabelGroup, Panel, SliderInput } = ReactPCUI;
    return fragment(
        jsx(Panel, { headerText: 'Gizmo Transform' },
            jsx(LabelGroup, { text: 'Axis Gap' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'settings.axisGap' }
                })
            ),
            jsx(LabelGroup, { text: 'Axis Line Thickness' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'settings.axisLineThickness' }
                })
            ),
            jsx(LabelGroup, { text: 'Axis Line Length' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'settings.axisLineLength' }
                })
            ),
            jsx(LabelGroup, { text: 'Axis Arrow Thickness' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'settings.axisArrowThickness' }
                })
            ),
            jsx(LabelGroup, { text: 'Axis Arrow Length' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'settings.axisArrowLength' }
                })
            )
        )
    );
}


/**
 * @param {import('../../options.mjs').ExampleOptions} options - The example options.
 * @returns {Promise<pc.AppBase>} The example application.
 */
async function example({ canvas, deviceType, data, glslangPath, twgslPath }) {

    const gfxOptions = {
        deviceTypes: [deviceType],
        glslangUrl: glslangPath + 'glslang.js',
        twgslUrl: twgslPath + 'twgsl.js'
    };

    const device = await pc.createGraphicsDevice(canvas, gfxOptions);
    const createOptions = new pc.AppOptions();
    createOptions.graphicsDevice = device;

    createOptions.componentSystems = [
        pc.RenderComponentSystem,
        pc.CameraComponentSystem,
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
    app.start();

    // Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
    app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
    app.setCanvasResolution(pc.RESOLUTION_AUTO);

    // Ensure canvas is resized when window changes size
    const resize = () => app.resizeCanvas();
    window.addEventListener('resize', resize);
    app.on('destroy', () => {
        window.removeEventListener('resize', resize);
    });

    // create box entities
    const boxA = new pc.Entity('cubeA');
    boxA.addComponent('render', {
        type: 'box'
    });
    app.root.addChild(boxA);
    // const boxB = new pc.Entity('cubeB');
    // boxB.addComponent('render', {
    //     type: 'box'
    // });
    // boxB.setPosition(1, 0, 0);
    // app.root.addChild(boxB);

    // create camera entity
    const camera = new pc.Entity('camera');
    camera.addComponent('camera', {
        clearColor: new pc.Color(0.5, 0.6, 0.9)
    });
    app.root.addChild(camera);
    camera.translate(5, 3, 5);
    camera.lookAt(0, 0, 0);

    // create directional light entity
    const light = new pc.Entity('light');
    light.addComponent('light');
    app.root.addChild(light);
    light.setEulerAngles(45, 20, 0);

    // create gizmo
    const gizmo = new pcx.GizmoTransform(app, camera);
    gizmo.attach([boxA]);
    data.set('settings', {
        axisGap: gizmo.axisGap,
        axisLineThickness: gizmo.axisLineThickness,
        axisLineLength: gizmo.axisLineLength,
        axisArrowThickness: gizmo.axisArrowThickness,
        axisArrowLength: gizmo.axisArrowLength
    });
    data.on('*:set', (/** @type {string} */ path, value) => {
        const pathArray = path.split('.');
        gizmo[pathArray[1]] = value;
    });

    return app;
}

class GizmosExample {
    static CATEGORY = 'Misc';
    static WEBGPU_ENABLED = true;
    static controls = controls;
    static example = example;
}

export { GizmosExample };
