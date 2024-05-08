import * as pc from 'playcanvas';

/**
 * @param {import('../../app/components/Example.mjs').ControlOptions} options - The options.
 * @returns {JSX.Element} The returned JSX Element.
 */
export function controls({ React, jsx, fragment }) {
    const { createRef, Component } = React;
    class JsxControls extends Component {
        position = new pc.Vec2();

        /** @type {React.RefObject<HTMLCanvasElement>} */
        refCanvas = createRef();

        mouseEvent(e) {
            const { position, modelEntity, width, canvas } = this;
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
            modelEntity.anim.setFloat('posX', position.x);
            modelEntity.anim.setFloat('posY', position.y);
            this.drawPosition();
        }

        get canvas() {
            return this.refCanvas.current;
        }

        /** @type {pc.Entity} */
        get modelEntity() {
            return this.app.root.findByName('model');
        }

        /** @type {pc.Application | undefined} */
        get app() {
            return window.top?.pc.app;
        }

        /** @type {number} */
        get width() {
            return window.top.controlPanel.offsetWidth;
        }

        /** @type {number} */
        get height() {
            return this.width;
        }

        drawPosition() {
            const { canvas, modelEntity, width, height } = this;
            if (!modelEntity) {
                console.warn('no modelEntity yet');
                return;
            }
            const ctx = canvas.getContext('2d');
            const halfWidth = Math.floor(width / 2);
            const halfHeight = Math.floor(height / 2);
            ctx.clearRect(0, 0, width, height);
            ctx.fillStyle = 'rgba(128, 128, 128, 0.5)';
            ctx.fillRect(0, 0, width, height);
            ctx.fillStyle = '#B1B8BA';
            ctx.fillRect(halfWidth, 0, 1, height);
            ctx.fillRect(0, halfHeight, width, 1);
            ctx.fillStyle = '#232e30';
            // @ts-ignore engine-tsd
            modelEntity.anim.baseLayer._controller._states.Emote.animations.forEach((animNode) => {
                if (animNode.point) {
                    const posX = (animNode.point.x + 1) * halfWidth;
                    const posY = (animNode.point.y * -1 + 1) * halfHeight;
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
                }
            });
            ctx.fillStyle = '#F60';
            ctx.beginPath();
            ctx.arc(
                (modelEntity.anim.getFloat('posX') + 1) * halfWidth,
                (modelEntity.anim.getFloat('posY') * -1 + 1) * halfHeight,
                5,
                0,
                2 * Math.PI
            );
            ctx.fill();
            ctx.fillStyle = '#283538';
            ctx.stroke();
        }

        onAppStart() {
            const { canvas } = this;
            // @ts-ignore engine-tsd
            const dim = window.top.controlPanel.offsetWidth + 'px';
            canvas.setAttribute('style', 'width: ' + dim + '; height: ' + dim + ';');
            canvas.setAttribute('width', dim);
            canvas.setAttribute('height', dim);
            this.drawPosition();
        }

        componentDidMount() {
            const { canvas, app } = this;
            // console.log("componentDidMount()", { canvas, app });
            canvas.addEventListener('mousemove', this.mouseEvent.bind(this));
            canvas.addEventListener('mousedown', this.mouseEvent.bind(this));
            canvas.addEventListener('touchmove', this.mouseEvent.bind(this));
            canvas.addEventListener('touchstart', this.mouseEvent.bind(this));
            if (!app) {
                console.warn('no app');
                return;
            }
            this.onAppStart();
        }

        render() {
            return fragment(jsx('canvas', { ref: this.refCanvas }));
        }
    }
    return jsx(JsxControls);
}
