// @ts-ignore: library file import
import * as pc from 'playcanvas/build/playcanvas.dbg.js';
// @ts-ignore: library file import
import * as pcx from 'playcanvas/build/playcanvas-extras.js';
import Example from '../../app/example';

class MiniStatsExample extends Example {
    static CATEGORY = 'Misc';
    static NAME = 'Mini Stats';
    static ENGINE = 'DEBUG';

    // @ts-ignore: override class function
    example(canvas: HTMLCanvasElement, pcx: any): void {
        // Create the application and start the update loop
        const app = new pc.Application(canvas, {});
        app.start();

        // Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
        app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
        app.setCanvasResolution(pc.RESOLUTION_AUTO);

        window.addEventListener("resize", function () {
            app.resizeCanvas(canvas.width, canvas.height);
        });

        // set up options for mini-stats, start with the default options
        const options = pcx.MiniStats.getDefaultOptions();

        // configure sizes
        options.sizes = [
            { width: 128, height: 16, spacing: 0, graphs: false },
            { width: 256, height: 32, spacing: 2, graphs: true },
            { width: 500, height: 64, spacing: 2, graphs: true }
        ];

        // when the application starts, use the largest size
        options.startSizeIndex = 2;

        // display additional counters
        // Note: for most of these to report values, either debug or profiling engine build needs to be used.
        options.stats = [

            // frame update time in ms
            {
                name: "Update",
                stats: ["frame.updateTime"],
                decimalPlaces: 1,
                unitsName: "ms",
                watermark: 33
            },

            // total number of draw calls
            {
                name: "DrawCalls",
                stats: ["drawCalls.total"],
                watermark: 2000
            },

            // total number of triangles, in 1000s
            {
                name: "triCount",
                stats: ["frame.triangles"],
                decimalPlaces: 1,
                multiplier: 1 / 1000,
                unitsName: "k",
                watermark: 500
            },

            // number of materials used in a frame
            {
                name: "materials",
                stats: ["frame.materials"],
                watermark: 2000
            },

            // frame time it took to do frustum culling
            {
                name: "cull",
                stats: ["frame.cullTime"],
                decimalPlaces: 1,
                watermark: 1,
                unitsName: "ms"
            },

            // used VRAM, displayed using 2 colors - red for textures, green for geometry
            {
                name: "VRAM",
                stats: ["vram.tex", "vram.geom"],
                decimalPlaces: 1,
                multiplier: 1 / (1024 * 1024),
                unitsName: "MB",
                watermark: 100
            },

            // frames per second
            {
                name: "FPS",
                stats: ["frame.fps"],
                watermark: 60
            },

            // delta time
            {
                name: "Frame",
                stats: ["frame.ms"],
                decimalPlaces: 1,
                unitsName: "ms",
                watermark: 33
            }
        ];

        // create mini-stats system
        const miniStats = new pcx.MiniStats(app, options);

        // add directional lights to the scene
        const light = new pc.Entity();
        light.addComponent("light", {
            type: "directional"
        });
        app.root.addChild(light);
        light.setLocalEulerAngles(45, 30, 0);

        // Create an entity with a camera component
        const camera = new pc.Entity();
        camera.addComponent("camera", {
            clearColor: new pc.Color(0.1, 0.1, 0.1)
        });
        app.root.addChild(camera);
        camera.setLocalPosition(20, 10, 10);
        camera.lookAt(pc.Vec3.ZERO);

        // helper function to create a primitive with shape type, position, scale
        function createPrimitive(primitiveType: string, position: number | pc.Vec3, scale: number | pc.Vec3) {
            // create material of random color
            const material = new pc.StandardMaterial();
            material.diffuse = new pc.Color(Math.random(), Math.random(), Math.random());
            material.update();

            // create primitive
            const primitive = new pc.Entity();
            primitive.addComponent('model', {
                type: primitiveType
            });
            primitive.model.material = material;

            // set position and scale
            primitive.setLocalPosition(position);
            primitive.setLocalScale(scale);

            return primitive;
        }

        // list of all created engine resources
        const entities: any[] = [];
        const vertexBuffers: any[] = [];
        const textures: any[] = [];

        // update function called every frame
        let adding = true;
        const step = 10, max = 2000;
        let entity: pc.GraphNode, vertexBuffer: pc.VertexBuffer, texture: { destroy: () => void; };
        app.on("update", function (dt: any) {

            // execute some tasks multiple times per frame
            for (let i = 0; i < step; i++) {

                // allocating resouces
                if (adding) {

                    // add entity (they used shared geometry internally, and we create individual material for each)
                    const shape = Math.random() < 0.5 ? "box" : "sphere";
                    const position = new pc.Vec3(Math.random() * 10, Math.random() * 10, Math.random() * 10);
                    const scale = 0.5 + Math.random();
                    entity = createPrimitive(shape, position, new pc.Vec3(scale, scale, scale));
                    entities.push(entity);
                    app.root.addChild(entity);

                    // if allocation reached the max limit, switch to removing mode
                    if (entities.length >= max) {
                        adding = false;
                    }

                    // add vertex buffer
                    const vertexCount = 500;
                    const data = new Float32Array(vertexCount * 16);
                    vertexBuffer = new pc.VertexBuffer(app.graphicsDevice, pc.VertexFormat.defaultInstancingFormat, vertexCount, pc.BUFFER_STATIC, data);
                    vertexBuffers.push(vertexBuffer);

                    // allocate texture
                    const texture = new pc.Texture(app.graphicsDevice, {
                        width: 64,
                        height: 64,
                        format: pc.PIXELFORMAT_R8_G8_B8,
                        mipmaps: false
                    });
                    textures.push(texture);

                    // ensure texture is uploaded    (actual VRAM is allocated)
                    texture.lock();
                    texture.unlock();
                    // @ts-ignore engine-tsd
                    app.graphicsDevice.setTexture(texture, 0);

                } else {    // de-allocating resources

                    if (entities.length > 0) {

                        // desotry entities
                        entity = entities[entities.length - 1];
                        // @ts-ignore engine-tsd
                        entity.destroy();
                        entities.length--;

                        // destroy vertex buffer
                        vertexBuffer = vertexBuffers[vertexBuffers.length - 1];
                        vertexBuffer.destroy();
                        vertexBuffers.length--;

                        // destroy texture
                        texture = textures[textures.length - 1];
                        texture.destroy();
                        textures.length--;
                    } else {
                        adding = true;
                    }
                }
            }
        });
    }
}

export default MiniStatsExample;
