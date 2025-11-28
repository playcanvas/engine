/**
 * @param {import('../../app/components/Example.mjs').ControlOptions} options - The options.
 * @returns {JSX.Element} The returned JSX Element.
 */
export function controls({ observer, ReactPCUI, React, jsx, fragment }) {
    const { BindingTwoWay, LabelGroup, BooleanInput } = ReactPCUI;
    return fragment(
        jsx(
            LabelGroup,
            { text: 'MSAA' },
            jsx(BooleanInput, {
                type: 'toggle',
                binding: new BindingTwoWay(),
                link: { observer, path: 'msaaEnabled' },
                value: observer.get('msaaEnabled')
            })
        )
    );
}
