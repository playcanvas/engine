import React from 'react';
import * as pc from 'playcanvas/build/playcanvas.js';
import { AssetLoader } from '../../app/helpers/loader';
import Example from '../../app/example';
// @ts-ignore: library file import
import { Button, LabelGroup } from '@playcanvas/pcui/pcui-react';
// @ts-ignore: library file import
import { BindingTwoWay, Observer } from '@playcanvas/pcui/pcui-binding';

class EventsExample extends Example {
    static CATEGORY = 'Animation';
    static NAME = 'Events';

    load() {
        return <>
            <AssetLoader name='model' type='container' url='static/assets/models/bitmoji.glb' />
            <AssetLoader name='idleAnim' type='container' url='static/assets/animations/bitmoji/idle.glb' />
            <AssetLoader name='jumpAnim' type='container' url='static/assets/animations/bitmoji/jump-flip.glb' />
            <AssetLoader name='particle' type='texture' url='static/assets/textures/leaf.png' />
        </>;
    }

    // @ts-ignore: override class function
    controls(data: Observer) {
        return <>
            <Button text='Jump' onClick={() => data.emit('jump')}/>
        </>;
    }

    // @ts-ignore: override class function
    example(canvas: HTMLCanvasElement, assets: { model: pc.Asset, idleAnim: pc.Asset, jumpAnim: pc.Asset, particle: pc.Asset }, data: any): void {

        const app = new pc.Application(canvas, {
            keyboard: new pc.Keyboard(document.body)
        });
        // Create an Entity with a camera component
        const cameraEntity = new pc.Entity();
        cameraEntity.addComponent("camera", {
            clearColor: new pc.Color(114/255, 180/255, 245/255)
        });
        cameraEntity.translateLocal(0.0, 4, 7.5);
        cameraEntity.lookAt(0, 0, 0);
        app.root.addChild(cameraEntity);

        // Create an entity with a light component
        app.scene.ambientLight = new pc.Color(0.5, 0.5, 0.5);
        const light = new pc.Entity();
        light.addComponent("light", {
            type: "directional"
        });
        light.setLocalEulerAngles(65, 0, 0);
        app.root.addChild(light);

        // create a plane with leaf particles spread over it's surface
        const planeEntity = new pc.Entity();
        planeEntity.name = 'Plane';
        planeEntity.addComponent("render", {
            type: "plane"
        });
        planeEntity.setLocalScale(4.5, 1, 4.5);
        planeEntity.setPosition(0, 0, 0);
        const material = new pc.StandardMaterial();
        material.diffuse  = new pc.Color(66/255, 165/255, 20/255);
        material.update();
        planeEntity.render.meshInstances[0].material = material;
        app.root.addChild(planeEntity);

        const planeParticlesEntity = new pc.Entity();
        planeParticlesEntity.setLocalPosition(0,0.01,0);
        planeEntity.addChild(planeParticlesEntity);
        planeParticlesEntity.addComponent("particlesystem", {
            numParticles: 6000,
            lifetime: 100000,
            preWarm: true,
            rate: 0,
            loop: true,
            initialVelocity: 0,
            emitterExtents: new pc.Vec3(4.5, 0.001, 4.5),
            colorMap: assets.particle.resource,
            orientation: pc.PARTICLEORIENTATION_WORLD,
            localSpace: false,
            scaleGraph: new pc.Curve([0, 0.1]),
            wrap: false,
            rotationSpeedGraph: new pc.Curve([
                0, -180, 0.5, 0
            ]),
            rotationSpeedGraph2: new pc.Curve([
                0, 180, 0.5, 0
            ]),
        });

        // create an entity from the loaded model using the render component
        const modelEntity = assets.model.resource.instantiateRenderEntity({
            castShadows: true
        });

        // add an anim component to the entity
        modelEntity.addComponent('anim', {
            activate: true
        });

        const idleTrack = assets.idleAnim.resource.animations[0].resource;
        const jumpTrack = assets.jumpAnim.resource.animations[0].resource;

        // @ts-ignore engine-tsd
        // add two events to the jump animation track. One for when the bitmoji's feet touch the ground and another when the
        // bitmoji should transition back to the idle state
        jumpTrack.events = new pc.AnimEvents([
            {
                time: jumpTrack.duration * 0.8,
                name: 'jump_land'
            },
            {
                time: jumpTrack.duration * 0.85,
                name: 'jump_end'
            }
        ]);

        // add the two animation tracks to the anim component
        modelEntity.anim.assignAnimation('Idle', idleTrack);
        modelEntity.anim.assignAnimation('Jump', jumpTrack);

        // when the player clicks the jump control button or presses the space bar, transition to the jump state
        const bitmojiJumpEvent = () => {
            if (modelEntity.anim.baseLayer.activeState === 'Jump') return;
            modelEntity.anim.baseLayer.transition('Jump', 0.2);
        };
        data.on('jump', bitmojiJumpEvent);
        app.on('update', () => {
            if (app.keyboard.isPressed(pc.KEY_SPACE)) {
                bitmojiJumpEvent();
            }
        })

        // when the jump ends, the jump_end event is fired on the anim component which we can listen to here
        modelEntity.anim.on('jump_end', () => {
            modelEntity.anim.baseLayer.transition('Idle', 0.2);
        })

        // create a particle system which will show some leaves being rustled as the bitmoji lands
        modelEntity.addComponent("particlesystem", {
            autoPlay: false,
            numParticles: 90,
            lifetime: 3,
            rate: 0,
            loop: false,
            startAngle: 0,
            startAngle2: 0,
            emitterExtents: new pc.Vec3(0.6, 0, 0.6),
            emitterExtentsInner: new pc.Vec3(0.1, 0, 0.1),
            localSpace: true,
            orientation: pc.PARTICLEORIENTATION_EMITTER,
            colorMap: assets.particle.resource,
            localVelocityGraph: new pc.CurveSet([
                [0,0],
                [0,1.7875,0.00233,0.5,0.1837,-0.75,0.4349,-0.1625],
                [0,0]
            ]),
            localVelocityGraph2: new pc.CurveSet([
                [0,0],
                [0,1.7875,0.1837,-1.1375,0.4349,-0.1625],
                [0,0]
            ]) ,
            radialSpeedGraph: new pc.Curve([0,4.125,0.03953,0.625,0.3581,0.1875]),
            rotationSpeedGraph: new pc.Curve([0,0,0.1047,166.5]),
            rotationSpeedGraph2: new pc.Curve([0,0,0.1070,-105.75]),
            alphaGraph: new pc.Curve([0, 1, 1, 0]),
            scaleGraph: new pc.Curve([0,0.1]),
            layers: [0, 4]
        });

        // when the bitmoji's jump_land animation event fires, trigger a play of the leaves particle system
        modelEntity.anim.on('jump_land', () => {
            modelEntity.particlesystem.reset();
            modelEntity.particlesystem.play();
        })

        app.root.addChild(modelEntity);

        app.start();
    }
}
export default EventsExample;
