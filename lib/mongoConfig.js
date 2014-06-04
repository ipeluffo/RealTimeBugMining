/*jslint node:true */
'use strict';

var configHelper = require('./configHelper');

var db;

if (configHelper.mongoDbUser && configHelper.mongoDbPass) {
    db = require('mongoskin').db('mongodb://' + configHelper.mongoDbUser + ':' + configHelper.mongoDbPass + '@' + configHelper.mongoDbUrl + ':' + configHelper.mongoDbPort + '/' + configHelper.mongoDbDatabase);
} else {
    db = require('mongoskin').db('mongodb://' + configHelper.mongoDbUrl + ':' + configHelper.mongoDbPort + '/' + configHelper.mongoDbDatabase);
}

module.exports = db;