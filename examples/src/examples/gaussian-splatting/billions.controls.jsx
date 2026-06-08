import {
    BindingTwoWay,
    LabelGroup,
    BooleanInput,
    Panel,
    SliderInput,
    Label
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
                <LabelGroup text='Instances'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'instances' }}
                        min={1}
                        max={100}
                        precision={0}
                        step={1}
                    />
                </LabelGroup>
                <LabelGroup text='Colorize LODs'>
                    <BooleanInput
                        type='toggle'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'colorizeLods' }}
                        value={observer.get('colorizeLods') || false}
                    />
                </LabelGroup>
                <LabelGroup text='Sky Rotation'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'skyRotation' }}
                        min={0}
                        max={360}
                        precision={0}
                        step={1}
                    />
                </LabelGroup>
            </Panel>
            <Panel headerText='Stats'>
                <LabelGroup text='Total Splats'>
                    <Label
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.stats.splatsTotal' }}
                        value={observer.get('data.stats.splatsTotal')}
                    />
                </LabelGroup>
                <LabelGroup text='Active Splats'>
                    <Label
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.stats.gsplats' }}
                        value={observer.get('data.stats.gsplats')}
                    />
                </LabelGroup>
            </Panel>
        </>
    );
}
