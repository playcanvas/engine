import { sortPriority } from '../../../core/sort.js';
import { Color } from '../../../math/color.js';
import { Vec4 } from '../../../math/vec4.js';

import { Component } from '../component.js';
import { ComponentSystem } from '../system.js';

import { CameraComponent } from './component.js';
import { CameraComponentData } from './data.js';

/** @typedef {import('../../app-base.js').AppBase} AppBase */

const _schema = ['enabled'];

/**
 * Used to add and remove {@link CameraComponent}s from Entities. It also holds an array of all
 * active cameras.
 *
 * @augments ComponentSystem
 */
class CameraComponentSystem extends ComponentSystem {
    /**
     * Holds all the active camera components.
     *
     * @type {CameraComponent[]}
     */
    cameras = [];

    /**
     * Create a new CameraComponentSystem instance.
     *
     * @param {AppBase} app - The Application.
     * @hideconstructor
     */
    constructor(app) {
        super(app);

        this.id = 'camera';

        this.ComponentType = CameraComponent;
        this.DataType = CameraComponentData;

        this.schema = _schema;

        this.on('beforeremove', this.onBeforeRemove, this);
        this.app.on('prerender', this.onAppPrerender, this);

        this.app.systems.on('update', this.onUpdate, this);
    }

    initializeComponentData(component, data, properties) {
        properties = [
            'aspectRatio',
            'aspectRatioMode',
            'calculateProjection',
            'calculateTransform',
            'clearColor',
            'clearColorBuffer',
            'clearDepthBuffer',
            'clearStencilBuffer',
            'cullFaces',
            'farClip',
            'flipFaces',
            'fov',
            'frustumCulling',
            'horizontalFov',
            'layers',
            'renderTarget',
            'nearClip',
            'orthoHeight',
            'projection',
            'priority',
            'rect',
            'scissorRect',
            'aperture',
            'shutter',
            'sensitivity'
        ];

        for (let i = 0; i < properties.length; i++) {
            const property = properties[i];
            if (data.hasOwnProperty(property)) {
                const value = data[property];
                switch (property) {
                    case 'rect':
                    case 'scissorRect':
                        if (Array.isArray(value)) {
                            component[property] = new Vec4(value[0], value[1], value[2], value[3]);
                        } else {
                            component[property] = value;
                        }
                        break;
                    case 'clearColor':
                        if (Array.isArray(value)) {
                            component[property] = new Color(value[0], value[1], value[2], value[3]);
                        } else {
                            component[property] = value;
                        }
                        break;
                    default:
                        component[property] = value;
                        break;
                }
            }
        }

        super.initializeComponentData(component, data, ['enabled']);
    }

    cloneComponent(entity, clone) {
        const c = entity.camera;
        return this.addComponent(clone, {
            aspectRatio: c.aspectRatio,
            aspectRatioMode: c.aspectRatioMode,
            calculateProjection: c.calculateProjection,
            calculateTransform: c.calculateTransform,
            clearColor: c.clearColor,
            clearColorBuffer: c.clearColorBuffer,
            clearDepthBuffer: c.clearDepthBuffer,
            clearStencilBuffer: c.clearStencilBuffer,
            cullFaces: c.cullFaces,
            enabled: c.enabled,
            farClip: c.farClip,
            flipFaces: c.flipFaces,
            fov: c.fov,
            frustumCulling: c.frustumCulling,
            horizontalFov: c.horizontalFov,
            layers: c.layers,
            renderTarget: c.renderTarget,
            nearClip: c.nearClip,
            orthoHeight: c.orthoHeight,
            projection: c.projection,
            priority: c.priority,
            rect: c.rect,
            scissorRect: c.scissorRect,
            aperture: c.aperture,
            sensitivity: c.sensitivity,
            shutter: c.shutter
        });
    }

    onBeforeRemove(entity, component) {
        this.removeCamera(component);
    }

    onUpdate(dt) {
    }

    onAppPrerender() {
        for (let i = 0, len = this.cameras.length; i < len; i++) {
            this.cameras[i].onAppPrerender();
        }
    }

    addCamera(camera) {
        this.cameras.push(camera);
        sortPriority(this.cameras);
    }

    removeCamera(camera) {
        const index = this.cameras.indexOf(camera);
        if (index >= 0) {
            this.cameras.splice(index, 1);
            sortPriority(this.cameras);
        }
    }

    destroy() {
        super.destroy();

        this.app.systems.off('update', this.onUpdate, this);
    }
}

Component._buildAccessors(CameraComponent.prototype, _schema);

export { CameraComponentSystem };
