/*jslint node:true */
'use strict';

var db = require('./mongoConfig');

db.bind('statistics');

var discardedTweetsKey = "discardedTweets" ;

exports.incrementDiscardedTweets = function (amount) {
    db.statistics.update({"metric":discardedTweetsKey}, { $inc : { "count":amount } }, { upsert: true }, function (err, result){
        if (err) { throw err; }
    });
};

exports.getDiscardedTweetsCount = function(callback) {
    db.statistics.findOne({"metric":discardedTweetsKey}, callback);
};