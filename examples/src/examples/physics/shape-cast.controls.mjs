/**
 * @param {import('../../app/components/Example.mjs').ControlOptions} options - The options.
 * @returns {JSX.Element} The returned JSX Element.
 */
export const controls = ({ observer, ReactPCUI, React, jsx, fragment }) => {
    const { BindingTwoWay, LabelGroup, Panel, SelectInput, SliderInput } = ReactPCUI;
    return jsx(
        Panel,
        { headerText: 'Shape Cast' },
        jsx(
            LabelGroup,
            { text: 'Shape' },
            jsx(SelectInput, {
                options: [
                    { v: 'box', t: 'Box' },
                    { v: 'capsule', t: 'Capsule' },
                    { v: 'cylinder', t: 'Cylinder' },
                    { v: 'sphere', t: 'Sphere' }
                ],
                binding: new BindingTwoWay(),
                link: { observer, path: 'shape.type' }
            })
        ),
        jsx(
            LabelGroup,
            { text: 'Size' },
            jsx(SliderInput, {
                min: 0.1,
                max: 3,
                binding: new BindingTwoWay(),
                link: { observer, path: 'shape.size' },
                value: 1
            })
        ),
        jsx(
            LabelGroup,
            { text: 'Sweep Speed' },
            jsx(SliderInput, {
                min: 0,
                max: 5,
                binding: new BindingTwoWay(),
                link: { observer, path: 'shape.sweepSpeed' },
                value: 1
            })
        ),
        jsx(
            LabelGroup,
            { text: 'Rotation Speed' },
            jsx(SliderInput, {
                min: 0,
                max: 5,
                binding: new BindingTwoWay(),
                link: { observer, path: 'shape.rotationSpeed' },
                value: 0
            })
        )
    );
};
