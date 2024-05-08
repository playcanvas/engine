/**
 * @param {import('../../app/components/Example.mjs').ControlOptions} options - The options.
 * @returns {JSX.Element} The returned JSX Element.
 */
export function controls({ observer, ReactPCUI, React, jsx, fragment }) {
    const { Panel, Button } = ReactPCUI;
    return jsx(
        Panel,
        { headerText: 'Asset' },
        jsx(Button, {
            text: 'Previous',
            onClick: () => observer.emit('previous')
        }),
        jsx(Button, {
            text: 'Next',
            onClick: () => observer.emit('next')
        })
    );
}
