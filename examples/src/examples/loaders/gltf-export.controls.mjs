/**
 * @param {import('../../app/components/Example.mjs').ControlOptions} options - The options.
 * @returns {JSX.Element} The returned JSX Element.
 */
export const controls = ({ observer, ReactPCUI, React, jsx, fragment }) => {
    const { Button } = ReactPCUI;
    return jsx(Button, {
        text: 'Download GLTF',
        onClick: () => observer.emit('download')
    });
};
