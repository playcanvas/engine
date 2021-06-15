import React from 'react';
import * as pc from 'playcanvas/build/playcanvas.js';
import { AssetLoader } from '../../app/helpers/loader';
import Example from '../../app/example';

// class ComponentPropertiesExample extends Example {
class ParticlesRandomSpritesExample extends Example {
    static CATEGORY = 'Graphics';
    static NAME = 'Particles: Random Sprites';

    load() {
        return <>
            <AssetLoader name='particlesCoinsTexture' type='texture' url='static/assets/textures/particles-coins.png' />
            <AssetLoader name='particlesBonusTexture' type='texture' url='static/assets/textures/particles-bonus.png' />
        </>;
    }

    // @ts-ignore: override class function
    example(canvas: HTMLCanvasElement, assets: { particlesCoinsTexture: pc.Asset, particlesBonusTexture: pc.Asset }): void {

        const app = new pc.Application(canvas, {
            mouse: new pc.Mouse(document.body),
            touch: new pc.TouchDevice(document.body),
            elementInput: new pc.ElementInput(canvas)
        });
        // Create an Entity with a camera component
        const cameraEntity = new pc.Entity();
        cameraEntity.addComponent("camera", {
            clearColor: new pc.Color(0.23, 0.5, 0.75)
        });
        cameraEntity.rotateLocal(0, 0, 0);
        cameraEntity.translateLocal(0, 0, 20);

        // Create a directional light
        const lightDirEntity = new pc.Entity();
        lightDirEntity.addComponent("light", {
            type: "directional",
            color: new pc.Color(1, 1, 1),
            intensity: 1
        });
        lightDirEntity.setLocalEulerAngles(45, 0, 0);

        // Create a screen to display the particle systems textures
        const screenEntity = new pc.Entity();
        screenEntity.addComponent("screen", { resolution: new pc.Vec2(640, 480), screenSpace: true });
        screenEntity.screen.scaleMode = "blend";
        screenEntity.screen.referenceResolution = new pc.Vec2(1280, 720);

        // Create a panel to display the full particle textures
        const panel = new pc.Entity();
        screenEntity.addChild(panel);
        const panel2 = new pc.Entity();
        screenEntity.addChild(panel2);

        // Add Entities into the scene hierarchy
        app.root.addChild(cameraEntity);
        app.root.addChild(lightDirEntity);
        app.root.addChild(screenEntity);

        // Create entity for first particle system
        const particleEntity1 = new pc.Entity();
        app.root.addChild(particleEntity1);
        particleEntity1.setLocalPosition(-3, 3, 0);

        // Create entity for second particle system
        const particleEntity2 = new pc.Entity();
        app.root.addChild(particleEntity2);
        particleEntity2.setLocalPosition(3, 3, 0);

        // gradually make particles bigger
        const scaleCurve = new pc.Curve(
            [0, 0.1, 1, 0.5]
        );

        // make particles fade in and out
        const alphaCurve = new pc.Curve(
            [0, 0, 0.5, 1, 1, 0]
        );

        const particleSystemConfiguration = function (asset: any, animTilesX: any, animTilesY: any) {
            return {
                numParticles: 32,
                lifetime: 2,
                rate: 0.2,
                colorMap: asset.resource,
                initialVelocity: 0.125,
                emitterShape: pc.EMITTERSHAPE_SPHERE,
                emitterRadius: 2.0,
                animLoop: true,
                animTilesX: animTilesX,
                animTilesY: animTilesY,
                animSpeed: 4,
                autoPlay: true,
                alphaGraph: alphaCurve,
                scaleGraph: scaleCurve
            };
        };

        // add particlesystem component to particle entity
        particleEntity1.addComponent("particlesystem", Object.assign(particleSystemConfiguration(assets.particlesCoinsTexture, 4, 6), {
            // set the number of animations in the sprite sheet to 4
            animNumAnimations: 4,
            // set the number of frames in each animation to 6
            animNumFrames: 6,
            // set the particle system to randomly select a different animation for each particle
            randomizeAnimIndex: true
        }));

        // display the full coin texture to the left of the panel
        panel.addComponent('element', {
            anchor: new pc.Vec4(0.5, 0.5, 0.5, 0.5),
            pivot: new pc.Vec2(1.75, 1.0),
            width: 150,
            height: 225,
            type: "image",
            textureAsset: assets.particlesCoinsTexture
        });

        // add particlesystem component to particle entity
        particleEntity2.addComponent("particlesystem", Object.assign(particleSystemConfiguration(assets.particlesBonusTexture, 4, 2), {
            // set the number of animations in the sprite sheet to 7
            animNumAnimations: 7,
            // set the number of frames in each animation to 1
            animNumFrames: 1,
            // set the particle system to randomly select a different animation for each particle
            randomizeAnimIndex: true
        }));

        // display the full bonus item texture to the left of the panel
        panel2.addComponent('element', {
            anchor: new pc.Vec4(0.5, 0.5, 0.5, 0.5),
            pivot: new pc.Vec2(-0.5, 1.0),
            width: 200,
            height: 100,
            type: "image",
            textureAsset: assets.particlesBonusTexture
        });

        app.start();
    }
}

export default ParticlesRandomSpritesExample;
