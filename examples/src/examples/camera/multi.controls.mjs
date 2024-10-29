/**
 * @param {import('../../app/components/Example.mjs').ControlOptions} options - The options.
 * @returns {JSX.Element} The returned JSX Element.
 */
export function controls({ observer, ReactPCUI, React, jsx, fragment }) {
    const { BindingTwoWay, LabelGroup, Panel, SliderInput } = ReactPCUI;

    return fragment(
        jsx(
            Panel,
            { headerText: 'Attributes' },
            jsx(
                LabelGroup,
                { text: 'Focus FOV' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'camera.focusFov' },
                    min: 30,
                    max: 120
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Look sensitivity' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'camera.lookSensitivity' },
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
                    link: { observer, path: 'camera.lookDamping' },
                    min: 0,
                    max: 0.99,
                    step: 0.01
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Move damping' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'camera.moveDamping' },
                    min: 0,
                    max: 0.99,
                    step: 0.01
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Pinch speed' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'camera.pinchSpeed' },
                    min: 1,
                    max: 10
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Wheel speed' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'camera.wheelSpeed' },
                    min: 0.001,
                    max: 0.01,
                    step: 0.001
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Zoom min' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'camera.zoomMin' },
                    min: 0.001,
                    max: 0.01,
                    step: 0.001
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Zoom max' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'camera.zoomMax' },
                    min: 1,
                    max: 10
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Zoom scale min' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'camera.zoomScaleMin' },
                    min: 0.001,
                    max: 0.01,
                    step: 0.001
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Move speed' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'camera.moveSpeed' },
                    min: 1,
                    max: 10
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Sprint speed' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'camera.sprintSpeed' },
                    min: 1,
                    max: 10
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Crouch speed' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'camera.crouchSpeed' },
                    min: 1,
                    max: 10
                })
            )
        )
    );
}
