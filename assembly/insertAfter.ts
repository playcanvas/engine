// https://github.com/AssemblyScript/assemblyscript/issues/1501
// Temporary replacement for Array#splice (which requires unsupported variadic arguments)

export function insertAfter<T>(arr: T[], index: i32, value: T): T[] {
    const len = arr.length + 1
    const res = new Array<T>(len)
    if (index < 0) index = len + index - 1
    if (index > len) index = len - 1
    let i = 0
    while (i < index) res[i] = arr[i++]
    res[i++] = value
    while (i < len) res[i] = arr[i++ - 1]
    return res
}

// intead fruits.splice(2, 0, "Lemon", "Kiwi") use:
// insertAfter(fruits, 2, "Lemon");
// insertAfter(fruits, 3 "Kiwi");

