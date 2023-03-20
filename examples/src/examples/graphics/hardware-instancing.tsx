import * as pc from '../../../../';

class HardwareInstancingExample {
    static CATEGORY = 'Graphics';
    static NAME = 'Hardware Instancing';
    static WEBGPU_ENABLED = true;

    example(canvas: HTMLCanvasElement, deviceType: string): void {

        const assets = {
            helipad: new pc.Asset('helipad-env-atlas', 'texture', { url: '/static/assets/cubemaps/helipad-env-atlas.png' }, { type: pc.TEXTURETYPE_RGBP })
        };

        const gfxOptions = {
            deviceTypes: [deviceType],
            glslangUrl: '/static/lib/glslang/glslang.js',
            twgslUrl: '/static/lib/twgsl/twgsl.js'
        };

        pc.createGraphicsDevice(canvas, gfxOptions).then((device: pc.GraphicsDevice) => {

            const createOptions = new pc.AppOptions();
            createOptions.graphicsDevice = device;

            createOptions.componentSystems = [
                // @ts-ignore
                pc.RenderComponentSystem,
                // @ts-ignore
                pc.CameraComponentSystem
            ];
            createOptions.resourceHandlers = [
                // @ts-ignore
                pc.TextureHandler
            ];

            const app = new pc.AppBase(canvas);
            app.init(createOptions);

            // Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
            app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
            app.setCanvasResolution(pc.RESOLUTION_AUTO);

            const assetListLoader = new pc.AssetListLoader(Object.values(assets), app.assets);
            assetListLoader.load(() => {

                app.start();

                // setup skydome
                app.scene.skyboxMip = 2;
                app.scene.exposure = 0.3;
                app.scene.envAtlas = assets.helipad.resource;

                // set up some general scene rendering properties
                app.scene.toneMapping = pc.TONEMAP_ACES;

                app.scene.ambientLight = new pc.Color(0.1, 0.1, 0.1);

                // Create an Entity with a camera component
                const camera = new pc.Entity();
                camera.addComponent("camera", {
                });
                app.root.addChild(camera);

                // Move the camera back to see the cubes
                camera.translate(0, 0, 10);

                // create standard material and enable instancing on it
                const material = new pc.StandardMaterial();
                material.onUpdateShader = function (options) {
                    options.litOptions.useInstancing = true;
                    return options;
                };
                material.gloss = 0.6;
                material.metalness = 0.7;
                material.useMetalness = true;
                material.update();

                // Create a Entity with a cylinder render component and the instancing material
                const box = new pc.Entity("InstancingEntity");
                box.addComponent("render", {
                    material: material,
                    type: "cylinder"
                });

                // add the box entity to the hierarchy
                app.root.addChild(box);

                if (app.graphicsDevice.supportsInstancing) {
                    // number of instances to render
                    const instanceCount = 1000;

                    // store matrices for individual instances into array
                    const matrices = new Float32Array(instanceCount * 16);
                    let matrixIndex = 0;

                    const radius = 5;
                    const pos = new pc.Vec3();
                    const rot = new pc.Quat();
                    const scl = new pc.Vec3();
                    const matrix = new pc.Mat4();

                    for (let i = 0; i < instanceCount; i++) {
                        // generate random positions / scales and rotations
                        pos.set(Math.random() * radius - radius * 0.5, Math.random() * radius - radius * 0.5, Math.random() * radius - radius * 0.5);
                        scl.set(0.1 + Math.random() * 0.1, 0.1 + Math.random() * 0.3, 0.1 + Math.random() * 0.1);
                        rot.setFromEulerAngles(i * 30, i * 50, i * 70);
                        matrix.setTRS(pos, rot, scl);

                        // copy matrix elements into array of floats
                        for (let m = 0; m < 16; m++)
                            matrices[matrixIndex++] = matrix.data[m];
                    }

                    // create static vertex buffer containing the matrices
                    const vertexBuffer = new pc.VertexBuffer(app.graphicsDevice, pc.VertexFormat.getDefaultInstancingFormat(app.graphicsDevice),
                                                             instanceCount, pc.BUFFER_STATIC, matrices);

                    // initialize instancing using the vertex buffer on meshInstance of the created box
                    const boxMeshInst = box.render.meshInstances[0];
                    boxMeshInst.setInstancing(vertexBuffer);
                }

                // Set an update function on the app's update event
                let angle = 0;
                app.on("update", function (dt) {
                    // orbit camera around
                    angle += dt * 0.2;
                    camera.setLocalPosition(8 * Math.sin(angle), 0, 8 * Math.cos(angle));
                    camera.lookAt(pc.Vec3.ZERO);
                });
            });
        }).catch(console.error);
    }
}

export default HardwareInstancingExample;
