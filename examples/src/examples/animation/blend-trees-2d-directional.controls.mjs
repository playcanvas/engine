/**
 * @param {import('../../app/components/Example.mjs').ControlOptions} options - The options.
 * @returns {JSX.Element} The returned JSX Element.
 */
export const controls = ({ observer, React, jsx, fragment }) => {
    const { useEffect, useRef } = React;
    /** @type {React.MutableRefObject<HTMLCanvasElement>} */
    const canvasRef = useRef(null);
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const width = window.top.controlPanel.offsetWidth;
        const height = width;
        const halfWidth = Math.floor(width / 2);
        const halfHeight = Math.floor(height / 2);
        canvas.setAttribute('style', `width: ${width}px; height: ${height}px;`);
        canvas.setAttribute('width', width);
        canvas.setAttribute('height', height);
        const ctx = canvas.getContext('2d');

        const drawPosition = () => {
            const animPoints = observer.get('data.animPoints') || [];
            const pos = observer.get('data.pos') || { x: 0, y: 0 };

            ctx.clearRect(0, 0, width, height);
            ctx.fillStyle = 'rgba(128, 128, 128, 0.5)';
            ctx.fillRect(0, 0, width, height);
            ctx.fillStyle = '#B1B8BA';
            ctx.fillRect(halfWidth, 0, 1, height);
            ctx.fillRect(0, halfHeight, width, 1);
            ctx.fillStyle = '#232e30';

            animPoints.forEach((animNode) => {
                const pointX = (animNode.x + 1) * halfWidth;
                const pointY = (animNode.y * -1 + 1) * halfHeight;
                const dotWidth = 8;
                const dotHeight = 8;

                ctx.fillStyle = '#ffffff80';
                ctx.beginPath();
                ctx.arc(pointX, pointY, halfWidth * 0.5 * animNode.weight, 0, 2 * Math.PI);
                ctx.fill();

                ctx.fillStyle = '#283538';
                ctx.beginPath();
                ctx.moveTo(pointX, pointY - dotHeight / 2);
                ctx.lineTo(pointX - dotWidth / 2, pointY);
                ctx.lineTo(pointX, pointY + dotHeight / 2);
                ctx.lineTo(pointX + dotWidth / 2, pointY);
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
        };


        // Initial draw
        drawPosition();

        observer.on('*:set', drawPosition);

        const mouseEvent = (e) => {
            if (e.buttons) {
                const rect = canvas.getBoundingClientRect();
                const x = ((e.clientX - rect.left) / (width / 2)) - 1;
                const y = -(((e.clientY - rect.top) / (height / 2)) - 1);
                observer.set('data.pos', { x, y });
            }
        };

        canvas.addEventListener('mousemove', mouseEvent);
        canvas.addEventListener('mousedown', mouseEvent);

        return () => {
            canvas.removeEventListener('mousemove', mouseEvent);
            canvas.removeEventListener('mousedown', mouseEvent);
        };
    }, [observer]);

    return fragment(jsx('canvas', { ref: canvasRef }));
};
