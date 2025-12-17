/**
 * @param {import('../../app/components/Example.mjs').ControlOptions} options - The options.
 * @returns {JSX.Element} The returned JSX Element.
 */
export const controls = ({ observer, ReactPCUI, jsx, fragment }) => {
    const { BindingTwoWay, LabelGroup, Panel, SliderInput } = ReactPCUI;

    return fragment(
        jsx(
            Panel,
            { headerText: 'Radix Sort' },
            jsx(
                LabelGroup,
                { text: 'Elements (K)' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'options.elementsK' },
                    value: 1000,
                    min: 1,
                    max: 10000,
                    precision: 0
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Bits' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'options.bits' },
                    value: 16,
                    min: 4,
                    max: 24,
                    precision: 0
                })
            )
        )
    );
};
