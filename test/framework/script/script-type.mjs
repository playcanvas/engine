import { Application } from '../../../src/framework/application.js';
import { createScript } from "../../../src/framework/script/script.js";
import { Entity } from '../../../src/framework/entity.js';
import { EventHandler } from "../../../src/core/event-handler.js";
import { ScriptComponent } from '../../../src/framework/components/script/component.js';

import { DummyComponentSystem } from '../test-component/system.mjs';

import { HTMLCanvasElement } from '@playcanvas/canvas-mock';

import { expect } from 'chai';

describe('ScriptType', function () {

    let app;
    let entity;
    let scriptInstance;
    let eventHandler;

    beforeEach(function () {
        const canvas = new HTMLCanvasElement(500, 500);
        app = new Application(canvas);

        app.systems.add(new DummyComponentSystem(app));

        createScript('testScriptType');

        entity = new Entity();
        entity.addComponent('script');

        app.root.addChild(entity);

        scriptInstance = entity.script.create('testScriptType');
        eventHandler = new EventHandler();
    });

    afterEach(function () {
        entity.destroy();
        app.destroy();

        app = null;
        entity = null;
        scriptInstance = null;
        eventHandler = null;
    });

    describe('#listen', function () {
        it(`adds an event subscription to the Event Handler that's passed to it`, function () {
            scriptInstance.listen(eventHandler, 'test', function () {
                this.listenCalled = true;
            }, scriptInstance);

            eventHandler.fire('test');

            expect(scriptInstance.listenCalled).to.equal(true);
        });

        it(`removes and adds the event subscription when script instance enabled, disabled, destroyed`, function () {
            scriptInstance.listenCalled = false;

            scriptInstance.listen(eventHandler, 'test', function () {
                this.listenCalled = true;
            }, scriptInstance);

            scriptInstance.enabled = false;
            eventHandler.fire('test');
            expect(scriptInstance.listenCalled).to.equal(false);

            scriptInstance.listenCalled = false;
            scriptInstance.enabled = true;
            eventHandler.fire('test');
            expect(scriptInstance.listenCalled).to.equal(true);

            scriptInstance.listenCalled = false;
            entity.script.destroy('testScriptType');
            eventHandler.fire('test');
            expect(scriptInstance.listenCalled).to.equal(false);
        });

        it(`removes and adds the event subscription when Script component enabled, disabled, destroyed`, function () {
            scriptInstance.listenCalled = false;

            scriptInstance.listen(eventHandler, 'test', function () {
                this.listenCalled = true;
            }, scriptInstance);

            entity.script.enabled = false;
            eventHandler.fire('test');
            expect(scriptInstance.listenCalled).to.equal(false);

            scriptInstance.listenCalled = false;
            entity.script.enabled = true;
            eventHandler.fire('test');
            expect(scriptInstance.listenCalled).to.equal(true);

            scriptInstance.listenCalled = false;
            entity.removeComponent('script');
            eventHandler.fire('test');
            expect(scriptInstance.listenCalled).to.equal(false);
        });

        // What happens when listen is called when it is disabled first
        // What happens when the entity is cloned
    });
});
