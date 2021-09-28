import React from 'react';
import * as pc from 'playcanvas/build/playcanvas.js';
import { AssetLoader } from '../../app/helpers/loader';
import Example from '../../app/example';

class ClusteredShadowsOmniExample extends Example {
    static CATEGORY = 'Graphics';
    static NAME = 'Clustered Omni Shadows';

    load() {
        return <>
            <AssetLoader name='script' type='script' url='static/scripts/camera/orbit-camera.js' />
        </>;
    }

    // @ts-ignore: override class function
    example(canvas: HTMLCanvasElement): void {

        // Create the application and start the update loop
        const app = new pc.Application(canvas, {});
        app.start();

        // Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
        app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
        app.setCanvasResolution(pc.RESOLUTION_AUTO);

        // enabled clustered lighting. This is a temporary API and will change in the future
        // @ts-ignore engine-tsd
        pc.LayerComposition.clusteredLightingEnabled = true;

        // adjust default clusterered lighting parameters to handle many lights:
        // 1) subdivide space with lights into this many cells:
        // @ts-ignore engine-tsd
        app.scene.layers.clusteredLightingCells = new pc.Vec3(16, 12, 16);

        // 2) and allow this many lights per cell:
        // @ts-ignore engine-tsd
        app.scene.layers.clusteredLightingMaxLights = 80;




        // helper function to create a 3d primitive including its material
        function createPrimitive(primitiveType: string, position: pc.Vec3, scale: pc.Vec3) {

            // create a material
            const material = new pc.StandardMaterial();
            material.diffuse = new pc.Color(0.7, 0.7, 0.7);
            material.update();

            // create the primitive using the material
            const primitive = new pc.Entity();
            primitive.addComponent('render', {
                type: primitiveType,
                material: material
            });

            // set position and scale and add it to scene
            primitive.setLocalPosition(position);
            primitive.setLocalScale(scale);
            app.root.addChild(primitive);

            return primitive;
        }

        // create the ground plane from the boxes
        createPrimitive("box", new pc.Vec3(0, -5, 0), new pc.Vec3(800, 2, 800));

        // create the towers from the boxes
        let scale = 16;
        for (let y = 0; y <= 7; y++) {
            for (let x = -1; x <= 1; x += 2) {
                for (let z = -5; z <= 5; z += 2) {
                    const prim = createPrimitive("box", new pc.Vec3(x * 70, 2 + y * 10, z * 40), new pc.Vec3(scale, scale, scale));
                    prim.setLocalEulerAngles(Math.random() * 360, Math.random() * 360, Math.random() * 360);
                }
            }
            scale -= 1.5;
        }



        const lightOmni = new pc.Entity("Omni");
        lightOmni.addComponent("light", {
            type: "omni",
            color: pc.Color.WHITE,
            range: 600,
            castShadows: true,
            shadowBias: 0.4,
            normalOffsetBias: 0.1
        });

        // attach a render component with a small sphere to it
        const material = new pc.StandardMaterial();
        material.emissive = pc.Color.WHITE;
        material.update();

        lightOmni.addComponent('render', {
            type: "sphere",
            material: material,
            castShadows: false
        });
        lightOmni.setPosition(0, 120, 0);
        lightOmni.setLocalScale(5, 5, 5);
        app.root.addChild(lightOmni);



        // create an Entity with a camera component
        const camera = new pc.Entity();
        camera.addComponent("camera", {
            clearColor: new pc.Color(0.9, 0.9, 0.9),
            farClip: 1500
        });

        // and position it in the world
        camera.setLocalPosition(300, 60, 25);

        // add orbit camera script with a mouse and a touch support
        camera.addComponent("script");
        camera.script.create("orbitCamera", {
            attributes: {
                inertiaFactor: 0.2,
                focusEntity: app.root,
                distanceMax: 600
            }
        });
        camera.script.create("orbitCameraInputMouse");
        camera.script.create("orbitCameraInputTouch");
        app.root.addChild(camera);

        // Set an update function on the app's update event
        app.on("update", function (dt: number) {

            // display shadow texture (debug feature, only works when depth is stored as color, which is webgl1)
            app.renderTexture(-0.7, 0.7, 0.4, 0.4, app.renderer.lightTextureAtlas.shadowMap.texture);
        });
    }
}

export default ClusteredShadowsOmniExample;
