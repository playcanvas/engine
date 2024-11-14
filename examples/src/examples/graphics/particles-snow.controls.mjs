/**
 * @param {import('../../app/components/Example.mjs').ControlOptions} options - The options.
 * @returns {JSX.Element} The returned JSX Element.
 */
export const controls = ({ observer, ReactPCUI, React, jsx, fragment }) => {
    const { BindingTwoWay, LabelGroup, Panel, BooleanInput } = ReactPCUI;
    return fragment(
        jsx(
            Panel,
            { headerText: 'Options' },
            jsx(
                LabelGroup,
                { text: 'Soft' },
                jsx(BooleanInput, {
                    type: 'toggle',
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'data.soft' },
                    value: observer.get('data.soft')
                })
            )
        )
    );
};
