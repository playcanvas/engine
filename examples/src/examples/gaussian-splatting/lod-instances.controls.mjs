/**
 * @param {import('../../app/components/Example.mjs').ControlOptions} options - The options.
 * @returns {JSX.Element} The returned JSX Element.
 */
export const controls = ({ observer, ReactPCUI, React, jsx, fragment }) => {
    const { BindingTwoWay, LabelGroup, BooleanInput, Panel, SliderInput, Label } = ReactPCUI;
    return fragment(
        jsx(
            Panel,
            { headerText: 'Settings' },
            jsx(
                LabelGroup,
                { text: 'Hue Animation' },
                jsx(BooleanInput, {
                    type: 'toggle',
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'colorize' },
                    value: observer.get('colorize')
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Splat Budget' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'splatBudget' },
                    min: 0,
                    max: 10,
                    precision: 1,
                    step: 0.1
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
