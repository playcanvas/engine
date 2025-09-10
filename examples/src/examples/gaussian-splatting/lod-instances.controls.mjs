/**
 * @param {import('../../app/components/Example.mjs').ControlOptions} options - The options.
 * @returns {JSX.Element} The returned JSX Element.
 */
export const controls = ({ observer, ReactPCUI, React, jsx, fragment }) => {
    const { BindingTwoWay, LabelGroup, BooleanInput, Panel } = ReactPCUI;
    return fragment(
        jsx(
            Panel,
            { headerText: 'Debug' },
            jsx(
                LabelGroup,
                { text: 'AABBs' },
                jsx(BooleanInput, {
                    type: 'toggle',
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'debugAabbs' },
                    value: observer.get('debugAabbs')
                })
            ),
            jsx(
                LabelGroup,
                { text: 'LOD' },
                jsx(BooleanInput, {
                    type: 'toggle',
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'debugLod' },
                    value: observer.get('debugLod')
                })
            )
        )
    );
};


