import * as pc from 'playcanvas';

/**
 * @param {import('../../options.mjs').ExampleOptions} options - The example options.
 * @returns {Promise<pc.AppBase|null>} The example application.
 */
async function example({ canvas, deviceType, files, glslangPath, twgslPath }) {
    const gfxOptions = {
        deviceTypes: [deviceType],

        // Even though we're using WGSL, we still need to provide glslang
        // and twgsl to compile shaders used internally by the engine.
        glslangUrl: glslangPath + 'glslang.js',
        twgslUrl: twgslPath + 'twgsl.js'
    };

    const device = await pc.createGraphicsDevice(canvas, gfxOptions);

    if (!device.isWebGPU) {
        console.error('WebGPU is required for this example.');
        return null;
    }

    const createOptions = new pc.AppOptions();
    createOptions.graphicsDevice = device;

    createOptions.componentSystems = [
        pc.RenderComponentSystem,
        pc.CameraComponentSystem
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

    // create box entity
    const box = new pc.Entity('cube');
    box.addComponent('render', {
        type: 'box'
    });
    app.root.addChild(box);

    const shaderDefinition = {
        vshader: files['shader.wgsl'],
        fshader: files['shader.wgsl'],
        shaderLanguage: pc.SHADERLANGUAGE_WGSL,
    };
    const shader = new pc.Shader(app.graphicsDevice, shaderDefinition);

    // For now WGSL shaders need to provide their own formats as they aren't processed.
    // This should match your ub_mesh struct in the shader.
    shader.meshUniformBufferFormat = new pc.UniformBufferFormat(app.graphicsDevice, [
        new pc.UniformFormat('matrix_model', pc.UNIFORMTYPE_MAT4),
        new pc.UniformFormat('amount', pc.UNIFORMTYPE_FLOAT)
    ]);
    shader.meshBindGroupFormat = new pc.BindGroupFormat(app.graphicsDevice, [
        new pc.BindBufferFormat(pc.UNIFORM_BUFFER_DEFAULT_SLOT_NAME, pc.SHADERSTAGE_VERTEX | pc.SHADERSTAGE_FRAGMENT)
    ]);

    const material = new pc.Material();
    material.shader = shader;
    box.render.material = material;

    // create camera entity
    const camera = new pc.Entity('camera');
    camera.addComponent('camera', {
        clearColor: new pc.Color(0.5, 0.6, 0.9)
    });
    app.root.addChild(camera);
    camera.setPosition(0, 0, 3);

    // Rotate the box according to the delta time since the last frame.
    // Update the material's 'amount' parameter to animate the color.
    let time = 0;
    app.on('update', (/** @type {number} */ dt) => {
        box.rotate(10 * dt, 20 * dt, 30 * dt);

        time += dt;
        // animate the amount as a sine wave varying from 0 to 1
        material.setParameter('amount', (Math.sin(time * 4) + 1) * 0.5);
    });
    return app;
}

class WgslShaderExample {
    static CATEGORY = 'Graphics';
    static WEBGPU_REQUIRED = true;
    static HIDDEN = true;
    static FILES = {
        'shader.wgsl': `
            struct ub_mesh {
                matrix_model : mat4x4f,
                amount : f32,
            }

            struct ub_view {
                matrix_viewProjection : mat4x4f,
            }

            struct VertexOutput {
                @builtin(position) position : vec4f,
                @location(0) fragPosition: vec4f,
            }

            @group(0) @binding(0) var<uniform> uvMesh : ub_mesh;
            @group(1) @binding(0) var<uniform> uvView : ub_view;

            @vertex
            fn vertexMain(@location(0) position : vec4f) -> VertexOutput {
                var output : VertexOutput;
                output.position = uvView.matrix_viewProjection * (uvMesh.matrix_model * position);
                output.fragPosition = 0.5 * (position + vec4(1.0));
                return output;
            }

            @fragment
            fn fragmentMain(input : VertexOutput) -> @location(0) vec4f {
                var color : vec3f = input.fragPosition.rgb;
                var roloc : vec3f = vec3f(1.0) - color;
                return vec4f(mix(color, roloc, uvMesh.amount), 1.0);
            }
        `
    };
    static example = example;
}

export { WgslShaderExample };
