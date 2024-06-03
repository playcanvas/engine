// @config WEBGPU_DISABLED
import * as pc from 'playcanvas';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

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
const camera = new pc.Entity();
camera.addComponent('camera', {
    clearColor: new pc.Color(0, 0, 0, 0),
    farClip: 10000
});
app.root.addChild(camera);

let shaderUpdated = false;
let shaderDepthArray = null;
let shaderDepthFloat = null;

const vertShader = /* glsl */ `
    attribute vec3 aPosition;
    attribute vec2 aUv0;
    uniform mat4 matrix_model;
    uniform mat4 matrix_viewProjection;
    varying vec2 vUv0;
    void main(void)
    {
        vec4 screenPosition = matrix_viewProjection * matrix_model * vec4(aPosition, 1.0);
        gl_Position = screenPosition;
        vUv0 = screenPosition.xy;
    }
    `;

const fragShader = /* glsl */ `
    varying vec2 vUv0;
    uniform vec4 uScreenSize;
    uniform mat4 matrix_depth_uv;
    uniform float depth_raw_to_meters;

    #ifdef XRDEPTH_ARRAY
        uniform int view_index;
        uniform highp sampler2DArray depthMap;
    #else
        uniform sampler2D depthMap;
    #endif

    void main (void) {
        vec2 uvScreen = gl_FragCoord.xy * uScreenSize.zw;

        // use texture array for multi-view 
        #ifdef XRDEPTH_ARRAY
            uvScreen = uvScreen * vec2(2.0, 1.0) - vec2(view_index, 0.0);
            vec3 uv = vec3((matrix_depth_uv * vec4(uvScreen.xy, 0.0, 1.0)).xy, view_index);
        #else
            vec2 uv = (matrix_depth_uv * vec4(uvScreen.x, 1.0 - uvScreen.y, 0.0, 1.0)).xy;
        #endif

        #ifdef XRDEPTH_FLOAT
            float depth = texture2D(depthMap, uv).r;
        #else
            // unpack from AlphaLuminance
            vec2 packedDepth = texture2D(depthMap, uv).ra;
            float depth = dot(packedDepth, vec2(255.0, 256.0 * 255.0));
        #endif

        depth *= depth_raw_to_meters;

        // depth = 1.0 - min(depth / 2.0, 1.0); // 0..1 = 0m..4m
        gl_FragColor = vec4(depth, depth, depth, 1.0);
    }`;

const materialDepth = new pc.Material();

/**
 * @param {boolean} array - If the depth information uses array texture.
 * @param {boolean} float - If the depth information uses F32R texture.
 */
const updateShader = (array, float) => {
    if (shaderDepthArray === array && shaderDepthFloat === float) return;

    shaderDepthArray = array;
    shaderDepthFloat = float;

    const key = 'textureDepthSensing_' + array + float;
    let frag = fragShader;

    if (shaderDepthArray) frag = '#define XRDEPTH_ARRAY\n' + frag;

    if (shaderDepthArray) frag = '#define XRDEPTH_FLOAT\n' + frag;

    materialDepth.shader = pc.createShaderFromCode(app.graphicsDevice, vertShader, frag, key, {
        aPosition: pc.SEMANTIC_POSITION,
        aUv0: pc.SEMANTIC_TEXCOORD0
    });
    materialDepth.clearVariants();
    materialDepth.update();
};

updateShader(false, false);

const plane = new pc.Entity();
plane.addComponent('render', {
    type: 'plane'
});
plane.render.material = materialDepth;
plane.render.meshInstances[0].cull = false;
plane.setLocalPosition(0, 0, -1);
plane.setLocalEulerAngles(90, 0, 0);
plane.enabled = false;
camera.addChild(plane);

if (app.xr.supported) {
    const activate = function () {
        if (app.xr.isAvailable(pc.XRTYPE_AR)) {
            camera.camera.startXr(pc.XRTYPE_AR, pc.XRSPACE_LOCALFLOOR, {
                depthSensing: {
                    // request access to camera depth
                    usagePreference: pc.XRDEPTHSENSINGUSAGE_GPU,
                    dataFormatPreference: pc.XRDEPTHSENSINGFORMAT_F32
                },
                callback: function (err) {
                    if (err) message('WebXR Immersive AR failed to start: ' + err.message);
                }
            });
        } else {
            message('Immersive AR is not available');
        }
    };

    app.mouse.on('mousedown', function () {
        if (!app.xr.active) activate();
    });

    if (app.touch) {
        app.touch.on('touchend', function (evt) {
            if (!app.xr.active) {
                // if not in VR, activate
                activate();
            } else {
                // otherwise reset camera
                camera.camera.endXr();
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
        message('Immersive AR session has started');
        console.log('depth gpu optimized', app.xr.views.depthGpuOptimized);
        console.log('depth texture format', app.xr.views.depthPixelFormat);
    });
    app.xr.on('end', function () {
        shaderUpdated = false;
        message('Immersive AR session has ended');
        plane.enabled = false;
    });
    app.xr.on('available:' + pc.XRTYPE_AR, function (available) {
        if (available) {
            if (!app.xr.views.supportedDepth) {
                message('AR Camera Depth is not supported');
            } else {
                message('Touch screen to start AR session');
            }
        } else {
            message('Immersive AR is not available');
        }
    });

    app.on('update', () => {
        // if camera depth is available
        if (app.xr.views.availableDepth) {
            if (!shaderUpdated && app.xr.active) {
                shaderUpdated = true;
                updateShader(app.xr.views.list.length > 1, app.xr.views.depthPixelFormat === pc.PIXELFORMAT_R32F);
            }

            const view = app.xr.views.list?.[0];
            if (view && view.textureDepth) {
                materialDepth.setParameter('depthMap', view.textureDepth);
                materialDepth.setParameter('matrix_depth_uv', view.depthUvMatrix.data);
                materialDepth.setParameter('depth_raw_to_meters', view.depthValueToMeters);
                plane.enabled = true;
            } else {
                plane.enabled = false;
            }
        }
    });

    if (!app.xr.isAvailable(pc.XRTYPE_AR)) {
        message('Immersive AR is not available');
    } else if (!app.xr.views.supportedDepth) {
        message('AR Camera Depth is not supported');
    } else {
        message('Touch screen to start AR session');
    }
} else {
    message('WebXR is not supported');
}

export { app };
