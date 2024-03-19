import { Vec2 } from '../../../core/math/vec2.js';
import { Vec4 } from '../../../core/math/vec4.js';

import { Component } from '../component.js';
import { ComponentSystem } from '../system.js';

import { LayoutGroupComponent } from './component.js';
import { LayoutGroupComponentData } from './data.js';

const _schema = ['enabled'];

const MAX_ITERATIONS = 100;

/**
 * Manages creation of {@link LayoutGroupComponent}s.
 *
 * @category User Interface
 */
class LayoutGroupComponentSystem extends ComponentSystem {
    /**
     * Create a new LayoutGroupComponentSystem instance.
     *
     * @param {import('../../app-base.js').AppBase} app - The application.
     * @ignore
     */
    constructor(app) {
        super(app);

        this.id = 'layoutgroup';

        this.ComponentType = LayoutGroupComponent;
        this.DataType = LayoutGroupComponentData;

        this.schema = _schema;

        this._reflowQueue = [];

        this.on('beforeremove', this._onRemoveComponent, this);

        // Perform reflow when running in the engine
        this.app.systems.on('postUpdate', this._onPostUpdate, this);
    }

    initializeComponentData(component, data, properties) {
        if (data.enabled !== undefined) component.enabled = data.enabled;
        if (data.orientation !== undefined) component.orientation = data.orientation;
        if (data.reverseX !== undefined) component.reverseX = data.reverseX;
        if (data.reverseY !== undefined) component.reverseY = data.reverseY;
        if (data.alignment !== undefined) {
            component.alignment = Array.isArray(data.alignment) ? new Vec2(data.alignment) : data.alignment;
        }
        if (data.padding !== undefined) {
            component.padding = Array.isArray(data.padding) ? new Vec4(data.padding) : data.padding;
        }
        if (data.spacing !== undefined) {
            component.spacing = Array.isArray(data.spacing) ? new Vec2(data.spacing) : data.spacing;
        }
        if (data.widthFitting !== undefined) component.widthFitting = data.widthFitting;
        if (data.heightFitting !== undefined) component.heightFitting = data.heightFitting;
        if (data.wrap !== undefined) component.wrap = data.wrap;

        super.initializeComponentData(component, data, properties);
    }

    cloneComponent(entity, clone) {
        const layoutGroup = entity.layoutgroup;

        return this.addComponent(clone, {
            enabled: layoutGroup.enabled,
            orientation: layoutGroup.orientation,
            reverseX: layoutGroup.reverseX,
            reverseY: layoutGroup.reverseY,
            alignment: layoutGroup.alignment,
            padding: layoutGroup.padding,
            spacing: layoutGroup.spacing,
            widthFitting: layoutGroup.widthFitting,
            heightFitting: layoutGroup.heightFitting,
            wrap: layoutGroup.wrap
        });
    }

    scheduleReflow(component) {
        if (this._reflowQueue.indexOf(component) === -1) {
            this._reflowQueue.push(component);
        }
    }

    _onPostUpdate() {
        this._processReflowQueue();
    }

    _processReflowQueue() {
        if (this._reflowQueue.length === 0) {
            return;
        }

        let iterationCount = 0;

        while (this._reflowQueue.length > 0) {
            // Create a copy of the queue to sort and process. If processing the reflow of any
            // layout groups results in additional groups being pushed to the queue, they will
            // be processed on the next iteration of the while loop.
            const queue = this._reflowQueue.slice();
            this._reflowQueue.length = 0;

            // Sort in ascending order of depth within the graph (i.e. outermost first), so that
            // any layout groups which are children of other layout groups will always have their
            // new size set before their own reflow is calculated.
            queue.sort(function (componentA, componentB) {
                return (componentA.entity.graphDepth - componentB.entity.graphDepth);
            });

            for (let i = 0; i < queue.length; ++i) {
                queue[i].reflow();
            }

            if (++iterationCount >= MAX_ITERATIONS) {
                console.warn('Max reflow iterations limit reached, bailing.');
                break;
            }
        }
    }

    _onRemoveComponent(entity, component) {
        component.onRemove();
    }

    destroy() {
        super.destroy();

        this.app.systems.off('postUpdate', this._onPostUpdate, this);
    }
}

Component._buildAccessors(LayoutGroupComponent.prototype, _schema);

export { LayoutGroupComponentSystem };
