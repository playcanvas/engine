/**
 * @param {import('../../app/components/Example.mjs').ControlOptions} options - The options.
 * @returns {JSX.Element} The returned JSX Element.
 */
export function controls({ observer, ReactPCUI, React, jsx, fragment }) {
    const { BindingTwoWay, BooleanInput, LabelGroup, Panel, SelectInput, SliderInput } = ReactPCUI;
    return fragment(
        jsx(
            Panel,
            { headerText: 'BLOOM [KEY_1]' },
            jsx(
                LabelGroup,
                { text: 'enabled' },
                jsx(BooleanInput, {
                    type: 'toggle',
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'scripts.bloom.enabled' }
                })
            ),
            jsx(
                LabelGroup,
                { text: 'intensity' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'scripts.bloom.bloomIntensity' }
                })
            ),
            jsx(
                LabelGroup,
                { text: 'threshold' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'scripts.bloom.bloomThreshold' }
                })
            ),
            jsx(
                LabelGroup,
                { text: 'blur amount' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'scripts.bloom.blurAmount' },
                    min: 1,
                    max: 30
                })
            )
        ),
        jsx(
            Panel,
            { headerText: 'SEPIA [KEY_2]' },
            jsx(
                LabelGroup,
                { text: 'enabled' },
                jsx(BooleanInput, {
                    type: 'toggle',
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'scripts.sepia.enabled' }
                })
            ),
            jsx(
                LabelGroup,
                { text: 'amount' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'scripts.sepia.amount' }
                })
            )
        ),
        jsx(
            Panel,
            { headerText: 'VIGNETTE [KEY_3]' },
            jsx(
                LabelGroup,
                { text: 'enabled' },
                jsx(BooleanInput, {
                    type: 'toggle',
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'scripts.vignette.enabled' }
                })
            ),
            jsx(
                LabelGroup,
                { text: 'darkness' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'scripts.vignette.darkness' }
                })
            ),
            jsx(
                LabelGroup,
                { text: 'offset' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'scripts.vignette.offset' },
                    max: 2
                })
            )
        ),
        jsx(
            Panel,
            { headerText: 'BOKEH [KEY_4]' },
            jsx(
                LabelGroup,
                { text: 'enabled' },
                jsx(BooleanInput, {
                    type: 'toggle',
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'scripts.bokeh.enabled' }
                })
            ),
            jsx(
                LabelGroup,
                { text: 'aperture' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'scripts.bokeh.aperture' },
                    max: 0.2
                })
            ),
            jsx(
                LabelGroup,
                { text: 'max blur' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'scripts.bokeh.maxBlur' },
                    max: 0.1
                })
            )
        ),
        jsx(
            Panel,
            { headerText: 'SSAO [KEY_5]' },
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
        ),
        jsx(
            Panel,
            { headerText: 'POST-PROCESS UI [KEY_6]' },
            jsx(
                LabelGroup,
                { text: 'enabled' },
                jsx(BooleanInput, {
                    type: 'toggle',
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'data.postProcessUI.enabled' }
                })
            )
        )
    );
}
