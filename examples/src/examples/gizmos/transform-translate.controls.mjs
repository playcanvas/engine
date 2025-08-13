import * as pc from 'playcanvas';

/**
 * @param {import('../../app/components/Example.mjs').ControlOptions} options - The options.
 * @returns {JSX.Element} The returned JSX Element.
 */
export const controls = ({ observer, ReactPCUI, React, jsx, fragment }) => {
    const { BindingTwoWay, LabelGroup, Panel, ColorPicker, SliderInput, SelectInput, BooleanInput } = ReactPCUI;
    const { useState } = React;

    const [proj, setProj] = useState(pc.PROJECTION_PERSPECTIVE);

    return fragment(
        jsx(
            Panel,
            { headerText: 'Transform' },
            jsx(
                LabelGroup,
                { text: 'Coord Space' },
                jsx(SelectInput, {
                    options: [
                        { v: 'world', t: 'World' },
                        { v: 'local', t: 'Local' }
                    ],
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'gizmo.coordSpace' }
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Size' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'gizmo.size' },
                    min: 0.1,
                    max: 2.0
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Snap' },
                jsx(BooleanInput, {
                    type: 'toggle',
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'gizmo.snap' }
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Snap Increment' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'gizmo.snapIncrement' },
                    min: 1,
                    max: 10,
                    precision: 0
                })
            )
        ),
        jsx(
            Panel,
            { headerText: 'Theme' },
            jsx(
                LabelGroup,
                { text: 'Axis X' },
                jsx(ColorPicker, {
                    channels: 4,
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'gizmo.theme.axis.x' }
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Axis Y' },
                jsx(ColorPicker, {
                    channels: 4,
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'gizmo.theme.axis.y' }
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Axis Z' },
                jsx(ColorPicker, {
                    channels: 4,
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'gizmo.theme.axis.z' }
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Axis XYZ' },
                jsx(ColorPicker, {
                    channels: 4,
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'gizmo.theme.axis.xyz' }
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Axis Face' },
                jsx(ColorPicker, {
                    channels: 4,
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'gizmo.theme.axis.f' }
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Hover X' },
                jsx(ColorPicker, {
                    channels: 4,
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'gizmo.theme.hover.x' }
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Hover Y' },
                jsx(ColorPicker, {
                    channels: 4,
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'gizmo.theme.hover.y' }
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Hover Z' },
                jsx(ColorPicker, {
                    channels: 4,
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'gizmo.theme.hover.z' }
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Hover XYZ' },
                jsx(ColorPicker, {
                    channels: 4,
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'gizmo.theme.hover.xyz' }
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Hover Face' },
                jsx(ColorPicker, {
                    channels: 4,
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'gizmo.theme.hover.f' }
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Guide X' },
                jsx(ColorPicker, {
                    channels: 4,
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'gizmo.theme.guide.x' }
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Guide Y' },
                jsx(ColorPicker, {
                    channels: 4,
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'gizmo.theme.guide.y' }
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Guide Z' },
                jsx(ColorPicker, {
                    channels: 4,
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'gizmo.theme.guide.z' }
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Guide Face' },
                jsx(ColorPicker, {
                    channels: 4,
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'gizmo.theme.guide.f' }
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Disabled' },
                jsx(ColorPicker, {
                    channels: 4,
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'gizmo.theme.disabled' }
                })
            )
        ),
        jsx(
            Panel,
            { headerText: 'Intersection' },
            jsx(
                LabelGroup,
                { text: 'Line Tolerance' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'gizmo.axisLineTolerance' },
                    min: 0,
                    max: 0.5,
                    precision: 2
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Center Tolerance' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'gizmo.axisCenterTolerance' },
                    min: 0,
                    max: 0.5,
                    precision: 2
                })
            )
        ),
        jsx(
            Panel,
            { headerText: 'Render' },
            jsx(
                LabelGroup,
                { text: 'Shading' },
                jsx(BooleanInput, {
                    type: 'toggle',
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'gizmo.shading' }
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Gap' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'gizmo.axisGap' }
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Line Thickness' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'gizmo.axisLineThickness' }
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Line Length' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'gizmo.axisLineLength' }
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Arrow Thickness' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'gizmo.axisArrowThickness' }
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Arrow Length' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'gizmo.axisArrowLength' }
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Plane Size' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'gizmo.axisPlaneSize' }
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Plane Gap' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'gizmo.axisPlaneGap' }
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Center Size' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'gizmo.axisCenterSize' }
                })
            )
        ),
        jsx(
            Panel,
            { headerText: 'Camera' },
            jsx(
                LabelGroup,
                { text: 'Projection' },
                jsx(SelectInput, {
                    options: [
                        { v: pc.PROJECTION_PERSPECTIVE + 1, t: 'Perspective' },
                        { v: pc.PROJECTION_ORTHOGRAPHIC + 1, t: 'Orthographic' }
                    ],
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'camera.proj' },
                    onSelect: value => setProj((parseInt(value, 10) || 1) - 1)
                })
            ),
            proj === pc.PROJECTION_PERSPECTIVE &&
                jsx(
                    LabelGroup,
                    { text: 'FOV' },
                    jsx(SliderInput, {
                        binding: new BindingTwoWay(),
                        link: { observer, path: 'camera.fov' },
                        min: 30,
                        max: 100
                    })
                )
        )
    );
};
