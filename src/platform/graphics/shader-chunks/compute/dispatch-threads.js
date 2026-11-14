/**
 * WGSL compute shader chunk giving access to the threads of a dispatch set up using
 * {@link Compute#setupDispatchThreads}.
 *
 * Usage in compute shaders: #include "dispatchThreadsCS"
 *
 * Provides:
 * - dispatchThreadCount() -> vec3u: the number of threads the dispatch was set up for.
 * - dispatchThreadInRange(globalId: vec3u) -> bool: true when the thread is one of those threads.
 * The dispatch is rounded up to whole workgroups, and the threads beyond the count exit early.
 * - dispatchThreadIndex(globalId: vec3u) -> u32: the linear index of the thread, x varying fastest.
 *
 * A dispatch of threads in one dimension which needs more workgroups than a single dimension holds
 * is spread over rows of workgroups, and the functions account for that.
 *
 * @ignore
 */
export default /* wgsl */`
// the number of threads the dispatch was set up for
uniform computeDispatchThreadCount: vec3u;

// the number of threads in a row of the dispatch - the x of the thread count, or the threads in a
// row of workgroups when a dispatch in one dimension is spread over rows of them
uniform computeDispatchRowThreads: u32;

fn dispatchThreadCount() -> vec3u {
    return uniform.computeDispatchThreadCount;
}

fn dispatchThreadIndex(globalId: vec3u) -> u32 {
    let count = uniform.computeDispatchThreadCount;
    return (globalId.z * count.y + globalId.y) * uniform.computeDispatchRowThreads + globalId.x;
}

fn dispatchThreadInRange(globalId: vec3u) -> bool {
    let count = uniform.computeDispatchThreadCount;

    // spread over rows of workgroups, a dispatch in one dimension is rounded up to whole rows
    if (uniform.computeDispatchRowThreads != count.x) {
        return dispatchThreadIndex(globalId) < count.x;
    }
    return all(globalId < count);
}
`;
