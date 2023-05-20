import { Application } from '../../../src/framework/application.js';
import { createScript } from '../../../src/framework/script/script.js';
import { Entity } from '../../../src/framework/entity.js';
import { EventHandler } from '../../../src/core/event-handler.js';

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
        it('adds an event subscription to the Event Handler that\'s passed to it', function () {
            scriptInstance.listen(eventHandler, 'test', function () {
                this.listenCalled = true;
            }, scriptInstance);

            eventHandler.fire('test');

            expect(scriptInstance.listenCalled).to.equal(true);
        });

        it('removes and adds the event subscription when script instance enabled, disabled, destroyed', function () {
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

        it('removes and adds the event subscription when Script component enabled, disabled, destroyed', function () {
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

        it('doesn\'t add subscription if Script component is disabled before listen is called', function () {
            entity.script.enabled = false;

            scriptInstance.listenCalled = false;

            scriptInstance.listen(eventHandler, 'test', function () {
                this.listenCalled = true;
            }, scriptInstance);

            eventHandler.fire('test');
            expect(scriptInstance.listenCalled).to.equal(false);
        });
    });

    describe('#unlisten', function () {
        it('removes an event subscription from the Event Handler', function () {
            const callback = function () {
                this.listenCalled = true;
            };

            scriptInstance.listen(eventHandler, 'test', callback, scriptInstance);
            scriptInstance.unlisten(eventHandler, 'test', callback, scriptInstance);

            scriptInstance.listenCalled = false;
            eventHandler.fire('test');

            expect(scriptInstance.listenCalled).to.equal(false);
        });

        it('removes the correct event subscription from the Event Handler when multiple are used', function () {
            const callback1 = function () {
                this.listenCalled1 = true;
            };
            const callback2 = function () {
                this.listenCalled2 = true;
            };
            const callback3 = function () {
                this.listenCalled3 = true;
            };

            scriptInstance.listen(eventHandler, 'test1', callback1, scriptInstance);
            scriptInstance.listen(eventHandler, 'test2', callback2, scriptInstance);
            scriptInstance.listen(eventHandler, 'test3', callback3, scriptInstance);

            scriptInstance.unlisten(eventHandler, 'test2', callback2, scriptInstance);

            eventHandler.fire('test1');
            eventHandler.fire('test2');
            eventHandler.fire('test3');

            expect(scriptInstance.listenCalled1).to.equal(true);
            expect(scriptInstance.listenCalled2).not.to.equal(true);
            expect(scriptInstance.listenCalled3).to.equal(true);
        });

        it('removes the correct event subscription from the Event Handler without scope object', function () {
            let callback2Flag = false;

            const callback1 = function () {
                this.listenCalled1 = true;
            };
            const callback2 = function () {
                callback2Flag = true;
            };
            const callback3 = function () {
                this.listenCalled3 = true;
            };

            scriptInstance.listen(eventHandler, 'test1', callback1, scriptInstance);
            scriptInstance.listen(eventHandler, 'test2', callback2);
            scriptInstance.listen(eventHandler, 'test3', callback3, scriptInstance);

            scriptInstance.unlisten(eventHandler, 'test2', callback2);

            eventHandler.fire('test1');
            eventHandler.fire('test2');
            eventHandler.fire('test3');

            expect(scriptInstance.listenCalled1).to.equal(true);
            expect(scriptInstance.listenCalled3).to.equal(true);

            expect(callback2Flag).to.equal(false);
        });
    });
});
