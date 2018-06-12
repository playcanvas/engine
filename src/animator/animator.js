pc.extend(pc, function () {


// *===============================================================================================================
// * class AnimationKeyable
// *
// *===============================================================================================================
var AnimationKeyableType = { NUM: 0, VEC: 1, QUAT: 2 };
var AnimationKeyable = function AnimationKeyable(type, time, value) {
    this.init(type, time, value);
};

AnimationKeyable.prototype.init = function (type, time, value) {
    this.type = type || AnimationKeyableType.NUM;
    this.time = time || 0;
    if (value)
        this.value = value;
    else {
        switch(type) {
            case AnimationKeyableType.NUM: this.value = 0; break;
            case AnimationKeyableType.VEC: this.value = new pc.Vec3(); break;
            case AnimationKeyableType.QUAT: this.value = new pc.Quat(); break;
        }
    }
    return this;
};

AnimationKeyable.prototype.copy = function (keyable) {
    if(!keyable)
        return this;

    var value = keyable.value;
    if(keyable.value instanceof pc.Vec3 || keyable.value instanceof pc.Quat)
        value = keyable.value.clone();

    this.init(keyable.type, keyable.time, value);
    return this;
};

AnimationKeyable.prototype.clone = function () {
    var value = this.value;
    if(this.value instanceof pc.Vec3 || this.value instanceof pc.Quat)
        value = this.value.clone();
    var cloned = new AnimationKeyable(this.type, this.time, value);
    return cloned;
};

// static function for lack of overloaded operator
// return keyable1 + keyable2
AnimationKeyable.sum = function (keyable1, keyable2) {
    if (!keyable1 || !keyable2 || keyable1.type != keyable2)
        return null;

    var resKeyable = new AnimationKeyable(keyable1.type);
    switch(keyable1.type) {
        case AnimationKeyableType.NUM: resKeyable.value = keyable1.value + keyable2.value; break;
        case AnimationKeyableType.VEC: resKeyable.value.add2(keyable1.value, keyable2.value); break;
        case AnimationKeyableType.QUAT:
            resKeyable.value.x = keyable1.value.x + keyable2.value.x;
            resKeyable.value.y = keyable1.value.y + keyable2.value.y;
            resKeyable.value.z = keyable1.value.z + keyable2.value.z;
            resKeyable.value.w = keyable1.value.w + keyable2.value.w; break;
    }
    return resKeyable;
};

// return keyable1 - keyable2
AnimationKeyable.minus = function (keyable1, keyable2) {
    if (!keyable1 || !keyable2 || keyable1.type != keyable2)
        return null;

    var resKeyable = new AnimationKeyable(keyable1.type);
    switch(keyable1.type) {
        case AnimationKeyableType.NUM: resKeyable.value = keyable1.value - keyable2.value; break;
        case AnimationKeyableType.VEC: resKeyable.value.sub2(keyable1.value, keyable2.value); break;
        case AnimationKeyableType.QUAT:
            resKeyable.value.x = keyable1.value.x - keyable2.value.x;
            resKeyable.value.y = keyable1.value.y - keyable2.value.y;
            resKeyable.value.z = keyable1.value.z - keyable2.value.z;
            resKeyable.value.w = keyable1.value.w - keyable2.value.w; break;
    }
    return resKeyable;
};

// return keyable * coeff
AnimationKeyable.mul = function (keyable, coeff) {
    if (!keyable)
        return null;

    var resKeyable = new AnimationKeyable();
    resKeyable.copy(keyable);
    switch(keyable.type) {
        case AnimationKeyableType.NUM: resKeyable.value *= coeff; break;
        case AnimationKeyableType.VEC: resKeyable.value.scale(coeff); break;
        case AnimationKeyableType.QUAT:
            resKeyable.value.x *= coeff;
            resKeyable.value.y *= coeff;
            resKeyable.value.z *= coeff;
            resKeyable.value.w *= coeff; break;
    }
    return resKeyable;
};

// return keyable / coeff
AnimationKeyable.div = function (keyable, coeff) {
    if (coeff === 0)
        return null;

    return AnimationKeyable.mul(keyable, 1 / coeff);
};

AnimationKeyable.linearBlend = function (keyable1, keyable2, p) {
    if (!keyable1 || !keyable2 || keyable1.type !== keyable2.type)
        return null;

    var resKeyable = new AnimationKeyable(keyable1.type);
    if (p === 0) {
        resKeyable.copy(keyable1);
        return resKeyable;
    }

    if (p === 1) {
        resKeyable.copy(keyable2);
        return resKeyable;
    }

    switch(keyable1.type) {
        case AnimationKeyableType.NUM:
            resKeyable.value = (1 - p) * keyable1.value + p * keyable2.value; break;
        case AnimationKeyableType.VEC:
            resKeyable.value.lerp(keyable1.value, keyable2.value, p); break;
        case AnimationKeyableType.QUAT:
            resKeyable.value.slerp(keyable1.value, keyable2.value, p); break;
    }
    return resKeyable;
};

AnimationKeyable.linearBlendValue = function (value1, value2, p) {
    var valRes;

    if (typeof value1 === "number" && typeof value2 === "number") {
        return (1 - p) * value1 + p * value2;
    }

    if ((value1 instanceof pc.Vec3 && value2 instanceof pc.Vec3) ||
       (value1 instanceof pc.Vec2 && value2 instanceof pc.Vec2)  ||
       (value1 instanceof pc.Vec4 && value2 instanceof pc.Vec4)) {
        valRes = value1.clone();
        valRes.lerp(value1, value2, p);
        return valRes;
    }

    if (value1 instanceof pc.Quat && value2 instanceof pc.Quat) {
        valRes = value1.clone();
        valRes.slerp(value1, value2, p);
        return valRes;
    }
    return null;
};

// *===============================================================================================================
// * class AnimationTarget: organize target into an object, this allows 1-Curve-Multiple-Targets
// *                        one AnimationCurve has a [] collection of AnimationTargets
// *                        one Animation has a {} dictionary of AnimationTargets, keyname matches curvename
// *===============================================================================================================
var AnimationTarget = function AnimationTarget(targetNode, targetPath, targetProp) {
    this.targetNode = targetNode;
    this.targetPath = targetPath;
    this.targetProp = targetProp;
};

//blend related
AnimationTarget.prototype.toString = function(){
    var str = "";
    if(this.targetNode)
        str += this.targetNode.name;
    if(this.targetPath)
        str += ("_" + this.targetPath);
    if(this.targetProp)
        str += ("_" + this.targetProp);
    return str;
};

AnimationTarget.prototype.copy = function (target) {
    if (target) {
        this.targetNode = target.targetNode;
        this.targetPath = target.targetPath;
        this.targetProp = target.targetProp;
    }
    return this;
};

AnimationTarget.prototype.clone = function () {
    var cloned = new AnimationTarget(this.targetNode, this.targetPath, this.targetProp);
    return cloned;
};

// based on current target[path]'s value, blend in value by p
AnimationTarget.prototype.blendToTarget = function (value, p) {
    if ((typeof value === "undefined") || p > 1 || p <= 0)// p===0 remain prev
        return;

     // target needs scaling for retargetting
    if (this.targetPath === "localPosition" && (this.vScale instanceof pc.Vec3)) {
        if (value instanceof pc.Vec3) {
            value.x *= this.vScale.x;
            value.y *= this.vScale.y;
            value.z *= this.vScale.z;
        } else if ((typeof value === "number") && (typeof this.vScale[this.targetProp] === "number")) {
            value *= this.vScale[this.targetProp];
        }
    }

    if (p === 1) {
        this.updateToTarget(value);
        return;
    }

    // p*cur + (1-p)*prev
    if (this.targetNode && this.targetNode.hasOwnProperty(this.targetPath)) {
        var blendValue;
        if (this.targetProp && this.targetProp in this.targetNode[this.targetPath]) {
            blendValue = AnimationKeyable.linearBlendValue(this.targetNode[this.targetPath][this.targetProp], value, p);
            this.targetNode[this.targetPath][this.targetProp] = blendValue;
        } else {
            blendValue = AnimationKeyable.linearBlendValue(this.targetNode[this.targetPath], value, p);
            this.targetNode[this.targetPath] = blendValue;
        }

        // special wrapping for eulerangles
        if (this.targetPath == "localEulerAngles") {
            var vec3 = new pc.Vec3();
            if (this.targetProp === "x" || this.targetProp === "y" || this.targetProp === "z")
                vec3[this.targetProp] = blendValue;
            else
                vec3 = blendValue;
            this.targetNode.setLocalEulerAngles(vec3);
        }

        // execute update target
        this.targetNode._dirtify(true);
    }

    /* /special wrapping for morph weights
    if (this.targetNode && this.targetPath === "weights" && this.targetNode.model)
    {
        var meshInstances = this.targetNode.model.meshInstances;
        for (var m = 0; m < meshInstances.length; m++)
        {
            var morphInstance = meshInstances[m].morphInstance;
            if (!morphInstance) continue;
            morphInstance.setWeight(this.targetProp, keyable.value);
        }
    }*/
};

AnimationTarget.prototype.updateToTarget = function (value) {
    if ((typeof value === "undefined"))
        return;

    // target needs scaling for retargetting
    if (this.targetPath === "localPosition" && (this.vScale instanceof pc.Vec3)) {
        if (value instanceof pc.Vec3) {
            value.x *= this.vScale.x;
            value.y *= this.vScale.y;
            value.z *= this.vScale.z;
        } else if ((typeof value === "number") && (typeof this.vScale[this.targetProp] === "number")) {
            value *= this.vScale[this.targetProp];
        }
    }

    if (this.targetNode && this.targetNode.hasOwnProperty(this.targetPath)) {
        if (this.targetProp && this.targetProp in this.targetNode[this.targetPath])
            this.targetNode[this.targetPath][this.targetProp] = value;
        else
            this.targetNode[this.targetPath] = value;

        // special wrapping for eulerangles
        if (this.targetPath == "localEulerAngles") {
            var vec3 = new pc.Vec3();
            if (this.targetProp === "x" || this.targetProp === "y" || this.targetProp === "z")
                vec3[this.targetProp] = value;
            else
                vec3 = value;
            this.targetNode.setLocalEulerAngles(vec3);
        }

        // execute update target
        this.targetNode._dirtify(true);
    }

    // special wrapping for morph weights
    if (this.targetNode && this.targetPath === "weights" && this.targetNode.model) {
        var meshInstances = this.targetNode.model.meshInstances;
        for (var m = 0; m < meshInstances.length; m++) {
            var morphInstance = meshInstances[m].morphInstance;
            if (!morphInstance) continue;
            morphInstance.setWeight(this.targetProp, value);
        }
    }
};

// static function
AnimationTarget.constructTargetNodes = function (root, vec3Scale) {
    if (!root)
        return;

    var vScale = vec3Scale || new pc.Vec3(1, 1, 1);
    var rootTargetNode = new AnimationTarget(root);
    if (root.localScale)
        rootTargetNode.vScale = new pc.Vec3(root.localScale.x * vScale.x, root.localScale.y * vScale.y, root.localScale.z * vScale.z);

    var arTargetsAll = [rootTargetNode];
    for (var i = 0; i < root.children.length; i ++) {
        var arTargets = AnimationTarget.constructTargetNodes(root.children[i], rootTargetNode.vScale);
        if (arTargets)
            arTargetsAll = arTargetsAll.concat(arTargets);
    }
    return arTargetsAll;
};

// static function
AnimationTarget.getLocalScale = function (node) {
    if (!node)
        return;

    var vScale = new pc.Vec3(1, 1, 1);
    var curNode = node;
    while(curNode) {
        if (curNode.localScale) {
            vScale.x *= curNode.localScale.x;
            vScale.y *= curNode.localScale.y;
            vScale.z *= curNode.localScale.z;
        }
        curNode = curNode.parent;
    }
    return vScale;
};

// *===============================================================================================================
// * class AnimationCurve: each curve corresponds to one channel
// * member
// *        animKeys: an array of Keys (knots) on the curve
// *        type: how to interpolate between keys.
// *
// *===============================================================================================================
var AnimationCurveType = { LINEAR: 0, STEP: 1, CUBIC: 2 };

var AnimationCurve = function AnimationCurve() {
    AnimationCurve.count ++;
    this.name = "curve" + AnimationCurve.count.toString();
    this.type = AnimationCurveType.LINEAR;
    this.keyableType = AnimationKeyableType.NUM;
    this.tension = 0.5;// 0.5 catmul-rom
    this.animTargets = [];// allow multiple targets
    this.duration = 0;
    this.animKeys = [];
    this.clip = new AnimationClip(null, this);//null for _component
};
AnimationCurve.count = 0;

// getter and setter
Object.defineProperty(AnimationCurve.prototype, 'isPlaying', {
    get: function () {
        return this.clip._isPlaying;
    },
    set: function (isPlaying) {
        this.clip._isPlaying = isPlaying;
    }
});
Object.defineProperty(AnimationCurve.prototype, 'loop', {
    get: function () {
        return this.clip._loop;
    },
    set: function (loop) {
        this.clip._loop = loop;
    }
});
Object.defineProperty(AnimationCurve.prototype, 'speed', {
    get: function () {
        return this.clip._speed;
    },
    set: function (speed) {
        this.clip._speed = speed;
    }
});

AnimationCurve.prototype.copy = function (curve) {
    var i;

    this.name = curve.name;
    this.type = curve.type;
    this.keyableType = curve.keyableType;
    this.tension = curve.tension;
    this.duration = curve.duration;

    this.animTargets = [];
    for (i = 0; i < curve.animTargets.length; i ++)
        this.animTargets.push(curve.animTargets[i].clone());

    this.animKeys = [];
    for (i = 0; i < curve.animKeys.length; i ++) {
        var key = new AnimationKeyable();
        key.copy(curve.animKeys[i]);
        this.animKeys.push(key);
    }
    return this;
};

AnimationCurve.prototype.clone = function () {
    var cloned = new AnimationCurve().copy(this);
    return cloned;
};

AnimationCurve.prototype.addTarget = function (targetNode, targetPath, targetProp) {
    var target = new AnimationTarget(targetNode, targetPath, targetProp);
    this.animTargets.push(target);
};

AnimationCurve.prototype.setTarget = function (targetNode, targetPath, targetProp) {
    this.animTargets = [];
    this.addTarget(targetNode, targetPath, targetProp);
};

AnimationCurve.prototype.clearTargets = function () {
    this.animTargets = [];
};

AnimationCurve.prototype.resetClip = function () {
    this.clip._playable = this;
    this.clip._animTargets = this.getAnimTargets();
    this.clip._isPlaying = true;
    this.clip._begTime = 0;
    this.clip._endTime = this.duration;
    this.clip._curTime = 0;
    this.clip._speed = 1;
    this.clip._loop = true;
};

AnimationCurve.prototype.blendToTarget = function (keyable, p) {
    this.clip.blendToTarget(keyable, p);
};

AnimationCurve.prototype.updateToTarget = function (keyable) {
    this.clip.updateToTarget(keyable);
};
// this.animTargets wrapped in object, with curve name
AnimationCurve.prototype.getAnimTargets = function () {
    var result = {};
    result[this.name] = this.animTargets;// an array []
    return result;
};

// events related
AnimationCurve.prototype.on = function (name, time, fnCallback, context, parameter) {
    if (this.clip)
        this.clip.on(name, time, fnCallback, context, parameter);
    return this;
};

AnimationCurve.prototype.off = function (name, time, fnCallback) {
    if (this.clip)
        this.clip.off(name, time, fnCallback);
    return this;
};

AnimationCurve.prototype.removeAllEvents = function () {
    if (this.clip)
        this.clip.removeAllEvents();
    return this;
};

AnimationCurve.prototype.fadeIn = function (duration) {
    this.clip.fadeIn(duration, this);
};

AnimationCurve.prototype.fadeOut = function (duration) {
    this.clip.fadeOut(duration);
};

AnimationCurve.prototype.play = function () {
    this.clip.play(this);
};

AnimationCurve.prototype.resume = function () {
    this.clip.resume();
};

AnimationCurve.prototype.stop = function () {
    this.clip.stop();
};

AnimationCurve.prototype.pause = function () {
    this.clip.pause();
};

AnimationCurve.prototype.showAt = function (time, fadeDir, fadeBegTime, fadeEndTime, fadeTime) {
    this.clip.showAt(time, fadeDir, fadeBegTime, fadeEndTime, fadeTime);
};

AnimationCurve.prototype.setAnimKeys = function (animKeys) {
    this.animKeys = animKeys;
};

AnimationCurve.prototype.insertKey = function (type, time, value) {
    if (this.keyableType != type)
        return;

    var pos = 0;
    while(pos < this.animKeys.length && this.animKeys[pos].time < time)
        pos ++;

    // replace if existed at time
    if (pos < this.animKeys.length && this.animKeys[pos].time == time) {
        this.animKeys[pos].value = value;
        return;
    }

    var keyable = new AnimationKeyable(type, time, value);

    // append at the back
    if (pos >= this.animKeys.length) {
        this.animKeys.push(keyable);
        this.duration = time;
        return;
    }

    // insert at pos
    this.animKeys.splice(pos, 0, keyable);
};

AnimationCurve.prototype.removeKey = function (index) {
    if (index <= this.animKeys.length) {
        if (index == this.animKeys.length - 1)
            this.duration = (index - 1) >= 0 ? this.animKeys[index - 1].time : 0;
        this.animKeys.splice(index, 1);
    }
};

AnimationCurve.prototype.removeAllKeys = function () {
    this.animKeys = [];
    this.duration = 0;
};

AnimationCurve.prototype.shiftKeyTime = function (time) {
    for (var i = 0; i < this.animKeys.length; i ++)
        this.animKeys[i].time += time;
};

AnimationCurve.prototype.getSubCurve = function (tmBeg, tmEnd) {
    var i;
    var subCurve = new AnimationCurve();
    subCurve.type = this.type;
    subCurve.name = this.name + "_sub";
    subCurve.keyableType = this.keyableType;
    subCurve.animTargets = this.animTargets;
    subCurve.tension = this.tension;

    subCurve.animTargets = [];
    for (i = 0; i < this.animTargets.length; i ++)
        subCurve.animTargets.push(this.animTargets[i].clone());

    var tmFirst = -1;
    for (i = 0; i < this.animKeys.length; i++) {
        if (this.animKeys[i].time >= tmBeg && this.animKeys[i].time <= tmEnd) {
            if (tmFirst < 0)
                tmFirst = this.animKeys[i].time;

            var key = new AnimationKeyable().copy(this.animKeys[i]);
            key.time -= tmFirst;
            subCurve.animKeys.push(key);
        }
    }

    subCurve.duration = (tmFirst === -1) ? 0 : (tmEnd - tmFirst);
    return subCurve;
};

AnimationCurve.prototype.evalLINEAR = function (time) {
    if (!this.animKeys || this.animKeys.length === 0)
        return null;

    // 1. find the interval [key1, key2]
    var resKey = new AnimationKeyable();
    var key1, key2;
    for (var i = 0; i < this.animKeys.length; i ++) {
        if (this.animKeys[i].time === time) {
            resKey.copy(this.animKeys[i]);
            return resKey;
        }

        if (this.animKeys[i].time > time) {
            key2 = this.animKeys[i];
            break;
        }
        key1 = this.animKeys[i];
    }

    // 2. only found one boundary
    if (!key1 || !key2) {
        resKey.copy(key1 ? key1 : key2);
        resKey.time = time;
        return resKey;
    }

    // 3. both found then interpolate
    var p = (time - key1.time) / (key2.time - key1.time);
    resKey = AnimationKeyable.linearBlend(key1, key2, p);
    resKey.time = time;
    return resKey;
};

AnimationCurve.prototype.evalSTEP = function (time) {
    if (!this.animKeys || this.animKeys.length === 0)
        return null;

    var key = this.animKeys[0];
    for (var i = 1; i < this.animKeys.length; i ++) {
        if (this.animKeys[i].time <= time)
            key = this.animKeys[i];
        else
            break;
    }
    var resKey = new AnimationKeyable();
    resKey.copy(key);
    resKey.time = time;
    return resKey;
};

AnimationCurve.prototype.evalCUBIC = function (time) {
    if (!this.animKeys || this.animKeys.length === 0)
        return null;

    // 1. find interval [key1, key2] enclosing time
    // key0, key3 are for tangent computation
    var key0, key1, key2, key3;
    var resKey = new AnimationKeyable();
    for (var i = 0; i < this.animKeys.length; i ++) {
        if (this.animKeys[i].time === time) {
            resKey.copy(this.animKeys[i]);
            return resKey;
        }
        if (this.animKeys[i].time > time) {
            key2 = this.animKeys[i];
            if (i + 1 < this.animKeys.length)
                key3 = this.animKeys[i + 1];
            break;
        }
        key1 = this.animKeys[i];
        if (i - 1 >= 0)
            key0 = this.animKeys[i - 1];
    }

    // 2. only find one boundary
    if (!key1 || !key2) {
        resKey.copy(key1 ? key1 : key2);
        resKey.time = time;
        return resKey;
    }

    // 3. curve interpolation
    if (key1.type == AnimationKeyableType.NUM || key1.type == AnimationKeyableType.VEC) {
        resKey = AnimationCurve.cubicCardinal(key0, key1, key2, key3, time, this.tension);
        resKey.time = time;
        return resKey;
    }
    return null;// quaternion or combo
};

AnimationCurve.prototype.eval = function (time) {
    if (!this.animKeys || this.animKeys.length === 0)
        return null;

    switch(this.type) {
        case AnimationCurveType.LINEAR: return this.evalLINEAR(time);
        case AnimationCurveType.STEP: return this.evalSTEP(time);
        case AnimationCurveType.CUBIC:
            if (this.keyableType == AnimationKeyableType.QUAT)
                return this.evalLINEAR(time);
            return this.evalCUBIC(time);
    }
    return null;
};

// static method: tangent 1, value 1, tangent 2, value 2, proportion
AnimationCurve.cubicHermite = function (t1, v1, t2, v2, p) {
    // basis
    var p2 = p * p;
    var p3 = p2 * p;
    var h0 = 2 * p3 - 3 * p2 + 1;
    var h1 = -2 * p3 + 3 * p2;
    var h2 = p3 - 2 * p2 + p;
    var h3 = p3 - p2;

    // interpolation
    return v1 * h0 + v2 * h1 + t1 * h2 + t2 * h3;
};

// static: only for num or vec
AnimationCurve.cubicCardinal = function (key0, key1, key2, key3, time, tension) {
    var m1, m2;

    if (!key1 || !key2 || key1.type != key2.type)
        return null;

    if (key1.type != AnimationKeyableType.NUM && key1.type != AnimationKeyableType.VEC)
        return null;

    var p = (time - key1.time) / (key2.time - key1.time);
    var resKey = new AnimationKeyable();
    resKey.type = key1.type;

    // adjust for non-unit-interval
    var factor = tension * (key2.time - key1.time);
    if (key1.type === AnimationKeyableType.NUM) {
        m1 = factor * (key2.value - key1.value) / (key2.time - key1.time);
        if (key0)
            m1 = 2 * factor * (key2.value - key0.value) / (key2.time - key0.time);

        m2 = factor * (key2.value - key1.value) / (key2.time - key1.time);
        if (key3)
            m2 = 2 * factor * (key3.value - key1.value) / (key3.time - key1.time);
        resKey.value = AnimationCurve.cubicHermite(m1, key1.value, m2, key2.value, p);
    }

    // each element in vector
    if (key1.type === AnimationKeyableType.VEC) {
        resKey.value = key1.value.clone();
        for (var i = 0; i < resKey.value.data.length; i ++) {
            m1 = factor * (key2.value.data[i] - key1.value.data[i]) / (key2.time - key1.time);
            if (key0)
                m1 = 2 * factor * (key2.value.data[i] - key0.value.data[i]) / (key2.time - key0.time);

            m2 = factor * (key2.value.data[i] - key1.value.data[i]) / (key2.time - key1.time);
            if (key3)
                m2 = 2 * factor * (key3.value.data[i] - key1.value.data[i]) / (key3.time - key1.time);
            resKey.value.data[i] = AnimationCurve.cubicHermite(m1, key1.value.data[i], m2, key2.value.data[i], p);
        }
    }
    return resKey;
};

// *===============================================================================================================
// * class AnimationSnapshot: animation slice (pose) at a particular time
// * member
// *       curveKeyable: the collection of evaluated keyables on curves at a particular time
// * e.g.: for an "walking" animation of a character, at time 1s, AnimationSnapshot corresponds to
// *       evaluated keyables that makes a arm-swing pose
// *===============================================================================================================
var AnimationSnapshot = function AnimationSnapshot() {
    this.curveKeyable = {};// curveKeyable[curveName]=keyable
};

AnimationSnapshot.prototype.copy = function (shot) {
    if (!shot)
        return this;

    this.curveKeyable = {};  
    for (var cname in shot.curveKeyable) {
        if (!shot.curveKeyable.hasOwnProperty(cname))
            continue; 
        this.curveKeyable[cname] = new AnimationKeyable().copy(shot.curveKeyable[cname]);
    }

    return this;
};
AnimationSnapshot.prototype.clone = function () {
    var cloned = new AnimationSnapshot().copy(this);
    return cloned;
};

// static function: linear blending
AnimationSnapshot.linearBlend = function (shot1, shot2, p, mask) {//WANGYI: names in mask are blocked out
    if (!shot1 || !shot2)
        return null;

    if (p === 0) return shot1;
    if (p === 1 && !mask) return shot2;//WANGYI: if there is a mask, not all shot2 are used

    var resShot = new AnimationSnapshot();
    resShot.copy(shot1); 
    for (var cname in shot2.curveKeyable) {
        if (!shot2.curveKeyable.hasOwnProperty(cname))
            continue; 
        if(mask && mask[cname]) continue;//WANGYI: blocked out
        if (shot1.curveKeyable[cname]) {
            var resKey = AnimationKeyable.linearBlend(shot1.curveKeyable[cname], shot2.curveKeyable[cname], p);
            resShot.curveKeyable[cname] = resKey;
        } else
            resShot.curveKeyable[cname] = shot2.curveKeyable[cname];
    }  
    return resShot;
};

// *===============================================================================================================
// * class Animation:
// * member
// *       name: name of this animation
// *       animCurves: an array of curves in the animation, each curve corresponds to one channel along timeline
// *
// * e.g.:   for an animation of a character, name = "walk"
// *       each joint has one curve with keys on timeline, thus animCurves stores curves of all joints
// *===============================================================================================================
var Animation = function Animation(root) {
    Animation.count ++;
    this.id = Animation.count;
    this.name = "take" + Animation.count.toString();
    this.duration = 0;
    this.animCurves = {}; // a map for easy query
    this.root = null;
    if (root) {
        this.root = root;
        this.constructFromRoot(root);
    }

    this.clip = new AnimationClip(null, this);//null for _component
};
Animation.count = 0;

// getter setter
Object.defineProperty(Animation.prototype, 'isPlaying', {
    get: function () {
        return this.clip._isPlaying;
    },
    set: function (isPlaying) {
        this.clip._isPlaying = isPlaying;
    }
});
Object.defineProperty(Animation.prototype, 'loop', {
    get: function () {
        return this.clip._loop;
    },
    set: function (loop) {
        this.clip._loop = loop;
    }
});
Object.defineProperty(Animation.prototype, 'speed', {
    get: function () {
        return this.clip._speed;
    },
    set: function (speed) {
        this.clip._speed = speed;
    }
});

Animation.prototype.copy = function (animation) {
    this.name = animation.name;
    this.duration = animation.duration;

    // copy curves
    this.animCurves = {}; 
    for(var cname in animation.animCurves){ 
        if(!animation.animCurves.hasOwnProperty(cname))
            continue;

        var curve = new AnimationCurve().copy(animation.animCurves[cname]);
        this.animCurves[curve.name] = curve;
    }
    return this;
};

Animation.prototype.clone = function () {
    var cloned = new Animation().copy(this);
    return cloned;
};

Animation.prototype.updateDuration = function () {
    this.duration = 0;
    for(var cname in this.animCurves) { 
        if(!this.animCurves.hasOwnProperty(cname)) continue;
        this.duration = Math.max(this.duration, this.animCurves[cname].duration);
    }
};

Animation.prototype.showAt = function (time, fadeDir, fadeBegTime, fadeEndTime, fadeTime) {
    this.clip.showAt(time, fadeDir, fadeBegTime, fadeEndTime, fadeTime);
};

Animation.prototype.blendToTarget = function (snapshot, p) {
    this.clip.blendToTarget(snapshot, p);
};

Animation.prototype.updateToTarget = function (snapshot) {
    this.clip.updateToTarget(snapshot);
};

// a dictionary: retrieve animTargets with curve name
Animation.prototype.getAnimTargets = function () {
    var animTargets = {}; 
    for(var cname in this.animCurves) { 

        if(!this.animCurves.hasOwnProperty(cname)) continue;
        if (!cname || !this.animCurves[cname]) continue;

        var curveTarget = this.animCurves[cname].getAnimTargets();
        animTargets[cname] = curveTarget[cname];
    }
    return animTargets;
};

Animation.prototype.resetClip = function () {
    this.clip._playable = this;
    this.clip._animTargets = this.getAnimTargets();
    this.clip._isPlaying = true;
    this.clip._begTime = 0;
    this.clip._endTime = this.duration;
    this.clip._curTime = 0;
    this.clip._speed = 1;
    this.clip._loop = true;
};

Animation.prototype.play = function () {
    this.clip.play(this);
};

Animation.prototype.stop = function () {
    this.clip.stop();
};

Animation.prototype.pause = function () {
    this.clip.pause();
};

Animation.prototype.resume = function () {
    this.clip.resume();
};

Animation.prototype.fadeIn = function (duration) {
    this.clip.fadeIn(duration, this);
};

Animation.prototype.fadeOut = function (duration) {
    this.clip.fadeOut(duration);
};

Animation.prototype.fadeTo = function (toAnimation, duration) {
    this.clip.fadeTo(toAnimation, duration);
};

// curve related
Animation.prototype.addCurve = function (curve) {
    if (curve && curve.name) {
        this.animCurves[curve.name] = curve;
        if (curve.duration > this.duration)
            this.duration = curve.duration;
    }
};

Animation.prototype.removeCurve = function (name) {
    if (name && this.animCurves[name]) {
        delete this.animCurves[name];
        this.updateDuration();
    }
};

Animation.prototype.removeAllCurves = function () {
    this.animCurves = {};
    this.duration = 0;
};


// events related
Animation.prototype.on = function (name, time, fnCallback, context, parameter) {
    if (this.clip)
        this.clip.on(name, time, fnCallback, context, parameter);
    return this;
};

Animation.prototype.off = function (name, time, fnCallback) {
    if (this.clip)
        this.clip.off(name, time, fnCallback);
    return this;
};

Animation.prototype.removeAllEvents = function () {
    if (this.clip)
        this.clip.removeAllEvents();
    return this;
};

// animation related
Animation.prototype.getSubAnimation = function (tmBeg, tmEnd) {
    var subAnimation = new Animation();
    subAnimation.name = this.name + "_sub";
    subAnimation.root = this.root;
 
    for(var cname in this.animCurves) { 

        if(!this.animCurves.hasOwnProperty(cname)) continue;
        if (!cname || !this.animCurves[cname])
            continue;

        var subCurve = this.animCurves[cname].getSubCurve(tmBeg, tmEnd);
        subAnimation.addCurve(subCurve);
    }

    return subAnimation;
};

// take a snapshot of animation at this moment
Animation.prototype.eval = function (time) {
    var snapshot = new AnimationSnapshot();
    snapshot.time = time;
 
    for(var cname in this.animCurves) {
        if(!this.animCurves.hasOwnProperty(cname)) continue;
        if (!cname || !this.animCurves[cname])
            continue;

        var keyable = this.animCurves[cname].eval(time);
        snapshot.curveKeyable[cname] = keyable;
    }
    return snapshot;
};

Animation.prototype.constructFromRoot = function (root) {
    if (!root)
        return;

    // scale
    var curveScale = new AnimationCurve();
    curveScale.keyableType = AnimationKeyableType.VEC;
    curveScale.name = root.name + ".localScale";
    curveScale.setTarget(root, "localScale");
    this.addCurve(curveScale);

    // translate
    var curvePos = new AnimationCurve();
    curvePos.keyableType = AnimationKeyableType.VEC;
    curvePos.name = root.name + ".localPosition";
    curvePos.setTarget(root, "localPosition");
    this.addCurve(curvePos);

    // rotate
    var curveRotQuat = new AnimationCurve();
    curveRotQuat.name = root.name + ".localRotation.quat";
    curveRotQuat.keyableType = AnimationKeyableType.QUAT;
    curveRotQuat.setTarget(root, "localRotation");
    this.addCurve(curveRotQuat);

    // children
    for (var i = 0; i < root.children.length; i ++)
        if (root.children[i]) this.constructFromRoot(root.children[i]);
};

/*
//this animation's target will now to root
//Note that animation's original target may be on different scale from new root, for "localPosition", this needs to be adjusted
//Example: animation is made under AS scale,
//         AS will never change no matter how many times this animation is transferred, because it is bound with how it is made
//         when it is transferred to a new root, which is under RS scale, define standard scale SS=1,
//thus
//         standardPos = curvePos / AS;          converting curvePos from AS to SS
//         newRootPos = standardPos * RS;        converting position under SS to new RS
//thus
//         target.vScale = RS / AS;              how to update curve pos to target
//         newRootPos = curvePos * target.vScale
//
//given animation, it maybe transferred multiple times, and its original AS is unknown, to recover AS, we have
//                      RS (scale of current root in scene) and
//                      vScale (scale of animation curve's value update to target)
//thus
//         AS = RS / vScale;
//
//to transfer again to a new root with scale NS
//
//         standardPos = curvePos / AS = curvePos * vScale / RS
//         newTargetPos = standardPos * NS = curvePos * vScale * NS / RS
//
//thus
//         newTarget.vScale = NS / AS = vScale * NS / RS;
//
*/
Animation.prototype.transferToRoot = function (root) {
    var arTarget = AnimationTarget.constructTargetNodes(root);// contains localScale information
 
    for(var cname in this.animCurves) { 
        if(!this.animCurves.hasOwnProperty(cname)) continue;
        if (!cname || !this.animCurves[cname])
            continue;

        var curve = this.animCurves[cname];
        for (var t = 0; t < curve.animTargets.length; t ++) { // for all targets
            var ctarget = curve.animTargets[t];
            var bFound = false;
            for (var a = 0; a < arTarget.length; a ++) { // find matching under root
                var atarget = arTarget[a];

                if (ctarget.targetNode.name === atarget.targetNode.name) { // match by target name
                    bFound = true;
                    var cScale = AnimationTarget.getLocalScale(ctarget.targetNode);
                    ctarget.targetNode = atarget.targetNode; // atarget contains scale information
                    if (cScale && atarget.vScale) {
                        ctarget.vScale = new pc.Vec3(cScale.x, cScale.y, cScale.z);
                        if (atarget.vScale.x) ctarget.vScale.x /= atarget.vScale.x;
                        if (atarget.vScale.y) ctarget.vScale.y /= atarget.vScale.y;
                        if (atarget.vScale.z) ctarget.vScale.z /= atarget.vScale.z;
                    }
                }
            }
            if (!bFound)
                console.warn("transferToRoot: " + ctarget.targetNode.name + "in animation " + this.name + " has no transferred target under " + root.name);

        }
    }
};

//blend related
Animation.prototype.updateCurveNameFromTarget = function () {
    var curveNames = Object.keys(this.animCurves);
    for (var i = 0; i < curveNames.length; i++) { // for each curve in animation
        var oldName = curveNames[i];
        if (!oldName || !this.animCurves[oldName])
            continue;
        var curve = this.animCurves[oldName];
        if(!curve.animTargets || curve.animTargets.length < 1)
            continue;

        // change name to target string
        var newName = curve.animTargets[0].toString();
        if(oldName === newName)//WANGYI: no need to change
            continue;

        curve.name = newName;
        this.animCurves[newName] = curve;
        delete this.animCurves[oldName];
    }
};

Animation.prototype.removeEmptyCurves = function () {
    var curveNames = Object.keys(this.animCurves);
    for (var i = 0; i < curveNames.length; i++) {
        if (!this.animCurves[curveNames[i]] ||
            !this.animCurves[curveNames[i]].animKeys || this.animCurves[curveNames[i]].animKeys.length == 0)
            delete this.animCurves[curveNames[i]];
    }
};

Animation.prototype.setInterpolationType = function (type) {
    for(var cname in this.animCurves) { 
        if(!this.animCurves.hasOwnProperty(cname)) continue;
        if (this.animCurves[cname])
            this.animCurves[cname].type = type;
    }
};

// *===============================================================================================================
// * class AnimationEvent:
// *===============================================================================================================
var AnimationEvent = function AnimationEvent(name, time, fnCallback, context, parameter) {
    this.name = name; 
    this.triggerTime = time; 
    this.fnCallback = fnCallback; 
    this.context = context || this;  
    this.parameter = parameter;

    this.triggered = false;
};
 
AnimationEvent.prototype.invoke = function () {
    if (this.fnCallback) { 
        this.fnCallback.call(this.context, this.parameter);  
        this.triggered = true;
    }
};

AnimationEvent.prototype.clone = function(){
    var cloned = new AnimationEvent(this.name, this.triggerTime, this.fnCallback, this.context, this.parameter); 
    return cloned;
};

// *===============================================================================================================
// * class AnimationClip: playback/runtime related thing
//                           AnimationCurve and Animation are both playable, they are animation data container
//                           AnimationClip is the runtime play of curve/animation
//                           one animation can be played by multiple AnimationClip simultaneously
// *=============================================================================================================== 
var AnimationClip = function AnimationClip(component, playable, targets) {
    AnimationClip.count ++;
    this._component = component;
    this._asset = null; 
    this._resIdx = 0;
    this._name = "clip" + AnimationClip.count.toString();

    // playing related ========================================================
    this._begTime = -1;
    this._endTime = -1;
    this._curTime = 0;
    this._accTime = 0;// accumulate time since playing
    this._speed = 1; 
    this._loop = true;
    this._isPlaying = false;

     // fade related ========================================================== 
    this._fadeBegTime = -1;
    this._fadeEndTime = -1;
    this._fadeTime = -1;
    this._fadeDir = 0;// 1 is in, -1 is out

    // targets and events =====================================================
    this._playable = null;
    this._animTargets = {};
    if (playable) {
        this._playable = playable;// curve or animation
        this._begTime = 0;//WANGYI:
        this._endTime = playable.duration;//WANGYI:
        if (!targets)
            this._animTargets = playable.getAnimTargets();
    }
    if (targets)
        this._animTargets = targets;// collection of AnimationTarget

    this._animEvents = [];

    // blend related ========================================================= 
    this._blendables = {}; 
    this._blendWeights = {}; 
    this._blendMasks = {};

    // onUpdate function for playback
    var self = this;  
    this.onUpdate = function (dt) { 
        self._curTime += (self._speed * dt);
        self._accTime += (self._speed * dt); 

        if (!self._isPlaying ||// not playing
            (!self._loop && (self._curTime < self._begTime || self._curTime > self._endTime))){ // not in range 
            self.invokeByTime(self._curTime);
            self.stop();  

            //notify component event
            if(self._component)
                self._component.fire('end', self); 
            self.invokeByName("end"); //self.fire('end');
            return;
        }
        
        //round time to duration
        var duration = self._endTime - self._begTime;
        if (self._curTime > self._endTime) { // loop start
            self.invokeByTime(self._curTime);

            //notify component event 
            if(self._component)
                self._component.fire('loop', self); 
            self.invokeByName('loop');//self.fire('loop');

            self._curTime -= duration;
            for (var i = 0; i < self._animEvents.length; i ++)
                self._animEvents[i].triggered = false;
        }
        if (self._curTime < self._begTime)
            self._curTime += duration; 
        
        if(self._fadeDir) { 
            self._fadeTime +=  dt;//(self._speed * dt); 
            if(self._fadeTime >= self._fadeEndTime) { 
                if(self._fadeDir === 1) {//fadein completed
                    self._fadeDir = 0;
                    self._fadeBegTime = -1;
                    self._fadeEndTime = -1;
                    self._fadeTime = -1;
                } else if (self._fadeDir === -1) {//fadeout completed
                    self.stop();
                    return;
                }
            }
        }

        if(self._playable instanceof pc.AnimationBlended) 
            self.showAt(self._accTime, self._fadeDir, self._fadeBegTime, self._fadeEndTime, self._fadeTime); 
        else
            self.showAt(self._curTime, self._fadeDir, self._fadeBegTime, self._fadeEndTime, self._fadeTime);
        self.invokeByTime(self._curTime);
    };
};  
// getter and setter
Object.defineProperty(AnimationClip.prototype, 'name', {
    get: function () {
        return this._name;
    },
    set: function (value) {
        this._name = value;
    }
});
Object.defineProperty(AnimationClip.prototype, 'isPlaying', {
    get: function () {
        return this._isPlaying;
    },
    set: function (value) {
        this._isPlaying = value;
    }
});
Object.defineProperty(AnimationClip.prototype, 'loop', {
    get: function () {
        return this._loop;
    },
    set: function (value) {
        this._loop = value;
    }
});
Object.defineProperty(AnimationClip.prototype, 'speed', {
    get: function () {
        return this._speed;
    },
    set: function (value) {
        this._speed = value;
    }
});
Object.defineProperty(AnimationClip.prototype, 'curTime', {
    get: function () {
        return this._curTime;
    },
    set: function (value) {
        this._curTime = value;
    }
}); 
Object.defineProperty(AnimationClip.prototype, 'fadeDir', {
    get: function () {
        return this._fadeDir;
    },
    set: function (value) {
        this._fadeDir = value;
    }
});
Object.defineProperty(AnimationClip.prototype, 'animation', {
    get: function () {
        if(this._playable instanceof pc.Animation)
            return this._playable;
        return null;
    },
    set: function (value) {
        if(value instanceof pc.Animation)
            this._playable = value;
    }
});
Object.defineProperty(AnimationClip.prototype, 'targets', {
    get: function () {
        return this._animTargets;
    },
    set: function (value) {
        this._animTargets = value;
    }
}); 


AnimationClip.count = 0; 
AnimationClip.prototype.clone = function () {   
    var cloned = new AnimationClip();
    cloned._component = this._component; 
    cloned._asset = this._asset; 
    cloned._resIdx = this._resIdx; 
    cloned._name = this._name; 

    cloned._begTime = this._begTime;
    cloned._endTime = this._endTime;
    cloned._curTime = this._curTime;
    cloned._accTime = this._accTime;
    cloned._speed = this._speed;
    cloned._loop = this._loop;
    cloned._isPlaying = this._isPlaying; 

    // fading
    cloned._fadeBegTime = this._fadeBegTime;
    cloned._fadeEndTime = this._fadeEndTime;
    cloned._fadtTime = this._fadeTime;
    cloned._fadeDir = this._fadeDir;// 1 is in, -1 is out

    cloned._playable = this._playable;

    // targets
    cloned._animTargets = {}; 
    for(var key in this._animTargets) { 
        if(!this._animTargets.hasOwnProperty(key)) continue;
        var ttargets = this._animTargets[key];
        var ctargets = [];
        for(var j = 0; j < ttargets.length; j ++) {
            ctargets.push(ttargets[j].clone());
        } 
        cloned._animTargets[key] = ctargets;
    }

    // events
    cloned._animEvents = [];
    for(var i = 0; i < this._animEvents.length; i ++)
        cloned._animEvents.push(this._animEvents[i].clone()); 

    // blending
    cloned._blendables = {};  
    for(var key in this._blendables)
        if(this._blendables.hasOwnProperty(key)) 
            cloned._blendables[key] = this._blendables[key];

    cloned._blendWeights = {};  
    for(var key in this._blendWeights)
        if(this._blendWeights.hasOwnProperty(key))
            cloned._blendWeights[key] = this._blendWeights[key];

    cloned._blendMasks = {};    
    for(var key in this._blendMasks) { 
        if(!this._blendMasks.hasOwnProperty(key)) 
            continue;

        tMask = this._blendMasks[key];
        cMask = {}; 
        for(var mname in tMask)
            if(tMask.hasOwnProperty(mname))
                cMask[mname] = tMasks[mname]; 

        cloned._blendMasks[key] = cMask; 
    }
    return cloned;
}; 

//blend related==========================================================
AnimationClip.prototype.setBlend = function(blendValue, weight, curveName, mask){
    if(blendValue instanceof pc.Animation){
        if(!curveName || curveName === "") 
            curveName = "__default__"; 
        this._blendables[curveName] = blendValue;
        this._blendWeights[curveName] = weight; 
        if(mask)//WANGYI:
            this._blendMasks[curveName] = mask;//contains names for blocking out, otherwise all blendin
        return;
    }

    //blendable is just a single DOF=================================
    var keyType;
    if(typeof blendValue === "number")//1 instanceof Number is false, don't know why
        keyType =  AnimationKeyableType.NUM;
    else if(blendValue instanceof pc.Vec3)
        keyType = AnimationKeyableType.VEC;
    else if(blendValue instanceof pc.Quat)
        keyType = AnimationKeyableType.QUAT;

    if(!curveName || curveName === "" || typeof keyType === "undefined")//has to specify curveName
        return;  

    this._blendWeights[curveName] = weight;  
    this._blendables[curveName] = new AnimationKeyable(keyType, 0, blendValue); 
};

AnimationClip.prototype.unsetBlend = function(curveName) {
    if(!curveName || curveName === "") 
        curveName = "__default__"; 

    //unset blendvalue 
    if(this._blendables[curveName])  
        delete this._blendables[curveName];
    if(this._blendWeights[curveName])
        delete this._blendWeights[curveName]; 
    if(this._blendMasks[curveName]) //WANGYI:
        delete this._blendMasks[curveName];
}; 

// events related
AnimationClip.prototype.on = function (name, time, fnCallback, context, parameter) {
    if (!name || !fnCallback)
        return;

    var event = new AnimationEvent(name, time, fnCallback, context, parameter);
    var pos = 0;
    for (; pos < this._animEvents.length; pos ++) {
        if (this._animEvents[pos].triggerTime > time)
            break;
    }

    if (pos >= this._animEvents.length)
        this._animEvents.push(event);
    else
        this._animEvents.splice(pos, 0, event);
};

//WANGYI:
AnimationClip.prototype.off = function (name, time, fnCallback) { 
    for (var pos = this._animEvents.length-1; pos >=0; pos --) {
        var event = this._animEvents[pos];
        if (!event) continue;
        if (event.name === name && event.fnCallback === fnCallback) {
            this._animEvents.splice(pos, 1);
            continue;
        } 
        if (event.triggerTime === time && event.fnCallback === fnCallback) {
            this._animEvents.splice(pos, 1); 
        }
    }    
};

AnimationClip.prototype.removeAllEvents = function () {
    this._animEvents = [];
};

AnimationClip.prototype.invokeByName = function (name) {
    for (var i = 0; i < this._animEvents.length; i ++) {
        if (this._animEvents[i] && this._animEvents[i].name === name) {
            this._animEvents[i].invoke();
        }
    }
};

AnimationClip.prototype.invokeByTime = function (time) {
    for (var i = 0; i < this._animEvents.length; i ++) {
        if (!this._animEvents[i])
            continue;

        if (this._animEvents[i].triggerTime > time)
            break;

        if (!this._animEvents[i].triggered)
            this._animEvents[i].invoke();

    }
};

AnimationClip.prototype.blendToTarget = function (input, p) {  
    if (!input || p > 1 || p <= 0)// p===0 remain prev
        return;

    if (p === 1) {
        this.updateToTarget(input);
        return;
    }

    // playable is a curve, input is a AnimationKeyable, animTargets is an object {curvename:[]targets}
    if (this._playable instanceof pc.AnimationCurve && input instanceof pc.AnimationKeyable) {
        var cname = this._playable.name;
        var ctargets = this._animTargets[cname];
        if (!ctargets)
            return;

        for (var j = 0; j < ctargets.length; j ++)
            ctargets[j].blendToTarget(input.value, p);
        return;
    }

    // playable is a animation, input is a AnimationSnapshot, animTargets is an object {curvename1:[]targets, curvename2:[]targets, curvename3:[]targets}
    if (this._playable instanceof pc.Animation && input instanceof pc.AnimationSnapshot) {
        for(var cname in input.curveKeyable) { 
            if(!input.curveKeyable.hasOwnProperty(cname))
                continue; 

            var ctargets = this._animTargets[cname];
            if (!ctargets) continue;

            for (var j = 0; j < ctargets.length; j ++)
                ctargets[j].blendToTarget(input.curveKeyable[cname].value, p);
        }
    }
};

AnimationClip.prototype.updateToTarget = function (input) {  
    if (!input)
        return;

    // playable is a curve, input is a AnimationKeyable
    if (this._playable instanceof pc.AnimationCurve && input instanceof pc.AnimationKeyable) {
        var cname = this._playable.name;
        var ctargets = this._animTargets[cname];
        if (!ctargets)
            return;

        for (var j = 0; j < ctargets.length; j ++)
            ctargets[j].updateToTarget(input.value);
        return;
    }

    // playable is a animation, input is a AnimationSnapshot
    if (this._playable instanceof pc.Animation && input instanceof pc.AnimationSnapshot) {
        for(var cname in input.curveKeyable) { 
            if(!input.curveKeyable.hasOwnProperty(cname))
                continue;

            var ctargets = this._animTargets[cname];
            if (!ctargets) continue;

            for (var j = 0; j < ctargets.length; j ++)
                ctargets[j].updateToTarget(input.curveKeyable[cname].value);
        } 
    }
};

AnimationClip.prototype.showAt = function (time, fadeDir, fadeBegTime, fadeEndTime, fadeTime) {
    var input = this._playable.eval(time); 
    //blend related==========================================================
    //blend animations first 
    for (var bname in this._blendables) {
        if (!this._blendables.hasOwnProperty(bname))
            continue; 

        var p = this._blendWeights[bname];
        var blendable = this._blendables[bname];
        var mask = this._blendMasks[bname];//WANGYI:
        if(blendable && (blendable instanceof pc.Animation) && (typeof p === "number")) {
            var blendInput = blendable.eval(this._accTime%blendable.duration);  
            input = AnimationSnapshot.linearBlend(input, blendInput, p, mask);//WANGYI, add mask
        }
    } 
    //blend custom bone second 
    for(var cname in this._blendables) {  
        if(!this._blendables.hasOwnProperty(cname))
            continue;

        var p = this._blendWeights[cname];
        var blendkey = this._blendables[cname];
        if(!blendkey || !input.curveKeyable[cname] || (blendkey instanceof pc.Animation))
            continue; 
        var resKey = AnimationKeyable.linearBlend(input.curveKeyable[cname], blendkey, p);
        input.curveKeyable[cname] = resKey;
    } 
    
    if(fadeDir === 0 || fadeTime < fadeBegTime || fadeTime > fadeEndTime)
        this.updateToTarget(input);
    else {
        var p = (fadeTime - fadeBegTime) / (fadeEndTime - fadeBegTime);
        if (fadeDir === -1)
            p = 1 - p;
        this.blendToTarget(input, p);
    } 
};  

//targets will not be updated
AnimationClip.prototype.updatePlayable = function(playable) {
    this._playable = playable;

    this._begTime = 0; 
    this._endTime = 0;
    if(this._playable && this._playable.duration)
        this._endTime = this._playable.duration;
    this._curTime = 0;
    this._accTime = 0;  
};
AnimationClip.prototype.play = function (playable, animTargets) {
    if (playable)
        this._playable = playable;

    if (!(this._playable instanceof pc.Animation) && !(this._playable instanceof pc.AnimationCurve))
        return this;

    if (this._isPlaying)// already playing
        return this;

    this._begTime = 0; 
    this._endTime = this._playable.duration;//WANGYI:
    this._curTime = 0;
    this._accTime = 0;
    this._isPlaying = true;
    if (playable && this !== playable.clip) {//WANGYI
        this._speed = playable.speed;
        this._loop = playable.loop;
    }


    if (!animTargets && this._animTargets === {} //no pass-in targets && no targets on clip either
        && playable && typeof playable.getAnimTargets === "function")//WANGYI
        this._animTargets = playable.getAnimTargets();
    else if(animTargets)
        this._animTargets = animTargets;
 
    //reset events  
    for (var i = 0; i < this._animEvents.length; i ++)
        this._animEvents[i].triggered = false;

    //reset events 
    for (var i = 0; i < this._animEvents.length; i ++)
        this._animEvents[i].triggered = false;
 
    //if(AnimationClip.app)
    //    AnimationClip.app.on('update', this.onUpdate);

    //notify component event 
    if(this._component)
        this._component.fire('play', this);
    this.invokeByName("play");//this.fire('play');
    return this;
};

AnimationClip.prototype.stop = function () {
    //if(AnimationClip.app)
    //    AnimationClip.app.off('update', this.onUpdate);
    this._curTime = 0;
    this._isPlaying = false;
    this._fadeBegTime = -1;
    this._fadeEndTime = -1;
    this._fadeTime = -1;
    this._fadeDir = 0;

    //notify component event
    //this.fire('stop');
    if(this._component)
        this._component.fire('stop', this);
    this.invokeByName("stop");
    return this;
};

AnimationClip.prototype.pause = function () {
    //if(AnimationClip.app)
    //   AnimationClip.app.off('update', this.onUpdate);
    this._isPlaying = false;

    //notify component event 
    if(this._component)
        this._component.fire('pause', this);
    this.invokeByName("pause");//this.fire('pause');
    return this;
};

AnimationClip.prototype.resume = function () {
    if (!this._isPlaying) {
        this._isPlaying = true;
        //if(AnimationClip.app) AnimationClip.app.on('update', this.onUpdate);

        //notify component event 
        if(this._component)
            this._component.fire('resume', this);
        this.invokeByName("resume");//this.fire('resume');
    }
};
 
AnimationClip.prototype.fadeOut = function (duration) { 
    if(typeof duration !== "number")//WANGYI:
        duration = 0;
    this._fadeBegTime = this._curTime;   
    this._fadeTime = this._fadeBegTime;
    this._fadeEndTime = this._fadeBegTime + duration;
    this._fadeDir = -1;
};

AnimationClip.prototype.fadeIn = function (duration, playable) {
    if(typeof duration !== "number")//WANGYI:
        duration = 0;
    this._fadeBegTime = this._curTime;
    this._fadeTime = this._fadeBegTime;
    this._fadeEndTime = this._fadeBegTime + duration;
    this._fadeDir = 1;
    if (playable)
        this._playable = playable;
    this.play(playable);
};

AnimationClip.prototype.fadeTo = function (playable, duration) {
    this.fadeOut(duration);
    var clip = new AnimationClip(this._component);
    clip.fadeIn(duration, playable);
    return clip;
};

AnimationClip.prototype.fadeToSelf = function(duration) { 
    var clip = this.clone(); 
    //if(AnimationClip.app)
    //    AnimationClip.app.on('update', clip.onUpdate);
    clip.fadeOut(duration);
 
    this.stop();
    this.fadeIn(duration); 
};

//asset related =========================================================================================
AnimationClip.prototype.onBeforeRemove = function() { 
    if(this._asset) 
        _onRemoveAsset();
};

//1.deregister event, 2.stop playing, 3.unhook playable
AnimationClip.prototype._onRemoveAsset = function () {
    if(!this._asset)
        return;

    this._asset.off('change', this._onChangeAsset, this);
    this._asset.off('remove', this._onRemoveOneAsset, this); 
    this.stop();
    if(this._playable) 
        this._playable = null; 
}; 
//1.change playable 2.remove old
AnimationClip.prototype._onChangeAsset = function (asset, attribute, newValue, oldValue) {
    if (attribute === 'resource') {
        // replace old animation with new one
        if (newValue) {
            this._playable = newValue; 
            if(this._isPlaying) {
                this.stop();
                this.play();
            }
        } 
        else _onRemoveAsset();
    }
};
AnimationClip.prototype._onLoadAsset = function () {
    if(!this._asset || !this._asset.resource) 
        return;
    //set playable
    if(this._asset.resource instanceof pc.Animation)
        this._playable = this._asset.resource;
    else if(this._asset.resource instanceof pc.AnimationGroup) {
        var animGroup = this._asset.resource;
        if(this._resIdx < animGroup.animations.length)
            this._playable = animGroup.animations[this._resIdx];
    }
    //set target
    if(this._component)
        this._component.setClipTarget(this);
};
//1.register event, 2.load animation, 3.hook playable
AnimationClip.prototype._onAddAsset = function(asset, idx) {
    this._asset = asset; 
    this._resIdx = idx || 0;

    this._asset.off('change', this._onChangeAsset, this);
    this._asset.on('change', this._onChangeAsset, this);
    this._asset.off('remove', this._onRemoveAsset, this);
    this._asset.on('remove', this._onRemoveAsset, this);
    if (this._asset.resource) {
        this._onLoadAsset();
    } 
    else {
        this._asset.once('load', this._onLoadAsset, this);
        if(this._component) {
            var registry = this._component.system.app.assets;
            if(registry) registry.load(this._asset); 
        }
    } 
};
//for asset hollyshit
        /*/TODO: move to clip
        _loadAnimationFromAssets: function (ids) {
            if (! ids || ! ids.length)
                return; 

            var assets = this.system.app.assets;
            var i, l = ids.length; 

            for(i = 0; i < l; i++) {
                var asset = assets.get(ids[i]);
                if (asset) this._onAddOneAsset(asset); 
                else assets.on('add:' + ids[i], this._onAddOneAsset); 
            }
        },

 //TODO: move to clip
        _onChangeOneAsset: function (asset, attribute, newValue, oldValue) {
            if (attribute === 'resource') {
                // replace old animation with new one
                if (newValue) {
                    this.animations[asset.name] = newValue;
                    this.clips[asset.name]._playable = newValue;

                    if(this.curClip && this.curClip._playable && this.curClip._playable.name === asset.name) { 
                        // restart animation
                        if (this.data.enabled && this.entity.enabled) 
                        {
                            this.curClip.stop();
                            this.curClip.play();
                        } 
                    }
                } else {
                    _onRemoveOneAsset(asset);
                }
            }
        }, 
         //TODO: move to clip
        _onRemoveOneAsset: function (asset) {
            asset.off('remove', this._onRemoveOneAsset, this);

            if(this.curClip && this.curClip._playable && this.curClip._playable.name === asset.name)
                this.curClip.stop();

            if (this.animations[asset.name]) 
                delete this.animations[asset.name];
            if (this.clips[asset.name])
                delete this.clips[asset.name]; 
        },
         //TODO: move to clip
        _onLoadOneAsset: function (asset) {
            this.addAnimation(asset.resource); 
            this.animations = this.animations; // assigning ensures set_animations event is fired
        },
         //TODO: move to clip
        _onAddOneAsset: function(asset) {
            asset.off('change', this._onChangeOneAsset, this);
            asset.on('change', this._onChangeOneAsset, this);

            asset.off('remove', this._onRemoveOneAsset, this);
            asset.on('remove', this._onRemoveOneAsset, this);

            if (asset.resource) {
                this._onLoadOneAsset(asset);
            } else {
                asset.once('load', this._onLoadOneAsset, this);
                if (this.enabled && this.entity.enabled)
                    assets.load(asset);
            }
        },  
        
        


        onSetAssets: function (name, oldValue, newValue) {
            if (oldValue && oldValue.length) {
                for (var i = 0; i < oldValue.length; i++) {
                    // unsubscribe from change event for old assets
                    if (oldValue[i]) {
                        var asset = this.system.app.assets.get(oldValue[i]);
                        if (asset) {
                            asset.off('change', this.onAssetChanged, this);
                            asset.off('remove', this.onAssetRemoved, this);

                            var aName = null;
                            if(asset.resource && asset.resource.name) 
                                aName = asset.resource.name;

                            if(this.curClip && this.curClip._playable && this.curClip._playable.name === aName)
                                this.curClip.stop();

                            delete this.animations[aName];
                            delete this.clips[aName];
                        }
                    }
                }
            }

            //let's just load everything for testing
            var ids = newValue.map(function (value) {
                if (value instanceof pc.Asset) {
                    return value.id;
                } else {
                    return value;
                }
            });

            this._loadAnimationFromAssets(ids);
        }, 


        onBeforeRemove: function() {
            for(var i = 0; i < this.assets.length; i++) {
                var asset = this.system.app.assets.get(this.assets[i]);
                if (! asset) continue;

                asset.off('change', this._onChangeOneAsset, this);
                asset.off('remove', this._onRemoveOneAsset, this);
            }
  
            //stop playing and delete clips
            if(this.curClip)
                this.curClip.stop();

            for(var i = 0; i < this.clips.length; i ++) {
                delete this.clips[i];
            } 
        },  */






// *===============================================================================================================
// WANGYI: why use this: blending from different animations, two animations at this moment
// *===============================================================================================================
var AnimationBlended = function AnimationBlended(weights, animations) {
    Animation.count ++;
    this._name = "take" + Animation.count.toString();
    this.animations = animations;
    this.weights = weights; 
    this.clip = new AnimationClip(null, this); //null for _component
    this.clip._loop = true;
    this.clip._begTime = 0;
    this.clip._endTime = 10000;//big value, but doesn't matter 
    //duration is independent each animation in animations 

    if(this.animations[0])
        this.animations[0].updateCurveNameFromTarget();
    if(this.animations[1])
        this.animations[1].updateCurveNameFromTarget();

}; 
//inheritance, set base to Animation
AnimationBlended.prototype = new Animation();
AnimationBlended.prototype.constructor = AnimationBlended;
 
AnimationBlended.prototype.eval = function (time) {

    if(!this.animations || !this.weights || this.animations.length != this.weights.length)
        return; 


    var snapshot1 = this.animations[0].eval(time%this.animations[0].duration); 
    if(this.animations.length===1)
        return snapshot1; 

    var snapshot2 = this.animations[1].eval(time%this.animations[1].duration); 

    var p = this.weights[1] / (this.weights[0] + this.weights[1]);  
    var resultShot = AnimationSnapshot.linearBlend(snapshot1, snapshot2, p); 

    return resultShot;
};

AnimationBlended.prototype.getAnimTargets = function () { 
    if(this.animations && this.animations.length > 0)
       return this.animations[0].getAnimTargets(); 
};

//online update weights or even animations
AnimationBlended.prototype.reset = function (weights, animations) {

     this.weights = weights;
     this.animations = animations;
};

// *===============================================================================================================
// * class AnimationGroup:
// * member
// *       animations: dictionary type, query animations animations[name]
// *
// *===============================================================================================================
var AnimationGroup = function AnimationGroup() {
    this.name = "";
    this.animations = []; // make it a map, easy to query animation by name
    this.curAnimation = null;
};

AnimationGroup.prototype.animationCount = function () {
    return this.animations.length;
};

AnimationGroup.prototype.getCurrentAnimation = function () {
    return this.curAnimation;
};

AnimationGroup.prototype.getAnimationByName = function(name) {
    for(var i = 0; i < this.animations.length; i ++)
        if(this.animations[i] && this.animations[i].name === name)
            return this.animations[i];
    return null;
};

AnimationGroup.prototype.getAnimationByIndex = function (index) {
    if(index < this.animations.length)
        return this.animations[index];
    return null;
};

AnimationGroup.prototype.addAnimation = function (animation) {
    this.animations.push(animation);
};

AnimationGroup.prototype.removeAnimation = function (name) {

    if(this.curAnimation && this.curAnimation.name === name) {
        this.curAnimation.stop();
        this.curAnimation = null;
    }

    for(var i = this.animations.length; i >= 0; i --) {
        if(this.animations[i] && this.animations[i].name === name) {
            this.animations.splice(i, 1);
            break;
        }
    }
};

AnimationGroup.prototype.playAnimation = function (name) {
    var animation = this.getAnimationByName(name);
    if(animation) {  
        this.curAnimation = animation;
        animation.play(); 
    }
};

AnimationGroup.prototype.stopAnimation = function () {
    if(this.curAnimation) {
        this.curAnimation.stop();
        this.curAnimation = null;
    } 
};

AnimationGroup.prototype.crossFadeToAnimation = function (name, duration) {
    var toAnimation = this.getAnimationByName(name); 
    if (this.curAnimation && toAnimation) { 
        this.curAnimation.fadeOut(duration);
        toAnimation.fadeIn(duration);
        this.curAnimation = toAnimation;
    } else if (this.curAnimation) {
        this.curAnimation.fadeOut(duration);
        this.curAnimation = null;
    } else if (toAnimation) {
        toAnimation.fadeIn(duration);
        this.curAnimation = toAnimation;
    }
};


//blend related
AnimationGroup.prototype.setBlend = function (blendValue, weight, curveName, mask) { 
    if(this.curAnimation && this.curAnimation.clip)
        this.curAnimation.clip.setBlend(blendValue, weight, curveName, mask);//WANGYI: added mask
};

AnimationGroup.prototype.unsetBlend = function(curveName) {
    if(this.curAnimation && this.curAnimation.clip)
        this.curAnimation.clip.unsetBlend(curveName);
};

//matching pc.extend(pc, function () {
return {
    AnimationGroup: AnimationGroup,
    AnimationClip: AnimationClip, 
    Animation: Animation,
    AnimationBlended: AnimationBlended, 
    AnimationEvent: AnimationEvent,
    AnimationSnapshot: AnimationSnapshot,
    AnimationCurve: AnimationCurve,
    AnimationCurveType: AnimationCurveType,
    AnimationTarget: AnimationTarget,
    AnimationKeyable: AnimationKeyable, 
    AnimationKeyableType: AnimationKeyableType
};

}());
