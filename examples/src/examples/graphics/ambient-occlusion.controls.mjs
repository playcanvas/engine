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
                { text: 'blurType' },
                jsx(SelectInput, {
                    options: [
                        // NOTE: BLUR_BOX is 0, BLUR_GAUSSIAN is 1
                        // But SelectInput options don't work with 0-based indices (a bug?)
                        // So we subtract 1 from the value of data.get('data.ssao.blurType')
                        { v: 1, t: 'Box' },
                        { v: 2, t: 'Gaussian' }
                    ],
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'data.ssao.blurType' }
                })
            ),
            jsx(
                LabelGroup,
                { text: 'blurSize' },
                jsx(SliderInput, {
                    min: 1,
                    step: 1,
                    max: 25,
                    precision: 0,
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'data.ssao.blurSize' }
                })
            ),
        )
    );
}
