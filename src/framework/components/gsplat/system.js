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
 * @import { Camera } from '../../../scene/camera.js'
 * @import { Layer } from '../../../scene/layer.js'
 * @import { ShaderMaterial } from '../../../scene/materials/shader-material.js'
 */

const _schema = [
    'enabled'
];

// order matters here
const _properties = [
    'unified',
    'lodDistances',
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
     * Fired when a GSplat material is created for a camera and layer combination. In unified
     * mode, materials are created during the first frame update when the GSplat is rendered.
     * The handler is passed the {@link ShaderMaterial}, the {@link Camera}, and the {@link Layer}.
     *
     * This event is useful for setting up custom material chunks and parameters before the
     * first render.
     *
     * @event
     * @example
     * app.systems.gsplat.on('material:created', (material, camera, layer) => {
     *     console.log(`Material created for camera ${camera.entity.name} on layer ${layer.name}`);
     *     // Set custom material parameters before first render
     *     material.setParameter('myParam', value);
     * });
     */
    static EVENT_MATERIALCREATED = 'material:created';

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
        app.renderer.gsplatDirector = new GSplatDirector(app.graphicsDevice, app.renderer, app.scene, gsplatAssetLoader, this);

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
                if (!gSplatComponent.unified) { // unified gsplat does not use material
                    const srcMaterial = gSplatComponent[prop];
                    if (srcMaterial) {
                        data[prop] = srcMaterial.clone();
                    }
                }
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

    /**
     * Gets the GSplat material used by unified GSplat rendering for the given camera and layer.
     *
     * Returns null if the material hasn't been created yet. In unified mode, materials are created
     * during the first frame update when the GSplat is rendered. To be notified immediately when
     * materials are created, listen to the 'material:created' event on GSplatComponentSystem:
     *
     * @param {Camera} camera - The camera instance.
     * @param {Layer} layer - The layer instance.
     * @returns {ShaderMaterial|null} The material, or null if not created yet.
     * @example
     * app.systems.gsplat.on('material:created', (material, camera, layer) => {
     *     // Material is now available
     *     material.setParameter('myParam', value);
     * });
     */
    getGSplatMaterial(camera, layer) {
        const director = this.app.renderer.gsplatDirector;
        if (!director) return null;

        const cameraData = director.camerasMap.get(camera);
        if (!cameraData) return null;

        const layerData = cameraData.layersMap.get(layer);
        return layerData?.gsplatManager?.material ?? null;
    }
}

Component._buildAccessors(GSplatComponent.prototype, _schema);

export { GSplatComponentSystem };
