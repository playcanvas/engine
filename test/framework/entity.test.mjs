import { AnimComponent } from '../../src/framework/components/anim/component.js';
import { AnimationComponent } from '../../src/framework/components/animation/component.js';
import { Application } from '../../src/framework/application.js';
import { AudioListenerComponent } from '../../src/framework/components/audio-listener/component.js';
import { AudioSourceComponent } from '../../src/framework/components/audio-source/component.js';
import { ButtonComponent } from '../../src/framework/components/button/component.js';
import { CameraComponent } from '../../src/framework/components/camera/component.js';
import { CollisionComponent } from '../../src/framework/components/collision/component.js';
import { ElementComponent } from '../../src/framework/components/element/component.js';
import { Entity } from '../../src/framework/entity.js';
import { JointComponent } from '../../src/framework/components/joint/component.js';
import { LayoutChildComponent } from '../../src/framework/components/layout-child/component.js';
import { LayoutGroupComponent } from '../../src/framework/components/layout-group/component.js';
import { LightComponent } from '../../src/framework/components/light/component.js';
import { ModelComponent } from '../../src/framework/components/model/component.js';
import { ParticleSystemComponent } from '../../src/framework/components/particle-system/component.js';
import { RenderComponent } from '../../src/framework/components/render/component.js';
import { RigidBodyComponent } from '../../src/framework/components/rigid-body/component.js';
import { ScreenComponent } from '../../src/framework/components/screen/component.js';
import { ScriptComponent } from '../../src/framework/components/script/component.js';
import { ScrollbarComponent } from '../../src/framework/components/scrollbar/component.js';
import { ScrollViewComponent } from '../../src/framework/components/scroll-view/component.js';
import { SoundComponent } from '../../src/framework/components/sound/component.js';
import { SpriteComponent } from '../../src/framework/components/sprite/component.js';
import { ZoneComponent } from '../../src/framework/components/zone/component.js';

import { HTMLCanvasElement } from '@playcanvas/canvas-mock/src/html-canvas-element.mjs';

import { expect } from 'chai';

describe('Entity', function () {

    let app;

    beforeEach(function () {
        const canvas = new HTMLCanvasElement(500, 500);
        app = new Application(canvas);
    });

    afterEach(function () {
        app.destroy();
    });

    describe('#constructor', function () {

        it('supports zero arguments', function () {
            const entity = new Entity();
            expect(entity).to.be.an.instanceof(Entity);
            expect(entity.name).to.equal('Untitled');
        });

        it('supports one argument', function () {
            const entity = new Entity('Test');
            expect(entity).to.be.an.instanceof(Entity);
            expect(entity.name).to.equal('Test');
        });

        it('supports two arguments', function () {
            const entity = new Entity('Test', app);
            expect(entity).to.be.an.instanceof(Entity);
            expect(entity.name).to.equal('Test');
        });

    });

    describe('#addComponent', function () {

        const components = {
            anim: AnimComponent,
            animation: AnimationComponent,
            audiolistener: AudioListenerComponent,
            audiosource: AudioSourceComponent,
            button: ButtonComponent,
            camera: CameraComponent,
            collision: CollisionComponent,
            element: ElementComponent,
            joint: JointComponent,
            layoutchild: LayoutChildComponent,
            layoutgroup: LayoutGroupComponent,
            light: LightComponent,
            model: ModelComponent,
            particlesystem: ParticleSystemComponent,
            render: RenderComponent,
            rigidbody: RigidBodyComponent,
            screen: ScreenComponent,
            scrollview: ScrollViewComponent,
            scrollbar: ScrollbarComponent,
            script: ScriptComponent,
            sound: SoundComponent,
            sprite: SpriteComponent,
            zone: ZoneComponent
        };

        Object.keys(components).forEach((name) => {
            it(`adds a ${name} component`, function () {
                // Create an entity and verify that it does not already have the component
                const entity = new Entity();
                expect(entity[name]).to.be.undefined;

                // Add the component
                let component = entity.addComponent(name);
                expect(component).to.be.an.instanceof(components[name]);
                expect(entity[name]).to.be.an.instanceof(components[name]);

                // Try to add the component again
                component = entity.addComponent(name);
                expect(component).to.be.null;
                expect(entity[name]).to.be.an.instanceof(components[name]);

                // Remove the component and destroy the entity
                entity.removeComponent(name);
                expect(entity[name]).to.be.undefined;
                entity.destroy();
            });
        });

    });

    describe('#destroy', function () {

        it('destroys the entity', function () {
            const entity = new Entity();

            let destroyed = false;
            entity.on('destroy', function () {
                destroyed = true;
            });
            entity.destroy();

            expect(destroyed).to.be.true;
        });

    });

    describe('#removeComponent', function () {

        it('removes a component from the entity', function () {
            const entity = new Entity();
            expect(entity.anim).to.be.undefined;
            entity.addComponent('anim');
            expect(entity.anim).to.be.an.instanceof(AnimComponent);
            entity.removeComponent('anim');
            expect(entity.anim).to.be.undefined;
            entity.destroy();
        });

    });

});
