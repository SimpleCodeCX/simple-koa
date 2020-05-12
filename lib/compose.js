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

module.exports = compose;
