import { Vec3 } from '../../core/math/vec3.js';
import { PROJECTION_PERSPECTIVE } from '../../scene/constants.js';

/**
 * @import { BoundingBox } from '../../core/shape/bounding-box.js'
 * @import { CameraComponent } from '../../framework/components/camera/component.js'
 */

const corner = new Vec3();
const screen = new Vec3();
const view = new Vec3();
const down = new Vec3();

const GAP = 6;

/** @ignore */
class Readout {
    /**
     * @type {CameraComponent}
     * @private
     */
    _camera;

    /**
     * The element showing the readout, a `div` with the class `gizmo-readout` in the document
     * body.
     *
     * @type {HTMLDivElement}
     */
    dom = document.createElement('div');

    /**
     * @param {CameraComponent} camera - The camera the readout is placed with.
     */
    constructor(camera) {
        this._camera = camera;

        this.dom.className = 'gizmo-readout';
        this.dom.style.cssText = [
            'position: fixed',
            'display: none',
            'transform: translateX(-50%)',
            'padding: 2px 6px',
            'border-radius: 3px',
            'background: rgba(0, 0, 0, 0.9)',
            'color: #fff',
            'font: 12px monospace',
            'white-space: pre',
            'pointer-events: none'
        ].join(';');
        document.body.appendChild(this.dom);
    }

    /**
     * Shows the markup centered below a world space box.
     *
     * @param {string} html - The readout markup.
     * @param {BoundingBox} bounds - The box to sit below.
     */
    showBelowBox(html, bounds) {
        const { center, halfExtents: half } = bounds;
        let left = Infinity;
        let right = -Infinity;
        let bottom = -Infinity;
        for (let i = 0; i < 8; i++) {
            corner.set(
                center.x + (i & 1 ? half.x : -half.x),
                center.y + (i & 2 ? half.y : -half.y),
                center.z + (i & 4 ? half.z : -half.z)
            );
            this._camera.worldToScreen(corner, screen);
            left = Math.min(left, screen.x);
            right = Math.max(right, screen.x);
            bottom = Math.max(bottom, screen.y);
        }
        this._show(html, 0.5 * (left + right), bottom);
    }

    /**
     * Shows the markup centered below the outline of a world space sphere.
     *
     * @param {string} html - The readout markup.
     * @param {Vec3} center - The center of the sphere.
     * @param {number} radius - The radius of the sphere.
     */
    showBelowSphere(html, center, radius) {
        const x = this._camera.worldToScreen(center, screen).x;

        // the lowest point of the outline: in perspective its tangent from the camera, which
        // reaches further than the radius straight down once the sphere is close
        const up = this._camera.entity.up;
        const eye = this._camera.entity.getPosition();
        const dist = view.sub2(center, eye).length();
        if (this._camera.projection === PROJECTION_PERSPECTIVE && dist > radius) {
            view.mulScalar(1 / dist);
            down.copy(view).mulScalar(up.dot(view)).sub(up).normalize();
            const sin = radius / dist;
            const cos = Math.sqrt(1 - sin * sin);
            corner.copy(view).mulScalar(cos).add(down.mulScalar(sin)).mulScalar(dist * cos).add(eye);
        } else {
            corner.copy(up).mulScalar(-radius).add(center);
        }
        this._show(html, x, this._camera.worldToScreen(corner, screen).y);
    }

    /**
     * @param {string} html - The readout markup.
     * @param {number} x - The canvas x coordinate to center on.
     * @param {number} y - The canvas y coordinate to sit below.
     * @private
     */
    _show(html, x, y) {
        const rect = this._camera.system.app.graphicsDevice.canvas.getBoundingClientRect();
        this.dom.innerHTML = html;
        this.dom.style.left = `${rect.left + x}px`;
        this.dom.style.top = `${rect.top + y + GAP}px`;
        this.dom.style.display = 'block';
    }

    hide() {
        this.dom.style.display = 'none';
    }

    destroy() {
        this.dom.remove();
    }
}

export { Readout };
