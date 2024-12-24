/**
 * @param {import('../../app/components/Example.mjs').ControlOptions} options - The options.
 * @returns {JSX.Element} The returned JSX Element.
 */
export const controls = ({ observer, ReactPCUI, jsx, fragment }) => {
    const { BindingTwoWay, LabelGroup, Panel, SliderInput, VectorInput } = ReactPCUI;

    return fragment(
        jsx(
            Panel,
            { headerText: 'Attributes' },
            jsx(
                LabelGroup,
                { text: 'Look sensitivity' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'attr.lookSensitivity' },
                    min: 0.1,
                    max: 1,
                    step: 0.01
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Look damping' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'attr.lookDamping' },
                    min: 0,
                    max: 0.999,
                    step: 0.001,
                    precision: 3
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Move damping' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'attr.moveDamping' },
                    min: 0,
                    max: 0.999,
                    step: 0.001,
                    precision: 3
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Pitch range' },
                jsx(VectorInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'attr.pitchRange' },
                    dimensions: 2
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Move speed' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'attr.moveSpeed' },
                    min: 1,
                    max: 10
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Sprint speed' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'attr.sprintSpeed' },
                    min: 1,
                    max: 10
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Crouch speed' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'attr.crouchSpeed' },
                    min: 1,
                    max: 10
                })
            )
        )
    );
};
