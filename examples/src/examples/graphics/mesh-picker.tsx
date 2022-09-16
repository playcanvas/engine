import * as pc from '../../../../';


class MeshPickerExample {
    static CATEGORY = 'Graphics';
    static NAME = 'Mesh Picker';

    example(canvas: HTMLCanvasElement): void {

        // Create the app and start the update loop
        const app = new pc.Application(canvas, {});

        const assets = {
            'helipad.dds': new pc.Asset('helipad.dds', 'cubemap', { url: '/static/assets/cubemaps/helipad.dds' }, { type: pc.TEXTURETYPE_RGBM }),
            'statue': new pc.Asset('statue', 'container', { url: '/static/assets/models/statue.glb' }),
            'cube': new pc.Asset('cube', 'container', { url: '/static/assets/models/playcanvas-cube.glb' }),
            'house': new pc.Asset('house', 'container', { url: '/static/assets/models/house.glb' })
        };

        const assetListLoader = new pc.AssetListLoader(Object.values(assets), app.assets);
        assetListLoader.load(() => {

            function createLight(color: pc.Color, scale: number) {

                // Create an Entity with a omni light component, which is casting shadows (using rendering to cubemap)
                const light = new pc.Entity();
                light.addComponent("light", {
                    type: "omni",
                    color: color,
                    radius: 10,
                    castShadows: false
                });

                // create material of specified color
                const material = new pc.StandardMaterial();
                material.emissive = color;
                material.update();

                // add sphere at the position of light
                light.addComponent("render", {
                    type: "sphere",
                    material: material
                });

                // Scale the sphere
                light.setLocalScale(scale, scale, scale);

                app.root.addChild(light);
                return light;
            }

            // Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
            app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
            app.setCanvasResolution(pc.RESOLUTION_AUTO);
            app.scene.ambientLight = new pc.Color(0.9, 0.9, 0.9);

            const start = new pc.Vec3(10, 10, 10);

            const direction = new pc.Vec3(-1, -1, -1).normalize();

            const originRay = new pc.Ray(start.clone(), direction.clone());

            app.start();

            const box = assets.statue.resource.instantiateRenderEntity();

            box.setLocalScale(0.5, 0.5, 0.5);

            box.setLocalPosition(0, -4, 0);

            app.root.addChild(box);

            const boxRenders = box.findComponents('render');

            // Create an Entity with a camera component
            const camera = new pc.Entity();
            camera.addComponent("camera", {
                clearColor: new pc.Color(0.2, 0.2, 0.2),
                farClip: 100
            });
            camera.translate(0, 0, 25);
            app.root.addChild(camera);
            const endLight = createLight(pc.Color.BLUE, 0.5);

            let d;

            let e : any;

            // spin the meshes
            app.on("update", function (dt) {

                d = originRay.direction.clone();

                d.normalize();

                e = originRay.origin.clone();

                d.mulScalar(20);

                e.add(d);

                box.rotate(3 * dt, 10 * dt, 6 * dt);

                boxRenders.forEach((render) => render._meshInstances.forEach((mi) => {
                    const p =  mi.rayCast(originRay);
                    if (p && p.distance(originRay.origin) < e.distance(originRay.origin)) {
                        e.copy(p);
                    }
                }

                ));

                app.drawLine(originRay.origin, e);

                endLight.setPosition(e);
            });
        });
    }
}

export default MeshPickerExample;
