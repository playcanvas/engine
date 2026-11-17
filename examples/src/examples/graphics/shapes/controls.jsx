import {
    BindingTwoWay,
    BooleanInput,
    LabelGroup,
    Panel,
    SliderInput
} from '@playcanvas/pcui/react';

/**
 * @import { Observer } from '@playcanvas/observer'
 * @import { ReactElement } from 'react'
 */

/**
 * @param {{ observer: Observer }} props - The control panel props.
 * @returns {ReactElement} The control panel.
 */
export function Controls({ observer }) {
    return (
        <>
            <Panel headerText='Settings'>
                <LabelGroup text='Texture'>
                    <BooleanInput
                        type='toggle'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'settings.texture' }}
                        value={observer.get('settings.texture')}
                    />
                </LabelGroup>
                <LabelGroup text='Wireframe'>
                    <BooleanInput
                        type='toggle'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'settings.wireframe' }}
                        value={observer.get('settings.wireframe')}
                    />
                </LabelGroup>
                <LabelGroup text='Metalness'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'settings.metalness' }}
                        min={0}
                        max={1}
                        precision={2}
                    />
                </LabelGroup>
                <LabelGroup text='Gloss'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'settings.gloss' }}
                        min={0}
                        max={1}
                        precision={2}
                    />
                </LabelGroup>
            </Panel>
            <Panel headerText='Rounded Box'>
                <LabelGroup text='Radius'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'settings.radius' }}
                        min={0}
                        max={0.5}
                        precision={2}
                    />
                </LabelGroup>
                <LabelGroup text='Segments'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'settings.radiusSegments' }}
                        min={2}
                        max={16}
                        precision={0}
                    />
                </LabelGroup>
            </Panel>
        </>
    );
}
