var fs = require('fs');

var db = require('mongoskin').db('mongodb://localhost:27017/realTimeBugMining');

module.exports = db;