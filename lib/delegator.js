function Delegator(proto, target) {
  if (!(this instanceof Delegator)) { // 这里是为了保证 Delegator 的实例是 new 出来的
    return new Delegator(proto, target);
  }
  this.proto = proto;
  this.target = target;
}

Delegator.prototype.getter = function (name) {
  const proto = this.proto;
  const target = this.target;
  proto.__defineGetter__(name, function () {
    return this[target][name]; // 当访问 proto[name] 的时候，访问的是 proto[target][name]
  });
  return this;
};
Delegator.prototype.setter = function (name) {
  const proto = this.proto;
  const target = this.target;
  proto.__defineSetter__(name, function (value) {
    return this[target][name] = value; // 当设置 proto[name] 的时候，访问的是 proto[target][name]
  });
  return this;
};
Delegator.prototype.access = function (name) {
  return this.getter(name).setter(name);
};

Delegator.prototype.method = function (name) {
  const proto = this.proto;
  const target = this.target;
  proto[name] = function () {
    // 当调用 proto[name]() 函数的时候，访问的是 proto[target][name]()
    return this[target][name].apply(target, arguments);
  };
  return this;
};

module.exports = Delegator;