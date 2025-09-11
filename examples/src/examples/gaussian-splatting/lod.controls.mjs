/**
 * @param {import('../../app/components/Example.mjs').ControlOptions} options - The options.
 * @returns {JSX.Element} The returned JSX Element.
 */
export const controls = ({ observer, ReactPCUI, React, jsx, fragment }) => {
    const { BindingTwoWay, LabelGroup, BooleanInput, SliderInput } = ReactPCUI;
    if (!observer.get('lod')) {
        observer.set('lod', { distance: 5 });
    }
    return fragment(
        jsx(
            LabelGroup,
            { text: 'Debug AABBs' },
            jsx(BooleanInput, {
                type: 'toggle',
                binding: new BindingTwoWay(),
                link: { observer, path: 'debugAabbs' },
                value: observer.get('debugAabbs')
            })
        ),
        jsx(
            LabelGroup,
            { text: 'Debug LOD' },
            jsx(BooleanInput, {
                type: 'toggle',
                binding: new BindingTwoWay(),
                link: { observer, path: 'debugLod' },
                value: observer.get('debugLod')
            })
        ),
        jsx(
            LabelGroup,
            { text: 'Distance' },
            jsx(SliderInput, {
                precision: 1,
                min: 3,
                max: 20,
                step: 0.1,
                binding: new BindingTwoWay(),
                link: { observer, path: 'lod.distance' }
            })
        )
    );
};
