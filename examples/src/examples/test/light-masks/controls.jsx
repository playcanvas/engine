import { BindingTwoWay, BooleanInput, LabelGroup, Panel } from '@playcanvas/pcui/react';

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
            <Panel headerText='Real-time lights'>
                <LabelGroup text='🔵 Dynamic only'>
                    <BooleanInput
                        type='toggle'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.dynamicOnly' }}
                        value={observer.get('data.dynamicOnly')}
                    />
                </LabelGroup>
                <LabelGroup text='🔴 Baked only'>
                    <BooleanInput
                        type='toggle'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.lightmappedOnly' }}
                        value={observer.get('data.lightmappedOnly')}
                    />
                </LabelGroup>
                <LabelGroup text='⚪ Affect all'>
                    <BooleanInput
                        type='toggle'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.affectAll' }}
                        value={observer.get('data.affectAll')}
                    />
                </LabelGroup>
            </Panel>
            <Panel headerText='Baked light'>
                <LabelGroup text='🟢 Bake only'>
                    <BooleanInput
                        type='toggle'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.bakeOnly' }}
                        value={observer.get('data.bakeOnly')}
                    />
                </LabelGroup>
            </Panel>
        </>
    );
}
