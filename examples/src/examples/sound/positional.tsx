import React from 'react';
import * as pc from 'playcanvas/build/playcanvas.js';
import { AssetLoader } from '../../app/helpers/loader';
import Example from '../../app/example';

class PositionalExample extends Example {
    static CATEGORY = 'Sound';
    static NAME = 'Positional';

    load() {
        return <>
            <AssetLoader name='model' type='model' url='static/assets/models/playbot/playbot.json' />
            <AssetLoader name='runAnim' type='animation' url='static/assets/animations/playbot/playbot-run.json' />
            <AssetLoader name='gravel' type='audio' url='static/assets/sounds/footsteps.mp3' />
        </>;
    }

    // @ts-ignore: override class function
    example(canvas: HTMLCanvasElement, assets: { model: pc.Asset, runAnim: pc.Asset, gravel: pc.Asset }): void {

        // Create the application and start the update loop
        const app = new pc.Application(canvas, {});

        // Create an Entity with a camera component
        const camera = new pc.Entity();
        camera.addComponent("camera", {
            clearColor: new pc.Color(1, 0, 0)
        });
        camera.addComponent("audiolistener");
        camera.rotateLocal(-30, 0, 0);
        camera.translateLocal(0, 0, 5);
        app.root.addChild(camera);

        // Create an Entity for the ground
        const material = new pc.StandardMaterial();
        material.diffuse = pc.Color.GRAY;
        material.update();

        const ground = new pc.Entity();
        ground.addComponent("render", {
            type: "box",
            material: material
        });
        ground.setLocalScale(50, 1, 50);
        ground.setLocalPosition(0, -0.5, 0);
        app.root.addChild(ground);

        // Create an entity with a light component
        const light = new pc.Entity();
        light.addComponent("light", {
            type: "directional",
            color: new pc.Color(1, 1, 1),
            castShadows: true,
            intensity: 2,
            shadowBias: 0.2,
            shadowDistance: 16,
            normalOffsetBias: 0.05,
            shadowResolution: 2048
        });
        light.setLocalEulerAngles(45, 30, 0);
        app.root.addChild(light);

        app.start();

        // Create walking dude
        const entity = new pc.Entity();

        // add sound component
        entity.addComponent('sound');

        // add footsteps slot
        entity.sound.addSlot('footsteps', {
            asset: assets.gravel.id,
            pitch: 1.7,
            loop: true,
            autoPlay: true
        });

        // add model
        entity.addComponent("model", {
            type: "asset",
            asset: assets.model,
            castShadows: true
        });

        // add animation
        entity.addComponent("animation", {
            assets: [assets.runAnim],
            speed: 0.8
        });

        // add entity in the hierarchy
        app.root.addChild(entity);

        let angle = 135;
        const radius = 3;
        const height = 0;// 1.1;
        app.on("update", function (dt) {
            angle += 30 * dt;
            if (angle > 360) {
                angle -= 360;
            }
            entity.setLocalPosition(radius * Math.sin(angle * pc.math.DEG_TO_RAD), height, radius * Math.cos(angle * pc.math.DEG_TO_RAD));
            entity.setLocalEulerAngles(0, angle + 90, 0);
        });
    }
}

export default PositionalExample;
