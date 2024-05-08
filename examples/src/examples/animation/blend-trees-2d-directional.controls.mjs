import * as pc from 'playcanvas';

/**
 * @param {import('../../app/components/Example.mjs').ControlOptions} options - The options.
 * @returns {JSX.Element} The returned JSX Element.
 */
export function controls({ React, jsx, fragment }) {
    const { useEffect, useRef } = React;
    /** @type {React.MutableRefObject<HTMLCanvasElement>} */
    const canvasRef = useRef(null);
    useEffect(() => {
        const canvas = canvasRef.current;
        // @ts-ignore engine-tsd
        /** @type {pc.Entity} */
        const modelEntity = pc.app.root.findByName('model');
        const width = window.top.controlPanel.offsetWidth;
        const height = width;
        const halfWidth = Math.floor(width / 2);
        const halfHeight = Math.floor(height / 2);
        canvas.setAttribute('style', 'width: ' + width + 'px; height: ' + height + 'px;');
        canvas.setAttribute('width', width);
        canvas.setAttribute('height', height);
        const ctx = canvas.getContext('2d');
        let position = new pc.Vec2();
        const drawPosition = (ctx) => {
            ctx.clearRect(0, 0, width, height);
            ctx.fillStyle = 'rgba(128, 128, 128, 0.5)';
            ctx.fillRect(0, 0, width, height);
            ctx.fillStyle = '#B1B8BA';
            ctx.fillRect(halfWidth, 0, 1, height);
            ctx.fillRect(0, halfHeight, width, 1);
            ctx.fillStyle = '#232e30';
            // @ts-ignore engine-tsd
            modelEntity.anim?.baseLayer._controller._states.Travel.animations.forEach((animNode) => {
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
        };
        drawPosition(ctx);
        const mouseEvent = (e) => {
            if (e.buttons) {
                position = new pc.Vec2(e.offsetX, e.offsetY).mulScalar(1 / (width / 2)).sub(pc.Vec2.ONE);
                position.y *= -1.0;
                modelEntity.anim.setFloat('posX', position.x);
                modelEntity.anim.setFloat('posY', position.y);
                drawPosition(ctx);
            }
        };
        canvas.addEventListener('mousemove', mouseEvent);
        canvas.addEventListener('mousedown', mouseEvent);
    });
    return fragment(jsx('canvas', { ref: canvasRef }));
}
