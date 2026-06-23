import { sortPriority } from '../../../core/sort.js';
import { Color } from '../../../core/math/color.js';
import { Vec4 } from '../../../core/math/vec4.js';
import { ComponentSystem } from '../system.js';
import { CameraComponent } from './component.js';

/**
 * @import { AppBase } from '../../app-base.js'
 */

const _properties = [
    'aspectRatio',
    'aspectRatioMode',
    'calculateProjection',
    'calculateTransform',
    'clearColor',
    'clearColorBuffer',
    'clearDepth',
    'clearDepthBuffer',
    'clearStencilBuffer',
    'renderSceneColorMap',
    'renderSceneDepthMap',
    'cullFaces',
    'farClip',
    'flipFaces',
    'fog',
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
    'sensitivity',
    'gammaCorrection',
    'toneMapping'
];

/**
 * Used to add and remove {@link CameraComponent}s from Entities. It also holds an array of all
 * active cameras.
 *
 * @category Graphics
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
     * @ignore
     */
    constructor(app) {
        super(app);

        this.id = 'camera';

        this.ComponentType = CameraComponent;

        this.on('beforeremove', this.onBeforeRemove, this);
        this.app.on('prerender', this.onAppPrerender, this);
    }

    initializeComponentData(component, data) {
        for (let i = 0; i < _properties.length; i++) {
            const property = _properties[i];
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

        super.initializeComponentData(component, data);
    }

    cloneComponent(entity, clone) {
        const c = entity.camera;

        const data = {
            enabled: c.enabled
        };

        for (let i = 0; i < _properties.length; i++) {
            const property = _properties[i];
            data[property] = c[property];
        }

        return this.addComponent(clone, data);
    }

    onBeforeRemove(entity, component) {
        this.removeCamera(component);

        component.onBeforeRemove();
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
        this.app.off('prerender', this.onAppPrerender, this);

        super.destroy();
    }
}

export { CameraComponentSystem };
