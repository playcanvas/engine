/**
 * @param {import('../../app/components/Example.mjs').ControlOptions} options - The options.
 * @returns {JSX.Element} The returned JSX Element.
 */
export const controls = ({ observer, ReactPCUI, React, jsx, fragment }) => {
    if (observer.get('shader') === undefined) {
        observer.set('shader', false);
    }
    const { Button } = ReactPCUI;
    return fragment(
        jsx(Button, {
            text: 'Custom Shader',
            onClick: () => {
                observer.set('shader', !observer.get('shader'));
            }
        })
    );
};
