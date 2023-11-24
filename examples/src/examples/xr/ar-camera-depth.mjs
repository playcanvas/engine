import * as pc from 'playcanvas';

/**
 * @typedef {import('../../options.mjs').ExampleOptions} ExampleOptions
 * @param {import('../../options.mjs').ExampleOptions} options - The example options.
 * @returns {Promise<pc.AppBase>} The example application.
 */
async function example({ canvas }) {
    /**
     * @param {string} msg - The message.
     */
    const message = function (msg) {
        /** @type {HTMLDivElement} */
        let el = document.querySelector('.message');
        if (!el) {
            el = document.createElement('div');
            el.classList.add('message');
            el.style.position = 'absolute';
            el.style.bottom = '96px';
            el.style.right = '0';
            el.style.padding = '8px 16px';
            el.style.fontFamily = 'Helvetica, Arial, sans-serif';
            el.style.color = '#fff';
            el.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
            document.body.append(el);
        }
        el.textContent = msg;
    };

    const app = new pc.Application(canvas, {
        mouse: new pc.Mouse(canvas),
        touch: new pc.TouchDevice(canvas),
        keyboard: new pc.Keyboard(window),
        graphicsDeviceOptions: { alpha: true }
    });

    app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
    app.setCanvasResolution(pc.RESOLUTION_AUTO);

    // Ensure canvas is resized when window changes size
    const resize = () => app.resizeCanvas();
    window.addEventListener('resize', resize);
    app.on('destroy', () => {
        window.removeEventListener('resize', resize);
    });

    // use device pixel ratio
    app.graphicsDevice.maxPixelRatio = window.devicePixelRatio;

    app.start();

    // create camera
    const c = new pc.Entity();
    c.addComponent('camera', {
        clearColor: new pc.Color(0, 0, 0, 0),
        farClip: 10000
    });
    app.root.addChild(c);

    const l = new pc.Entity();
    l.addComponent("light", {
        type: "spot",
        range: 30
    });
    l.translate(0, 10, 0);
    app.root.addChild(l);

    const material = new pc.StandardMaterial();

    const materialDepth = new pc.Material();
    materialDepth.cull = pc.CULLFACE_NONE;
    materialDepth.shader = app.scene.immediate.getShader('textureDepthSensing', /* glsl */ `
    varying vec2 uv0;
    uniform sampler2D colorMap;
    uniform mat4 matrix_depth_uv;
    uniform float depth_raw_to_meters;

    void main (void) {
        vec2 texCoord = (matrix_depth_uv * vec4(uv0.xy, 0.0, 1.0)).xy;
        vec2 packedDepth = texture2D(colorMap, texCoord).ra;
        float depth = dot(packedDepth, vec2(255.0, 256.0 * 255.0)) * depth_raw_to_meters; // m
        depth = 1.0 - min(depth / 8.0, 1.0); // 0..1 = 0m..8m
        gl_FragColor = vec4(depth, depth, depth, 1.0);
    }`);
    materialDepth.update();

    /**
     * @param {number} x - The x coordinate.
     * @param {number} y - The y coordinate.
     * @param {number} z - The z coordinate.
     */
    const createCube = function (x, y, z) {
        const cube = new pc.Entity();
        cube.addComponent("render", {
            type: "box"
        });
        cube.render.material = material;
        cube.setLocalScale(0.5, 0.5, 0.5);
        cube.translate(x * 0.5, y, z * 0.5);
        app.root.addChild(cube);
    };

    // create a grid of cubes
    const SIZE = 4;
    for (let x = 0; x < SIZE; x++) {
        for (let y = 0; y < SIZE; y++) {
            createCube(2 * x - SIZE, 0.25, 2 * y - SIZE);
        }
    }

    if (app.xr.supported) {
        const activate = function () {
            if (app.xr.isAvailable(pc.XRTYPE_AR)) {
                c.camera.startXr(pc.XRTYPE_AR, pc.XRSPACE_LOCALFLOOR, {
                    depthSensing: { // request access to camera depth
                        usagePreference: pc.XRDEPTHSENSINGUSAGE_GPU,
                        dataFormatPreference: pc.XRDEPTHSENSINGFORMAT_F32
                    }, 
                    callback: function (err) {
                        if (err) message("WebXR Immersive AR failed to start: " + err.message);
                    }
                });
            } else {
                message("Immersive AR is not available");
            }
        };

        app.mouse.on("mousedown", function () {
            if (!app.xr.active)
                activate();
        });

        if (app.touch) {
            app.touch.on("touchend", function (evt) {
                if (!app.xr.active) {
                    // if not in VR, activate
                    activate();
                } else {
                    // otherwise reset camera
                    c.camera.endXr();
                }

                evt.event.preventDefault();
                evt.event.stopPropagation();
            });
        }

        // end session by keyboard ESC
        app.keyboard.on('keydown', function (evt) {
            if (evt.key === pc.KEY_ESCAPE && app.xr.active) {
                app.xr.end();
            }
        });

        app.xr.on('start', function () {
            message("Immersive AR session has started");
            console.log('depth gpu optimized', app.xr.views.depthGpuOptimized);
            console.log('depth texture format', app.xr.views.depthPixelFormat);
        });
        app.xr.on('end', function () {
            message("Immersive AR session has ended");
        });
        app.xr.on('available:' + pc.XRTYPE_AR, function (available) {
            if (available) {
                if (!app.xr.views.supportedDepth) {
                    message("AR Camera Depth is not supported");
                } else {
                    message("Touch screen to start AR session");
                }
            } else {
                message("Immersive AR is not available");
            }
        });

        app.on('update', () => {
            // if camera depth is available
            if (app.xr.views.availableDepth) {
                for(let i = 0; i < app.xr.views.list.length; i++) {
                    const view = app.xr.views.list[i];
                    if (!view.textureDepth) // check if depth texture is available
                        continue;

                    materialDepth.setParameter('colorMap', view.textureDepth);
                    materialDepth.setParameter('matrix_depth_uv', view.depthUvMatrix.data);
                    materialDepth.setParameter('depth_raw_to_meters', view.depthValueToMeters);

                    // debug draw camera depth texture on the screen
                    app.drawTexture(0.5, -0.5, 1, 1, view.textureDepth, materialDepth);
                }
            }
        });

        app.xr.on('end', () => {
            if (!material.diffuseMap)
                return;

            // clear camera depth texture when XR session ends
            material.diffuseMap = null;
            material.update();
        });

        if (!app.xr.isAvailable(pc.XRTYPE_AR)) {
            message("Immersive AR is not available");
        } else if (!app.xr.views.supportedDepth) {
            message("AR Camera Depth is not supported");
        } else {
            message("Touch screen to start AR session");
        }
    } else {
        message("WebXR is not supported");
    }
    return app;
}

class ArCameraDepthExample {
    static CATEGORY = 'XR';
    static NAME = 'AR Camera Depth';
    static example = example;
}

export { ArCameraDepthExample };
