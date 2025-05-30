/**
 * @param {import('../../app/components/Example.mjs').ControlOptions} options - The options.
 * @returns {JSX.Element} The returned JSX Element.
 */
export const controls = ({ observer, ReactPCUI, React, jsx, fragment }) => {
    const { BindingTwoWay, LabelGroup, Panel, SliderInput, VectorInput } = ReactPCUI;

    return fragment(
        jsx(
            Panel,
            { headerText: 'Attributes' },
            jsx(
                LabelGroup,
                { text: 'Rotate speed' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'attr.rotateSpeed' },
                    min: 0.1,
                    max: 1,
                    step: 0.01
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
                { text: 'Zoom speed' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'attr.zoomSpeed' },
                    min: 0,
                    max: 10,
                    step: 0.001,
                    precision: 3
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Zoom pinch sensitivity' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'attr.zoomPinchSens' },
                    min: 0,
                    max: 10,
                    step: 0.01,
                    precision: 2
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Focus damping' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'attr.focusDamping' },
                    min: 0,
                    max: 0.999,
                    step: 0.001,
                    precision: 3
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Rotate damping' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'attr.rotateDamping' },
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
                { text: 'Zoom damping' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'attr.zoomDamping' },
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
                { text: 'Yaw range' },
                jsx(VectorInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'attr.yawRange' },
                    dimensions: 2
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Zoom range' },
                jsx(VectorInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'attr.zoomRange' },
                    dimensions: 2
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Zoom scale min' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'attr.zoomScaleMin' },
                    min: 0,
                    max: 1,
                    step: 0.001,
                    precision: 3
                })
            )
        )
    );
};
