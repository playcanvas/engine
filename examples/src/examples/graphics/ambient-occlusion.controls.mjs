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
                    link: { observer, path: 'scripts.ssao.enabled' }
                })
            ),
            jsx(
                LabelGroup,
                { text: 'radius' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'scripts.ssao.radius' },
                    max: 10
                })
            ),
            jsx(
                LabelGroup,
                { text: 'samples' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'scripts.ssao.samples' },
                    max: 32
                })
            ),
            jsx(
                LabelGroup,
                { text: 'brightness' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'scripts.ssao.brightness' }
                })
            ),
            jsx(
                LabelGroup,
                { text: 'downscale' },
                jsx(SelectInput, {
                    options: [
                        { v: 1, t: 'None' },
                        { v: 2, t: '50%' },
                        { v: '4', t: '25%' }
                    ],
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'scripts.ssao.downscale' }
                })
            )
        )
    );
}
