import * as pc from 'playcanvas';

/**
 * @param {import('../../app/example.mjs').ControlOptions} options - The options.
 * @returns {JSX.Element} The returned JSX Element.
 */
function controls({ observer, ReactPCUI, jsx, fragment }) {
    const { BindingTwoWay, Container, Button, LabelGroup, Panel, SliderInput, SelectInput } = ReactPCUI;
    return fragment(
        jsx(Panel, { headerText: 'Sand simulation' },
            jsx(LabelGroup, { text: 'Brush' },
                jsx(SelectInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'options.brush' },
                    type: "string",
                    value: 1,
                    options: [
                        { v: 1, t: 'Sand' },
                        { v: 2, t: 'Stone' },
                        { v: 3, t: 'Water' }
                    ]
                })
            ),
            jsx(LabelGroup, { text: 'Brush size' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'options.brushSize' },
                    value: 3,
                    min: 1,
                    max: 12,
                    precision: 0
                })
            ),
            jsx(Container, { flex: true, flexGrow: 1 },
                jsx(Button, {
                    text: 'Reset',
                    onClick: () => observer.emit('reset')
                })
            )
        )
    );
}

/**
 * @typedef {{ 'sandSimulation.frag': string, 'renderOutput.frag': string }} Files
 * @typedef {import('../../options.mjs').ExampleOptions<Files>} Options
 * @param {Options} options - The example options.
 * @returns {Promise<pc.AppBase>} The example application.
 */
async function example({ canvas, data, deviceType, assetPath, files, glslangPath, twgslPath, dracoPath }) {

    const STEPS_PER_FRAME = 4;

    const PLANE_WIDTH = 10;
    const PLANE_HEIGHT = 10;

    const TEXTURE_RATIO = PLANE_WIDTH / PLANE_HEIGHT;
    const TEXTURE_HEIGHT = 512;
    const TEXTURE_WIDTH = TEXTURE_HEIGHT * TEXTURE_RATIO;

    // set up and load draco module, as the glb we load is draco compressed
    pc.WasmModule.setConfig('DracoDecoderModule', {
        glueUrl: dracoPath + 'draco.wasm.js',
        wasmUrl: dracoPath + 'draco.wasm.wasm',
        fallbackUrl: dracoPath + 'draco.js'
    });

    const assets = {
        noiseTexture: new pc.Asset('noise', 'texture', { url: assetPath + 'textures/clouds.jpg' }),
        font: new pc.Asset('font', 'font', { url: assetPath + 'fonts/courier.json' })
    };

    const gfxOptions = {
        deviceTypes: [deviceType],
        glslangUrl: glslangPath + 'glslang.js',
        twgslUrl: twgslPath + 'twgsl.js'
    };

    const device = await pc.createGraphicsDevice(canvas, gfxOptions);
    const createOptions = new pc.AppOptions();
    createOptions.graphicsDevice = device;
    createOptions.keyboard = new pc.Keyboard(document.body);

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

    // Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
    app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
    app.setCanvasResolution(pc.RESOLUTION_AUTO);

    // Ensure canvas is resized when window changes size
    const resize = () => app.resizeCanvas();
    window.addEventListener('resize', resize);
    app.on('destroy', () => {
        window.removeEventListener('resize', resize);
    });

    // Helpers to create integer pixel buffers and render targets which we will ping-pong between
    const createPixelColorBuffer = (i) => {
        return new pc.Texture(device, {
            name: `PixelBuffer_${i}`,
            width: TEXTURE_WIDTH,
            height: TEXTURE_HEIGHT,
            format: pc.PIXELFORMAT_RG8UI,
            addressU: pc.ADDRESS_CLAMP_TO_EDGE,
            addressV: pc.ADDRESS_CLAMP_TO_EDGE
        });
    };
    const createPixelRenderTarget = (i, colorBuffer) => {
        return new pc.RenderTarget({
            name: `PixelRenderTarget_${i}`,
            colorBuffer: colorBuffer
        });
    };

    const sandShader = pc.createShaderFromCode(
        device,
        files['quad.vert'],
        files['sandSimulation.frag'],
        'SandShader',
        { aPosition: pc.SEMANTIC_POSITION },
        false,
        'uvec2'
    );

    const outputShader = pc.createShaderFromCode(
        device,
        files['quad.vert'],
        files['renderOutput.frag'],
        'RenderOutputShader',
        { aPosition: pc.SEMANTIC_POSITION }
    );

    // Create our integer pixel buffers and render targets
    const pixelColorBuffers = [createPixelColorBuffer(0), createPixelColorBuffer(1)];
    const pixelRenderTargets = [
        createPixelRenderTarget(0, pixelColorBuffers[0]),
        createPixelRenderTarget(1, pixelColorBuffers[1])
    ];

    const sourceTexture = pixelColorBuffers[0];
    const sourceRenderTarget = pixelRenderTargets[0];
    const sandRenderTarget = pixelRenderTargets[1];
    const sandTexture = pixelColorBuffers[1];

    const sourceTextureData = sourceTexture.lock();
    for (let x = 0; x < sourceTexture.width; x++) {
        for (let y = 0; y < sourceTexture.height; y++) {
            const i = (y * sourceTexture.width + x) * 2;
            if (x > sourceTexture.width * 0.3 && x < sourceTexture.width * 0.7 && y > sourceTexture.height * 0.7 && y < sourceTexture.height * 0.8) {
                sourceTextureData[i] = 2;
            } else if (Math.random() > 0.94) {
                sourceTextureData[i] = 1;
                sourceTextureData[i] |= (Math.floor(Math.random() * 15) << 4);
            } else {
                sourceTextureData[i] = 0;
            }
        }
    }
    sourceTexture.unlock();

    const outputTexture = new pc.Texture(device, {
        name: 'OutputTexture',
        width: TEXTURE_WIDTH,
        height: TEXTURE_HEIGHT,
        format: pc.PIXELFORMAT_RGBA8,
        minFilter: pc.FILTER_LINEAR_MIPMAP_LINEAR,
        magFilter: pc.FILTER_LINEAR,
        addressU: pc.ADDRESS_REPEAT,
        addressV: pc.ADDRESS_REPEAT
    });

    const outputRenderTarget = createPixelRenderTarget(2, outputTexture);


    const assetListLoader = new pc.AssetListLoader(Object.values(assets), app.assets);
    assetListLoader.load(() => {

        data.set('options', {
            brush: 1,
            brushSize: 3
        });

        app.start();

        // Create an Entity with a camera component
        const cameraEntity = new pc.Entity();
        cameraEntity.addComponent("camera", {
            clearColor: new pc.Color(0.4, 0.45, 0.5),
            farClip: 500
        });

        // add camera to the world
        cameraEntity.setPosition(0, 5, 15);
        cameraEntity.lookAt(0, 5, 0);
        app.root.addChild(cameraEntity);
        if (cameraEntity.camera === undefined) throw new Error('Camera component expected');

        // create material used on the geometry
        const groundMaterial = new pc.StandardMaterial();
        groundMaterial.gloss = 0.6;
        groundMaterial.metalness = 0.4;
        groundMaterial.diffuse = new pc.Color(0.95, 0.85, 0.85);
        groundMaterial.useMetalness = true;
        groundMaterial.useLighting = true;
        groundMaterial.update();

        const ground = new pc.Entity();
        ground.addComponent('render', {
            castShadows: false,
            castShadowsLightmap: false,
            lightmapped: false,
            type: "plane",
            material: groundMaterial
        });
        app.root.addChild(ground);
        ground.setLocalPosition(0, 0, 0);
        ground.setLocalScale(40, 40, 40);

        // Create a directional light
        const lightEntity = new pc.Entity();
        lightEntity.addComponent("light", {
            type: "directional",
            color: pc.Color.WHITE,
            range: 100,
            intensity: 1,
            shadowDistance: 256,
            castShadows: true,
            shadowBias: 0.1
            // normalOffsetBias: 0.2
        });
        lightEntity.setLocalEulerAngles(60, 40, 0);
        lightEntity.setLocalPosition(0, 10, 0);
        app.root.addChild(lightEntity);

        // create a plane called gameScreen to display rendered texture
        const gameScreen = new pc.Entity();
        gameScreen.addComponent('render', {
            castShadows: true,
            receiveShadows: false,
            castShadowsLightmap: false,
            lightmapped: false,
            type: "plane"
        });
        if (!gameScreen.render) throw new Error('Render component expected');
        gameScreen.setLocalPosition(0, 5, 0);
        gameScreen.setLocalScale(PLANE_WIDTH, 1, PLANE_HEIGHT);
        gameScreen.setEulerAngles(90, 0, 0);
        const gamePlane = new pc.Plane(new pc.Vec3(0, 0, 1), 0);
        // const gameScreenAabb = new pc.BoundingBox();
        // gameScreenAabb.center = new pc.Vec3(0, 5, 1);
        // gameScreenAabb.halfExtents = new pc.Vec3(7.5, 5, 1);

        /** @type {pc.StandardMaterial} */
        const gameScreenMaterial = gameScreen.render.material;
        gameScreenMaterial.emissiveMap = outputTexture;     // assign the rendered texture as an emissive texture
        gameScreenMaterial.useLighting = false;
        gameScreenMaterial.update();

        app.root.addChild(gameScreen);

        // Slightly rotate the camera to face the mouse cursor
        const mouse = new pc.Mouse(document.body);
        const lookRange = 1.5;
        const mouseRay = new pc.Ray();
        const planePoint = new pc.Vec3();
        const mousePos = new pc.Vec2();
        let mouseState = 0;
        mouse.disableContextMenu();
        mouse.on(pc.EVENT_MOUSEDOWN, function (event) {
            if (event.button === pc.MOUSEBUTTON_LEFT) {
                mouseState = 1;
            } else if (event.button === pc.MOUSEBUTTON_RIGHT) {
                mouseState = 2;
            }
        });
        mouse.on(pc.EVENT_MOUSEUP, function () {
            mouseState = 0;
        });
        mouse.on(pc.EVENT_MOUSEMOVE, function (event) {
            const x = event.x;
            const y = event.y;

            mousePos.x = x;
            mousePos.y = y;

            const centerX = app.graphicsDevice.width / 2;
            const centerY = app.graphicsDevice.height / 2;

            const xOffset = (x - centerX) / app.graphicsDevice.width;
            const yOffset = (y - centerY) / app.graphicsDevice.height;

            cameraEntity.lookAt(xOffset * lookRange, 5 - yOffset * lookRange, 0);
            if (cameraEntity.camera) {
                cameraEntity.camera.screenToWorld(event.x, event.y, cameraEntity.camera.farClip, mouseRay.direction);
                mouseRay.origin.copy(cameraEntity.getPosition());
                mouseRay.direction.sub(mouseRay.origin).normalize();
                gamePlane.intersectsRay(mouseRay, planePoint);
                planePoint.x = (PLANE_WIDTH / 2) + planePoint.x;
                planePoint.y = PLANE_HEIGHT - planePoint.y;
                mousePos.set(planePoint.x / PLANE_WIDTH, planePoint.y / PLANE_HEIGHT);
            }
        });

        const worldLayer = app.scene.layers.getLayerByName("World");
        if (!worldLayer) throw new Error('World layer expected');

        const mousePosition = new Float32Array(2);

        // Create a 2D screen
        const screen = new pc.Entity();
        screen.addComponent("screen", {
            referenceResolution: new pc.Vec2(1280, 720),
            scaleBlend: 0.5,
            scaleMode: pc.SCALEMODE_BLEND,
            screenSpace: true
        });
        app.root.addChild(screen);

        // Markup Text with wrap
        const textMarkup = new pc.Entity();
        textMarkup.setLocalPosition(0, 50, 0);
        textMarkup.addComponent("element", {
            alignment: new pc.Vec2(1.0, 0.0),
            pivot: new pc.Vec2(0.0, 0.0),
            anchor: new pc.Vec4(0.25, 0.01, 0.96, 0.99),
            fontAsset: assets.font.id,
            fontSize: 16,
            text: 'Left click: add\nRight click: remove\nPress space: reset',
            width: 500,
            height: 100,
            autoWidth: false,
            autoHeight: false,
            wrapLines: true,
            enableMarkup: true,
            type: pc.ELEMENTTYPE_TEXT
        });
        screen.addChild(textMarkup);

        // update things every frame
        let passNum = 0;
        app.on("update", function (/** @type {number} */dt) {

            mousePosition[0] = mousePos.x;
            mousePosition[1] = mousePos.y;

            const brushRadius = data.get('options.brushSize') / Math.max(TEXTURE_WIDTH, TEXTURE_HEIGHT);
            const brush = data.get('options.brush') ?? 1;

            // Run the sand simulation shader
            for (let i = 0; i < STEPS_PER_FRAME; i++) {
                device.scope.resolve('sourceTexture').setValue(sourceTexture);
                device.scope.resolve('mousePosition').setValue(mousePosition);
                device.scope.resolve('mouseButton').setValue(mouseState);
                device.scope.resolve('brush').setValue(brush);
                device.scope.resolve('brushRadius').setValue(brushRadius);
                device.scope.resolve('passNum').setValue(passNum);
                pc.drawQuadWithShader(device, sandRenderTarget, sandShader);
                device.copyRenderTarget(sandRenderTarget, sourceRenderTarget, true, false);
                passNum = (passNum + 1) % 3;
            }

            device.scope.resolve('sourceTexture').setValue(sandRenderTarget.colorBuffer);
            device.scope.resolve('mousePosition').setValue(mousePosition);
            device.scope.resolve('brushRadius').setValue(brushRadius);
            pc.drawQuadWithShader(device, outputRenderTarget, outputShader);

        });
    });
    return app;
}

export class IntegerTextureExample {
    static CATEGORY = 'Graphics';
    static WEBGPU_ENABLED = true;
    static WEBGL1_DISABLED = true;
    static example = example;
    static controls = controls;
    static sharedShaderChunks = {
        'sandCommon.frag': /* glsl */`
            const uint AIR = 0u;
            const uint SAND = 1u;
            const uint WALL = 2u;
            const uint WATER = 3u;
                                    
            bool isInBounds(ivec2 c, ivec2 size) {
                return c.x > 0 && c.x < size.x - 1 && c.y > 0 && c.y < size.y - 1;
            }
            
            int seed;

            float rand() {
                int n = (seed++ << 13) ^ seed;
                return float((n * (n * n * 15731 + 789221) + 1376312589) & 0x7fffffff) / 2147483647.0;
            }
            
            #define INIT_SEED() \
                seed = int(uv0.x + uv0.y + float(coord.x) + float(coord.y)); \
                seed = int(rand() * 2147483647.0) + int(passNum);

            struct Particle {
                uint element;        // 3 bits
                bool movedThisFrame; // 1 bit
                uint shade;          // 4 bits
            };
            
            uvec2 pack(Particle particle) {
                uint packed = 0u;
                packed |= (particle.element & 0x7u);      // Store element in the lowest 3 bits
                packed |= ((particle.movedThisFrame ? 1u : 0u) << 3); // Store movedThisFrame in the next bit
                packed |= (particle.shade << 4);          // Store shade in the next 4 bits
            
                return uvec2(packed, 0u); // Second component is reserved/unused
            }
            
            Particle unpack(uvec2 pixel) {
                uint packed = pixel.x;
            
                Particle particle;
                particle.element = packed & 0x7u;                         // Extract lowest 3 bits
                particle.movedThisFrame = ((packed >> 3) & 0x1u) != 0u;   // Extract the next bit
                particle.shade = (packed >> 4) & 0xFu;                    // Extract the next 4 bits
            
                return particle;
            }

            Particle getParticle(ivec2 c) {
                uvec2 val = texelFetch(sourceTexture, c, 0).rg;
                return unpack(val);
            }
        `
    };

    static FILES = {
        'quad.vert': /* glsl */`
            attribute vec2 aPosition;
            varying vec2 uv0;
            void main(void)
            {
                gl_Position = vec4(aPosition, 0.0, 1.0);
                uv0 = getImageEffectUV((aPosition.xy + 1.0) * 0.5);
            }
        `,
        'sandSimulation.frag': /* glsl */`
            precision highp usampler2D;

            uniform usampler2D sourceTexture;
            uniform vec2 mousePosition;
            uniform uint mouseButton;
            uniform uint passNum;
            uniform uint brush;
            uniform float brushRadius;

            varying vec2 uv0;

            ${IntegerTextureExample.sharedShaderChunks['sandCommon.frag']}
                        
            void main() {

                ivec2 size = textureSize(sourceTexture, 0);
                ivec2 coord = ivec2(uv0 * vec2(size));

                if (!isInBounds(coord, size)) {
                    //gl_FragColor = uvec2(WALL, 0u);
                    gl_FragColor = uvec2(WALL, 0u);
                    return;
                }
            
                Particle currentParticle = getParticle(coord);
            
                Particle nextState = currentParticle;
                nextState.movedThisFrame = false;
                float mouseDist = distance(mousePosition, uv0);

                INIT_SEED();

                int dir = int(passNum % 3u) - 1;
                if (rand() > 0.75) {
                    dir = ((dir + 1) % 3) - 1;
                }

                int upDown = 1;
                if (rand() > 0.99) {
                    upDown = 0;
                }

                if (mouseButton == 1u && mouseDist < brushRadius) {
                    nextState.element = brush;
                    nextState.movedThisFrame = true;
                    nextState.shade = uint(rand() * 15.0);
                } else if (mouseButton == 2u && mouseDist < brushRadius) {
                    nextState.element = AIR;
                    nextState.movedThisFrame = false;
                    nextState.shade = uint(rand() * 15.0);
                } else if (currentParticle.element == AIR) {
                    Particle particleAbove = getParticle(coord + ivec2(dir, -upDown));
                    if (particleAbove.element == SAND) {
                        nextState = particleAbove;
                        nextState.movedThisFrame = true;
                    }
                } else if (currentParticle.element == SAND) {
                    Particle particleBelow = getParticle(coord + ivec2(-dir, upDown));
                    if ((particleBelow.element == AIR) && !particleBelow.movedThisFrame) {
                        nextState = particleBelow;
                        nextState.movedThisFrame = false;
                    }
                }
            
                gl_FragColor = pack(nextState);
            }
        `,
        'renderOutput.frag': /* glsl */`
            precision highp usampler2D;
            uniform usampler2D sourceTexture;
            uniform vec2 mousePosition;
            uniform float brushRadius;
            varying vec2 uv0;

            vec3 whiteColor = vec3(1.0);
            vec3 skyBlueColor = vec3(0.6, 0.7, 0.8);
            vec3 yellowSandColor = vec3(0.73, 0.58, 0.26);
            vec3 grayWallColor = vec3(0.5, 0.5, 0.5);
            vec3 waterBlueColor = vec3(0.2, 0.3, 0.8);

            float circle( vec2 p, float r ) {
                return length(p) - r;
            }

            const float circleOutline = 0.01;

            ${IntegerTextureExample.sharedShaderChunks['sandCommon.frag']}

            void main() {
                ivec2 size = textureSize(sourceTexture, 0);
                ivec2 coord = ivec2(uv0 * vec2(size));
                Particle particle = getParticle(coord);
                
                vec3 gameColor = skyBlueColor;
                if (particle.element == SAND) {
                    gameColor = mix(yellowSandColor, whiteColor, (float(particle.shade) / 15.0) * 0.5);
                } else if (particle.element == WALL) {
                    gameColor = grayWallColor;
                } else if (particle.element == WATER) {
                    gameColor = mix(waterBlueColor, whiteColor, (float(particle.shade) / 15.0) * 0.75);
                }

                float d = length(uv0 - mousePosition);
                float wd = fwidth(d);
                float circle = smoothstep(brushRadius + wd, brushRadius, d);
                float circleInner = smoothstep(brushRadius - circleOutline + wd, brushRadius - circleOutline, d);
                float brush = max(circle - circleInner, 0.0) * 0.5;

                vec3 outColor = mix(gameColor, vec3(1.0), brush);
                //vec3 outColor = mix(vec3(1.0), gameColor, circle);

                gl_FragColor = vec4(outColor, 1.0);
            }
        `
    };
}
