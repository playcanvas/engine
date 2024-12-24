import { Color } from '../../core/math/color.js';
import { EventHandler } from '../../core/event-handler.js';
import { Mat4 } from '../../core/math/mat4.js';
import { Vec3 } from '../../core/math/vec3.js';
import { Vec4 } from '../../core/math/vec4.js';

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
     * @type {Vec4}
     */
    _anchor = new Vec4(1, 1, 1, 1);

    /**
     * @type {Color}
     */
    _colorX = new Color(1, 0.3, 0.3);

    /**
     * @type {Color}
     */
    _colorY = new Color(0.3, 1, 0.3);

    /**
     * @type {Color}
     */
    _colorZ = new Color(0.3, 0.3, 1);

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

    /**
     * @type {(cameraMatrix: Mat4) => void}
     */
    update;

    constructor() {
        super();
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

        // construct svg elements
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.id = 'view-cube-svg';

        const group = document.createElementNS(svg.namespaceURI, 'g');
        svg.appendChild(group);

        /**
         * @param {string} color - The color.
         * @param {boolean} [fill] - The fill.
         * @param {string} [text] - The text.
         * @returns {SVGAElement} - The circle.
         */
        const circle = (color, fill = false, text) => {
            const result = /** @type {SVGAElement} */ (document.createElementNS(svg.namespaceURI, 'g'));

            const circle = /** @type {SVGCircleElement} */ (document.createElementNS(svg.namespaceURI, 'circle'));
            circle.setAttribute('fill', fill ? color : '#555');
            circle.setAttribute('stroke', color);
            circle.setAttribute('stroke-width', '2');
            circle.setAttribute('r', '10');
            circle.setAttribute('cx', '0');
            circle.setAttribute('cy', '0');
            circle.setAttribute('pointer-events', 'all');

            result.appendChild(circle);

            if (text) {
                const t = /** @type {SVGTextElement} */ (document.createElementNS(svg.namespaceURI, 'text'));
                t.setAttribute('font-size', '10');
                t.setAttribute('font-family', 'Arial');
                t.setAttribute('font-weight', 'bold');
                t.setAttribute('text-anchor', 'middle');
                t.setAttribute('alignment-baseline', 'central');
                t.textContent = text;
                result.appendChild(t);
            }

            result.setAttribute('cursor', 'pointer');

            group.appendChild(result);

            return result;
        };

        /**
         * @param {string} color - The color.
         * @returns {SVGLineElement} - The line.
         */
        const line = (color) => {
            const result = /** @type {SVGLineElement} */ (document.createElementNS(svg.namespaceURI, 'line'));
            result.setAttribute('stroke', color);
            result.setAttribute('stroke-width', '2');
            group.appendChild(result);
            return result;
        };

        const colX = this._colorX.toString(false);
        const colY = this._colorY.toString(false);
        const colZ = this._colorZ.toString(false);

        this._shapes = {
            nx: circle(colX),
            ny: circle(colY),
            nz: circle(colZ),
            xaxis: line(colX),
            yaxis: line(colY),
            zaxis: line(colZ),
            px: circle(colX, true, 'X'),
            py: circle(colY, true, 'Y'),
            pz: circle(colZ, true, 'Z')
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

        this.dom.appendChild(svg);

        let cw = 0;
        let ch = 0;

        /**
         * @param {Mat4} cameraMatrix - The camera matrix.
         */
        this.update = (cameraMatrix) => {
            const w = this.dom.clientWidth;
            const h = this.dom.clientHeight;

            if (w && h) {
                if (w !== cw || h !== ch) {
                    // resize elements
                    svg.setAttribute('width', w.toString());
                    svg.setAttribute('height', h.toString());
                    group.setAttribute('transform', `translate(${w * 0.5}, ${h * 0.5})`);
                    cw = w;
                    ch = h;
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

                group.appendChild(fragment);
            }
        };
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
}

export { ViewCube };
