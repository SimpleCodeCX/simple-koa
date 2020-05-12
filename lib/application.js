const http = require('http');
const EventEmitter = require('events')
const compose = require('./compose');
const context = require('./context');
const request = require('./request');
const response = require('./response');

module.exports = class Koa extends EventEmitter {
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

