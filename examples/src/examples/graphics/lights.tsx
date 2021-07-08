import React from 'react';
import * as pc from 'playcanvas/build/playcanvas.js';
import Example from '../../app/example';
import { AssetLoader } from '../../app/helpers/loader';

class LightsExample extends Example {
    static CATEGORY = 'Graphics';
    static NAME = 'Lights';

    load() {
        return <>
            <AssetLoader name='statue' type='container' url='static/assets/models/statue.glb' />
            <AssetLoader name='font' type='font' url='static/assets/fonts/arial.json' />
            <AssetLoader name="heart" type="texture" url="static/assets/textures/heart.png" />
        </>;
    }

    // @ts-ignore: override class function$
    example(canvas: HTMLCanvasElement, assets: any): void {
        function createMaterial(colors: any) {
            const material: any = new pc.StandardMaterial();
            for (const param in colors) {
                material[param] = colors[param];
            }
            material.update();
            return material;
        }

        // Create the application and start the update loop
        const app = new pc.Application(canvas, {
            keyboard: new pc.Keyboard(window)
        });
        app.start();

        // Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
        app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
        app.setCanvasResolution(pc.RESOLUTION_AUTO);

        app.scene.ambientLight = new pc.Color(0.4, 0.4, 0.4);

        // create an entity with the statue
        const entity = assets.statue.resource.instantiateRenderEntity();

        app.root.addChild(entity);

        // Create an Entity with a camera component
        const camera = new pc.Entity();
        camera.addComponent("camera", {
            clearColor: new pc.Color(0.4, 0.45, 0.5)
        });
        camera.translate(0, 15, 35);
        camera.rotate(-14, 0, 0);
        app.root.addChild(camera);

        // ground material
        const material = createMaterial({
            ambient: pc.Color.GRAY,
            diffuse: pc.Color.GRAY
        });

        // Create an Entity for the ground
        const ground = new pc.Entity();
        ground.addComponent("render", {
            type: "box",
            material: material
        });
        ground.setLocalScale(70, 1, 70);
        ground.setLocalPosition(0, -0.5, 0);
        app.root.addChild(ground);

        // Create an spot light
        const spotlight = new pc.Entity();
        spotlight.addComponent("light", {
            type: "spot",
            color: pc.Color.WHITE,
            innerConeAngle: 30,
            outerConeAngle: 31,
            range: 100,
            intensity: 0.6,
            castShadows: true,
            shadowBias: 0.05,
            normalOffsetBias: 0.03,
            shadowResolution: 2048,

            // heart texture's alpha channel as a cookie texture
            cookie: assets.heart.resource,
            // cookie: assets.heart.asset.resource,
            cookieChannel: "a"
        });

        const cone = new pc.Entity();
        cone.addComponent("render", {
            type: "cone",
            castShadows: false,
            material: createMaterial({ emissive: pc.Color.WHITE })
        });
        spotlight.addChild(cone);
        app.root.addChild(spotlight);

        // Create a omni light
        const omnilight = new pc.Entity();
        omnilight.addComponent("light", {
            type: "omni",
            color: pc.Color.YELLOW,
            range: 100,
            castShadows: true,
            intensity: 0.6
        });
        omnilight.addComponent("render", {
            type: "sphere",
            castShadows: false,
            material: createMaterial({ diffuse: pc.Color.BLACK, emissive: pc.Color.YELLOW })
        });
        app.root.addChild(omnilight);

        // Create a directional light
        const directionallight = new pc.Entity();
        directionallight.addComponent("light", {
            type: "directional",
            color: pc.Color.CYAN,
            range: 100,
            castShadows: true,
            shadowBias: 0.1,
            normalOffsetBias: 0.2,
            intensity: 0.6
        });
        app.root.addChild(directionallight);


        // Create a 2D screen for text rendering
        const screen = new pc.Entity();
        screen.addComponent("screen", {
            referenceResolution: new pc.Vec2(1280, 720),
            scaleBlend: 0.5,
            scaleMode: pc.SCALEMODE_BLEND,
            screenSpace: true
        });
        app.root.addChild(screen);

        // Load a font

        // Create a basic text element
        const text = new pc.Entity();
        text.addComponent("element", {
            anchor: new pc.Vec4(0.1, 0.1, 0.5, 0.5),
            fontAsset: assets.font,
            fontSize: 28,
            pivot: new pc.Vec2(0.5, 0.1),
            type: pc.ELEMENTTYPE_TEXT,
            alignment: pc.Vec2.ZERO
        });
        screen.addChild(text);

        // Allow user to toggle individual lights
        app.keyboard.on("keydown", function (e) {
            switch (e.key) {
                case pc.KEY_1:
                    omnilight.enabled = !omnilight.enabled;
                    break;
                case pc.KEY_2:
                    spotlight.enabled = !spotlight.enabled;
                    break;
                case pc.KEY_3:
                    directionallight.enabled = !directionallight.enabled;
                    break;
            }
        }, this);

        // Simple update loop to rotate the light
        let angleRad = 1;
        app.on("update", function (dt) {
            angleRad += 0.3 * dt;
            if (entity) {

                spotlight.lookAt(new pc.Vec3(0, -5, 0));
                spotlight.rotateLocal(90, 0, 0);
                spotlight.setLocalPosition(15 * Math.sin(angleRad), 25, 15 * Math.cos(angleRad));

                omnilight.setLocalPosition(5 * Math.sin(-2 * angleRad), 10, 5 * Math.cos(-2 * angleRad));

                directionallight.setLocalEulerAngles(45, -60 * angleRad, 0);
            }

            // update text showing which lights are enabled
            if (text) {
                text.element.text =
                    "[Key 1] Omni light: " + omnilight.enabled +
                    "\n[Key 2] Spot light: " + spotlight.enabled +
                    "\n[Key 3] Directional light: " + directionallight.enabled;
            }
        });
    }
}

export default LightsExample;
