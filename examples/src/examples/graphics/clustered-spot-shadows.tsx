import React from 'react';
// @ts-ignore: library file import
import * as pc from 'playcanvas/build/playcanvas.prf.js';
import Example from '../../app/example';
import { AssetLoader } from '../../app/helpers/loader';

class ClusteredSpotShadowsExample extends Example {
    static CATEGORY = 'Graphics';
    static NAME = 'Clustered Spot Shadows';

    load() {
        return <>
            <AssetLoader name="channels" type="texture" url="static/assets/textures/channels.png" />
        </>;
    }

    example(canvas: HTMLCanvasElement, assets: any): void {

        // Create the application and start the update loop
        const app = new pc.Application(canvas, {});
        app.start();

        app.scene.ambientLight = new pc.Color(0.1, 0.1, 0.1);

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

        // Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
        app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
        app.setCanvasResolution(pc.RESOLUTION_AUTO);

        window.addEventListener("resize", function () {
            app.resizeCanvas(canvas.width, canvas.height);
        });

        // helper function to create a 3d primitive including its material
        function createPrimitive(primitiveType: string, position: pc.Vec3, scale: pc.Vec3) {

            // create a material
            const material = new pc.StandardMaterial();

            // create the primitive using the material
            const primitive = new pc.Entity();
            primitive.addComponent('render', {
                type: primitiveType,
                castShadows: true,
                material: material
            });

            // set position and scale and add it to scene
            primitive.setLocalPosition(position);
            primitive.setLocalScale(scale);
            app.root.addChild(primitive);

            return primitive;
        }

        // create the ground plane from the boxes
        for (let x = -5; x <= 5; x += 1) {
            for (let z = -5; z <= 5; z += 1) {
                createPrimitive("box", new pc.Vec3(x * 40, -5, z * 40), new pc.Vec3(37, 2, 37));
            }
        }

        // create shadow caster boxes
        for (let i = 0; i < 100; i += 1) {
            const scale = 4 + Math.random() * 10;
            const pos = new pc.Vec3((Math.random() - 0.5) * 400, 2 * scale, (Math.random() - 0.5) * 400);
            createPrimitive("box", pos, new pc.Vec3(scale, scale, scale));
        }

        const cookieChannels = ["r", "g", "b", "a", "rgb"];

        // create many spot lights
        const count = 10;
        const spotLightList: Array<pc.Entity> = [];
        for (let i = 0; i < count; i++) {
            const intensity = 1.5;
            const color = new pc.Color(intensity * Math.random(), intensity * Math.random(), intensity * Math.random(), 1);
            const lightSpot = new pc.Entity("Spot" + i);
            const cookieChannel = cookieChannels[Math.floor(Math.random() * cookieChannels.length)];

            lightSpot.addComponent("light", {
                type: "spot",
                color: color,
                innerConeAngle: 20,
                outerConeAngle: 24 + Math.random() * 20,
                range: 80,
                castShadows: true,
                shadowBias: 0.4,
                normalOffsetBias: 0.1,
                shadowResolution: 512,      // only used when clustering is off

                // cookie texture
                cookie: assets.channels.resource,
                cookieChannel: cookieChannel,
                cookieIntensity: 0.2 + Math.random()
            });

            // attach a render component with a small cone to each light
            const material = new pc.StandardMaterial();
            material.emissive = color;
            material.update();

            lightSpot.addComponent('render', {
                type: "cone",
                material: material,
                castShadows: false
            });
            lightSpot.setLocalScale(5, 5, 5);
            app.root.addChild(lightSpot);
            spotLightList.push(lightSpot);
        }

        // Create an entity with a camera component
        const camera = new pc.Entity();
        camera.addComponent("camera", {
            clearColor: new pc.Color(0.2, 0.2, 0.2),
            farClip: 1000,
            nearClip: 0.1
        });
        app.root.addChild(camera);

        // Set an update function on the app's update event
        let time = 0;
        app.on("update", function (dt: number) {
            time += dt * 0.05;

            // rotate spot lights around
            const lightPos = new pc.Vec3();
            spotLightList.forEach(function (spotlight, i) {
                const angle = (i / spotLightList.length) * Math.PI * 8;
                const x = ((i / spotLightList.length) - 0.5) * 500;
                const z = 200 * Math.sin(angle + time);
                lightPos.set(x, 60, z);
                spotlight.setLocalPosition(lightPos);

                lightPos.y = 0;
                spotlight.lookAt(lightPos, pc.Vec3.RIGHT);
                spotlight.rotateLocal(90, 0, 0);
            });

            // orbit the camera
            camera.setLocalPosition(300 * Math.sin(time * 0.4), 90, 300 * Math.cos(time * 0.4));
            camera.lookAt(new pc.Vec3(0, 0, 0));

            // display shadow texture (debug feature, only works when depth is stored as color, which is webgl1)
            // app.drawTexture(-0.7, 0.7, 0.4, 0.4, app.renderer.lightTextureAtlas.shadowMap.texture);

            // display cookie texture (debug feature)
            // app.drawTexture(-0.7, 0.2, 0.4, 0.4, app.renderer.lightTextureAtlas.cookieMap);
        });
    }
}

export default ClusteredSpotShadowsExample;
