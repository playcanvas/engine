import * as pc from 'playcanvas';

/**
 * @param {import('../../app/components/Example.mjs').ControlOptions} options - The options.
 * @returns {JSX.Element} The returned JSX Element.
 */
export function controls({ observer, ReactPCUI, React, jsx, fragment }) {
    const { BindingTwoWay, LabelGroup, Panel, SliderInput, SelectInput, BooleanInput } = ReactPCUI;
    return fragment(
        jsx(
            Panel,
            { headerText: 'Area light' },
            jsx(
                LabelGroup,
                { text: 'Enabled' },
                jsx(BooleanInput, {
                    id: 'area-light',
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'script.area.enabled' }
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Intensity' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'script.area.intensity' },
                    min: 0.0,
                    max: 32.0
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Softness' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'script.area.size' },
                    min: 0.01,
                    max: 32.0
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Shadows' },
                jsx(SelectInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'script.area.shadowType' },
                    options: [
                        { v: pc.SHADOW_PCSS, t: 'PCSS' },
                        { v: pc.SHADOW_PCF5, t: 'PCF' }
                    ]
                })
            )
        ),
        jsx(
            Panel,
            { headerText: 'Point light' },
            jsx(
                LabelGroup,
                { text: 'Enabled' },
                jsx(BooleanInput, {
                    id: 'point-light',
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'script.point.enabled' }
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Intensity' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'script.point.intensity' },
                    min: 0.0,
                    max: 32.0
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Softness' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'script.point.size' },
                    min: 0.01,
                    max: 32.0
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Shadows' },
                jsx(SelectInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'script.point.shadowType' },
                    options: [
                        { v: pc.SHADOW_PCSS, t: 'PCSS' },
                        { v: pc.SHADOW_PCF5, t: 'PCF' }
                    ]
                })
            )
        ),
        jsx(
            Panel,
            { headerText: 'Directional light' },
            jsx(
                LabelGroup,
                { text: 'Enabled' },
                jsx(BooleanInput, {
                    id: 'directional-light',
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'script.directional.enabled' }
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Intensity' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'script.directional.intensity' },
                    min: 0.0,
                    max: 32.0
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Softness' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'script.directional.size' },
                    min: 0.01,
                    max: 32.0
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Shadows' },
                jsx(SelectInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'script.directional.shadowType' },
                    options: [
                        { v: pc.SHADOW_PCSS, t: 'PCSS' },
                        { v: pc.SHADOW_PCF5, t: 'PCF' }
                    ]
                })
            )
        ),
        jsx(
            Panel,
            { headerText: 'Animate' },
            jsx(
                LabelGroup,
                { text: 'Cycle Active Light' },
                jsx(BooleanInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'script.cycle' }
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Animate Lights' },
                jsx(BooleanInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'script.animate' }
                })
            )
        )
    );
}
