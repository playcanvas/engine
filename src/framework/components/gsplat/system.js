import { Vec3 } from '../../../core/math/vec3.js';
import { BoundingBox } from '../../../core/shape/bounding-box.js';

import { Component } from '../component.js';
import { ComponentSystem } from '../system.js';

import { GSplatComponent } from './component.js';
import { GSplatComponentData } from './data.js';

const _schema = [
    'enabled'
];

// order matters here
const _properties = [
    'instance',
    'asset',
    'layers'
];

/**
 * Allows an Entity to render a gsplat.
 *
 * @augments ComponentSystem
 * @category Graphics
 */
class GSplatComponentSystem extends ComponentSystem {
    /**
     * Create a new GSplatComponentSystem.
     *
     * @param {import('../../app-base.js').AppBase} app - The Application.
     * @hideconstructor
     */
    constructor(app) {
        super(app);

        this.id = 'gsplat';

        this.ComponentType = GSplatComponent;
        this.DataType = GSplatComponentData;

        this.schema = _schema;

        this.on('beforeremove', this.onRemove, this);
    }

    initializeComponentData(component, _data, properties) {
        // duplicate layer list
        if (_data.layers && _data.layers.length) {
            _data.layers = _data.layers.slice(0);
        }

        for (let i = 0; i < _properties.length; i++) {
            if (_data.hasOwnProperty(_properties[i])) {
                component[_properties[i]] = _data[_properties[i]];
            }
        }

        if (_data.aabbCenter && _data.aabbHalfExtents) {
            component.customAabb = new BoundingBox(new Vec3(_data.aabbCenter), new Vec3(_data.aabbHalfExtents));
        }

        super.initializeComponentData(component, _data, _schema);
    }

    cloneComponent(entity, clone) {

        const gSplatComponent = entity.gsplat;

        // copy properties
        const data = {};
        for (let i = 0; i < _properties.length; i++) {
            data[_properties[i]] = gSplatComponent[_properties[i]];
        }
        data.enabled = gSplatComponent.enabled;

        // gsplat instance cannot be used this way, remove it and manually clone it later
        delete data.instance;

        // clone component
        const component = this.addComponent(clone, data);

        // clone gsplat instance
        component.instance = gSplatComponent.instance.clone();

        if (gSplatComponent.customAabb) {
            component.customAabb = gSplatComponent.customAabb.clone();
        }

        return component;
    }

    onRemove(entity, component) {
        component.onRemove();
    }
}

Component._buildAccessors(GSplatComponent.prototype, _schema);

export { GSplatComponentSystem };
