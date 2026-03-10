/**
 * @param {import('../../app/components/Example.mjs').ControlOptions} options - The options.
 * @returns {JSX.Element} The returned JSX Element.
 */
export const controls = ({ observer, ReactPCUI, React, jsx, fragment }) => {
    const { BindingTwoWay, LabelGroup, ColorPicker, SliderInput, Panel } = ReactPCUI;

    return fragment(
        jsx(
            Panel,
            { headerText: 'Paint Settings' },
            jsx(
                LabelGroup,
                { text: 'Paint Color' },
                jsx(ColorPicker, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'paintColor' }
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Intensity' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'paintIntensity' },
                    min: 0.1,
                    max: 1.0,
                    precision: 2
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Brush Size' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'brushSize' },
                    min: 0.05,
                    max: 0.5,
                    precision: 2
                })
            )
        )
    );
};
