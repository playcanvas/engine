import {
    BindingTwoWay,
    BooleanInput,
    Button,
    Label,
    LabelGroup,
    Panel,
    SliderInput
} from '@playcanvas/pcui/react';

/**
 * @import { Observer } from '@playcanvas/observer'
 * @import { ReactElement } from 'react'
 */

/**
 * The controls of one light type: its settings, which apply to every light of the type, and the
 * buttons adding and removing lights of it.
 *
 * @param {object} props - The props.
 * @param {Observer} props.observer - The observer.
 * @param {string} props.type - The light type: 'omni', 'spot' or 'directional'.
 * @param {boolean} [props.cookie] - Whether the type has a cookie intensity setting.
 * @returns {ReactElement} The controls.
 */
function LightControls({ observer, type, cookie = false }) {
    return (
        <>
            <LabelGroup text='enabled'>
                <BooleanInput
                    type='toggle'
                    binding={new BindingTwoWay()}
                    link={{ observer, path: `lights.${type}.enabled` }}
                />
            </LabelGroup>
            <LabelGroup text='intensity'>
                <SliderInput
                    binding={new BindingTwoWay()}
                    link={{ observer, path: `lights.${type}.intensity` }}
                />
            </LabelGroup>
            <LabelGroup text='shadow intensity'>
                <SliderInput
                    binding={new BindingTwoWay()}
                    link={{ observer, path: `lights.${type}.shadowIntensity` }}
                />
            </LabelGroup>
            {cookie && (
                <LabelGroup text='cookie'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: `lights.${type}.cookieIntensity` }}
                    />
                </LabelGroup>
            )}
            <Button text='Add Light' onClick={() => observer.emit('add', type)} />
            <Button text='Remove Light' onClick={() => observer.emit('remove', type)} />
            <LabelGroup text='light count'>
                <Label
                    binding={new BindingTwoWay()}
                    link={{ observer, path: `lights.${type}.count` }}
                    value={observer.get(`lights.${type}.count`)}
                />
            </LabelGroup>
        </>
    );
}

/**
 * @param {{ observer: Observer }} props - The control panel props.
 * @returns {ReactElement} The control panel.
 */
export function Controls({ observer }) {
    return (
        <>
            <Panel headerText='OMNI LIGHTS [KEY_1]'>
                <LightControls observer={observer} type='omni' cookie />
            </Panel>
            <Panel headerText='SPOT LIGHTS [KEY_2]'>
                <LightControls observer={observer} type='spot' cookie />
            </Panel>
            <Panel headerText='DIRECTIONAL LIGHTS [KEY_3]'>
                <LightControls observer={observer} type='directional' />
            </Panel>
            <Panel headerText='MATERIAL'>
                <LabelGroup text='flat shading'>
                    <BooleanInput
                        type='toggle'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'material.flatShading' }}
                    />
                </LabelGroup>
            </Panel>
            <Panel headerText='DEBUG'>
                <LabelGroup text='light shapes'>
                    <BooleanInput
                        type='toggle'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'debug.lightShapes' }}
                    />
                </LabelGroup>
            </Panel>
        </>
    );
}
