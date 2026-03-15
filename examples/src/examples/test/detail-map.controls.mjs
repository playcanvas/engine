/**
 * @param {import('../../app/components/Example.mjs').ControlOptions} options - The options.
 * @returns {JSX.Element} The returned JSX Element.
 */
export const controls = ({ observer, ReactPCUI, React, jsx, fragment }) => {
    const { BindingTwoWay, LabelGroup, Panel, BooleanInput } = ReactPCUI;
    return fragment(
        jsx(
            Panel,
            { headerText: 'Detail Maps' },
            jsx(
                LabelGroup,
                { text: 'Diffuse' },
                jsx(BooleanInput, {
                    type: 'toggle',
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'data.diffuse' }
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Normal' },
                jsx(BooleanInput, {
                    type: 'toggle',
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'data.normal' }
                })
            ),
            jsx(
                LabelGroup,
                { text: 'AO' },
                jsx(BooleanInput, {
                    type: 'toggle',
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'data.ao' }
                })
            )
        )
    );
};
