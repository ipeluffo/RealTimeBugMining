/*jslint node:true */
'use strict';

var db = require('./mongoConfig');

db.bind('vectors');
db.bind('documentVectors');

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
    db.vectors.update({'name': 'searchVector'}, {'name' : 'searchVector', 'vectorValue': searchVector}, {upsert: true}, function (err, result) {
        if (err) { throw err; }
    });
};

exports.getDocumentVectors = function (callback) {
    db.documentVectors.find().toArray(callback);
};

exports.insertDocumentVector = function(documentVectorValues, callback) {
    db.documentVectors.insert({'vectorValue' : documentVectorValues}, callback);
};

exports.getDocumentVector = function (documentVectorId, callback) {
    db.documentVectors.findOne({'_id' : documentVectorId}, callback);
};

exports.getDocumentVectorsCount = function (callback) {
    db.documentVectors.count(callback);
};

exports.updateDocumentVector = function(documentVector, callback) {
    db.documentVectors.update( { "_id" : documentVector["_id"] }, { $set : { 'vectorValue' : documentVector['vectorValue'] } }, callback);
};
