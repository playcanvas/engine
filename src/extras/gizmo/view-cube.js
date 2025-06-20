import { EventHandler } from '../../core/event-handler.js';
import { Color } from '../../core/math/color';
import { Mat4 } from '../../core/math/mat4.js';
import { Vec3 } from '../../core/math/vec3.js';
import { Vec4 } from '../../core/math/vec4.js';
import { COLOR_BLUE, COLOR_GREEN, COLOR_RED } from './color';

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
     * @type {number}
     * @private
     */
    _size = 0;

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
     * @type {Color}
     * @private
     */
    _colorNeg = new Color(0.3, 0.3, 0.3);

    /**
     * @type {number}
     * @private
     */
    _radius = 10;

    /**
     * @type {number}
     * @private
     */
    _textSize = 10;

    /**
     * @type {number}
     * @private
     */
    _lineThickness = 2;

    /**
     * @type {number}
     * @private
     */
    _lineLength = 40;

    /**
     * @type {{
     *     nx: SVGAElement,
     *     ny: SVGAElement,
     *     nz: SVGAElement,
     *     px: SVGAElement,
     *     py: SVGAElement,
     *     pz: SVGAElement,
     *     xaxis: SVGLineElement,
     *     yaxis: SVGLineElement,
     *     zaxis: SVGLineElement
     * }}
     */
    _shapes;

    /**
     * @param {Vec4} [anchor] - The anchor.
     */
    constructor(anchor) {
        super();

        // container
        this.dom = document.createElement('div');
        this.dom.id = 'view-cube-container';
        this.dom.style.cssText = [
            'position: absolute',
            'margin: auto',
            'pointer-events: none'
        ].join(';');
        document.body.appendChild(this.dom);

        this.anchor = anchor ?? this._anchor;

        // construct svg root and group
        this._svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        this._svg.id = 'view-cube-svg';
        this._group = document.createElementNS(this._svg.namespaceURI, 'g');
        this._svg.appendChild(this._group);

        // size
        this._resize();

        const colX = this._colorX.toString(false);
        const colY = this._colorY.toString(false);
        const colZ = this._colorZ.toString(false);

        this._shapes = {
            nx: this._circle(colX),
            ny: this._circle(colY),
            nz: this._circle(colZ),
            px: this._circle(colX, true, 'X'),
            py: this._circle(colY, true, 'Y'),
            pz: this._circle(colZ, true, 'Z'),
            xaxis: this._line(colX),
            yaxis: this._line(colY),
            zaxis: this._line(colZ)
        };

        this._shapes.px.children[0].addEventListener('pointerdown', () => {
            this.fire(ViewCube.EVENT_CAMERAALIGN, Vec3.RIGHT);
        });
        this._shapes.py.children[0].addEventListener('pointerdown', () => {
            this.fire(ViewCube.EVENT_CAMERAALIGN, Vec3.UP);
        });
        this._shapes.pz.children[0].addEventListener('pointerdown', () => {
            this.fire(ViewCube.EVENT_CAMERAALIGN, Vec3.BACK);
        });
        this._shapes.nx.children[0].addEventListener('pointerdown', () => {
            this.fire(ViewCube.EVENT_CAMERAALIGN, Vec3.LEFT);
        });
        this._shapes.ny.children[0].addEventListener('pointerdown', () => {
            this.fire(ViewCube.EVENT_CAMERAALIGN, Vec3.DOWN);
        });
        this._shapes.nz.children[0].addEventListener('pointerdown', () => {
            this.fire(ViewCube.EVENT_CAMERAALIGN, Vec3.FORWARD);
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
     * @type {Color}
     */
    set colorNeg(value) {
        this._colorNeg.copy(value);

        this._shapes.px.children[0].setAttribute('fill', this._colorNeg.toString(false));
        this._shapes.py.children[0].setAttribute('fill', this._colorNeg.toString(false));
        this._shapes.pz.children[0].setAttribute('fill', this._colorNeg.toString(false));
    }

    get colorNeg() {
        return this._colorNeg;
    }

    /**
     * @type {number}
     */
    set radius(value) {
        this._radius = value;

        this._shapes.px.children[0].setAttribute('r', `${value}`);
        this._shapes.py.children[0].setAttribute('r', `${value}`);
        this._shapes.pz.children[0].setAttribute('r', `${value}`);
        this._shapes.nx.children[0].setAttribute('r', `${value}`);
        this._shapes.ny.children[0].setAttribute('r', `${value}`);
        this._shapes.nz.children[0].setAttribute('r', `${value}`);

        this._resize();
    }

    get radius() {
        return this._radius;
    }

    /**
     * @type {number}
     */
    set textSize(value) {
        this._textSize = value;

        this._shapes.px.children[1].setAttribute('font-size', `${value}`);
        this._shapes.py.children[1].setAttribute('font-size', `${value}`);
        this._shapes.pz.children[1].setAttribute('font-size', `${value}`);
    }

    get textSize() {
        return this._textSize;
    }

    /**
     * @type {number}
     */
    set lineThickness(value) {
        this._lineThickness = value;

        this._shapes.xaxis.setAttribute('stroke-width', `${value}`);
        this._shapes.yaxis.setAttribute('stroke-width', `${value}`);
        this._shapes.zaxis.setAttribute('stroke-width', `${value}`);
        this._shapes.px.children[0].setAttribute('stroke-width', `${value}`);
        this._shapes.py.children[0].setAttribute('stroke-width', `${value}`);
        this._shapes.pz.children[0].setAttribute('stroke-width', `${value}`);
        this._shapes.nx.children[0].setAttribute('stroke-width', `${value}`);
        this._shapes.ny.children[0].setAttribute('stroke-width', `${value}`);
        this._shapes.nz.children[0].setAttribute('stroke-width', `${value}`);

        this._resize();
    }

    get lineThickness() {
        return this._lineThickness;
    }

    /**
     * @type {number}
     */
    set lineLength(value) {
        this._lineLength = value;

        this._resize();
    }

    get lineLength() {
        return this._lineLength;
    }

    /**
     * @private
     */
    _resize() {
        this._size = 2 * (this.lineLength + this.radius + this.lineThickness);

        this.dom.style.width = `${this._size}px`;
        this.dom.style.height = `${this._size}px`;

        this._svg.setAttribute('width', `${this._size}`);
        this._svg.setAttribute('height', `${this._size}`);
        this._group.setAttribute('transform', `translate(${this._size * 0.5}, ${this._size * 0.5})`);
    }

    /**
     * @private
     * @param {SVGAElement} group - The group.
     * @param {number} x - The x.
     * @param {number} y - The y.
     */
    _transform(group, x, y) {
        group.setAttribute('transform', `translate(${x * this._lineLength}, ${y * this._lineLength})`);
    }

    /**
     * @private
     * @param {SVGLineElement} line - The line.
     * @param {number} x - The x.
     * @param {number} y - The y.
     */
    _x2y2(line, x, y) {
        line.setAttribute('x2', `${x * this._lineLength}`);
        line.setAttribute('y2', `${y * this._lineLength}`);
    }

    /**
     * @private
     * @param {string} color - The color.
     * @returns {SVGLineElement} - The line.
     */
    _line(color) {
        const result = /** @type {SVGLineElement} */ (document.createElementNS(this._svg.namespaceURI, 'line'));
        result.setAttribute('stroke', color);
        result.setAttribute('stroke-width', `${this._lineThickness}`);
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
        const group = /** @type {SVGAElement} */ (document.createElementNS(this._svg.namespaceURI, 'g'));

        const circle = /** @type {SVGCircleElement} */ (document.createElementNS(this._svg.namespaceURI, 'circle'));
        circle.setAttribute('fill', fill ? color : this._colorNeg.toString(false));
        circle.setAttribute('stroke', color);
        circle.setAttribute('stroke-width', `${this._lineThickness}`);
        circle.setAttribute('r', `${this._radius}`);
        circle.setAttribute('cx', '0');
        circle.setAttribute('cy', '0');
        circle.setAttribute('pointer-events', 'all');

        group.appendChild(circle);

        if (text) {
            const t = /** @type {SVGTextElement} */ (document.createElementNS(this._svg.namespaceURI, 'text'));
            t.setAttribute('font-size', `${this._textSize}`);
            t.setAttribute('font-family', 'Arial');
            t.setAttribute('font-weight', 'bold');
            t.setAttribute('text-anchor', 'middle');
            t.setAttribute('alignment-baseline', 'central');
            t.textContent = text;
            group.appendChild(t);
        }

        group.setAttribute('cursor', 'pointer');

        this._group.appendChild(group);

        return group;
    }

    /**
     * @param {Mat4} cameraMatrix - The camera matrix.
     */
    update(cameraMatrix) {
        // skip if the container is not visible
        if (!this._size) {
            return;
        }

        tmpM1.invert(cameraMatrix);
        tmpM1.getX(tmpV1);
        tmpM1.getY(tmpV2);
        tmpM1.getZ(tmpV3);

        this._transform(this._shapes.px, tmpV1.x, -tmpV1.y);
        this._transform(this._shapes.nx, -tmpV1.x, tmpV1.y);
        this._transform(this._shapes.py, tmpV2.x, -tmpV2.y);
        this._transform(this._shapes.ny, -tmpV2.x, tmpV2.y);
        this._transform(this._shapes.pz, tmpV3.x, -tmpV3.y);
        this._transform(this._shapes.nz, -tmpV3.x, tmpV3.y);

        this._x2y2(this._shapes.xaxis, tmpV1.x, -tmpV1.y);
        this._x2y2(this._shapes.yaxis, tmpV2.x, -tmpV2.y);
        this._x2y2(this._shapes.zaxis, tmpV3.x, -tmpV3.y);

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

    destroy() {
        this.dom.remove();
        this.off();
    }
}

export { ViewCube };
