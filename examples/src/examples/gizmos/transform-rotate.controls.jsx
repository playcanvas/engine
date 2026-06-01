import {
    BindingTwoWay,
    LabelGroup,
    Panel,
    ColorPicker,
    SliderInput,
    SelectInput,
    BooleanInput
} from '@playcanvas/pcui/react';
import { useState } from 'react';

import * as pc from 'playcanvas';

/**
 * @import { Observer } from '@playcanvas/observer'
 * @import { ReactElement } from 'react'
 */

/**
 * @param {{ observer: Observer }} props - The control panel props.
 * @returns {ReactElement} The control panel.
 */
export function Controls({ observer }) {
    const [proj, setProj] = useState(pc.PROJECTION_PERSPECTIVE);

    return (
        <>
            <Panel headerText='Transform'>
                <LabelGroup text='Coord Space'>
                    <SelectInput
                        options={[
                            { v: 'world', t: 'World' },
                            { v: 'local', t: 'Local' }
                        ]}
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'gizmo.coordSpace' }}
                    />
                </LabelGroup>
                <LabelGroup text='Size'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'gizmo.size' }}
                        min={0.1}
                        max={2.0}
                    />
                </LabelGroup>
                <LabelGroup text='Snap'>
                    <BooleanInput
                        type='toggle'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'gizmo.snap' }}
                    />
                </LabelGroup>
                <LabelGroup text='Snap Increment'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'gizmo.snapIncrement' }}
                        min={1}
                        max={10}
                        precision={0}
                    />
                </LabelGroup>
                <LabelGroup text='Drag Mode'>
                    <SelectInput
                        options={[
                            { v: 'show', t: 'Show' },
                            { v: 'hide', t: 'Hide' },
                            { v: 'selected', t: 'Selected' }
                        ]}
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'gizmo.dragMode' }}
                    />
                </LabelGroup>
                <LabelGroup text='Rotation Mode'>
                    <SelectInput
                        options={[
                            { v: 'absolute', t: 'Absolute' },
                            { v: 'orbit', t: 'Orbit' }
                        ]}
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'gizmo.rotationMode' }}
                    />
                </LabelGroup>
            </Panel>
            <Panel headerText='Theme'>
                <LabelGroup text='Shape Base X'>
                    <ColorPicker
                        channels={4}
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'gizmo.theme.shapeBase.x' }}
                    />
                </LabelGroup>
                <LabelGroup text='Shape Base Y'>
                    <ColorPicker
                        channels={4}
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'gizmo.theme.shapeBase.y' }}
                    />
                </LabelGroup>
                <LabelGroup text='Shape Base Z'>
                    <ColorPicker
                        channels={4}
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'gizmo.theme.shapeBase.z' }}
                    />
                </LabelGroup>
                <LabelGroup text='Shape Base XYZ'>
                    <ColorPicker
                        channels={4}
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'gizmo.theme.shapeBase.xyz' }}
                    />
                </LabelGroup>
                <LabelGroup text='Shape Base Face'>
                    <ColorPicker
                        channels={4}
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'gizmo.theme.shapeBase.f' }}
                    />
                </LabelGroup>
                <LabelGroup text='Shape Hover X'>
                    <ColorPicker
                        channels={4}
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'gizmo.theme.shapeHover.x' }}
                    />
                </LabelGroup>
                <LabelGroup text='Shape Hover Y'>
                    <ColorPicker
                        channels={4}
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'gizmo.theme.shapeHover.y' }}
                    />
                </LabelGroup>
                <LabelGroup text='Shape Hover Z'>
                    <ColorPicker
                        channels={4}
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'gizmo.theme.shapeHover.z' }}
                    />
                </LabelGroup>
                <LabelGroup text='Shape Hover XYZ'>
                    <ColorPicker
                        channels={4}
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'gizmo.theme.shapeHover.xyz' }}
                    />
                </LabelGroup>
                <LabelGroup text='Shape Hover Face'>
                    <ColorPicker
                        channels={4}
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'gizmo.theme.shapeHover.f' }}
                    />
                </LabelGroup>
                <LabelGroup text='Guide Base X'>
                    <ColorPicker
                        channels={4}
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'gizmo.theme.guideBase.x' }}
                    />
                </LabelGroup>
                <LabelGroup text='Guide Base Y'>
                    <ColorPicker
                        channels={4}
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'gizmo.theme.guideBase.y' }}
                    />
                </LabelGroup>
                <LabelGroup text='Guide Base Z'>
                    <ColorPicker
                        channels={4}
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'gizmo.theme.guideBase.z' }}
                    />
                </LabelGroup>
                <LabelGroup text='Guide Occlusion'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'gizmo.theme.guideOcclusion' }}
                        min={0}
                        max={1}
                        precision={2}
                    />
                </LabelGroup>
                <LabelGroup text='Disabled'>
                    <ColorPicker
                        channels={4}
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'gizmo.theme.disabled' }}
                    />
                </LabelGroup>
            </Panel>
            <Panel headerText='Intersection'>
                <LabelGroup text='Ring Tolerance'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'gizmo.ringTolerance' }}
                        min={0}
                        max={0.5}
                        precision={2}
                    />
                </LabelGroup>
            </Panel>
            <Panel headerText='Render'>
                <LabelGroup text='XYZ Tube Radius'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'gizmo.xyzTubeRadius' }}
                    />
                </LabelGroup>
                <LabelGroup text='XYZ Ring Radius'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'gizmo.xyzRingRadius' }}
                    />
                </LabelGroup>
                <LabelGroup text='Face Tube Radius'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'gizmo.faceTubeRadius' }}
                    />
                </LabelGroup>
                <LabelGroup text='Face Ring Radius'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'gizmo.faceRingRadius' }}
                        max={2}
                    />
                </LabelGroup>
                <LabelGroup text='Center Radius'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'gizmo.centerRadius' }}
                    />
                </LabelGroup>
                <LabelGroup text='Angle Guide Thickness'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'gizmo.angleGuideThickness' }}
                        min={0.001}
                        max={0.1}
                        step={0.01}
                        precision={3}
                    />
                </LabelGroup>
            </Panel>
            <Panel headerText='Camera'>
                <LabelGroup text='Projection'>
                    <SelectInput
                        options={[
                            { v: pc.PROJECTION_PERSPECTIVE + 1, t: 'Perspective' },
                            { v: pc.PROJECTION_ORTHOGRAPHIC + 1, t: 'Orthographic' }
                        ]}
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'camera.proj' }}
                        onSelect={value => setProj((parseInt(value, 10) || 1) - 1)}
                    />
                </LabelGroup>
                {proj === pc.PROJECTION_PERSPECTIVE && (
                    <LabelGroup text='FOV'>
                        <SliderInput
                            binding={new BindingTwoWay()}
                            link={{ observer, path: 'camera.fov' }}
                            min={30}
                            max={100}
                        />
                    </LabelGroup>
                )}
            </Panel>
        </>
    );
}
