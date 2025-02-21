/**
 * @param {import('../../app/components/Example.mjs').ControlOptions} options - The options.
 * @returns {JSX.Element} The returned JSX Element.
 */
export const controls = ({ observer, ReactPCUI, React, jsx, fragment }) => {
    const { BindingTwoWay, LabelGroup, Panel, BooleanInput, SliderInput, VectorInput } = ReactPCUI;

    return fragment(
        jsx(
            LabelGroup,
            { text: 'Zoom reset' },
            jsx(BooleanInput, {
                type: 'toggle',
                binding: new BindingTwoWay(),
                link: { observer, path: 'example.zoomReset' }
            })
        ),
        jsx(
            LabelGroup,
            { text: 'Smoothed focus' },
            jsx(BooleanInput, {
                type: 'toggle',
                binding: new BindingTwoWay(),
                link: { observer, path: 'example.smoothedFocus' }
            })
        ),
        jsx(
            Panel,
            { headerText: 'Attributes' },
            jsx(
                LabelGroup,
                { text: 'Enable Orbit' },
                jsx(BooleanInput, {
                    type: 'toggle',
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'attr.enableOrbit' }
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Enable Pan' },
                jsx(BooleanInput, {
                    type: 'toggle',
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'attr.enablePan' }
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Enable Fly' },
                jsx(BooleanInput, {
                    type: 'toggle',
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'attr.enableFly' }
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
                { text: 'Pitch range' },
                jsx(VectorInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'attr.pitchRange' },
                    dimensions: 2
                })
            ),
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
                { text: 'Move fast speed' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'attr.moveFastSpeed' },
                    min: 1,
                    max: 10
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Move slow speed' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'attr.moveSlowSpeed' },
                    min: 1,
                    max: 10
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
                { text: 'Zoom Pinch Sensitivity' },
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
                { text: 'Zoom min' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'attr.zoomMin' },
                    min: 0,
                    max: 10
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Zoom max' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'attr.zoomMax' },
                    min: 0,
                    max: 20
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
