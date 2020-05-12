const Delegator = require('./delegator');
const context = {};
Delegator(context, 'request').getter('method');
Delegator(context, 'response').access('body');


module.exports = context;