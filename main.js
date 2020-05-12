const Koa = require('./lib/application');

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