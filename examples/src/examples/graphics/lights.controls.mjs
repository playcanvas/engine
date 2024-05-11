/**
 * @param {import('../../app/components/Example.mjs').ControlOptions} options - The options.
 * @returns {JSX.Element} The returned JSX Element.
 */
export function controls({ observer, ReactPCUI, React, jsx, fragment }) {
    const { BindingTwoWay, BooleanInput, LabelGroup, Panel, SliderInput } = ReactPCUI;
    return fragment(
        jsx(
            Panel,
            { headerText: 'OMNI LIGHT [KEY_1]' },
            jsx(
                LabelGroup,
                { text: 'enabled' },
                jsx(BooleanInput, {
                    type: 'toggle',
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'lights.omni.enabled' }
                })
            ),
            jsx(
                LabelGroup,
                { text: 'intensity' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'lights.omni.intensity' }
                })
            ),
            jsx(
                LabelGroup,
                { text: 'shadow intensity' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'lights.omni.shadowIntensity' }
                })
            ),
            jsx(
                LabelGroup,
                { text: 'cookie' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'lights.omni.cookieIntensity' }
                })
            )
        ),
        jsx(
            Panel,
            { headerText: 'SPOT LIGHT [KEY_2]' },
            jsx(
                LabelGroup,
                { text: 'enabled' },
                jsx(BooleanInput, {
                    type: 'toggle',
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'lights.spot.enabled' }
                })
            ),
            jsx(
                LabelGroup,
                { text: 'intensity' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'lights.spot.intensity' }
                })
            ),
            jsx(
                LabelGroup,
                { text: 'shadow intensity' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'lights.spot.shadowIntensity' }
                })
            ),
            jsx(
                LabelGroup,
                { text: 'cookie' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'lights.spot.cookieIntensity' }
                })
            )
        ),
        jsx(
            Panel,
            { headerText: 'DIRECTIONAL LIGHT [KEY_3]' },
            jsx(
                LabelGroup,
                { text: 'enabled' },
                jsx(BooleanInput, {
                    type: 'toggle',
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'lights.directional.enabled' }
                })
            ),
            jsx(
                LabelGroup,
                { text: 'intensity' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'lights.directional.intensity' }
                })
            ),
            jsx(
                LabelGroup,
                { text: 'shadow intensity' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'lights.directional.shadowIntensity' }
                })
            )
        )
    );
}
