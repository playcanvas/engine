import * as pc from 'playcanvas';

/**
 * @param {import('../../app/components/Example.mjs').ControlOptions} options - The options.
 * @returns {JSX.Element} The returned JSX Element.
 */
export function controls({ observer, ReactPCUI, React, jsx, fragment }) {
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
                    { v: pc.SHADOW_PCF1, t: 'PCF1' },
                    { v: pc.SHADOW_PCF3, t: 'PCF3' },
                    { v: pc.SHADOW_PCF5, t: 'PCF5' }
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
}
