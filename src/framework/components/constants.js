// The order of the component systems, see ComponentSystem.order.
//
// Each frame the application fires four phases, in this order. The systems handling a phase run
// in ascending order, so a system ordered before SYSTEMORDER_SCRIPT runs before the scripts in
// every phase it handles, and a system ordered after it runs after them:
//
//   update            joints -> SCRIPTS update -> sound, particles, UI, sprites
//   physicsUpdate     rigid body: physics simulated
//   animationUpdate   anim: animations evaluated, bones posed
//   postUpdate        joints -> SCRIPTS postUpdate (for example IK on the posed bones) -> layout
//
// The order is also the order in which the components of an entity are enabled and disabled, and
// in which the components of a loaded entity are created, so for example a rigid body comes before
// its collision. The values are spaced apart, so that a system can be placed between two others.

// --- before scripts ------------------------------------------------------------------------------

export const SYSTEMORDER_RIGIDBODY = 100;        // physicsUpdate, after scripts' update
export const SYSTEMORDER_COLLISION = 200;        // no phase
export const SYSTEMORDER_JOINT = 300;            // update, postUpdate
export const SYSTEMORDER_ANIM = 400;             // animationUpdate, after scripts' update
export const SYSTEMORDER_MODEL = 500;            // no phase
export const SYSTEMORDER_RENDER = 600;           // no phase
export const SYSTEMORDER_CAMERA = 700;           // no phase
export const SYSTEMORDER_LIGHT = 800;            // no phase

// --- scripts -------------------------------------------------------------------------------------

export const SYSTEMORDER_SCRIPT = 900;           // update, postUpdate
export const SYSTEMORDER_DEFAULT = 950;          // custom systems, unless they set their own

// --- after scripts -------------------------------------------------------------------------------

export const SYSTEMORDER_SOUND = 1000;           // update: uses the transforms scripts set
export const SYSTEMORDER_AUDIOLISTENER = 1100;   // update: uses the transforms scripts set
export const SYSTEMORDER_PARTICLESYSTEM = 1200;  // update: emits from the transforms scripts set
export const SYSTEMORDER_SCREEN = 1300;          // update
export const SYSTEMORDER_ELEMENT = 1400;         // no phase
export const SYSTEMORDER_BUTTON = 1500;          // update
export const SYSTEMORDER_SCROLLVIEW = 1600;      // update
export const SYSTEMORDER_SCROLLBAR = 1700;       // no phase
export const SYSTEMORDER_SPRITE = 1800;          // update: advances clips from what scripts set
export const SYSTEMORDER_LAYOUTGROUP = 1900;     // postUpdate: reflows after scripts' postUpdate
export const SYSTEMORDER_LAYOUTCHILD = 2000;     // no phase
export const SYSTEMORDER_ZONE = 2100;            // no phase
export const SYSTEMORDER_GSPLAT = 2200;          // no phase
