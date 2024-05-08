/**
 * @param {import('../../app/components/Example.mjs').ControlOptions} options - The options.
 * @returns {JSX.Element} The returned JSX Element.
 */
export function controls({ observer, ReactPCUI, React, jsx, fragment }) {
    const { BindingTwoWay, BooleanInput, LabelGroup } = ReactPCUI;
    return jsx(
        LabelGroup,
        { text: 'softness' },
        jsx(BooleanInput, {
            type: 'toggle',
            binding: new BindingTwoWay(),
            link: {
                observer,
                path: 'data.softness'
            }
        })
    );
}
