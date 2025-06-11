import * as pc from 'playcanvas';

/**
 * @param {import('../../app/components/Example.mjs').ControlOptions} options - The options.
 * @returns {JSX.Element} The returned JSX Element.
 */
export const controls = ({ observer, ReactPCUI, React, jsx, fragment }) => {
    const { BindingTwoWay, BooleanInput, LabelGroup, Panel, SelectInput, SliderInput } = ReactPCUI;
    return jsx(
        Panel,
        { headerText: 'Settings' },
        jsx(
            LabelGroup,
            { text: 'Filter' },
            jsx(SelectInput, {
                binding: new BindingTwoWay(),
                link: { observer, path: 'settings.shadowType' },
                type: 'number',
                options: [
                    { v: pc.SHADOW_PCF1_32F, t: 'PCF1_32F' },
                    { v: pc.SHADOW_PCF3_32F, t: 'PCF3_32F' },
                    { v: pc.SHADOW_PCF5_32F, t: 'PCF5_32F' },
                    { v: pc.SHADOW_PCF1_16F, t: 'PCF1_16F' },
                    { v: pc.SHADOW_PCF3_16F, t: 'PCF3_16F' },
                    { v: pc.SHADOW_PCF5_16F, t: 'PCF5_16F' }
                ]
            })
        ),
        jsx(
            LabelGroup,
            { text: 'Shadow Res' },
            jsx(SliderInput, {
                binding: new BindingTwoWay(),
                link: { observer, path: 'settings.shadowAtlasResolution' },
                min: 512,
                max: 4096,
                precision: 0
            })
        ),
        jsx(
            LabelGroup,
            { text: 'Shadows On' },
            jsx(BooleanInput, {
                type: 'toggle',
                binding: new BindingTwoWay(),
                link: { observer, path: 'settings.shadowsEnabled' },
                value: observer.get('settings.shadowsEnabled')
            })
        ),
        jsx(
            LabelGroup,
            { text: 'Cookies On' },
            jsx(BooleanInput, {
                type: 'toggle',
                binding: new BindingTwoWay(),
                link: { observer, path: 'settings.cookiesEnabled' },
                value: observer.get('settings.cookiesEnabled')
            })
        )
    );
};
