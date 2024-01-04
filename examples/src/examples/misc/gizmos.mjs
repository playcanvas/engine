import * as pc from 'playcanvas';

/**
 * @param {import('../../app/example.mjs').ControlOptions} options - The options.
 * @returns {JSX.Element} The returned JSX Element.
 */
function controls({ observer, ReactPCUI, React, jsx, fragment }) {
    const { BindingTwoWay, LabelGroup, Panel, SliderInput, SelectInput } = ReactPCUI;
    return fragment(
        jsx(Panel, { headerText: 'Gizmo' },
            jsx(LabelGroup, { text: 'Type' },
                jsx(SelectInput, {
                    options: [
                        { v: 'translate', t: 'Translate' },
                        { v: 'rotate', t: 'Rotate' },
                        { v: 'scale', t: 'Scale' }
                    ],
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'gizmo.type' }
                })
            ),
            jsx(LabelGroup, { text: 'Size' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'gizmo.size' },
                    min: 0.1,
                    max: 2.0
                })
            ),
            jsx(LabelGroup, { text: 'Coord Space' },
                jsx(SelectInput, {
                    options: [
                        { v: 'world', t: 'World' },
                        { v: 'local', t: 'Local' }
                    ],
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'gizmo.coordSpace' }
                })
            ),
            jsx(LabelGroup, { text: 'Axis Gap' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'gizmo.axisGap' }
                })
            ),
            jsx(LabelGroup, { text: 'Axis Line Thickness' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'gizmo.axisLineThickness' }
                })
            ),
            jsx(LabelGroup, { text: 'Axis Line Length' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'gizmo.axisLineLength' }
                })
            ),
            jsx(LabelGroup, { text: 'Axis Box Size' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'gizmo.axisBoxSize' }
                })
            ),
            jsx(LabelGroup, { text: 'Axis Arrow Thickness' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'gizmo.axisArrowThickness' }
                })
            ),
            jsx(LabelGroup, { text: 'Axis Arrow Length' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'gizmo.axisArrowLength' }
                })
            ),
            jsx(LabelGroup, { text: 'Axis Plane Size' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'gizmo.axisPlaneSize' }
                })
            ),
            jsx(LabelGroup, { text: 'Axis Plane Gap' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'gizmo.axisPlaneGap' }
                })
            ),
            jsx(LabelGroup, { text: 'Axis Center Size' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'gizmo.axisCenterSize' }
                })
            )
        ),
        jsx(Panel, { headerText: 'Camera' },
            jsx(LabelGroup, { text: 'Projection' },
                jsx(SelectInput, {
                    options: [
                        { v: pc.PROJECTION_PERSPECTIVE + 1, t: 'Perspective' },
                        { v: pc.PROJECTION_ORTHOGRAPHIC + 1, t: 'Orthographic' }
                    ],
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'camera.proj' }
                })
            ),
            jsx(LabelGroup, { text: 'Distance' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'camera.dist' },
                    min: 1,
                    max: 10
                })
            ),
            jsx(LabelGroup, { text: 'FOV' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'camera.fov' },
                    min: 30,
                    max: 100
                })
            ),
            jsx(LabelGroup, { text: 'Ortho Height' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'camera.orthoHeight' },
                    min: 1,
                    max: 20
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
    boxA.setPosition(0.5, 0, -0.5);
    app.root.addChild(boxA);
    const boxB = new pc.Entity('cubeB');
    boxB.addComponent('render', {
        type: 'box'
    });
    boxB.setPosition(-0.5, 0, 0.5);
    app.root.addChild(boxB);

    // create camera entity
    data.set('camera', {
        proj: pc.PROJECTION_PERSPECTIVE + 1,
        dist: 1,
        fov: 45,
        orthoHeight: 10
    });
    const camera = new pc.Entity('camera');
    camera.addComponent('camera', {
        clearColor: new pc.Color(0.5, 0.6, 0.9)
    });
    app.root.addChild(camera);
    camera.setPosition(5, 3, 5);
    camera.lookAt(0, 0, 0);

    // create directional light entity
    const light = new pc.Entity('light');
    light.addComponent('light');
    app.root.addChild(light);
    light.setEulerAngles(45, 20, 0);

    // create gizmo
    class GizmoHandler {
        data;

        _type = 'translate';

        skipSetFire = false;

        constructor(app, camera, data) {
            this.data = data;
            this.gizmos = {
                translate: new pcx.GizmoTranslate(app, camera),
                rotate: new pcx.GizmoRotate(app, camera),
                scale: new pcx.GizmoScale(app, camera)
            };
        }

        get gizmo() {
            return this.gizmos[this._type];
        }

        switch(type, nodes) {
            this.gizmo.detach();
            this._type = type;
            const gizmo = this.gizmo;
            gizmo.attach(nodes);
            this.skipSetFire = true;
            this.data.set('gizmo', {
                type: type,
                size: gizmo.size,
                coordSpace: gizmo.coordSpace,
                axisGap: gizmo.axisGap,
                axisLineThickness: gizmo.axisLineThickness,
                axisLineLength: gizmo.axisLineLength,
                axisArrowThickness: gizmo.axisArrowThickness,
                axisArrowLength: gizmo.axisArrowLength,
                axisBoxSize: gizmo.axisBoxSize,
                axisPlaneSize: gizmo.axisPlaneSize,
                axisPlaneGap: gizmo.axisPlaneGap,
                axisCenterSize: gizmo.axisCenterSize
            });
            this.skipSetFire = false;
        }
    }
    const gizmoHandler = new GizmoHandler(app, camera, data);
    gizmoHandler.switch('translate', [boxA, boxB]);

    data.on('*:set', (/** @type {string} */ path, value) => {
        const pathArray = path.split('.');

        switch (pathArray[0]) {
            case 'camera':
                switch (pathArray[1]) {
                    case 'proj':
                        camera.camera.projection = value - 1;
                        break;
                    case 'dist':
                        camera.setPosition(5 * value, 3 * value, 5 * value);
                        break;
                    case 'fov':
                        camera.camera.fov = value;
                        break;
                    case 'orthoHeight':
                        camera.camera.orthoHeight = value;
                        break;
                }
                gizmoHandler.gizmo.updateGizmoScale();
                return;
            case 'gizmo':
                if (gizmoHandler.skipSetFire) {
                    return;
                }
                switch (pathArray[1]) {
                    case 'type':
                        gizmoHandler.switch(value, [boxA, boxB]);
                        break;
                    default:
                        gizmoHandler.gizmo[pathArray[1]] = value;
                        break;
                }
                break;
        }
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
