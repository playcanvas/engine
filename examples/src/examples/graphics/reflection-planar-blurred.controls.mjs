/**
 * @param {import('../../app/components/Example.mjs').ControlOptions} options - The options.
 * @returns {JSX.Element} The returned JSX Element.
 */
export const controls = ({ observer, ReactPCUI, React, jsx, fragment }) => {
    const { BindingTwoWay, LabelGroup, Panel, SliderInput } = ReactPCUI;
    return fragment(
        jsx(
            Panel,
            { headerText: 'Blurred Planar Reflection' },
            jsx(
                LabelGroup,
                { text: 'Resolution' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'data.resolution' },
                    min: 0.1,
                    max: 1.0,
                    precision: 2
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Blur Amount' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'data.blurAmount' },
                    min: 0,
                    max: 1.0,
                    precision: 2
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Intensity' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'data.intensity' },
                    min: 0,
                    max: 1.0,
                    precision: 2
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Fade Strength' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'data.fadeStrength' },
                    min: 0.1,
                    max: 5.0,
                    precision: 2
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Angle Fade' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'data.angleFade' },
                    min: 0.1,
                    max: 1.0,
                    precision: 2
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Height Range' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'data.heightRange' },
                    min: 0.001,
                    max: 1.0,
                    precision: 3
                })
            )
        )
    );
};
