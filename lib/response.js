const response = {
  get body() {
    return this._body;
  },
  set body(val) {
    this._body = val;
  },
};
module.exports = response;