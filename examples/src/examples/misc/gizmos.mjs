import * as pc from 'playcanvas';

/**
 * @param {import('../../app/example.mjs').ControlOptions} options - The options.
 * @returns {JSX.Element} The returned JSX Element.
 */
function controls({ observer, ReactPCUI, React, jsx, fragment }) {
    const { BindingTwoWay, LabelGroup, Panel, BooleanInput, ColorPicker, SliderInput, SelectInput } = ReactPCUI;

    const [type, setType] = React.useState('translate');

    window.setType = (value) => setType(value);

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
                        link: { observer, path: 'gizmo.useLegacyRotation' }
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
    // Class for handling gizmos
    class GizmoHandler {
        _type = 'translate';

        _nodes = [];

        skipSetFire = false;

        constructor(app, camera, layer) {
            this._gizmos = {
                translate: new pcx.GizmoTranslate(app, camera, layer),
                rotate: new pcx.GizmoRotate(app, camera, layer),
                scale: new pcx.GizmoScale(app, camera, layer)
            };
        }

        get gizmo() {
            return this._gizmos[this._type];
        }

        _updateData(type) {
            const gizmo = this.gizmo;
            this.skipSetFire = true;
            data.set('gizmo', {
                type: type,
                size: gizmo.size,
                snapIncrement: gizmo.snapIncrement,
                useLegacyRotation: gizmo.useLegacyRotation,
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

        attach(nodes) {
            for (let i = 0; i < nodes.length; i++) {
                const node = nodes[i];
                if (this._nodes.indexOf(node) === -1) {
                    this._nodes.push(node);
                }
            }
        }

        detach() {
            this._nodes.length = 0;
        }

        switch(type) {
            this.gizmo.detach();
            this._type = type ?? 'translate';
            this.gizmo.attach(this._nodes);
            this._updateData(type);
        }

        destroy() {
            for (const type in this._gizmos) {
                this._gizmos[type].destroy();
            }
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

    // load assets
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

    // create gizmoLayer
    const gizmoLayer = new pc.Layer({
        name: 'Gizmo',
        clearDepthBuffer: true,
        opaqueSortMode: pc.SORTMODE_NONE,
        transparentSortMode: pc.SORTMODE_NONE
    });
    app.scene.layers.push(gizmoLayer);
    camera.camera.layers = camera.camera.layers.concat(gizmoLayer.id);

    // create gizmo
    const gizmoHandler = new GizmoHandler(app, camera.camera, gizmoLayer);
    gizmoHandler.attach([boxA, boxB]);
    gizmoHandler.switch('translate');

    // Change gizmo mode keybinds
    const setType = (value) => {
        data.set('gizmo.type', value);

        // call method from top context (same as controls)
        window.top.setType(value);
    };
    const keypress = (e) => {
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
    };
    window.addEventListener('keypress', keypress);

    // Gizmo and camera set handler
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
                        gizmoHandler.switch(value);
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

    // Picker
    // const picker = new pc.Picker(app, canvas.clientWidth, canvas.clientHeight);
    // const worldLayer = app.scene.layers.getLayerByName("World");
    // const pickerLayers = [worldLayer, gizmoLayer];

    // const onPointerDown = (e) => {
    //     if (picker) {
    //         picker.prepare(camera.camera, app.scene, pickerLayers);
    //     }

    //     const selection = picker.getSelection(e.clientX - 1, e.clientY - 1, 2, 2);
    //     console.log(selection[0]?.node.name);

    //     // // skip adding selection if selected gizmo
    //     // if (selection[0] &&
    //     //     selection[0].node.render.layers.indexOf(gizmoLayer.id) !== -1
    //     // ) {
    //     //     return;
    //     // }

    //     // // reset gizmo nodes if not multi select
    //     // if (!e.ctrlKey && !e.metaKey) {
    //     //     gizmoNodes.length = 0;
    //     // }

    //     // if (selection[0] && gizmoNodes.indexOf(selection[0].node) === -1) {
    //     //     gizmoNodes.push(selection[0].node);
    //     // }

    //     // gizmoHandler.switch('translate', gizmoNodes);
    // };

    // window.addEventListener('pointerdown', onPointerDown);

    app.on('destroy', () => {
        this.gizmoHandler.destroy();

        window.removeEventListener('resize', resize);
        window.removeEventListener('keypress', keypress);
        // window.removeEventListener('pointerdown', onPointerDown);
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
