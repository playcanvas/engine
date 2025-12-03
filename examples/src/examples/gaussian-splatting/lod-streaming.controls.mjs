/**
 * @param {import('../../app/components/Example.mjs').ControlOptions} options - The options.
 * @returns {JSX.Element} The returned JSX Element.
 */
export const controls = ({ observer, ReactPCUI, React, jsx, fragment }) => {
    const { BindingTwoWay, LabelGroup, BooleanInput, Panel, SelectInput, Label } = ReactPCUI;
    return fragment(
        jsx(
            Panel,
            { headerText: 'Settings' },
            jsx(
                LabelGroup,
                { text: 'High Res' },
                jsx(BooleanInput, {
                    type: 'toggle',
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'highRes' },
                    value: observer.get('highRes') || false
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Colorize LOD' },
                jsx(BooleanInput, {
                    type: 'toggle',
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'debugLod' },
                    value: observer.get('debugLod')
                })
            ),
            jsx(
                LabelGroup,
                { text: 'LOD Preset' },
                jsx(SelectInput, {
                    type: 'string',
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'lodPreset' },
                    value: observer.get('lodPreset') || 'desktop',
                    options: [
                        { v: 'desktop-max', t: 'Desktop Max (0-5)' },
                        { v: 'desktop', t: 'Desktop (1-5)' },
                        { v: 'mobile-max', t: 'Mobile Max (2-5)' },
                        { v: 'mobile', t: 'Mobile (3-5)' }
                    ]
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Splat Budget' },
                jsx(SelectInput, {
                    type: 'string',
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'splatBudget' },
                    value: observer.get('splatBudget') || '4M',
                    options: [
                        { v: 'none', t: 'No limit' },
                        { v: '1M', t: '1M' },
                        { v: '2M', t: '2M' },
                        { v: '3M', t: '3M' },
                        { v: '4M', t: '4M' },
                        { v: '6M', t: '6M' }
                    ]
                })
            )
        ),
        jsx(
            Panel,
            { headerText: 'Stats' },
            jsx(
                LabelGroup,
                { text: 'Resolution' },
                jsx(Label, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'data.stats.resolution' },
                    value: observer.get('data.stats.resolution')
                })
            ),
            jsx(
                LabelGroup,
                { text: 'GSplat Count' },
                jsx(Label, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'data.stats.gsplats' },
                    value: observer.get('data.stats.gsplats')
                })
            )
        )
    );
};
