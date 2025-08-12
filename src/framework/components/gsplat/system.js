import { Vec3 } from '../../../core/math/vec3.js';
import { BoundingBox } from '../../../core/shape/bounding-box.js';
import { GSplatDirector } from '../../../scene/gsplat-unified/gsplat-director.js';
import { Component } from '../component.js';
import { ComponentSystem } from '../system.js';
import { GSplatComponent } from './component.js';
import { GSplatComponentData } from './data.js';
import { GSplatAssetLoader } from './gsplat-asset-loader.js';

/**
 * @import { AppBase } from '../../app-base.js'
 */

const _schema = [
    'enabled'
];

// order matters here
const _properties = [
    'unified',
    'castShadows',
    'material',
    'highQualitySH',
    'asset',
    'layers'
];

/**
 * Allows an Entity to render a gsplat.
 *
 * @category Graphics
 */
class GSplatComponentSystem extends ComponentSystem {
    /**
     * Create a new GSplatComponentSystem.
     *
     * @param {AppBase} app - The Application.
     * @ignore
     */
    constructor(app) {
        super(app);

        this.id = 'gsplat';

        this.ComponentType = GSplatComponent;
        this.DataType = GSplatComponentData;

        this.schema = _schema;

        // loader for splat LOD assets, as asset system is not available on the scene level
        const gsplatAssetLoader = new GSplatAssetLoader(app.assets);
        app.renderer.gsplatDirector = new GSplatDirector(app.graphicsDevice, gsplatAssetLoader);

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
        _properties.forEach((prop) => {
            if (prop === 'material') {
                data[prop] = gSplatComponent[prop].clone();
            } else {
                data[prop] = gSplatComponent[prop];
            }
        });
        data.enabled = gSplatComponent.enabled;

        // clone component
        const component = this.addComponent(clone, data);

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
