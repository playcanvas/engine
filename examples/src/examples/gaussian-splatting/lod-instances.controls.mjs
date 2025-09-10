/**
 * @param {import('../../app/components/Example.mjs').ControlOptions} options - The options.
 * @returns {JSX.Element} The returned JSX Element.
 */
export const controls = ({ observer, ReactPCUI, React, jsx, fragment }) => {
    const { BindingTwoWay, LabelGroup, BooleanInput, Panel, SelectInput } = ReactPCUI;
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
            ),
            jsx(
                LabelGroup,
                { text: 'LOD Preset' },
                jsx(SelectInput, {
                    type: 'string',
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'lodPreset' },
                    value: observer.get('lodPreset') || 'normal',
                    options: [
                        { v: 'normal', t: 'Normal (0–2)' },
                        { v: 'ultra', t: 'Ultra (0–0)' },
                        { v: 'high', t: 'High (1–2)' },
                        { v: 'low', t: 'Low (2–2)' }
                    ]
                })
            )
        )
    );
};
