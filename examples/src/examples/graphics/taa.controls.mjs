/**
 * @param {import('../../app/components/Example.mjs').ControlOptions} options - The options.
 * @returns {JSX.Element} The returned JSX Element.
 */
export function controls({ observer, ReactPCUI, React, jsx, fragment }) {
    const { BindingTwoWay, BooleanInput, LabelGroup, Panel, SliderInput } = ReactPCUI;
    return fragment(
        jsx(
            Panel,
            { headerText: 'Scene Rendering' },
            jsx(
                LabelGroup,
                { text: 'resolution' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'data.scene.scale' },
                    min: 0.5,
                    max: 1,
                    precision: 1
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Bloom' },
                jsx(BooleanInput, {
                    type: 'toggle',
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'data.scene.bloom' }
                })
            )
        ),
        jsx(
            Panel,
            { headerText: 'TAA' },
            jsx(
                LabelGroup,
                { text: 'enabled' },
                jsx(BooleanInput, {
                    type: 'toggle',
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'data.taa.enabled' }
                })
            ),
            jsx(
                LabelGroup,
                { text: 'sharpness' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'data.scene.sharpness' },
                    min: 0,
                    max: 1,
                    precision: 2
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
}
