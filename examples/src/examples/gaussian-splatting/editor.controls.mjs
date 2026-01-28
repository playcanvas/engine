/**
 * @param {import('../../app/components/Example.mjs').ControlOptions} options - The options.
 * @returns {JSX.Element} The returned JSX Element.
 */
export const controls = ({ observer, ReactPCUI, React, jsx, fragment }) => {
    const { BindingTwoWay, LabelGroup, SliderInput, Button, Panel } = ReactPCUI;

    return fragment(
        jsx(
            Panel,
            { headerText: 'Editor Settings' },
            jsx(Button, {
                text: 'Select',
                onClick: () => observer.emit('select')
            }),
            jsx(
                LabelGroup,
                { text: 'Box Size' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'boxSize' },
                    min: 0.1,
                    max: 5.0,
                    precision: 2
                })
            ),
            jsx(Button, {
                text: 'Delete Selected',
                onClick: () => observer.emit('deleteSelected')
            }),
            jsx(Button, {
                text: 'Clone Selected',
                onClick: () => observer.emit('cloneSelected')
            })
        )
    );
};
