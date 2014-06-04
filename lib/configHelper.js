/*jslint node:true */
'use strict';

var fs = require('fs');

var configFile = fs.readFileSync(__dirname + '/../config.json');

module.exports = JSON.parse(configFile.toString());
