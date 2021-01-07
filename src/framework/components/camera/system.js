import { Color } from '../../../core/color.js';

import { Vec4 } from '../../../math/vec4.js';

import { Component } from '../component.js';
import { ComponentSystem } from '../system.js';

import { CameraComponent } from './component.js';
import { CameraComponentData } from './data.js';

const _schema = ['enabled'];

/**
 * @class
 * @name pc.CameraComponentSystem
 * @augments pc.ComponentSystem
 * @classdesc Used to add and remove {@link pc.CameraComponent}s from Entities. It also holds an
 * array of all active cameras.
 * @description Create a new CameraComponentSystem.
 * @param {pc.Application} app - The Application.
 * @property {pc.CameraComponent[]} cameras Holds all the active camera components.
 */
var CameraComponentSystem = function (app) {
    ComponentSystem.call(this, app);

    this.id = 'camera';

    this.ComponentType = CameraComponent;
    this.DataType = CameraComponentData;

    this.schema = _schema;

    // holds all the active camera components
    this.cameras = [];

    this.on('beforeremove', this.onBeforeRemove, this);
    this.app.on("prerender", this.onPrerender, this);

    ComponentSystem.bind('update', this.onUpdate, this);
};
CameraComponentSystem.prototype = Object.create(ComponentSystem.prototype);
CameraComponentSystem.prototype.constructor = CameraComponentSystem;

Component._buildAccessors(CameraComponent.prototype, _schema);

Object.assign(CameraComponentSystem.prototype, {
    initializeComponentData: function (component, data, properties) {
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
            'scissorRect'
        ];

        for (var i = 0; i < properties.length; i++) {
            var property = properties[i];
            if (data.hasOwnProperty(property)) {
                var value = data[property];
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

        ComponentSystem.prototype.initializeComponentData.call(this, component, data, ['enabled']);
    },

    cloneComponent: function (entity, clone) {
        var c = entity.camera;
        this.addComponent(clone, {
            aspectRatio: c.aspectRatio,
            aspectRatioMode: c.aspectRatioMode,
            calculateProjection: c.calculateProjection,
            calculateTransform: c.calculateTransform,
            clearColor: c.clearColor,
            clearColorBuffer: c.clearColorBuffer,
            clearDepthBuffer: c.clearDepthBuffer,
            clearStencilBuffer: c.clearStencilBuffer,
            cullFaces: c.cullFaces,
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
            scissorRect: c.scissorRect
        });
    },

    onBeforeRemove: function (entity, component) {
        this.removeCamera(component);
    },

    onUpdate: function (dt) {
        if (this.app.vr) {
            var components = this.store;

            for (var id in components) {
                var component = components[id];

                if (component.data.enabled && component.entity.enabled) {
                    var cameraComponent = component.entity.camera;
                    var vrDisplay = cameraComponent.vrDisplay;
                    if (vrDisplay) {
                        // Change WebVR near/far planes based on the stereo camera
                        vrDisplay.setClipPlanes(cameraComponent.nearClip, cameraComponent.farClip);

                        // update camera node transform from VrDisplay
                        if (component.entity) {
                            component.entity.localTransform.copy(vrDisplay.combinedViewInv);
                            component.entity._dirtyLocal = false;
                            component.entity._dirtifyWorld();
                        }
                    }
                }
            }
        }
    },

    onPrerender: function () {
        for (var i = 0, len = this.cameras.length; i < len; i++) {
            this.cameras[i].onPrerender();
        }
    },

    addCamera: function (camera) {
        this.cameras.push(camera);
        this.sortCamerasByPriority();
    },

    removeCamera: function (camera) {
        var index = this.cameras.indexOf(camera);
        if (index >= 0) {
            this.cameras.splice(index, 1);
            this.sortCamerasByPriority();
        }
    },

    sortCamerasByPriority: function () {
        this.cameras.sort(function (a, b) {
            return a.priority - b.priority;
        });
    }
});

export { CameraComponentSystem };
