/**
 * @param {import('../../app/components/Example.mjs').ControlOptions} options - The options.
 * @returns {JSX.Element} The returned JSX Element.
 */
export const controls = ({ observer, ReactPCUI, React, jsx, fragment }) => {
    const { BindingTwoWay, LabelGroup, BooleanInput } = ReactPCUI;
    return fragment(
        jsx(
            LabelGroup,
            { text: 'Unified' },
            jsx(BooleanInput, {
                type: 'toggle',
                binding: new BindingTwoWay(),
                link: { observer, path: 'unified' },
                value: observer.get('unified')
            })
        )
    );
};
