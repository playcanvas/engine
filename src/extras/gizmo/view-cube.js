import { EventHandler } from '../../core/event-handler.js';
import { Mat4 } from '../../core/math/mat4.js';
import { Vec3 } from '../../core/math/vec3.js';
import { Vec4 } from '../../core/math/vec4.js';
import { COLOR_BLUE, COLOR_GREEN, COLOR_RED } from './color.js';

/** @import { Color } from '../../core/math/color.js' */

const tmpV1 = new Vec3();
const tmpV2 = new Vec3();
const tmpV3 = new Vec3();
const tmpM1 = new Mat4();

class ViewCube extends EventHandler {
    /**
     * Fired when the user clicks on a face of the view cube.
     *
     * @event
     * @example
     * const viewCube = new ViewCube()
     * viewCube.on(ViewCube.EVENT_CAMERAALIGN, function (face) {
     *    console.log('Camera aligned to face: ' + face);
     * });
     */
    static EVENT_CAMERAALIGN = 'camera:align';

    /**
     * @type {SVGSVGElement}
     * @private
     */
    _svg;

    /**
     * @type {Element}
     * @private
     */
    _group;

    /**
     * @type {Vec4}
     * @private
     */
    _anchor = new Vec4(1, 1, 1, 1);

    /**
     * @type {Color}
     * @private
     */
    _colorX = COLOR_RED.clone();

    /**
     * @type {Color}
     * @private
     */
    _colorY = COLOR_GREEN.clone();

    /**
     * @type {Color}
     * @private
     */
    _colorZ = COLOR_BLUE.clone();

    /**
     * @type {number}
     * @private
     */
    _width = 0;

    /**
     * @type {number}
     * @private
     */
    _height = 0;

    /**
     * @type {{
     *     nx: SVGAElement,
     *     ny: SVGAElement,
     *     nz: SVGAElement,
     *     xaxis: SVGLineElement,
     *     yaxis: SVGLineElement,
     *     zaxis: SVGLineElement,
     *     px: SVGAElement,
     *     py: SVGAElement,
     *     pz: SVGAElement
     * }}
     */
    _shapes;

    constructor() {
        super();

        // container
        this.dom = document.createElement('div');
        this.dom.id = 'view-cube-container';
        this.dom.style.cssText = [
            'position: absolute',
            'width: 140px',
            'height: 140px',
            `top: ${this._anchor.x ? '0px' : 'auto'}`,
            `right: ${this._anchor.y ? '0px' : 'auto'}`,
            `bottom: ${this._anchor.z ? '0px' : 'auto'}`,
            `left: ${this._anchor.w ? '0px' : 'auto'}`,
            'margin: auto',
            'pointer-events: none'
        ].join(';');
        document.body.appendChild(this.dom);

        // construct svg root and group
        this._svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        this._svg.id = 'view-cube-svg';
        this._group = document.createElementNS(this._svg.namespaceURI, 'g');
        this._svg.appendChild(this._group);

        const colX = this._colorX.toString(false);
        const colY = this._colorY.toString(false);
        const colZ = this._colorZ.toString(false);

        this._shapes = {
            nx: this._circle(colX),
            ny: this._circle(colY),
            nz: this._circle(colZ),
            xaxis: this._line(colX),
            yaxis: this._line(colY),
            zaxis: this._line(colZ),
            px: this._circle(colX, true, 'X'),
            py: this._circle(colY, true, 'Y'),
            pz: this._circle(colZ, true, 'Z')
        };

        this._shapes.px.children[0].addEventListener('pointerdown', () => {
            this.fire(ViewCube.EVENT_CAMERAALIGN, 'px');
        });
        this._shapes.py.children[0].addEventListener('pointerdown', () => {
            this.fire(ViewCube.EVENT_CAMERAALIGN, 'py');
        });
        this._shapes.pz.children[0].addEventListener('pointerdown', () => {
            this.fire(ViewCube.EVENT_CAMERAALIGN, 'pz');
        });
        this._shapes.nx.children[0].addEventListener('pointerdown', () => {
            this.fire(ViewCube.EVENT_CAMERAALIGN, 'nx');
        });
        this._shapes.ny.children[0].addEventListener('pointerdown', () => {
            this.fire(ViewCube.EVENT_CAMERAALIGN, 'ny');
        });
        this._shapes.nz.children[0].addEventListener('pointerdown', () => {
            this.fire(ViewCube.EVENT_CAMERAALIGN, 'nz');
        });

        this.dom.appendChild(this._svg);
    }

    set anchor(value) {
        this._anchor.copy(value);

        this.dom.style.top = this._anchor.x ? '0px' : 'auto';
        this.dom.style.right = this._anchor.y ? '0px' : 'auto';
        this.dom.style.bottom = this._anchor.z ? '0px' : 'auto';
        this.dom.style.left = this._anchor.w ? '0px' : 'auto';
    }

    get anchor() {
        return this._anchor;
    }

    /**
     * @attribute
     * @type {Color}
     */
    set colorX(value) {
        this._colorX.copy(value);

        this._shapes.px.children[0].setAttribute('fill', this._colorX.toString(false));
        this._shapes.px.children[0].setAttribute('stroke', this._colorX.toString(false));
        this._shapes.nx.children[0].setAttribute('stroke', this._colorX.toString(false));
        this._shapes.xaxis.setAttribute('stroke', this._colorX.toString(false));
    }

    get colorX() {
        return this._colorX;
    }

    /**
     * @attribute
     * @type {Color}
     */
    set colorY(value) {
        this._colorY.copy(value);

        this._shapes.py.children[0].setAttribute('fill', this._colorY.toString(false));
        this._shapes.py.children[0].setAttribute('stroke', this._colorY.toString(false));
        this._shapes.ny.children[0].setAttribute('stroke', this._colorY.toString(false));
        this._shapes.yaxis.setAttribute('stroke', this._colorY.toString(false));
    }

    get colorY() {
        return this._colorY;
    }

    /**
     * @attribute
     * @type {Color}
     */
    set colorZ(value) {
        this._colorZ.copy(value);

        this._shapes.pz.children[0].setAttribute('fill', this._colorZ.toString(false));
        this._shapes.pz.children[0].setAttribute('stroke', this._colorZ.toString(false));
        this._shapes.nz.children[0].setAttribute('stroke', this._colorZ.toString(false));
        this._shapes.zaxis.setAttribute('stroke', this._colorZ.toString(false));
    }

    get colorZ() {
        return this._colorZ;
    }

    /**
     * @private
     * @param {string} color - The color.
     * @returns {SVGLineElement} - The line.
     */
    _line(color) {
        const result = /** @type {SVGLineElement} */ (document.createElementNS(this._svg.namespaceURI, 'line'));
        result.setAttribute('stroke', color);
        result.setAttribute('stroke-width', '2');
        this._group.appendChild(result);
        return result;
    }

    /**
     * @private
     * @param {string} color - The color.
     * @param {boolean} [fill] - The fill.
     * @param {string} [text] - The text.
     * @returns {SVGAElement} - The circle.
     */
    _circle(color, fill = false, text) {
        const result = /** @type {SVGAElement} */ (document.createElementNS(this._svg.namespaceURI, 'g'));

        const circle = /** @type {SVGCircleElement} */ (document.createElementNS(this._svg.namespaceURI, 'circle'));
        circle.setAttribute('fill', fill ? color : '#555');
        circle.setAttribute('stroke', color);
        circle.setAttribute('stroke-width', '2');
        circle.setAttribute('r', '10');
        circle.setAttribute('cx', '0');
        circle.setAttribute('cy', '0');
        circle.setAttribute('pointer-events', 'all');

        result.appendChild(circle);

        if (text) {
            const t = /** @type {SVGTextElement} */ (document.createElementNS(this._svg.namespaceURI, 'text'));
            t.setAttribute('font-size', '10');
            t.setAttribute('font-family', 'Arial');
            t.setAttribute('font-weight', 'bold');
            t.setAttribute('text-anchor', 'middle');
            t.setAttribute('alignment-baseline', 'central');
            t.textContent = text;
            result.appendChild(t);
        }

        result.setAttribute('cursor', 'pointer');

        this._group.appendChild(result);

        return result;
    }

    /**
     * @param {Mat4} cameraMatrix - The camera matrix.
     */
    update(cameraMatrix) {
        const w = this.dom.clientWidth;
        const h = this.dom.clientHeight;

        // skip if the container is not visible
        if (!w || !h) {
            return;
        }

        // skip if the size has not changed
        if (w !== this._width || h !== this._height) {
            // resize elements
            this._svg.setAttribute('width', w.toString());
            this._svg.setAttribute('height', h.toString());
            this._group.setAttribute('transform', `translate(${w * 0.5}, ${h * 0.5})`);
            this._width = w;
            this._height = h;
        }

        tmpM1.invert(cameraMatrix);
        tmpM1.getX(tmpV1);
        tmpM1.getY(tmpV2);
        tmpM1.getZ(tmpV3);

        /**
         * @param {SVGAElement} group - The group.
         * @param {number} x - The x.
         * @param {number} y - The y.
         */
        const transform = (group, x, y) => {
            group.setAttribute('transform', `translate(${x * 40}, ${y * 40})`);
        };

        /**
         * @param {SVGLineElement} line - The line.
         * @param {number} x - The x.
         * @param {number} y - The y.
         */
        const x2y2 = (line, x, y) => {
            line.setAttribute('x2', (x * 40).toString());
            line.setAttribute('y2', (y * 40).toString());
        };

        transform(this._shapes.px, tmpV1.x, -tmpV1.y);
        transform(this._shapes.nx, -tmpV1.x, tmpV1.y);
        transform(this._shapes.py, tmpV2.x, -tmpV2.y);
        transform(this._shapes.ny, -tmpV2.x, tmpV2.y);
        transform(this._shapes.pz, tmpV3.x, -tmpV3.y);
        transform(this._shapes.nz, -tmpV3.x, tmpV3.y);

        x2y2(this._shapes.xaxis, tmpV1.x, -tmpV1.y);
        x2y2(this._shapes.yaxis, tmpV2.x, -tmpV2.y);
        x2y2(this._shapes.zaxis, tmpV3.x, -tmpV3.y);

        // reorder dom for the mighty svg painter's algorithm
        const order = [
            { n: ['xaxis', 'px'], value: tmpV1.z },
            { n: ['yaxis', 'py'], value: tmpV2.z },
            { n: ['zaxis', 'pz'], value: tmpV3.z },
            { n: ['nx'], value: -tmpV1.z },
            { n: ['ny'], value: -tmpV2.z },
            { n: ['nz'], value: -tmpV3.z }
        ].sort((a, b) => a.value - b.value);
        const fragment = document.createDocumentFragment();
        order.forEach((o) => {
            o.n.forEach((n) => {
                fragment.appendChild(this._shapes[n]);
            });
        });

        this._group.appendChild(fragment);
    }
}

export { ViewCube };
