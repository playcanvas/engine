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

        Object.keys(components).forEach((name) => {
            it(`adds a ${name} component`, function () {
                // Create an entity and verify that it does not already have the component
                const entity = new Entity();
                expect(entity[name]).to.be.undefined;

                // Add the component
                let component = entity.addComponent(name);
                expect(component).to.be.an.instanceof(components[name]);
                expect(component).to.equal(entity[name]);
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

    describe('#clone', function () {

        it('clones an entity', function () {
            const entity = new Entity('Test');
            Object.keys(components).forEach((name) => {
                entity.addComponent(name);
            });

            const clone = entity.clone();
            expect(clone).to.be.an.instanceof(Entity);
            expect(clone.getGuid()).to.not.equal(entity.getGuid());
            expect(clone.name).to.equal('Test');
            Object.keys(components).forEach((name) => {
                expect(clone[name]).to.be.an.instanceof(components[name]);
            });
        });

        it('clones an entity hierarchy', function () {
            const root = new Entity('Test');
            const child = new Entity('Child');
            root.addChild(child);
            Object.keys(components).forEach((name) => {
                root.addComponent(name);
                child.addComponent(name);
            });

            const clone = root.clone();
            expect(clone).to.be.an.instanceof(Entity);
            expect(clone.getGuid()).to.not.equal(root.getGuid());
            expect(clone.name).to.equal('Test');
            Object.keys(components).forEach((name) => {
                expect(clone[name]).to.be.an.instanceof(components[name]);
            });
            expect(clone.children.length).to.equal(root.children.length);

            const cloneChild = clone.findByName('Child');
            expect(cloneChild.getGuid()).to.not.equal(child.getGuid());
            Object.keys(components).forEach((name) => {
                expect(cloneChild[name]).to.be.an.instanceof(components[name]);
            });

            root.destroy();
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

    describe('#findByGuid', function () {

        it('returns same entity', function () {
            const e = new Entity();
            expect(e.findByGuid(e.getGuid())).to.equal(e);
        });

        it('returns direct child entity', function () {
            const e = new Entity();
            const c = new Entity();
            e.addChild(c);
            expect(e.findByGuid(c.getGuid())).to.equal(c);
        });

        it('returns child of child entity', function () {
            const e = new Entity();
            const c = new Entity();
            const c2 = new Entity();
            e.addChild(c);
            c.addChild(c2);
            expect(e.findByGuid(c2.getGuid())).to.equal(c2);
        });

        it('does not return parent', function () {
            const e = new Entity();
            const c = new Entity();
            e.addChild(c);
            expect(c.findByGuid(e.getGuid())).to.equal(null);
        });

        it('does not return destroyed entity', function () {
            const e = new Entity();
            const c = new Entity();
            e.addChild(c);
            c.destroy();
            expect(e.findByGuid(c.getGuid())).to.equal(null);
        });

        it('does not return entity that was removed from hierarchy', function () {
            const e = new Entity();
            const c = new Entity();
            e.addChild(c);
            e.removeChild(c);
            expect(e.findByGuid(c.getGuid())).to.equal(null);
        });

        it('does not return entity that does not exist', function () {
            expect(app.root.findByGuid('missing')).to.equal(null);
        });

    });

    describe('#findComponent', function () {

        it('finds component on single entity', function () {
            const e = new Entity();
            e.addComponent('anim');
            const component = e.findComponent('anim');
            expect(component).to.be.an.instanceof(AnimComponent);
        });

        it('returns null when component is not found', function () {
            const e = new Entity();
            e.addComponent('anim');
            const component = e.findComponent('render');
            expect(component).to.be.null;
        });

        it('finds component on child entity', function () {
            const root = new Entity();
            const child = new Entity();
            root.addChild(child);
            child.addComponent('anim');
            const component = root.findComponent('anim');
            expect(component).to.be.an.instanceof(AnimComponent);
        });

        it('finds component on grandchild entity', function () {
            const root = new Entity();
            const child = new Entity();
            const grandchild = new Entity();
            root.addChild(child);
            child.addChild(grandchild);
            grandchild.addComponent('anim');
            const component = root.findComponent('anim');
            expect(component).to.be.an.instanceof(AnimComponent);
        });

        it('does not find component on parent entity', function () {
            const root = new Entity();
            const child = new Entity();
            root.addChild(child);
            root.addComponent('anim');
            const component = child.findComponent('anim');
            expect(component).to.be.null;
        });

    });

    describe('#findComponents', function () {

        it('finds components on single entity', function () {
            const e = new Entity();
            e.addComponent('anim');
            const components = e.findComponents('anim');
            expect(components).to.be.an('array');
            expect(components.length).to.equal(1);
            expect(components[0]).to.be.an.instanceof(AnimComponent);
        });

        it('returns empty array when no components are found', function () {
            const e = new Entity();
            e.addComponent('anim');
            const components = e.findComponents('render');
            expect(components).to.be.an('array');
            expect(components.length).to.equal(0);
        });

        it('finds components on child entity', function () {
            const root = new Entity();
            const child = new Entity();
            root.addChild(child);
            child.addComponent('anim');
            const components = root.findComponents('anim');
            expect(components).to.be.an('array');
            expect(components.length).to.equal(1);
            expect(components[0]).to.be.an.instanceof(AnimComponent);
        });

        it('finds components on 3 entity hierarchy', function () {
            const root = new Entity();
            const child = new Entity();
            const grandchild = new Entity();
            root.addChild(child);
            child.addChild(grandchild);
            root.addComponent('anim');
            child.addComponent('anim');
            grandchild.addComponent('anim');
            const components = root.findComponents('anim');
            expect(components).to.be.an('array');
            expect(components.length).to.equal(3);
            expect(components[0]).to.be.an.instanceof(AnimComponent);
            expect(components[1]).to.be.an.instanceof(AnimComponent);
            expect(components[2]).to.be.an.instanceof(AnimComponent);
        });

        it('does not find components on parent entity', function () {
            const root = new Entity();
            const child = new Entity();
            root.addChild(child);
            root.addComponent('anim');
            const components = child.findComponents('anim');
            expect(components).to.be.an('array');
            expect(components.length).to.equal(0);
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
