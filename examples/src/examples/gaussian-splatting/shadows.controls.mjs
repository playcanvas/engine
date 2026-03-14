/**
 * @param {import('../../app/components/Example.mjs').ControlOptions} options - The options.
 * @returns {JSX.Element} The returned JSX Element.
 */
export const controls = ({ observer, ReactPCUI, React, jsx, fragment }) => {
    const { BindingTwoWay, LabelGroup, SliderInput } = ReactPCUI;
    return fragment(
        jsx(
            LabelGroup,
            { text: 'Alpha Clip' },
            jsx(SliderInput, {
                binding: new BindingTwoWay(),
                link: { observer, path: 'alphaClip' },
                min: 0,
                max: 1,
                precision: 2
            })
        )
    );
};
