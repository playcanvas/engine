import * as pc from 'playcanvas';

/**
 * @param {import('../../app/components/Example.mjs').ControlOptions} options - The options.
 * @returns {JSX.Element} The returned JSX Element.
 */
export const controls = ({ observer, ReactPCUI, React, jsx, fragment }) => {
    const { BindingTwoWay, SelectInput, LabelGroup, SliderInput } = ReactPCUI;
    return fragment(
        jsx(
            LabelGroup,
            { text: 'Tonemap' },
            jsx(SelectInput, {
                binding: new BindingTwoWay(),
                link: { observer, path: 'data.sceneTonemapping' },
                type: 'number',
                options: [
                    { v: pc.TONEMAP_LINEAR, t: 'LINEAR' },
                    { v: pc.TONEMAP_FILMIC, t: 'FILMIC' },
                    { v: pc.TONEMAP_HEJL, t: 'HEJL' },
                    { v: pc.TONEMAP_ACES, t: 'ACES' },
                    { v: pc.TONEMAP_ACES2, t: 'ACES2' },
                    { v: pc.TONEMAP_NEUTRAL, t: 'NEUTRAL' }
                ]
            })
        ),
        jsx(
            LabelGroup,
            { text: 'Pixel Size' },
            jsx(SliderInput, {
                binding: new BindingTwoWay(),
                link: { observer, path: 'data.pixelSize' },
                min: 8,
                max: 20,
                precision: 0
            })
        ),
        jsx(
            LabelGroup,
            { text: 'Intensity' },
            jsx(SliderInput, {
                binding: new BindingTwoWay(),
                link: { observer, path: 'data.pixelationIntensity' },
                min: 0,
                max: 1,
                precision: 2
            })
        )
    );
};
