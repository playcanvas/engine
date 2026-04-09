/**
 * @param {import('../../app/components/Example.mjs').ControlOptions} options - The options.
 * @returns {JSX.Element} The returned JSX Element.
 */
export const controls = ({ observer, ReactPCUI, React, jsx, fragment }) => {
    const { BindingTwoWay, LabelGroup, BooleanInput, SelectInput } = ReactPCUI;
    return fragment(
        jsx(
            LabelGroup,
            { text: 'Renderer' },
            jsx(SelectInput, {
                type: 'number',
                binding: new BindingTwoWay(),
                link: { observer, path: 'renderer' },
                value: observer.get('renderer') ?? 0,
                options: [
                    { v: 0, t: 'Auto' },
                    { v: 1, t: 'Raster (CPU Sort)' },
                    { v: 2, t: 'Raster (GPU Sort)' },
                    { v: 3, t: 'Compute' }
                ]
            })
        ),
        jsx(
            LabelGroup,
            { text: 'Exaggerated Stereo' },
            jsx(BooleanInput, {
                type: 'toggle',
                binding: new BindingTwoWay(),
                link: { observer, path: 'exaggeratedStereo' }
            })
        )
    );
};
