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
            'house': new pc.Asset('house', 'container', {url: '/static/assets/models/house.glb'})
        };

        const assetListLoader = new pc.AssetListLoader(Object.values(assets), app.assets);
        assetListLoader.load(() => {

            // Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
            app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
            app.setCanvasResolution(pc.RESOLUTION_AUTO);

            const cubeEntities: pc.Entity[] = [];

            const start = new pc.Vec3(5, 5, 5);

            const end = new pc.Vec3(-5, -5, -5);

            const direction = new pc.Vec3(-1, -1, -1).normalize();

            const originRay = new pc.Ray(start, direction);

            app.start();

            // get the instance of the cube it set up with render component and add it to scene
            //cubeEntities[0] = assets.cube.resource.instantiateRenderEntity();
            //cubeEntities[0].setLocalPosition(7, 12, 0);
            //cubeEntities[0].setLocalScale(3, 3, 3);
            //app.root.addChild(cubeEntities[0]);

            const box = assets.house.resource.instantiateRenderEntity();
            // const box = new pc.Entity("cube");
            // box.addComponent("render", {
            //     type: "box"
            // });

            box.setLocalScale(10, 10, 10);

            box.setLocalPosition(0, 0, 0);

            app.root.addChild(box);

            const boxRender = box.findComponent('render');

            boxRender._meshInstances.forEach((mi) => {
                mi.rayCastToMesh(originRay);
            })

            // Create an Entity with a camera component
            const camera = new pc.Entity();
            camera.addComponent("camera", {
                clearColor: new pc.Color(0.9, 0.1, 0.1),
                farClip: 100
            });
            camera.translate(0, 0, 25);
            //camera.lookAt(0, 7, 0);
            app.root.addChild(camera);

            // set skybox - this DDS file was 'prefiltered' in the PlayCanvas Editor and then downloaded.
            app.scene.setSkybox(assets["helipad.dds"].resources);
            app.scene.toneMapping = pc.TONEMAP_ACES;
            app.scene.skyboxMip = 1;

            new pc.Keyboard(document.body).on(pc.EVENT_KEYDOWN, function (event: any) {
                if (event.key === 68) {
                    const o = originRay.direction;
                    o.add(new pc.Vec3(0, 0.005, 0));
                    originRay.set(originRay.origin, o);
                }
                if (event.key === 71) {
                    const o = originRay.direction;
                    o.add(new pc.Vec3(0, -0.005, 0));
                    originRay.set(originRay.origin, o);
                }
            }, this);

            let s = originRay.origin;

            let d = originRay.direction.clone();

            d.normalize();

            let e = originRay.origin.clone();

            d.mulScalar(20);

            e.add(d);

            let p = 20;

            // spin the meshes
            app.on("update", function (dt) {

                d = originRay.direction.clone();

                d.normalize();

                e = originRay.origin.clone();
    
                d.mulScalar(20);
    
                e.add(d);

                box.rotate(3 * dt, 10 * dt, 6 * dt);

                //originRay.set(new pc.Vec3(mouseX, mouseY, 5), new pc.Vec3(0, 0, -1));


                boxRender._meshInstances.forEach((mi) => {
                    e = mi.rayCastToMesh(originRay) || e;
                });



                app.drawLine(originRay.origin, e);
                /*if (cubeEntitiesRender._meshInstances) {
                    cubeEntitiesRender._meshInstances.forEach((mi) => {
                        mi.rayCastToMesh(originRay);
                    })
                }*/

                /*if (cubeEntities[0]) {
                    //cubeEntities[0].rotate(3 * dt, 10 * dt, 6 * dt);

                    if (cubeEntitiesRender._meshInstances) {
                        cubeEntitiesRender._meshInstances.forEach((mi) => {
                            mi.rayCastToMesh(originRay);
                        })

                    }
                }*/
            });
        });
    }
}

export default MeshPickerExample;
