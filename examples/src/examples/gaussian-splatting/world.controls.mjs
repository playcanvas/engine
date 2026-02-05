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
