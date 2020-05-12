# 剖析并实现一个简单版的koa框架

### 一、关于 node http 的用法

node http 的用法很简单，http 的每次请求，都会带有 request 和 response 两个对象。

```javascript
const server = http.createServer((request, response) => {
  // request 可以获取到 http 请求头相关的东西
  console.log(request.method);
  console.log(request.url);
  console.log(request.headers['cookie']);
  console.log(request.httpVersion);
  // response 响应流
  response.write('response data.');
  response.end();
});
server.listen(3000);
```


通过 request 可以获取到请求头相关的东西，比如请求头的 method、url、http header 等等，另外，request 继承自可读流，因此 request 具备可读流的所有特点，比如可以监听 on(‘data’) 获取到请求体的内容，也可以on(‘end’) 监听流的结束，代码如下：

```javascript
const data = [];
  request.on('data', function (dataBuffer) {
    data.push(dataBuffer);
  });
  request.on('end', function () {
    const buffer = Buffer.concat(data).toString();
    console.log(buffer);
  });
```

response 继承自可写流，拥有可写流的所有特点，比如 write、end 、close操作，
通过 response.wirte(‘响应数据’) + response.end() 可以向客户端响应数据。
response.end(‘xxx’) 相当于 response.write(‘xxx’) + response.close(); 
代码如下：

```javascript
response.write('response data.');
  response.end();
```


### 二、koa 是基于 node http 的
koa 是一个 http 框架，因此，koa 是基于 node http 模块的。
最简单的 koa 实现如下（其实内部就是封装了 http）：
```javascript
class Koa {
  constructor(fn) {
    this.fn = fn;
  }
  listen(...args) {
    const server = http.createServer((req, res) => {
      this.fn(req, res);
    });
    return server.listen(...args);
  }
}
function handleHttp(req, res) {
  res.end('response data.');
}
const koa = new Koa(handleHttp);
koa.listen(3000);
```

### 三、koa 的上下文 Context

#### 1、在 koa 的Context 中，实现了如下功能：

- 1）分别定义了 req和res 属性来保留原生的 request和response 对象，因此我们可以通过 ctx.req 和 ctx.res 访问到原来的 request和response 对象。
- 2）分别定义了 request 和 response 属性，用于扩展 原生的request和response 对象。
- 3）实现了委托，把 context 上的属性，委托给 request 或 response 对象，比如，当我访问 ctx.body=xxxx 的时候，其实访问的是 response.body=xxx，当我访问 ctx.method 的时候，其实访问的是 request.method。

#### 2、委托的实现原理如下：

```javascript
function Delegator(proto, target) {
  if (!(this instanceof Delegator)) { // 这里是为了保证 Delegator 的实例是 new 出来的
    return new Delegator(proto, target);
  }
  this.proto = proto;
  this.target = target;
}

Delegator.prototype.getter = function (name) {
  const proto = this.proto;
  const target = this.target;
  proto.__defineGetter__(name, function () {
    return this[target][name]; // 当访问 proto[name] 的时候，访问的是 proto[target][name]
  });
  return this;
};
Delegator.prototype.setter = function (name) {
  const proto = this.proto;
  const target = this.target;
  proto.__defineSetter__(name, function (value) {
    return this[target][name] = value; // 当设置 proto[name] 的时候，访问的是 proto[target][name]
  });
  return this;
};
Delegator.prototype.access = function (name) {
  return this.getter(name).setter(name);
};

Delegator.prototype.method = function (name) {
  const proto = this.proto;
  const target = this.target;
  proto[name] = function () {
    // 当调用 proto[name]() 函数的时候，访问的是 proto[target][name]()
    return this[target][name].apply(target, arguments);
  };
  return this;
};

const context = {
  request: {
    a: 123,
    fn: function () {
      return 'fn';
    }
  }
};
Delegator(context, 'request')
  .getter('a')
  .setter('a')
  .method('fn');

console.log(context.a); // 123
console.log(context.fn()); // fn
```

输出如下：
```javascript
123
fn
```

#### 3、Context 在 koa 的应用

```javascript
const request = {
  get method() {
    return this.req.method;
  },
};
const response = {
  get body() {
    return this._body;
  },
  set body(val) {
    this._body = val;
  },
};
const context = {};
Delegator(context, 'request').getter('method');
Delegator(context, 'response').access('body');

class Koa {
  constructor(fn) {
    this.fn = fn;
    this.context = Object.create(context);
    this.request = Object.create(request);
    this.response = Object.create(response);
  }
  listen(...args) {
    const server = http.createServer((req, res) => {
      const context = this.createContext(req, res);
      Promise.resolve(this.fn(context)).then(() => {
        let body = 'koa response';
        if (context.body) {
          body = context.body;
        }
        res.write(body);
        res.end();
      });

    });
    return server.listen(...args);
  }
  createContext(req, res) {
    const context = Object.create(this.context);
    context.res = res;
    context.req = req;
    context.request = Object.create(this.request);
    context.response = Object.create(this.response);
    context.req = request.req = response.req = req;
    context.res = request.res = response.res = res;
    return context;
  }
}
function handleHttp(ctx) {
  console.log(ctx.method); // ctx.method 会被委托到 ctx.request.method
  ctx.body = 'reponse data.'; // ctx.body 会被委托到 ctx.response.body
}
const koa = new Koa(handleHttp);
koa.listen(3000);
```


### 四、middleware(中间件)洋葱模型

koa 的核心思想在于基于中间件的洋葱模型，koa 通过一个 compose 函数，把一个一个的中间件串联起来，组合成了一个大的函数，在每个中间件里，通过 next() 执行下一个中间件。
引用官方的一张洋葱模型图，如下：


![](https://user-gold-cdn.xitu.io/2020/5/12/17209328e7a05419?w=660&h=491&f=png&s=129101)


compose 的代码如下：


```javascript
function compose(middlewares) {
  return function (context, next) {
    function dispatch(i) {
      let fn = middlewares[i];
      if (i === middlewares.length) fn = next;
      if (!fn) {
        return Promise.resolve();
      }
      try {
        return Promise.resolve(fn(context, () => {
          return dispatch(i + 1);
        }));
      } catch (e) {
        return Promise.reject(e);
      }
    }
    return dispatch(0);
  };
}

const middlewares = [];
async function a(ctx, next) {
  console.log('a1');
  const r = await next();
  console.log(r);
  console.log('a2');
}
async function b(ctx, next) {
  console.log('b1');
  await next();
  console.log('b2');
  return 'b';
}
middlewares.push(a);
middlewares.push(b);
compose(middlewares)({}).then(v => {
  console.log('ddd');
});
```

以上代码的执行顺序如下：

```javascript
a in
b in
b out
b
a out
end
```


### 五、在 koa 应用中间件洋葱模型

```javascript
const http = require('http');
const EventEmitter = require('events')

function compose(middlewares) {
  return function (context, next) {
    function dispatch(i) {
      let fn = middlewares[i];
      if (i === middlewares.length) fn = next;
      if (!fn) {
        return Promise.resolve();
      }
      try {
        return Promise.resolve(fn(context, () => {
          return dispatch(i + 1);
        }));
      } catch (e) {
        return Promise.reject(e);
      }
    }
    return dispatch(0);
  };
}

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


const request = {
  get method() {
    return this.req.method;
  },
};
const response = {
  get body() {
    return this._body;
  },
  set body(val) {
    this._body = val;
  },
};
const context = {};
Delegator(context, 'request').getter('method');
Delegator(context, 'response').access('body');

class Koa extends EventEmitter {
  constructor() {
    super();
    this.middlewares = [];
    this.context = Object.create(context);
    this.request = Object.create(request);
    this.response = Object.create(response);
  }
  listen(...args) {
    const server = http.createServer((req, res) => {
      this.handleHttp(req, res);
    });
    return server.listen(...args);
  }
  use(fn) {
    this.middlewares.push(fn);
  }
  handleHttp(req, res) {
    const middleware = compose(this.middlewares);
    const context = this.createContext(req, res);
    middleware(context).then(() => {
      let body = 'koa response';
      if (context.body) {
        body = context.body;
      }
      res.write(body);
      res.end();
    });
  }
  createContext(req, res) {
    const context = Object.create(this.context);
    context.res = res;
    context.req = req;
    context.request = Object.create(this.request);
    context.response = Object.create(this.response);
    context.req = request.req = response.req = req;
    context.res = request.res = response.res = res;
    return context;
  }
}
const koa = new Koa();
async function middlewareA(ctx, next) {
  console.time('responseTime');
  console.log('middlewareA in');
  console.log(ctx.method); // ctx.method 会被委托到 ctx.request.method
  await next();
  console.log(ctx.body);
  console.log('middlewareA out');
  console.timeEnd('responseTime');
}
function middlewareB(ctx, next) {
  console.log('middlewareB in');
  ctx.res.setHeader('Content-Type', 'text/html;charset=utf-8');
  ctx.body = 'reponse data.'; // ctx.body 会被委托到 ctx.response.body
  console.log('middlewareB out');
}
koa.use(middlewareA);
koa.use(middlewareB);
const server = koa.listen(3000);
server.on('listening', function () {
  console.log('listening on localhost:3000');
});
```


### 六、代码放在 github 上

https://github.com/SimpleCodeCX/simple-koa