import {
    BindingTwoWay,
    BooleanInput,
    ColorPicker,
    LabelGroup,
    Panel,
    SelectInput,
    SliderInput
} from '@playcanvas/pcui/react';
import { useState } from 'react';

import { PROJECTION_ORTHOGRAPHIC, PROJECTION_PERSPECTIVE } from 'playcanvas';

/**
 * @import { Observer } from '@playcanvas/observer'
 * @import { ReactElement } from 'react'
 */

/**
 * @param {{ observer: Observer }} props - The control panel props.
 * @returns {ReactElement} The control panel.
 */
export function Controls({ observer }) {
    const [proj, setProj] = useState(PROJECTION_PERSPECTIVE);
    const [subjectProj, setSubjectProj] = useState(PROJECTION_PERSPECTIVE);

    return (
        <>
            <Panel headerText='Theme'>
                <LabelGroup text='Base'>
                    <ColorPicker
                        channels={4}
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'gizmo.theme.base' }}
                    />
                </LabelGroup>
                <LabelGroup text='Occluded'>
                    <ColorPicker
                        channels={4}
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'gizmo.theme.occluded' }}
                    />
                </LabelGroup>
                <LabelGroup text='Fill'>
                    <ColorPicker
                        channels={4}
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'gizmo.theme.fill' }}
                    />
                </LabelGroup>
                <LabelGroup text='Primary'>
                    <ColorPicker
                        channels={4}
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'gizmo.theme.primary' }}
                    />
                </LabelGroup>
                <LabelGroup text='Secondary'>
                    <ColorPicker
                        channels={4}
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'gizmo.theme.secondary' }}
                    />
                </LabelGroup>
                <LabelGroup text='Tertiary'>
                    <ColorPicker
                        channels={4}
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'gizmo.theme.tertiary' }}
                    />
                </LabelGroup>
                <LabelGroup text='Backdrop'>
                    <ColorPicker
                        channels={4}
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'gizmo.theme.backdrop' }}
                    />
                </LabelGroup>
            </Panel>
            <Panel headerText='Layers'>
                <LabelGroup text='Handles'>
                    <BooleanInput
                        type='toggle'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'gizmo.handles' }}
                    />
                </LabelGroup>
                <LabelGroup text='Readout'>
                    <BooleanInput
                        type='toggle'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'gizmo.readout' }}
                    />
                </LabelGroup>
                <LabelGroup text='Icon'>
                    <BooleanInput
                        type='toggle'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'gizmo.icon' }}
                    />
                </LabelGroup>
            </Panel>
            <Panel headerText='Render'>
                <LabelGroup text='Line Thickness'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'gizmo.lineThickness' }}
                        min={1}
                        max={10}
                        precision={1}
                    />
                </LabelGroup>
                <LabelGroup text='Handle Size'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'gizmo.handleSize' }}
                        min={2}
                        max={20}
                        precision={1}
                    />
                </LabelGroup>
                <LabelGroup text='Icon Size'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'gizmo.iconSize' }}
                        min={8}
                        max={64}
                        precision={0}
                    />
                </LabelGroup>
            </Panel>
            <Panel headerText='Snap'>
                <LabelGroup text='Snap'>
                    <BooleanInput
                        type='toggle'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'gizmo.snap' }}
                    />
                </LabelGroup>
                <LabelGroup text='Increment'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'gizmo.snapIncrement' }}
                        min={0.05}
                        max={2}
                        precision={2}
                    />
                </LabelGroup>
                <LabelGroup text='Angle Increment'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'gizmo.snapAngleIncrement' }}
                        min={1}
                        max={45}
                        precision={0}
                    />
                </LabelGroup>
            </Panel>
            <Panel headerText='Subject'>
                <LabelGroup text='Projection'>
                    <SelectInput
                        options={[
                            { v: PROJECTION_PERSPECTIVE + 1, t: 'Perspective' },
                            { v: PROJECTION_ORTHOGRAPHIC + 1, t: 'Orthographic' }
                        ]}
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'subject.proj' }}
                        onSelect={(value) => setSubjectProj((parseInt(value, 10) || 1) - 1)}
                    />
                </LabelGroup>
                {subjectProj === PROJECTION_PERSPECTIVE ? (
                    <LabelGroup text='FOV'>
                        <SliderInput
                            binding={new BindingTwoWay()}
                            link={{ observer, path: 'subject.fov' }}
                            min={10}
                            max={120}
                        />
                    </LabelGroup>
                ) : (
                    <LabelGroup text='Ortho Height'>
                        <SliderInput
                            binding={new BindingTwoWay()}
                            link={{ observer, path: 'subject.orthoHeight' }}
                            min={0.5}
                            max={5}
                            precision={2}
                        />
                    </LabelGroup>
                )}
                <LabelGroup text='Near Clip'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'subject.nearClip' }}
                        min={0.1}
                        max={2}
                        precision={2}
                    />
                </LabelGroup>
                <LabelGroup text='Far Clip'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'subject.farClip' }}
                        min={2}
                        max={10}
                        precision={1}
                    />
                </LabelGroup>
            </Panel>
            <Panel headerText='Camera'>
                <LabelGroup text='Projection'>
                    <SelectInput
                        options={[
                            { v: PROJECTION_PERSPECTIVE + 1, t: 'Perspective' },
                            { v: PROJECTION_ORTHOGRAPHIC + 1, t: 'Orthographic' }
                        ]}
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'camera.proj' }}
                        onSelect={(value) => setProj((parseInt(value, 10) || 1) - 1)}
                    />
                </LabelGroup>
                {proj === PROJECTION_PERSPECTIVE && (
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
