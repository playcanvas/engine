import * as pc from 'playcanvas';

/**
 * @param {import('../../app/example.mjs').ControlOptions} options - The options.
 * @returns {JSX.Element} The returned JSX Element.
 */
function controls({ observer, ReactPCUI, React, jsx, fragment }) {
    const { BindingTwoWay, LabelGroup, Panel, BooleanInput, ColorPicker, SliderInput, SelectInput } = ReactPCUI;

    const [type, setType] = React.useState('translate');

    this.setType = (value) => setType(value);

    return fragment(
        jsx(Panel, { headerText: 'Transform' },
            jsx(LabelGroup, { text: 'Type' },
                jsx(SelectInput, {
                    options: [
                        { v: 'translate', t: 'Translate' },
                        { v: 'rotate', t: 'Rotate' },
                        { v: 'scale', t: 'Scale' }
                    ],
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'gizmo.type' },
                    onSelect: this.setType
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
            jsx(LabelGroup, { text: 'Size' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'gizmo.size' },
                    min: 0.1,
                    max: 2.0
                })
            ),
            jsx(LabelGroup, { text: 'Snap Increment' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'gizmo.snapIncrement' },
                    min: 1,
                    max: 10,
                    precision: 0
                })
            ),
            type === 'rotate' &&
                jsx(LabelGroup, { text: 'Legacy Rotation' },
                    jsx(BooleanInput, {
                        type: 'toggle',
                        binding: new BindingTwoWay(),
                        link: { observer, path: 'gizmo.legacyRotation' }
                    })
                )
        ),
        jsx(Panel, { headerText: 'Color' },
            jsx(LabelGroup, { text: 'X Axis' },
                jsx(ColorPicker, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'gizmo.xAxisColor' }
                })
            ),
            jsx(LabelGroup, { text: 'Y Axis' },
                jsx(ColorPicker, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'gizmo.yAxisColor' }
                })
            ),
            jsx(LabelGroup, { text: 'Z Axis' },
                jsx(ColorPicker, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'gizmo.zAxisColor' }
                })
            )
        ),
        jsx(Panel, { headerText: 'Intersection' },
            (type === 'translate' || type === 'scale') &&
                jsx(LabelGroup, { text: 'Line Tolerance' },
                    jsx(SliderInput, {
                        binding: new BindingTwoWay(),
                        link: { observer, path: 'gizmo.axisLineTolerance' },
                        min: 0,
                        max: 0.5,
                        precision: 2
                    })
                ),
            type === 'scale' &&
                jsx(LabelGroup, { text: 'Center Tolerance' },
                    jsx(SliderInput, {
                        binding: new BindingTwoWay(),
                        link: { observer, path: 'gizmo.axisCenterTolerance' },
                        min: 0,
                        max: 0.5,
                        precision: 2
                    })
                ),
            type === 'rotate' &&
                jsx(LabelGroup, { text: 'Ring Tolerance' },
                    jsx(SliderInput, {
                        binding: new BindingTwoWay(),
                        link: { observer, path: 'gizmo.ringTolerance' },
                        min: 0,
                        max: 0.5,
                        precision: 2
                    })
                )
        ),
        jsx(Panel, { headerText: 'Render' },
            (type === 'translate' || type === 'scale') &&
                jsx(LabelGroup, { text: 'Gap' },
                    jsx(SliderInput, {
                        binding: new BindingTwoWay(),
                        link: { observer, path: 'gizmo.axisGap' }
                    })
                ),
            (type === 'translate' || type === 'scale') &&
                jsx(LabelGroup, { text: 'Line Thickness' },
                    jsx(SliderInput, {
                        binding: new BindingTwoWay(),
                        link: { observer, path: 'gizmo.axisLineThickness' }
                    })
                ),
            (type === 'translate' || type === 'scale') &&
                jsx(LabelGroup, { text: 'Line Length' },
                    jsx(SliderInput, {
                        binding: new BindingTwoWay(),
                        link: { observer, path: 'gizmo.axisLineLength' }
                    })
                ),
            type === 'scale' &&
                jsx(LabelGroup, { text: 'Box Size' },
                    jsx(SliderInput, {
                        binding: new BindingTwoWay(),
                        link: { observer, path: 'gizmo.axisBoxSize' }
                    })
                ),
            type === 'translate' &&
                jsx(LabelGroup, { text: 'Arrow Thickness' },
                    jsx(SliderInput, {
                        binding: new BindingTwoWay(),
                        link: { observer, path: 'gizmo.axisArrowThickness' }
                    })
                ),
            type === 'translate' &&
                jsx(LabelGroup, { text: 'Arrow Length' },
                    jsx(SliderInput, {
                        binding: new BindingTwoWay(),
                        link: { observer, path: 'gizmo.axisArrowLength' }
                    })
                ),
            (type === 'translate' || type === 'scale') &&
                jsx(LabelGroup, { text: 'Plane Size' },
                    jsx(SliderInput, {
                        binding: new BindingTwoWay(),
                        link: { observer, path: 'gizmo.axisPlaneSize' }
                    })
                ),
            (type === 'translate' || type === 'scale') &&
                jsx(LabelGroup, { text: 'Plane Gap' },
                    jsx(SliderInput, {
                        binding: new BindingTwoWay(),
                        link: { observer, path: 'gizmo.axisPlaneGap' }
                    })
                ),
            type === 'scale' &&
                jsx(LabelGroup, { text: 'Center Size' },
                    jsx(SliderInput, {
                        binding: new BindingTwoWay(),
                        link: { observer, path: 'gizmo.axisCenterSize' }
                    })
                ),
            type === 'rotate' &&
                jsx(LabelGroup, { text: 'XYZ Tube Radius' },
                    jsx(SliderInput, {
                        binding: new BindingTwoWay(),
                        link: { observer, path: 'gizmo.xyzTubeRadius' }
                    })
                ),
            type === 'rotate' &&
                jsx(LabelGroup, { text: 'XYZ Ring Radius' },
                    jsx(SliderInput, {
                        binding: new BindingTwoWay(),
                        link: { observer, path: 'gizmo.xyzRingRadius' }
                    })
                ),
            type === 'rotate' &&
                jsx(LabelGroup, { text: 'Face Tube Radius' },
                    jsx(SliderInput, {
                        binding: new BindingTwoWay(),
                        link: { observer, path: 'gizmo.faceTubeRadius' }
                    })
                ),
            type === 'rotate' &&
                jsx(LabelGroup, { text: 'Face Ring Radius' },
                    jsx(SliderInput, {
                        binding: new BindingTwoWay(),
                        link: { observer, path: 'gizmo.faceRingRadius' },
                        max: 2
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
async function example({ canvas, deviceType, data, glslangPath, twgslPath, scriptsPath }) {
    class GizmoHandler {
        _type = 'translate';

        skipSetFire = false;

        constructor(app, camera) {
            const layer = new pc.Layer({
                name: 'Gizmo',
                clearDepthBuffer: true,
                opaqueSortMode: pc.SORTMODE_NONE,
                transparentSortMode: pc.SORTMODE_NONE
            });
            app.scene.layers.push(layer);
            camera.layers = camera.layers.concat(layer.id);

            this.gizmos = {
                translate: new pcx.GizmoTranslate(app, camera, layer),
                rotate: new pcx.GizmoRotate(app, camera, layer),
                scale: new pcx.GizmoScale(app, camera, layer)
            };
        }

        get gizmo() {
            return this.gizmos[this._type];
        }

        switch(type, nodes) {
            this.gizmo.detach();
            this._type = type ?? 'translate';
            const gizmo = this.gizmo;
            gizmo.attach(nodes);
            this.skipSetFire = true;
            data.set('gizmo', {
                type: type,
                size: gizmo.size,
                snapIncrement: gizmo.snapIncrement,
                legacyRotation: gizmo.legacyRotation,
                xAxisColor: Object.values(gizmo.xAxisColor),
                yAxisColor: Object.values(gizmo.yAxisColor),
                zAxisColor: Object.values(gizmo.zAxisColor),
                coordSpace: gizmo.coordSpace,
                axisLineTolerance: gizmo.axisLineTolerance,
                axisCenterTolerance: gizmo.axisCenterTolerance,
                ringTolerance: gizmo.ringTolerance,
                axisGap: gizmo.axisGap,
                axisLineThickness: gizmo.axisLineThickness,
                axisLineLength: gizmo.axisLineLength,
                axisArrowThickness: gizmo.axisArrowThickness,
                axisArrowLength: gizmo.axisArrowLength,
                axisBoxSize: gizmo.axisBoxSize,
                axisPlaneSize: gizmo.axisPlaneSize,
                axisPlaneGap: gizmo.axisPlaneGap,
                axisCenterSize: gizmo.axisCenterSize,
                xyzTubeRadius: gizmo.xyzTubeRadius,
                xyzRingRadius: gizmo.xyzRingRadius,
                faceTubeRadius: gizmo.faceTubeRadius,
                faceRingRadius: gizmo.faceRingRadius
            });
            this.skipSetFire = false;
        }
    }

    const gfxOptions = {
        deviceTypes: [deviceType],
        glslangUrl: glslangPath + 'glslang.js',
        twgslUrl: twgslPath + 'twgsl.js'
    };

    const device = await pc.createGraphicsDevice(canvas, gfxOptions);
    const createOptions = new pc.AppOptions();
    createOptions.graphicsDevice = device;
    createOptions.mouse = new pc.Mouse(document.body);
    createOptions.keyboard = new pc.Keyboard(window);

    createOptions.componentSystems = [
        pc.RenderComponentSystem,
        pc.CameraComponentSystem,
        pc.LightComponentSystem,
        pc.ScriptComponentSystem
    ];
    createOptions.resourceHandlers = [
        // @ts-ignore
        pc.TextureHandler,
        // @ts-ignore
        pc.ContainerHandler,
        // @ts-ignore
        pc.ScriptHandler
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

    // control keybinds
    const setType = (value) => {
        data.set('gizmo.type', value);
        this.top.setType(value);
    };
    window.addEventListener('keypress', (e) => {
        switch (e.key) {
            case 'x':
                data.set('gizmo.coordSpace', data.get('gizmo.coordSpace') === 'world' ? 'local' : 'world');
                break;
            case '1':
                setType('translate');
                break;
            case '2':
                setType('rotate');
                break;
            case '3':
                setType('scale');
                break;
        }
    });

    // assets
    const assets = {
        script: new pc.Asset('script', 'script', { url: scriptsPath + 'camera/orbit-camera.js' })
    };

    /**
     * @param {pc.Asset[] | number[]} assetList - The asset list.
     * @param {pc.AssetRegistry} assetRegistry - The asset registry.
     * @returns {Promise<void>} The promise.
     */
    function loadAssets(assetList, assetRegistry) {
        return new Promise((resolve) => {
            const assetListLoader = new pc.AssetListLoader(assetList, assetRegistry);
            assetListLoader.load(resolve);
        });
    }
    await loadAssets(Object.values(assets), app.assets);

    app.start();

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
    camera.addComponent("script");
    camera.script.create("orbitCamera");
    camera.script.create("orbitCameraInputMouse");
    camera.script.create("orbitCameraInputTouch");
    camera.rotate(-20, 45, 0);
    app.root.addChild(camera);

    // create directional light entity
    const light = new pc.Entity('light');
    light.addComponent('light');
    app.root.addChild(light);
    light.setEulerAngles(45, 20, 0);

    // create gizmo
    const gizmoHandler = new GizmoHandler(app, camera.camera);
    gizmoHandler.switch('translate', [boxA, boxB]);

    const tmpC = new pc.Color();
    data.on('*:set', (/** @type {string} */ path, value) => {
        const pathArray = path.split('.');

        switch (pathArray[0]) {
            case 'camera':
                switch (pathArray[1]) {
                    case 'proj':
                        camera.camera.projection = value - 1;
                        break;
                    case 'fov':
                        camera.camera.fov = value;
                        break;
                    case 'orthoHeight':
                        camera.camera.orthoHeight = value;
                        break;
                }
                return;
            case 'gizmo':
                if (gizmoHandler.skipSetFire) {
                    return;
                }
                switch (pathArray[1]) {
                    case 'type':
                        gizmoHandler.switch(value, [boxA, boxB]);
                        break;
                    case 'xAxisColor':
                    case 'yAxisColor':
                    case 'zAxisColor':
                        tmpC.set(...value);
                        gizmoHandler.gizmo[pathArray[1]] = tmpC;
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
