/**
 * @param {import('../../app/components/Example.mjs').ControlOptions} options - The options.
 * @returns {JSX.Element} The returned JSX Element.
 */
export function controls({ observer, ReactPCUI, React, jsx, fragment }) {
    const { BindingTwoWay, BooleanInput, LabelGroup, Panel, SelectInput, SliderInput } = ReactPCUI;
    return fragment(
        jsx(
            Panel,
            { headerText: 'Ambient Occlusion' },
            jsx(
                LabelGroup,
                { text: 'enabled' },
                jsx(BooleanInput, {
                    type: 'toggle',
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'data.ssao.enabled' }
                })
            ),
            jsx(
                LabelGroup,
                { text: 'blurEnabled' },
                jsx(BooleanInput, {
                    type: 'toggle',
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'data.ssao.blurEnabled' }
                })
            ),
            jsx(
                LabelGroup,
                { text: 'radius' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'data.ssao.radius' },
                    max: 50
                })
            ),
            jsx(
                LabelGroup,
                { text: 'samples' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'data.ssao.samples' },
                    min: 1,
                    max: 64,
                    precision: 0
                })
            ),
            jsx(
                LabelGroup,
                { text: 'intensity' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'data.ssao.intensity' }
                })
            ),
            jsx(
                LabelGroup,
                { text: 'power' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'data.ssao.power' },
                    min: 0.1,
                    max: 10
                })
            ),
            jsx(
                LabelGroup,
                { text: 'minAngle' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'data.ssao.minAngle' },
                    max: 90
                })
            ),
            jsx(
                LabelGroup,
                { text: 'scale' },
                jsx(SelectInput, {
                    options: [
                        { v: 1.00, t: '100%' },
                        { v: 0.75, t: '75%' },
                        { v: 0.50, t: '50%' }
                    ],
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'data.ssao.scale' }
                })
            )
        )
    );
}
