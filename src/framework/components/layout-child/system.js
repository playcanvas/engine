import { Component } from '../component.js';
import { ComponentSystem } from '../system.js';

import { LayoutChildComponent } from './component.js';
import { LayoutChildComponentData } from './data.js';

const _schema = ['enabled'];

/**
 * Manages creation of {@link LayoutChildComponent}s.
 *
 * @category User Interface
 */
class LayoutChildComponentSystem extends ComponentSystem {
    /**
     * Create a new LayoutChildComponentSystem instance.
     *
     * @param {import('../../app-base.js').AppBase} app - The application.
     * @ignore
     */
    constructor(app) {
        super(app);

        this.id = 'layoutchild';

        this.ComponentType = LayoutChildComponent;
        this.DataType = LayoutChildComponentData;

        this.schema = _schema;
    }

    initializeComponentData(component, data, properties) {
        if (data.enabled !== undefined) component.enabled = data.enabled;
        if (data.minWidth !== undefined) component.minWidth = data.minWidth;
        if (data.minHeight !== undefined) component.minHeight = data.minHeight;
        if (data.maxWidth !== undefined) component.maxWidth = data.maxWidth;
        if (data.maxHeight !== undefined) component.maxHeight = data.maxHeight;
        if (data.fitWidthProportion !== undefined) component.fitWidthProportion = data.fitWidthProportion;
        if (data.fitHeightProportion !== undefined) component.fitHeightProportion = data.fitHeightProportion;
        if (data.excludeFromLayout !== undefined) component.excludeFromLayout = data.excludeFromLayout;

        super.initializeComponentData(component, data, properties);
    }

    cloneComponent(entity, clone) {
        const layoutChild = entity.layoutchild;

        return this.addComponent(clone, {
            enabled: layoutChild.enabled,
            minWidth: layoutChild.minWidth,
            minHeight: layoutChild.minHeight,
            maxWidth: layoutChild.maxWidth,
            maxHeight: layoutChild.maxHeight,
            fitWidthProportion: layoutChild.fitWidthProportion,
            fitHeightProportion: layoutChild.fitHeightProportion,
            excludeFromLayout: layoutChild.excludeFromLayout
        });
    }
}

Component._buildAccessors(LayoutChildComponent.prototype, _schema);

export { LayoutChildComponentSystem };
