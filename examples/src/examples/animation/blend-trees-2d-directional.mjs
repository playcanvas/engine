import * as pc from 'playcanvas';

/**
 * @param {import('../../app/example.mjs').ControlOptions} options - The options.
 * @returns {JSX.Element} The returned JSX Element.
 */
function controls({ observer, ReactPCUI, React, jsx, fragment }) {
    const { useEffect, useRef } = React;
    /** @type {React.MutableRefObject<HTMLCanvasElement>} */
    const canvasRef = useRef(null);
    useEffect(() => {
        const canvas = canvasRef.current;
        // @ts-ignore engine-tsd
        /** @type {pc.Entity} */
        const modelEntity = pc.app.root.findByName('model');
        const width = window.top.controlPanel.offsetWidth;
        const height = width;
        const halfWidth = Math.floor(width / 2);
        const halfHeight = Math.floor(height / 2);
        canvas.setAttribute('style', 'width: ' + width + 'px; height: ' + height + 'px;');
        canvas.setAttribute('width', width);
        canvas.setAttribute('height', height);
        const ctx = canvas.getContext('2d');
        let position = new pc.Vec2();
        const drawPosition = (ctx) => {
            ctx.clearRect(0, 0, width, height);
            ctx.fillStyle = "rgba(128, 128, 128, 0.5)";
            ctx.fillRect(0, 0, width, height);
            ctx.fillStyle = '#B1B8BA';
            ctx.fillRect(halfWidth, 0, 1, height);
            ctx.fillRect(0, halfHeight, width, 1);
            ctx.fillStyle = '#232e30';
            // @ts-ignore engine-tsd
            modelEntity.anim?.baseLayer._controller._states.Travel.animations.forEach((animNode) => {
                if (animNode.point) {
                    const posX = (animNode.point.x + 1) * halfWidth;
                    const posY = (animNode.point.y * -1 + 1) * halfHeight;
                    const width = 8;
                    const height = 8;

                    ctx.fillStyle = "#ffffff80";
                    ctx.beginPath();
                    ctx.arc(posX, posY, halfWidth * 0.5 * animNode.weight, 0, 2 * Math.PI);
                    ctx.fill();

                    ctx.fillStyle = '#283538';
                    ctx.beginPath();
                    ctx.moveTo(posX, posY - height / 2);
                    ctx.lineTo(posX - width / 2, posY);
                    ctx.lineTo(posX, posY + height / 2);
                    ctx.lineTo(posX + width / 2, posY);
                    ctx.closePath();
                    ctx.fill();
                }
            });
            ctx.fillStyle = '#F60';
            ctx.beginPath();
            ctx.arc((modelEntity.anim.getFloat('posX') + 1) * halfWidth, (modelEntity.anim.getFloat('posY') * -1 + 1) * halfHeight, 5, 0, 2 * Math.PI);
            ctx.fill();
            ctx.fillStyle = '#283538';
            ctx.stroke();
        };
        drawPosition(ctx);
        const mouseEvent = (e) => {
            if (e.buttons) {
                position = new pc.Vec2(e.offsetX, e.offsetY).mulScalar(1 / (width / 2)).sub(pc.Vec2.ONE);
                position.y *= -1.0;
                modelEntity.anim.setFloat('posX', position.x);
                modelEntity.anim.setFloat('posY', position.y);
                drawPosition(ctx);
            }
        };
        canvas.addEventListener('mousemove', mouseEvent);
        canvas.addEventListener('mousedown', mouseEvent);
    });
    return fragment(
        jsx("canvas", { ref: canvasRef })
    );
}

/**
 * @param {import('../../options.mjs').ExampleOptions} options - The example options.
 * @returns {Promise<pc.AppBase>} The example application.
 */
async function example({ canvas, deviceType, assetPath, glslangPath, twgslPath, scriptsPath }) {
    const assets = {
        model:     new pc.Asset('model',             'container', { url: assetPath + 'models/bitmoji.glb' }),
        idleAnim:  new pc.Asset('idleAnim',          'container', { url: assetPath + 'animations/bitmoji/idle.glb' }),
        walkAnim:  new pc.Asset('idleAnim',          'container', { url: assetPath + 'animations/bitmoji/walk.glb' }),
        jogAnim:   new pc.Asset('idleAnim',          'container', { url: assetPath + 'animations/bitmoji/run.glb' }),
        danceAnim: new pc.Asset('danceAnim',         'container', { url: assetPath + 'animations/bitmoji/win-dance.glb' }),
        helipad:   new pc.Asset('helipad-env-atlas', 'texture',   { url: assetPath + 'cubemaps/helipad-env-atlas.png' }, { type: pc.TEXTURETYPE_RGBP, mipmaps: false }),
        bloom:     new pc.Asset('bloom',             'script',    { url: scriptsPath + 'posteffects/posteffect-bloom.js' })
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
        pc.LightComponentSystem,
        pc.ScriptComponentSystem,
        pc.AnimComponentSystem
    ];
    createOptions.resourceHandlers = [
        // @ts-ignore
        pc.TextureHandler,
        // @ts-ignore
        pc.ContainerHandler,
        // @ts-ignore
        pc.ScriptHandler,
        // @ts-ignore
        pc.AnimClipHandler,
        // @ts-ignore
        pc.AnimStateGraphHandler
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
        // setup skydome
        app.scene.exposure = 2;
        app.scene.skyboxMip = 2;
        app.scene.envAtlas = assets.helipad.resource;

        // Create an Entity with a camera component
        const cameraEntity = new pc.Entity();
        cameraEntity.addComponent("camera", {
            clearColor: new pc.Color(0.1, 0.1, 0.1)
        });
        cameraEntity.translate(0, 0.75, 3);
        // add bloom postprocessing (this is ignored by the picker)
        cameraEntity.addComponent("script");
        cameraEntity.script.create("bloom", {
            attributes: {
                bloomIntensity: 1,
                bloomThreshold: 0.7,
                blurAmount: 4
            }
        });
        app.root.addChild(cameraEntity);

        // Create an entity with a light component
        const lightEntity = new pc.Entity();
        lightEntity.addComponent("light", {
            castShadows: true,
            intensity: 1.5,
            normalOffsetBias: 0.02,
            shadowType: pc.SHADOW_PCF5,
            shadowDistance: 6,
            shadowResolution: 2048,
            shadowBias: 0.02
        });
        app.root.addChild(lightEntity);
        lightEntity.setLocalEulerAngles(45, 30, 0);

        // create an entity from the loaded model using the render component
        const modelEntity = assets.model.resource.instantiateRenderEntity({
            castShadows: true
        });
        modelEntity.name = 'model';

        // add an anim component to the entity
        modelEntity.addComponent('anim', {
            activate: true
        });

        // create an anim state graph
        const animStateGraphData = {
            "layers": [
                {
                    "name": "locomotion",
                    "states": [
                        {
                            "name": "START"
                        },
                        {
                            "name": "Travel",
                            "speed": 1.0,
                            "loop": true,
                            "blendTree": {
                                "type": pc.ANIM_BLEND_2D_DIRECTIONAL,
                                "syncDurations": true,
                                "parameters": ["posX", "posY"],
                                "children": [
                                    {
                                        "name": "Idle",
                                        "point": [0.0, 0.0]
                                    },
                                    {
                                        "speed": -1,
                                        "name": "WalkBackwards",
                                        "point": [0.0, -0.5]
                                    },
                                    {
                                        "speed": 1,
                                        "name": "Walk",
                                        "point": [0.0, 0.5]
                                    },
                                    {
                                        "speed": 1,
                                        "name": "Jog",
                                        "point": [0.0, 1.0]
                                    }
                                ]
                            }
                        }
                    ],
                    "transitions": [
                        {
                            "from": "START",
                            "to": "Travel"
                        }
                    ]
                }
            ],
            "parameters": {
                "posX": {
                    "name": "posX",
                    "type": "FLOAT",
                    "value": 0
                },
                "posY": {
                    "name": "posY",
                    "type": "FLOAT",
                    "value": 0
                }
            }
        };

        // load the state graph into the anim component
        modelEntity.anim.loadStateGraph(animStateGraphData);

        // load the state graph asset resource into the anim component
        const locomotionLayer = modelEntity.anim.baseLayer;
        locomotionLayer.assignAnimation('Travel.Idle', assets.idleAnim.resource.animations[0].resource);
        locomotionLayer.assignAnimation('Travel.Walk', assets.walkAnim.resource.animations[0].resource);
        locomotionLayer.assignAnimation('Travel.WalkBackwards', assets.walkAnim.resource.animations[0].resource);
        locomotionLayer.assignAnimation('Travel.Jog', assets.jogAnim.resource.animations[0].resource);

        app.root.addChild(modelEntity);

        app.start();
    });
    return app;
}

class BlendTrees2DDirectionalExample {
    static CATEGORY = 'Animation';
    static WEBGPU_ENABLED = true;
    static controls = controls;
    static example = example;
}

export { BlendTrees2DDirectionalExample };
