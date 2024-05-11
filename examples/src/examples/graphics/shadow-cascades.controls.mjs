import * as pc from 'playcanvas';

/**
 * @param {import('../../app/components/Example.mjs').ControlOptions} options - The options.
 * @returns {JSX.Element} The returned JSX Element.
 */
export function controls({ observer, ReactPCUI, React, jsx, fragment }) {
    const { BindingTwoWay, BooleanInput, LabelGroup, Panel, SelectInput, SliderInput } = ReactPCUI;
    return fragment(
        jsx(
            Panel,
            { headerText: 'Shadow Cascade Settings' },
            jsx(
                LabelGroup,
                { text: 'Filtering' },
                jsx(SelectInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'settings.light.shadowType' },
                    type: 'number',
                    options: [
                        { v: pc.SHADOW_PCF1, t: 'PCF1' },
                        { v: pc.SHADOW_PCF3, t: 'PCF3' },
                        { v: pc.SHADOW_PCF5, t: 'PCF5' },
                        { v: pc.SHADOW_VSM8, t: 'VSM8' },
                        { v: pc.SHADOW_VSM16, t: 'VSM16' },
                        { v: pc.SHADOW_VSM32, t: 'VSM32' }
                    ]
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Count' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'settings.light.numCascades' },
                    min: 1,
                    max: 4,
                    precision: 0
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Every Frame' },
                jsx(BooleanInput, {
                    type: 'toggle',
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'settings.light.everyFrame' },
                    value: observer.get('settings.light.everyFrame')
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Resolution' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'settings.light.shadowResolution' },
                    min: 128,
                    max: 2048,
                    precision: 0
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Distribution' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'settings.light.cascadeDistribution' },
                    min: 0,
                    max: 1,
                    precision: 2
                })
            ),
            jsx(
                LabelGroup,
                { text: 'VSM Blur' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'settings.light.vsmBlurSize' },
                    min: 1,
                    max: 25,
                    precision: 0
                })
            )
        )
    );
}
