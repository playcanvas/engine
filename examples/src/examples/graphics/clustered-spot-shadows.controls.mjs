import * as pc from 'playcanvas';

/**
 * @param {import('../../app/components/Example.mjs').ControlOptions} options - The options.
 * @returns {JSX.Element} The returned JSX Element.
 */
export function controls({ observer, ReactPCUI, React, jsx, fragment }) {
    const { BindingTwoWay, BooleanInput, Button, Label, LabelGroup, Panel, SelectInput, SliderInput } = ReactPCUI;
    return fragment(
        jsx(
            Panel,
            { headerText: 'Atlas' },
            jsx(
                LabelGroup,
                { text: 'Resolution' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'settings.shadowAtlasResolution' },
                    min: 256,
                    max: 4096,
                    precision: 0
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Split' },
                jsx(SelectInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'settings.atlasSplit' },
                    type: 'number',
                    options: [
                        { v: 0, t: 'Automatic' },
                        { v: 1, t: '7 Shadows' },
                        { v: 2, t: '12 Shadows' },
                        { v: 3, t: '16 Shadows' }
                    ]
                })
            ),
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
            )
        ),
        jsx(
            Panel,
            { headerText: 'Lights' },
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
            ),
            jsx(
                LabelGroup,
                { text: 'Static' },
                jsx(BooleanInput, {
                    type: 'toggle',
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'settings.static' },
                    value: observer.get('settings.static')
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Shadow Intensity' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'settings.shadowIntensity' },
                    min: 0,
                    max: 1,
                    value: observer.get('settings.shadowIntensity')
                })
            ),
            jsx(Button, {
                text: 'Add Light',
                onClick: () => observer.emit('add')
            }),
            jsx(Button, {
                text: 'Remove Light',
                onClick: () => observer.emit('remove')
            }),
            jsx(
                LabelGroup,
                { text: 'Light Count' },
                jsx(Label, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'settings.numLights' },
                    value: observer.get('settings.numLights')
                })
            )
        ),
        jsx(
            Panel,
            { headerText: 'Debug' },
            jsx(
                LabelGroup,
                { text: 'Cells' },
                jsx(BooleanInput, {
                    type: 'toggle',
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'settings.debug' },
                    value: observer.get('settings.debug')
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Atlas' },
                jsx(BooleanInput, {
                    type: 'toggle',
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'settings.debugAtlas' },
                    value: observer.get('settings.debugAtlas')
                })
            )
        )
    );
}
