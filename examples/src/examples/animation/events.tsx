import React from 'react';
import * as pc from 'playcanvas/build/playcanvas.js';
import { AssetLoader } from '../../app/helpers/loader';
import Example from '../../app/example';

class EventsExample extends Example {
    static CATEGORY = 'Animation';
    static NAME = 'Events';

    load() {
        return <>
            <AssetLoader name='model' type='container' url='static/assets/models/bitmoji.glb' />
            <AssetLoader name='walkAnim' type='container' url='static/assets/animations/bitmoji/walk.glb' />
            <AssetLoader name='helipad.dds' type='cubemap' url='static/assets/cubemaps/helipad.dds' data={{ type: pc.TEXTURETYPE_RGBM }}/>
            <AssetLoader name='bloom' type='script' url='static/scripts/posteffects/posteffect-bloom.js' />
        </>;
    }

    // @ts-ignore: override class function
    example(canvas: HTMLCanvasElement, assets: { orbitScript: pc.Asset, bloom: pc.Asset, model: pc.Asset, walkAnim, 'helipad.dds': pc.Asset }): void {

        const app = new pc.Application(canvas, {
            mouse: new pc.Mouse(document.body),
            touch: new pc.TouchDevice(document.body)
        });
        app.scene.exposure = 2;
        app.start();

        // setup skydome
        app.scene.skyboxMip = 2;
        app.scene.setSkybox(assets['helipad.dds'].resources);


        // Create an Entity with a camera component
        const cameraEntity = new pc.Entity();
        cameraEntity.addComponent("camera", {
            clearColor: new pc.Color(0.1, 0.1, 0.1)
        });
        cameraEntity.translate(0, 1, 0);

        // add bloom postprocessing (this is ignored by the picker)
        cameraEntity.addComponent("script");
        cameraEntity.script.create("bloom", {
            attributes: {
                bloomIntensity: 1,
                bloomThreshold: 0.7,
                blurAmount: 4
            }
        });
        app.root.addChild(cameraEntity);

        const boxes: any = {};
        const highlightedBoxes: pc.Entity[] = [];

        // create a floor made up of box models
        for (let i = -5; i <= 5; i++) {
            for (let j = -5; j <= 5; j++) {
                const box = new pc.Entity();
                boxes[`${i}${j}`] = box;
                box.addComponent('model', {type: 'box'});
                box.setPosition(i,-0.5,j);
                box.setLocalScale(0.95, 1, 0.95);
                const material = new pc.StandardMaterial();
                material.diffuse = new pc.Color(0.7, 0.7, 0.7);
                material.shininess = 30;
                material.metalness = 0.2;
                material.useMetalness = true;
                box.model.material = material;
                material.update();
                app.root.addChild(box);

            }
        }

        // light up a box at the given position with a random color using the emissive material property
        let highlightBox = (pos: pc.Vec3) => {
            const i = Math.floor(pos.x + 0.5);
            const j = Math.floor(pos.z + 0.5);
            const colorVec = new pc.Vec3(Math.random(), Math.random(), Math.random());
            colorVec.mulScalar(1 / colorVec.length());
            // @ts-ignore engine-tsd
            boxes[`${i}${j}`].model.material.emissive = new pc.Color(colorVec.data);
            highlightedBoxes.push(boxes[`${i}${j}`]);
        };

        // create an entity from the loaded model using the render component
        const modelEntity = assets.model.resource.instantiateRenderEntity({
            castShadows: true
        });

        // add an anim component to the entity
        modelEntity.addComponent('anim', {
            activate: true
        });
        modelEntity.setLocalPosition(-3, 0, 0);

        const modelEntityParent = new pc.Entity();
        modelEntityParent.addChild(modelEntity);

        app.root.addChild(modelEntityParent);
        
        // rotate the model in a circle around the center of the scene
        app.on('update', (dt) => {
            modelEntityParent.rotate(0, 13.8 * dt, 0);
        })

        const walkTrack = assets.walkAnim.resource.animations[0].resource;
        // @ts-ignore engine-tsd
        // Add two anim events to the walk animation, one for each foot step. These events should occur just as each foot touches the ground
        walkTrack.events = new pc.AnimEvents([
            {
                time: walkTrack.duration * 0.1,
                name: 'foot_step',
                bone: 'R_foot0002_bind_JNT'
            },
            {
                time: walkTrack.duration * 0.6,
                name: 'foot_step',
                bone: 'L_foot0002_bind_JNT'
            }
        ]);

        // add the animation track to the anim component, with a defined speed
        modelEntity.anim.assignAnimation('Walk', walkTrack, undefined, 0.62);

        modelEntity.anim.on('foot_step', (event: any) => {
            // highlight the box that is under the foot's bone position
            highlightBox(modelEntity.findByName(event.bone).getPosition());
        });

        app.on('update', (dt) => {
            // on update, iterate over any currently highlighted boxes and reduce their emmisive property
            let popBoxCount = 0;
            highlightedBoxes.forEach((box: pc.Entity) => {
                // @ts-ignore engine-tsd
                let emissive = box.model.material.emissive;
                emissive = new pc.Vec3(emissive.r, emissive.g, emissive.b);
                emissive.scale(0.92);
                emissive = new pc.Color(emissive.data);
                if (emissive.r < 0.001 && emissive.g < 0.001 && emissive.b < 0.001) {
                    // @ts-ignore engine-tsd
                    box.model.material.emissive = new pc.Color(0, 0, 0);
                    popBoxCount++;
                } else {
                    // @ts-ignore engine-tsd
                    box.model.material.emissive = emissive;
                }
                box.model.material.update();
            });
            // if a box is no longer emissive, it should be removed from the list
            while (popBoxCount !== 0) {
                highlightedBoxes.shift();
                popBoxCount--;
            }

            // set the camera to folow the model
            const modelPosition = modelEntity.getPosition().clone();
            modelPosition.y = 0.5;
            cameraEntity.lookAt(modelPosition);
        });
    }
}
export default EventsExample;
