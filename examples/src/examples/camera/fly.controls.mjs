/**
 * @param {import('../../app/components/Example.mjs').ControlOptions} options - The options.
 * @returns {JSX.Element} The returned JSX Element.
 */
export const controls = ({ observer, ReactPCUI, React, jsx, fragment }) => {
    const { BindingTwoWay, LabelGroup, Panel, SliderInput, VectorInput, TextInput } = ReactPCUI;

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
                { text: 'Rotate joystick sensitivity' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'attr.rotateJoystickSens' },
                    min: 0,
                    max: 10,
                    step: 0.01,
                    precision: 2
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
                { text: 'Gamepad deadzone' },
                jsx(VectorInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'attr.gamepadDeadZone' },
                    dimensions: 2
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Mobile input layout' },
                jsx(TextInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'attr.mobileInputLayout' }
                })
            )
        )
    );
};
