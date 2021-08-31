import React from 'react';
import * as pc from 'playcanvas/build/playcanvas.js';
import { AssetLoader } from '../../app/helpers/loader';
import Example from '../../app/example';

class ShadowCascadesExample extends Example {
    static CATEGORY = 'Graphics';
    static NAME = 'Shadow Cascades';

    load() {
        return <>
            <AssetLoader name='script' type='script' url='static/scripts/camera/fly-camera.js' />
        </>;
    }

    // @ts-ignore: override class function
    example(canvas: HTMLCanvasElement): void {

        const app = new pc.Application(canvas, {});

        app.start();

        // Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
        app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
        app.setCanvasResolution(pc.RESOLUTION_AUTO);

        window.addEventListener("resize", function () {
            app.resizeCanvas(canvas.width, canvas.height);
        });

        app.scene.ambientLight = new pc.Color(0.5, 0.5, 0.5);

        function createPrimitive(primitiveType: string, position: pc.Vec3, scale: pc.Vec3) {

            // create a material
            const material = new pc.StandardMaterial();

            if (primitiveType === "capsule") {
                material.diffuse = new pc.Color(Math.random(), Math.random(), Math.random());
                material.shininess = 70;
                material.metalness = 0.4;
                material.useMetalness = true;
            }
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
        }

        // create ground plane
        const limit = 200;
        createPrimitive("plane", new pc.Vec3(0, 0, 0), new pc.Vec3(3 * limit, 3 * limit, 3 * limit));

        // populate it with capsules
        for (let x = -limit; x <= limit; x += 50) {
            for (let z = -limit; z <= limit; z += 50) {
                createPrimitive("capsule", new pc.Vec3(x, 15, z), new pc.Vec3(12, 22, 12));
            }
        }

        // create an Entity with a camera component
        const camera = new pc.Entity();
        camera.addComponent("camera", {
            clearColor: new pc.Color(0.9, 0.9, 0.9),
            farClip: 1000
        });
        app.root.addChild(camera);

        // and position it in the world
        camera.setLocalPosition(20, 80, 250);
        camera.lookAt(-30, -50, 0);

        // add the fly camera script to the camera, to allow mouse / keyboard movement
        camera.addComponent("script");
        camera.script.create("flyCamera");
        // @ts-ignore
        camera.script.flyCamera.speed = 60;

        // Create a directional light casting cascaded shadows
        const dirLight = new pc.Entity();
        dirLight.addComponent("light", {
            type: "directional",
            color: pc.Color.WHITE,
            shadowBias: 0.3,
            normalOffsetBias: 0.2,
            intensity: 1.0,

            // enable shadow casting
            castShadows: true,
            shadowDistance: 1000,

            // shadow map resolution storing 4 cascades
            shadowResolution: 2048,
            numCascades: 4,

            // distribution of cascade distances to prefer sharpness closer to the camera
            cascadeDistribution: 0.7,

            // shadow filtering
            shadowType: pc.SHADOW_PCF3
        });
        app.root.addChild(dirLight);
        dirLight.setLocalEulerAngles(45, -20, 20);
    }
}

export default ShadowCascadesExample;
