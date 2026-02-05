import * as pc from 'playcanvas';

/**
 * @param {import('../../app/components/Example.mjs').ControlOptions} options - The options.
 * @returns {JSX.Element} The returned JSX Element.
 */
export const controls = ({ observer, ReactPCUI, React, jsx, fragment }) => {
    const { BindingTwoWay, BooleanInput, VectorInput, LabelGroup, Panel, SliderInput, SelectInput } = ReactPCUI;
    return fragment(
        jsx(
            Panel,
            { headerText: 'Sky' },
            jsx(
                LabelGroup,
                { text: 'Preset' },
                jsx(SelectInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'data.skybox.preset' },
                    type: 'string',
                    options: [
                        { v: 'Street Dome', t: 'Street Dome' },
                        { v: 'Street Infinite', t: 'Street Infinite' },
                        { v: 'Room', t: 'Room' }
                    ]
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Type' },
                jsx(SelectInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'data.skybox.type' },
                    type: 'string',
                    options: [
                        { v: pc.SKYTYPE_INFINITE, t: 'Infinite' },
                        { v: pc.SKYTYPE_BOX, t: 'Box' },
                        { v: pc.SKYTYPE_DOME, t: 'Dome' }
                    ]
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Exposure' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'data.skybox.exposure' },
                    min: 0,
                    max: 3,
                    precision: 2
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Rotation' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'data.skybox.rotation' },
                    min: 0,
                    max: 360,
                    precision: 0
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Scale' },
                jsx(VectorInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'data.skybox.scale' },
                    value: [1, 1, 1],
                    precision: 1
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Position' },
                jsx(VectorInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'data.skybox.position' },
                    value: [0, 0, 0],
                    precision: 1
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Tripod Y' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'data.skybox.tripodY' },
                    min: 0,
                    max: 1,
                    precision: 2
                })
            )
        ),
        jsx(
            Panel,
            { headerText: 'Color Enhance' },
            jsx(
                LabelGroup,
                { text: 'enabled' },
                jsx(BooleanInput, {
                    type: 'toggle',
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'data.colorEnhance.enabled' }
                })
            ),
            jsx(
                LabelGroup,
                { text: 'shadows' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'data.colorEnhance.shadows' },
                    min: -3,
                    max: 3,
                    precision: 2
                })
            ),
            jsx(
                LabelGroup,
                { text: 'highlights' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'data.colorEnhance.highlights' },
                    min: -3,
                    max: 3,
                    precision: 2
                })
            ),
            jsx(
                LabelGroup,
                { text: 'vibrance' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'data.colorEnhance.vibrance' },
                    min: -1,
                    max: 1,
                    precision: 2
                })
            ),
            jsx(
                LabelGroup,
                { text: 'dehaze' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'data.colorEnhance.dehaze' },
                    min: -1,
                    max: 1,
                    precision: 2
                })
            )
        )
    );
};
