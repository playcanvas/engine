import * as pc from '../../../../';

class HierarchyExample {
    static CATEGORY = 'Graphics';
    static NAME = 'Hierarchy';
    static WEBGPU_ENABLED = true;

    example(canvas: HTMLCanvasElement, deviceType: string): void {

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
                pc.CameraComponentSystem,
                // @ts-ignore
                pc.LightComponentSystem
            ];

            const app = new pc.AppBase(canvas);
            app.init(createOptions);

            // Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
            app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
            app.setCanvasResolution(pc.RESOLUTION_AUTO);

            app.start();

            app.scene.ambientLight = new pc.Color(0.2, 0.2, 0.2);

            // helper function to create a primitive with shape type, position, scale
            function createPrimitive(primitiveType: string, position: pc.Vec3, scale: pc.Vec3) {
                // create material of random color
                const material = new pc.StandardMaterial();
                material.diffuse = new pc.Color(Math.random(), Math.random(), Math.random());
                material.update();

                // create primitive with a render component
                const primitive = new pc.Entity();
                primitive.addComponent('render', {
                    type: primitiveType,
                    material: material
                });

                // set position and scale
                primitive.setLocalPosition(position);
                primitive.setLocalScale(scale);

                return primitive;
            }

            // list of all created entities
            const entities: Array<pc.Entity> = [];

            // helper recursive function to create a next layer of entities for a specified parent
            function createChildren(parent: pc.Entity, gridSize: number, scale: number, scaleDelta: number, spacing: number, levels: number) {
                if (levels >= 0) {
                    const offset = spacing * (gridSize - 1) * 0.5;
                    for (let x = 0; x < gridSize; x++) {
                        for (let y = 0; y < gridSize; y++) {
                            const shape = Math.random() < 0.5 ? "box" : "sphere";
                            const position = new pc.Vec3(x * spacing - offset, spacing, y * spacing - offset);
                            const entity = createPrimitive(shape, position, new pc.Vec3(scale, scale, scale));

                            parent.addChild(entity);
                            entities.push(entity);

                            createChildren(entity, gridSize, scale - scaleDelta, scaleDelta, spacing * 0.7, levels - 1);
                        }
                    }
                }
            }

            // dummy root entity
            const root = new pc.Entity();
            app.root.addChild(root);

            // generate hierarchy of children entities
            const levels = 5;
            const gridSize = 2;
            const scale = 1.7;
            const scaleDelta = 0.25;
            const spacing = 7;
            createChildren(root, gridSize, scale, scaleDelta, spacing, levels);
            console.log("number of created entities: " + entities.length);

            // Create main camera
            const camera = new pc.Entity();
            camera.addComponent("camera", {
                clearColor: new pc.Color(0.1, 0.1, 0.1)
            });
            camera.setLocalPosition(90 * Math.sin(0), 40, 90 * Math.cos(0));
            camera.lookAt(new pc.Vec3(0, 5, 0));
            app.root.addChild(camera);

            // Create an Entity with a omni light component
            const light = new pc.Entity();
            light.addComponent("light", {
                type: "omni",
                color: new pc.Color(1, 1, 1),
                range: 150
            });
            light.translate(40, 60, 50);
            app.root.addChild(light);

            // update each frame
            let time = 0;
            app.on("update", function (dt) {
                time += dt;

                // rotation quaternion changing with time
                const rot = new pc.Quat();
                rot.setFromEulerAngles(time * 5, time * 13, time * 6);

                // apply it to all entities
                for (let e = 0; e < entities.length; e++) {
                    entities[e].setLocalRotation(rot);
                }
            });
        });
    }
}

export default HierarchyExample;
