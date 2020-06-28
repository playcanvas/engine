import { type } from '../../../core/core.js';
import { Color } from '../../../core/color.js';

import { Vec4 } from '../../../math/vec4.js';

import { Camera } from '../../../scene/camera.js';

import { Component } from '../component.js';
import { ComponentSystem } from '../system.js';

import { CameraComponent } from './component.js';
import { CameraComponentData } from './data.js';

import { PostEffectQueue } from './post-effect-queue.js';

var _schema = [
    'enabled',
    'clearColorBuffer',
    'clearColor',
    'clearDepthBuffer',
    'clearStencilBuffer',
    'frustumCulling',
    'projection',
    'fov',
    'orthoHeight',
    'nearClip',
    'farClip',
    'priority',
    'rect',
    'scissorRect',
    'camera',
    'aspectRatio',
    'aspectRatioMode',
    'horizontalFov',
    'model',
    'renderTarget',
    'calculateTransform',
    'calculateProjection',
    'cullFaces',
    'flipFaces',
    'layers'
];

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
    this.description = "Renders the scene from the location of the Entity.";

    this.ComponentType = CameraComponent;
    this.DataType = CameraComponentData;

    this.schema = _schema;

    // holds all the active camera components
    this.cameras = [];

    this.on('beforeremove', this.onBeforeRemove, this);
    this.on('remove', this.onRemove, this);
    this.app.on("prerender", this.onPrerender, this);

    ComponentSystem.bind('update', this.onUpdate, this);
};
CameraComponentSystem.prototype = Object.create(ComponentSystem.prototype);
CameraComponentSystem.prototype.constructor = CameraComponentSystem;

Component._buildAccessors(CameraComponent.prototype, _schema);

Object.assign(CameraComponentSystem.prototype, {
    initializeComponentData: function (component, _data, properties) {
        properties = [
            'postEffects',
            'enabled',
            'model',
            'camera',
            'aspectRatio',
            'aspectRatioMode',
            'horizontalFov',
            'renderTarget',
            'clearColor',
            'fov',
            'orthoHeight',
            'nearClip',
            'farClip',
            'projection',
            'priority',
            'clearColorBuffer',
            'clearDepthBuffer',
            'clearStencilBuffer',
            'frustumCulling',
            'rect',
            'scissorRect',
            'calculateTransform',
            'calculateProjection',
            'cullFaces',
            'flipFaces',
            'layers'
        ];

        // duplicate data because we're modifying the data
        var data = {};
        for (var i = 0, len = properties.length; i < len; i++) {
            var property = properties[i];
            data[property] = _data[property];
        }

        if (data.layers && type(data.layers) === 'array') {
            data.layers = data.layers.slice(0);
        }

        if (data.clearColor && type(data.clearColor) === 'array') {
            var c = data.clearColor;
            data.clearColor = new Color(c[0], c[1], c[2], c[3]);
        }

        if (data.rect && type(data.rect) === 'array') {
            var rect = data.rect;
            data.rect = new Vec4(rect[0], rect[1], rect[2], rect[3]);
        }

        if (data.scissorRect && type(data.scissorRect) === 'array') {
            var scissorRect = data.scissorRect;
            data.scissorRect = new Vec4(scissorRect[0], scissorRect[1], scissorRect[2], scissorRect[3]);
        }

        if (data.activate) {
            console.warn("WARNING: activate: Property is deprecated. Set enabled property instead.");
            data.enabled = data.activate;
        }

        data.camera = new Camera();
        data._node = component.entity;
        data.camera._component = component;

        var self = component;
        data.camera.calculateTransform = function (mat, mode) {
            if (!self._calculateTransform)
                return null;

            return self._calculateTransform(mat, mode);
        };
        data.camera.calculateProjection = function (mat, mode) {
            if (!self._calculateProjection)
                return null;

            return self._calculateProjection(mat, mode);
        };

        data.postEffects = new PostEffectQueue(this.app, component);

        ComponentSystem.prototype.initializeComponentData.call(this, component, data, properties);
    },

    onBeforeRemove: function (entity, component) {
        this.removeCamera(component);
        component.onRemove();
    },

    onRemove: function (entity, data) {
        data.camera = null;
    },

    onUpdate: function (dt) {
        var components = this.store;
        var component, componentData, cam, vrDisplay;

        if (this.app.vr) {
            for (var id in components) {
                component = components[id];
                componentData = component.data;
                cam = componentData.camera;
                vrDisplay = cam.vrDisplay;
                if (componentData.enabled && component.entity.enabled && vrDisplay) {
                    // Change WebVR near/far planes based on the stereo camera
                    vrDisplay.setClipPlanes(cam._nearClip, cam._farClip);

                    // update camera node transform from VrDisplay
                    if (cam._node) {
                        cam._node.localTransform.copy(vrDisplay.combinedViewInv);
                        cam._node._dirtyLocal = false;
                        cam._node._dirtifyWorld();
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
