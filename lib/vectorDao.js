/*jslint node:true */
'use strict';

var db = require('./mongoConfig');

db.bind('vectors');

exports.getSuperVector = function (callback) {
    db.vectors.findOne({'name': 'superVector'}, callback);
};

exports.getSearchVector = function (callback) {
    db.vectors.findOne({'name': 'searchVector'}, callback);
};

exports.updateSuperVector = function (superVector) {
    db.vectors.update({'name': 'superVector'}, {'name': 'superVector', 'vectorValue': superVector}, {upsert: true}, function (err, result) {
        if (err) { throw err; }
    });
};

exports.updateSearchVector = function (searchVector) {
    db.vectors.update({'name': 'searchVector'}, {'name' : 'searchVector', 'vectorValue ': searchVector}, {upsert: true}, function (err, result) {
        if (err) { throw err; }
    });
};