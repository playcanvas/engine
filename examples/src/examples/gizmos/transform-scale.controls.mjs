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
            ),
            jsx(
                LabelGroup,
                { text: 'Flip Axes' },
                jsx(BooleanInput, {
                    type: 'toggle',
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'gizmo.flipAxes' }
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Flip Planes' },
                jsx(BooleanInput, {
                    type: 'toggle',
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'gizmo.flipPlanes' }
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Drag Mode' },
                jsx(SelectInput, {
                    options: [
                        { v: 'show', t: 'Show' },
                        { v: 'hide', t: 'Hide' },
                        { v: 'selected', t: 'Selected' }
                    ],
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'gizmo.dragMode' }
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Uniform' },
                jsx(BooleanInput, {
                    type: 'toggle',
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'gizmo.uniform' }
                })
            )
        ),
        jsx(
            Panel,
            { headerText: 'Theme' },
            jsx(
                LabelGroup,
                { text: 'Shape Base X' },
                jsx(ColorPicker, {
                    channels: 4,
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'gizmo.theme.shapeBase.x' }
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Shape Base Y' },
                jsx(ColorPicker, {
                    channels: 4,
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'gizmo.theme.shapeBase.y' }
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Shape Base Z' },
                jsx(ColorPicker, {
                    channels: 4,
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'gizmo.theme.shapeBase.z' }
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Shape Base XYZ' },
                jsx(ColorPicker, {
                    channels: 4,
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'gizmo.theme.shapeBase.xyz' }
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Shape Base Face' },
                jsx(ColorPicker, {
                    channels: 4,
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'gizmo.theme.shapeBase.f' }
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Shape Hover X' },
                jsx(ColorPicker, {
                    channels: 4,
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'gizmo.theme.shapeHover.x' }
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Shape Hover Y' },
                jsx(ColorPicker, {
                    channels: 4,
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'gizmo.theme.shapeHover.y' }
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Shape Hover Z' },
                jsx(ColorPicker, {
                    channels: 4,
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'gizmo.theme.shapeHover.z' }
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Shape Hover XYZ' },
                jsx(ColorPicker, {
                    channels: 4,
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'gizmo.theme.shapeHover.xyz' }
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Shape Hover Face' },
                jsx(ColorPicker, {
                    channels: 4,
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'gizmo.theme.shapeHover.f' }
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Guide Base X' },
                jsx(ColorPicker, {
                    channels: 4,
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'gizmo.theme.guideBase.x' }
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Guide Base Y' },
                jsx(ColorPicker, {
                    channels: 4,
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'gizmo.theme.guideBase.y' }
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Guide Base Z' },
                jsx(ColorPicker, {
                    channels: 4,
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'gizmo.theme.guideBase.z' }
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Guide Base Face' },
                jsx(ColorPicker, {
                    channels: 4,
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'gizmo.theme.guideBase.f' }
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Guide Occlusion' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'gizmo.theme.guideOcclusion' },
                    min: 0,
                    max: 1,
                    precision: 2
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
                { text: 'Box Size' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'gizmo.axisBoxSize' }
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
