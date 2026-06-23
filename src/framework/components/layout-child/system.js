import { ComponentSystem } from '../system.js';
import { LayoutChildComponent } from './component.js';

/**
 * @import { AppBase } from '../../app-base.js'
 */

/**
 * Manages creation of {@link LayoutChildComponent}s.
 *
 * @category User Interface
 */
class LayoutChildComponentSystem extends ComponentSystem {
    /**
     * Create a new LayoutChildComponentSystem instance.
     *
     * @param {AppBase} app - The application.
     * @ignore
     */
    constructor(app) {
        super(app);

        this.id = 'layoutchild';

        this.ComponentType = LayoutChildComponent;
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

        // pass an empty properties list as the enabled state is initialized above
        super.initializeComponentData(component, data, []);
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

export { LayoutChildComponentSystem };
