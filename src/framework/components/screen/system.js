import { IndexedList } from '../../../core/indexed-list.js';

import { Vec2 } from '../../../core/math/vec2.js';

import { Component } from '../component.js';
import { ComponentSystem } from '../system.js';

import { ScreenComponent } from './component.js';
import { ScreenComponentData } from './data.js';

const _schema = ['enabled'];

/**
 * Manages creation of {@link ScreenComponent}s.
 *
 * @augments ComponentSystem
 * @category User Interface
 */
class ScreenComponentSystem extends ComponentSystem {
    /**
     * Create a new ScreenComponentSystem instance.
     *
     * @param {import('../../app-base.js').AppBase} app - The application.
     * @hideconstructor
     */
    constructor(app) {
        super(app);

        this.id = 'screen';

        this.ComponentType = ScreenComponent;
        this.DataType = ScreenComponentData;

        this.schema = _schema;

        this.windowResolution = new Vec2();

        // queue of callbacks
        this._drawOrderSyncQueue = new IndexedList();

        this.app.graphicsDevice.on('resizecanvas', this._onResize, this);

        this.app.systems.on('update', this._onUpdate, this);

        this.on('beforeremove', this.onRemoveComponent, this);
    }

    initializeComponentData(component, data, properties) {
        if (data.priority !== undefined) component.priority = data.priority;
        if (data.screenSpace !== undefined) component.screenSpace = data.screenSpace;
        component.cull = component.screenSpace;
        if (data.scaleMode !== undefined) component.scaleMode = data.scaleMode;
        if (data.scaleBlend !== undefined) component.scaleBlend = data.scaleBlend;
        if (data.resolution !== undefined) {
            if (data.resolution instanceof Vec2) {
                component._resolution.copy(data.resolution);
            } else {
                component._resolution.set(data.resolution[0], data.resolution[1]);
            }
            component.resolution = component._resolution;
        }
        if (data.referenceResolution !== undefined) {
            if (data.referenceResolution instanceof Vec2) {
                component._referenceResolution.copy(data.referenceResolution);
            } else {
                component._referenceResolution.set(data.referenceResolution[0], data.referenceResolution[1]);
            }
            component.referenceResolution = component._referenceResolution;
        }

        // queue up a draw order sync
        component.syncDrawOrder();
        super.initializeComponentData(component, data, properties);
    }

    destroy() {
        super.destroy();

        this.app.graphicsDevice.off('resizecanvas', this._onResize, this);
        this.app.systems.off('update', this._onUpdate, this);
    }

    _onUpdate(dt) {
        const components = this.store;

        for (const id in components) {
            if (components[id].entity.screen.update) components[id].entity.screen.update(dt);
        }
    }

    _onResize(width, height) {
        this.windowResolution.x = width;
        this.windowResolution.y = height;
    }

    cloneComponent(entity, clone) {
        const screen = entity.screen;

        return this.addComponent(clone, {
            enabled: screen.enabled,
            screenSpace: screen.screenSpace,
            scaleMode: screen.scaleMode,
            resolution: screen.resolution.clone(),
            referenceResolution: screen.referenceResolution.clone()
        });
    }

    onRemoveComponent(entity, component) {
        component.onRemove();
    }

    processDrawOrderSyncQueue() {
        const list = this._drawOrderSyncQueue.list();

        for (let i = 0; i < list.length; i++) {
            const item = list[i];
            item.callback.call(item.scope);
        }
        this._drawOrderSyncQueue.clear();
    }

    queueDrawOrderSync(id, fn, scope) {
        // first queued sync this frame
        // attach an event listener
        if (!this._drawOrderSyncQueue.list().length) {
            this.app.once('prerender', this.processDrawOrderSyncQueue, this);
        }

        if (!this._drawOrderSyncQueue.has(id)) {
            this._drawOrderSyncQueue.push(id, {
                callback: fn,
                scope: scope
            });
        }
    }
}

Component._buildAccessors(ScreenComponent.prototype, _schema);

export { ScreenComponentSystem };
