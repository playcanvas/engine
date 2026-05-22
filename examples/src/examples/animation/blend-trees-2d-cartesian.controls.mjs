import * as pc from 'playcanvas';

/**
 * @param {import('../../app/components/Example.mjs').ControlOptions} options - The options.
 * @returns {JSX.Element} The returned JSX Element.
 */
export const controls = ({ observer, React, jsx, fragment }) => {
    const { createRef, Component } = React;
    class JsxControls extends Component {
        position = new pc.Vec2();

        /** @type {React.RefObject<HTMLCanvasElement>} */
        refCanvas = createRef();

        mouse = this.mouseEvent.bind(this);

        draw = this.drawPosition.bind(this);

        evt = null;

        mouseEvent(e) {
            const { position, width, canvas } = this;
            if (!canvas || !width) {
                return;
            }
            if (e.targetTouches) {
                const offset = canvas.getBoundingClientRect();
                position
                .set(e.targetTouches[0].clientX - offset.x, e.targetTouches[0].clientY - offset.y)
                .mulScalar(1 / (width / 2))
                .sub(pc.Vec2.ONE);
            } else {
                if (e.buttons) {
                    position
                    .set(e.offsetX, e.offsetY)
                    .mulScalar(1 / (width / 2))
                    .sub(pc.Vec2.ONE);
                } else {
                    return;
                }
            }
            position.y *= -1.0;
            observer.set('data.pos', { x: position.x, y: position.y });
        }

        get canvas() {
            return this.refCanvas.current;
        }

        /** @type {number} */
        get width() {
            const panel = /** @type {HTMLElement | null} */ (this.canvas?.closest('#controlPanel') ?? null);
            return panel?.offsetWidth ?? this.canvas?.parentElement?.offsetWidth ?? 0;
        }

        /** @type {number} */
        get height() {
            return this.width;
        }

        drawPosition() {
            const { canvas, width, height } = this;
            if (!canvas || !width || !height) {
                return;
            }
            const animPoints = observer.get('data.animPoints') || [];
            const pos = observer.get('data.pos') || { x: 0, y: 0 };

            const ctx = canvas.getContext('2d');
            if (!ctx) {
                return;
            }
            const halfWidth = Math.floor(width / 2);
            const halfHeight = Math.floor(height / 2);
            ctx.clearRect(0, 0, width, height);
            ctx.fillStyle = 'rgba(128, 128, 128, 0.5)';
            ctx.fillRect(0, 0, width, height);
            ctx.fillStyle = '#B1B8BA';
            ctx.fillRect(halfWidth, 0, 1, height);
            ctx.fillRect(0, halfHeight, width, 1);
            ctx.fillStyle = '#232e30';

            animPoints.forEach((animNode) => {
                const posX = (animNode.x + 1) * halfWidth;
                const posY = (animNode.y * -1 + 1) * halfHeight;
                const width = 8;
                const height = 8;
                ctx.fillStyle = '#ffffff80';
                ctx.beginPath();
                ctx.arc(posX, posY, halfWidth * 0.5 * animNode.weight, 0, 2 * Math.PI);
                ctx.fill();
                ctx.fillStyle = '#283538';
                ctx.beginPath();
                ctx.moveTo(posX, posY - height / 2);
                ctx.lineTo(posX - width / 2, posY);
                ctx.lineTo(posX, posY + height / 2);
                ctx.lineTo(posX + width / 2, posY);
                ctx.closePath();
                ctx.fill();
            });

            ctx.fillStyle = '#F60';
            ctx.beginPath();
            ctx.arc(
                (pos.x + 1) * halfWidth,
                (pos.y * -1 + 1) * halfHeight,
                5,
                0,
                2 * Math.PI
            );
            ctx.fill();
            ctx.fillStyle = '#283538';
            ctx.stroke();
        }

        componentDidMount() {
            const { canvas, width, height } = this;
            if (!canvas || !width || !height) {
                return;
            }

            canvas.addEventListener('mousemove', this.mouse);
            canvas.addEventListener('mousedown', this.mouse);
            canvas.addEventListener('touchmove', this.mouse);
            canvas.addEventListener('touchstart', this.mouse);

            const dim = `${width}px`;
            canvas.setAttribute('style', `width: ${dim}; height: ${dim};`);
            canvas.width = width;
            canvas.height = height;
            this.drawPosition();

            this.evt = observer.on('*:set', this.draw);
        }

        componentWillUnmount() {
            const { canvas } = this;
            if (canvas) {
                canvas.removeEventListener('mousemove', this.mouse);
                canvas.removeEventListener('mousedown', this.mouse);
                canvas.removeEventListener('touchmove', this.mouse);
                canvas.removeEventListener('touchstart', this.mouse);
            }

            this.evt?.unbind();
            this.evt = null;
        }

        render() {
            return fragment(jsx('canvas', { ref: this.refCanvas }));
        }
    }
    return jsx(JsxControls);
};
