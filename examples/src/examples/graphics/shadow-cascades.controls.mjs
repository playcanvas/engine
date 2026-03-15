import * as pc from 'playcanvas';

/**
 * @param {import('../../app/components/Example.mjs').ControlOptions} options - The options.
 * @returns {JSX.Element} The returned JSX Element.
 */
export const controls = ({ observer, ReactPCUI, React, jsx, fragment }) => {
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
                        { v: pc.SHADOW_PCF1_32F, t: 'PCF1_32F' },
                        { v: pc.SHADOW_PCF3_32F, t: 'PCF3_32F' },
                        { v: pc.SHADOW_PCF5_32F, t: 'PCF5_32F' },
                        { v: pc.SHADOW_PCF1_16F, t: 'PCF1_16F' },
                        { v: pc.SHADOW_PCF3_16F, t: 'PCF3_16F' },
                        { v: pc.SHADOW_PCF5_16F, t: 'PCF5_16F' },
                        { v: pc.SHADOW_VSM_16F, t: 'VSM_16F' },
                        { v: pc.SHADOW_VSM_32F, t: 'VSM_32F' },
                        { v: pc.SHADOW_PCSS_32F, t: 'PCSS_32F' }
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
                { text: 'Blend' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'settings.light.cascadeBlend' },
                    min: 0,
                    max: 0.2,
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
};
