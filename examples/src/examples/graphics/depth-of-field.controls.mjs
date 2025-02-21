/**
 * @param {import('../../app/components/Example.mjs').ControlOptions} options - The options.
 * @returns {JSX.Element} The returned JSX Element.
 */
export const controls = ({ observer, ReactPCUI, React, jsx, fragment }) => {
    const { BindingTwoWay, BooleanInput, LabelGroup, Panel, SelectInput, SliderInput, Label } = ReactPCUI;
    return fragment(
        jsx(
            Panel,
            { headerText: 'Scene Rendering' },
            jsx(
                LabelGroup,
                { text: 'Debug' },
                jsx(SelectInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'data.scene.debug' },
                    type: 'number',
                    options: [
                        { v: 0, t: 'NONE' },
                        { v: 1, t: 'BLOOM' },
                        { v: 2, t: 'VIGNETTE' },
                        { v: 3, t: 'DOF-COC' },
                        { v: 4, t: 'DOF-BLUR' },
                        { v: 5, t: 'SCENE' }
                    ]
                })
            )
        ),
        jsx(
            Panel,
            { headerText: 'Depth of Field' },
            jsx(
                LabelGroup,
                { text: 'Enabled' },
                jsx(BooleanInput, {
                    type: 'toggle',
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'data.dof.enabled' }
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Near Blur' },
                jsx(BooleanInput, {
                    type: 'toggle',
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'data.dof.nearBlur' }
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Focus Distance' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'data.dof.focusDistance' },
                    min: 0,
                    max: 800,
                    precision: 0
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Focus Range' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'data.dof.focusRange' },
                    min: 0,
                    max: 300,
                    precision: 0
                })
            ),
            jsx(
                LabelGroup,
                { text: 'High Quality' },
                jsx(BooleanInput, {
                    type: 'toggle',
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'data.dof.highQuality' }
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Blur Radius' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'data.dof.blurRadius' },
                    min: 1,
                    max: 20,
                    precision: 1
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Blur Rings' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'data.dof.blurRings' },
                    min: 2,
                    max: 10,
                    precision: 0
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Blur Ring Points' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'data.dof.blurRingPoints' },
                    min: 2,
                    max: 10,
                    precision: 0
                })
            )
        ),
        jsx(
            Panel,
            { headerText: 'DOF Stats' },
            jsx(
                LabelGroup,
                { text: 'Blur Samples' },
                jsx(Label, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'data.stats.blurSamples' },
                    value: observer.get('data.stats.blurSamples')
                })
            )
        ),
        jsx(
            Panel,
            { headerText: 'TAA (Work in Progress)' },
            jsx(
                LabelGroup,
                { text: 'Enabled' },
                jsx(BooleanInput, {
                    type: 'toggle',
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'data.taa.enabled' }
                })
            ),
            jsx(
                LabelGroup,
                { text: 'jitter' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'data.taa.jitter' },
                    min: 0,
                    max: 1,
                    precision: 2
                })
            )
        )
    );
};
