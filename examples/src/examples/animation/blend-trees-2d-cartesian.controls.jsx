import { useEffect, useRef } from 'react';

import * as pc from 'playcanvas';

/**
 * @import { Observer } from '@playcanvas/observer'
 * @import { ReactElement } from 'react'
 */

/**
 * @param {{ observer: Observer }} props - The control panel props.
 * @returns {ReactElement} The control panel.
 */
export function Controls({ observer }) {
    const refCanvas = useRef(/** @type {HTMLCanvasElement | null} */ (null));

    useEffect(() => {
        const canvas = refCanvas.current;
        if (!canvas) {
            return;
        }

        const position = new pc.Vec2();

        // width follows the control panel and is read fresh so resizes are tracked
        const width = () => {
            const panel = /** @type {HTMLElement | null} */ (
                canvas.closest('#controlPanel') ?? null
            );
            return panel?.offsetWidth ?? canvas.parentElement?.offsetWidth ?? 0;
        };

        const mouseEvent = (e) => {
            const w = width();
            if (!w) {
                return;
            }
            if (e.targetTouches) {
                const offset = canvas.getBoundingClientRect();
                position
                .set(
                    e.targetTouches[0].clientX - offset.x,
                    e.targetTouches[0].clientY - offset.y
                )
                .mulScalar(1 / (w / 2))
                .sub(pc.Vec2.ONE);
            } else if (e.buttons) {
                position
                .set(e.offsetX, e.offsetY)
                .mulScalar(1 / (w / 2))
                .sub(pc.Vec2.ONE);
            } else {
                return;
            }
            position.y *= -1.0;
            observer.set('data.pos', { x: position.x, y: position.y });
        };

        const drawPosition = () => {
            const w = width();
            const h = w;
            if (!w || !h) {
                return;
            }
            const animPoints = observer.get('data.animPoints') || [];
            const pos = observer.get('data.pos') || { x: 0, y: 0 };

            const ctx = canvas.getContext('2d');
            if (!ctx) {
                return;
            }
            const halfWidth = Math.floor(w / 2);
            const halfHeight = Math.floor(h / 2);
            ctx.clearRect(0, 0, w, h);
            ctx.fillStyle = 'rgba(128, 128, 128, 0.5)';
            ctx.fillRect(0, 0, w, h);
            ctx.fillStyle = '#B1B8BA';
            ctx.fillRect(halfWidth, 0, 1, h);
            ctx.fillRect(0, halfHeight, w, 1);
            ctx.fillStyle = '#232e30';

            animPoints.forEach((animNode) => {
                const posX = (animNode.x + 1) * halfWidth;
                const posY = (animNode.y * -1 + 1) * halfHeight;
                const size = 8;
                ctx.fillStyle = '#ffffff80';
                ctx.beginPath();
                ctx.arc(posX, posY, halfWidth * 0.5 * animNode.weight, 0, 2 * Math.PI);
                ctx.fill();
                ctx.fillStyle = '#283538';
                ctx.beginPath();
                ctx.moveTo(posX, posY - size / 2);
                ctx.lineTo(posX - size / 2, posY);
                ctx.lineTo(posX, posY + size / 2);
                ctx.lineTo(posX + size / 2, posY);
                ctx.closePath();
                ctx.fill();
            });

            ctx.fillStyle = '#F60';
            ctx.beginPath();
            ctx.arc((pos.x + 1) * halfWidth, (pos.y * -1 + 1) * halfHeight, 5, 0, 2 * Math.PI);
            ctx.fill();
            ctx.fillStyle = '#283538';
            ctx.stroke();
        };

        const w = width();
        if (!w) {
            return;
        }

        canvas.addEventListener('mousemove', mouseEvent);
        canvas.addEventListener('mousedown', mouseEvent);
        canvas.addEventListener('touchmove', mouseEvent);
        canvas.addEventListener('touchstart', mouseEvent);

        const dim = `${w}px`;
        canvas.setAttribute('style', `width: ${dim}; height: ${dim};`);
        canvas.width = w;
        canvas.height = w;
        drawPosition();

        const evt = observer.on('*:set', drawPosition);

        return () => {
            canvas.removeEventListener('mousemove', mouseEvent);
            canvas.removeEventListener('mousedown', mouseEvent);
            canvas.removeEventListener('touchmove', mouseEvent);
            canvas.removeEventListener('touchstart', mouseEvent);
            evt?.unbind();
        };
    }, [observer]);

    return <canvas ref={refCanvas} />;
}
