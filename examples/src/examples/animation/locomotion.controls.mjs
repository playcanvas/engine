/**
 * @param {import('../../app/components/Example.mjs').ControlOptions} options - The options.
 * @returns {JSX.Element} The returned JSX Element.
 */
export function controls({ observer, ReactPCUI, React, jsx, fragment }) {
    const { BindingTwoWay, LabelGroup, BooleanInput, Button } = ReactPCUI;
    const binding = new BindingTwoWay();
    const link = {
        observer,
        path: 'jogToggle'
    };
    return fragment(
        jsx(Button, {
            text: 'Jump',
            onClick: () => observer.emit('jump')
        }),
        jsx(
            LabelGroup,
            {
                text: 'Run: '
            },
            jsx(BooleanInput, {
                type: 'toggle',
                binding,
                link
            })
        )
    );
}
