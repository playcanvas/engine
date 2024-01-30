import * as pc from 'playcanvas';

/**
 * @param {import('../../app/example.mjs').ControlOptions} options - The options.
 * @returns {JSX.Element} The returned JSX Element.
 */
function controls({ observer, ReactPCUI, React, jsx, fragment }) {
    const { BindingTwoWay, LabelGroup, Panel, ColorPicker, SliderInput, SelectInput } = ReactPCUI;

    const [type, setType] = React.useState('translate');
    const [proj, setProj] = React.useState(pc.PROJECTION_PERSPECTIVE);

    // @ts-ignore
    window.setType = (/** @type {string} */ value) => setType(value);

    // @ts-ignore
    window.setProj = (/** @type {number} */ value) => setProj(value);

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
            (type === 'translate' || type === 'rotate') &&
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
                    link: { observer, path: 'camera.proj' },
                    onSelect: value => setProj((parseInt(value) || 1) - 1)
                })
            ),
            (proj === pc.PROJECTION_PERSPECTIVE) &&
                jsx(LabelGroup, { text: 'FOV' },
                    jsx(SliderInput, {
                        binding: new BindingTwoWay(),
                        link: { observer, path: 'camera.fov' },
                        min: 30,
                        max: 100
                    })
                )
        )
    );
}

/**
 * @param {import('../../options.mjs').ExampleOptions} options - The example options.
 * @returns {Promise<pc.AppBase>} The example application.
 */
async function example({ pcx, canvas, deviceType, data, glslangPath, twgslPath, scriptsPath }) {

    // Class for handling gizmos
    class GizmoHandler {
        /**
         * Gizmo type.
         *
         * @type {string}
         * @private
         */
        _type = 'translate';

        /**
         * Object to reference each gizmo.
         *
         * @type {pcx.Gizmo}
         * @private
         */
        _gizmos;

        /**
         * Nodes to attach to active gizmo.
         *
         * @type {pc.GraphNode[]}
         * @private
         */
        _nodes = [];

        /**
         * Flag to ignore picker on gizmo pointer events.
         *
         * @type {boolean}
         * @private
         */
        _ignorePicker = false;

        /**
         * Flag to skip data set from firing event.
         *
         * @type {boolean}
         * @private
         */
        _skipSetFire = false;


        /**
         * @param {pc.AppBase} app - The application.
         * @param {pc.CameraComponent | undefined} camera - The camera component.
         * @param {pc.Layer} layer - The gizmo layer
         */
        constructor(app, camera, layer) {
            this._gizmos = {
                translate: new pcx.TranslateGizmo(app, camera, layer),
                rotate: new pcx.RotateGizmo(app, camera, layer),
                scale: new pcx.ScaleGizmo(app, camera, layer)
            };

            for (const type in this._gizmos) {
                const gizmo = this._gizmos[type];
                gizmo.on('pointer:down', (/** @type {number} */ x, /** @type {number} */ y, /** @type {pc.MeshInstance} */ meshInstance) => {
                    this._ignorePicker = !!meshInstance;
                });
                gizmo.on('pointer:up', () => {
                    this._ignorePicker = false;
                });
            }
        }

        get gizmo() {
            return this._gizmos[this._type];
        }

        get ignorePicker() {
            return this._ignorePicker;
        }

        get skipSetFire() {
            return this._skipSetFire;
        }

        /**
         * @param {string} type - The transform gizmo type.
         */
        _updateData(type) {
            const gizmo = this.gizmo;
            this._skipSetFire = true;
            data.set('gizmo', {
                type: type,
                size: gizmo.size,
                snapIncrement: gizmo.snapIncrement,
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
            this._skipSetFire = false;
        }

        /**
         * Adds single node to active gizmo.
         *
         * @param {pc.GraphNode} node - The node to add.
         * @param {boolean} clear - To clear the node array.
         */
        add(node, clear = false) {
            if (clear) {
                this._nodes.length = 0;
            }
            if (this._nodes.indexOf(node) === -1) {
                this._nodes.push(node);
            }
            this.gizmo.attach(this._nodes);
        }

        /**
         * Clear all nodes.
         */
        clear() {
            this._nodes.length = 0;
            this.gizmo.detach();
        }

        /**
         * Switches between gizmo types
         *
         * @param {string} type - The transform gizmo type.
         */
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

    /**
     * @param {pc.Color} color - The color.
     * @returns {pc.Material} - The standard material.
     */
    function createMaterial(color) {
        const material = new pc.StandardMaterial();
        material.diffuse = color;
        return material;
    }

    // create entities
    const box = new pc.Entity('box');
    box.addComponent('render', {
        type: 'box',
        material: createMaterial(new pc.Color(0.8, 1, 1))
    });
    box.setPosition(1, 0, 1);
    app.root.addChild(box);

    const sphere = new pc.Entity('sphere');
    sphere.addComponent('render', {
        type: 'sphere',
        material: createMaterial(new pc.Color(1, 0.8, 1))
    });
    sphere.setPosition(-1, 0, 1);
    app.root.addChild(sphere);

    const cone = new pc.Entity('cone');
    cone.addComponent('render', {
        type: 'cone',
        material: createMaterial(new pc.Color(1, 1, 0.8))
    });
    cone.setPosition(-1, 0, -1);
    cone.setLocalScale(1.5, 2.25, 1.5);
    app.root.addChild(cone);

    const capsule = new pc.Entity('capsule');
    capsule.addComponent('render', {
        type: 'capsule',
        material: createMaterial(new pc.Color(0.8, 0.8, 1))
    });
    capsule.setPosition(1, 0, -1);
    app.root.addChild(capsule);

    // create camera entity
    data.set('camera', {
        proj: pc.PROJECTION_PERSPECTIVE + 1,
        dist: 1,
        fov: 45,
        orthoHeight: 10
    });
    const camera = new pc.Entity('camera');
    camera.addComponent('camera', {
        clearColor: new pc.Color(0.1, 0.1, 0.1)
    });
    camera.addComponent("script");
    const orbitCamera = camera.script.create("orbitCamera");
    camera.script.create("orbitCameraInputMouse");
    camera.script.create("orbitCameraInputTouch");
    camera.setPosition(1, 1, 1);
    app.root.addChild(camera);
    orbitCamera.distance = 14;

    // create 3-point lighting
    const backLight = new pc.Entity('light');
    backLight.addComponent('light', {
        intensity: 0.5
    });
    app.root.addChild(backLight);
    backLight.setEulerAngles(-60, 0, 90);

    const fillLight = new pc.Entity('light');
    fillLight.addComponent('light', {
        intensity: 0.5
    });
    app.root.addChild(fillLight);
    fillLight.setEulerAngles(45, 0, 0);

    const keyLight = new pc.Entity('light');
    keyLight.addComponent('light', {
        intensity: 1
    });
    app.root.addChild(keyLight);
    keyLight.setEulerAngles(0, 0, -60);

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
    gizmoHandler.switch('translate');
    gizmoHandler.add(box);
    this.focus();

    // wrappers for control state changes
    const setType = (/** @type {string} */ value) => {
        data.set('gizmo.type', value);

        // call method from top context (same as controls)
        // @ts-ignore
        window.top.setType(value);
    };
    const setProj = (/** @type {number} */ value) => {
        data.set('camera.proj', value + 1);

        // call method from top context (same as controls)
        // @ts-ignore
        window.top.setProj(value);
    };

    const keydown = (/** @type {KeyboardEvent} */ e) => {
        gizmoHandler.gizmo.snap = !!e.shiftKey;
        gizmoHandler.gizmo.uniform = !e.ctrlKey;
    };
    const keyup = (/** @type {KeyboardEvent} */ e) => {
        gizmoHandler.gizmo.snap = !!e.shiftKey;
        gizmoHandler.gizmo.uniform = !e.ctrlKey;
    };
    const keypress = (/** @type {KeyboardEvent} */ e) => {
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
            case 'p':
                setProj(pc.PROJECTION_PERSPECTIVE);
                break;
            case 'o':
                setProj(pc.PROJECTION_ORTHOGRAPHIC);
                break;
        }
    };
    window.addEventListener('keydown', keydown);
    window.addEventListener('keyup', keyup);
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
                        // @ts-ignore
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
    const picker = new pc.Picker(app, canvas.clientWidth, canvas.clientHeight);
    const worldLayer = app.scene.layers.getLayerByName("World");
    const pickerLayers = [worldLayer];

    const onPointerDown = (/** @type {PointerEvent} */ e) => {
        if (gizmoHandler.ignorePicker) {
            return;
        }

        if (picker) {
            picker.resize(canvas.clientWidth, canvas.clientHeight);
            picker.prepare(camera.camera, app.scene, pickerLayers);
        }

        const selection = picker.getSelection(e.clientX - 1, e.clientY - 1, 2, 2);
        if (!selection[0]) {
            gizmoHandler.clear();
            return;
        }

        gizmoHandler.add(selection[0].node, !e.ctrlKey && !e.metaKey);
    };
    window.addEventListener('pointerdown', onPointerDown);

    const gridColor = new pc.Color(1, 1, 1, 0.5);
    const gridHalfSize = 4;
    /**
     * @type {pc.Vec3[]}
     */
    const gridLines = [];
    for (let i = 0; i < gridHalfSize * 2 + 1; i++) {
        gridLines.push(new pc.Vec3(-gridHalfSize, 0, i - gridHalfSize), new pc.Vec3(gridHalfSize, 0, i - gridHalfSize));
        gridLines.push(new pc.Vec3(i - gridHalfSize, 0, -gridHalfSize), new pc.Vec3(i - gridHalfSize, 0, gridHalfSize));
    }
    app.on('update', () => {
        app.drawLines(gridLines, gridColor);
    });

    app.on('destroy', () => {
        gizmoHandler.destroy();

        window.removeEventListener('resize', resize);
        window.removeEventListener('keydown', keydown);
        window.removeEventListener('keyup', keyup);
        window.removeEventListener('keypress', keypress);
        window.removeEventListener('pointerdown', onPointerDown);
    });

    return app;
}

class GizmosExample {
    static CATEGORY = 'Misc';
    static WEBGPU_ENABLED = false;
    static controls = controls;
    static example = example;
}

export { GizmosExample };
