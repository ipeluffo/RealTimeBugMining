/*jslint node:true */
'use strict';

var db = require('./mongoConfig');

db.bind('tweets');

exports.findApprovedTweets = function (callback) {
    db.tweets.find({'userFeedback': 'approved'}).toArray(callback);
};

exports.findApprovedTweetsWithPagination = function (page, callback) {
    db.tweets.find({'userFeedback': 'approved'}, {'skip' : (100*(page-1)), 'limit':100}).toArray(callback);
};

exports.approvedTweetsCount = function (callback) {
    db.tweets.count({'userFeedback': 'approved'}, callback);
};

exports.findRejectedTweets = function (callback) {
    db.tweets.find({'userFeedback': 'rejected'}).toArray(callback);
};

exports.findRejectedTweetsWithPagination = function (page, callback) {
    db.tweets.find({'userFeedback': 'rejected'}, {'skip' : (100*(page-1)), 'limit':100}).toArray(callback);
};

exports.rejectedTweetsCount = function (callback) {
    db.tweets.count({'userFeedback': 'rejected'}, callback);
};

exports.findAllTweets = function (callback) {
    db.tweets.find().toArray(callback);
};

exports.findNoFeedbackTweets = function (callback) {
    db.tweets.find({'userFeedback': 'none'}).toArray(callback);
};

exports.findNoFeedbackTweetsWithPagination = function (page, callback) {
    db.tweets.find({'userFeedback': 'none'}, {'skip' : (100*(page-1)), 'limit':100}).toArray(callback);
};

exports.noFeedbackTweetsCount = function (callback) {
    db.tweets.count({'userFeedback': 'none'}, callback);
};

exports.saveTweet = function (tweet) {
    tweet.userFeedback = 'none';
    db.tweets.update({'id_str': tweet.id_str}, tweet, {upsert: true}, function (err, result) {
        if (err) { throw err; }
    });
};

exports.getTweet = function (tweetId, callback) {
    db.tweets.findOne({'id_str' : tweetId}, callback);
};

exports.approveTweet = function (tweetId, callback) {
    db.tweets.update({'id_str': tweetId}, { $set : {'userFeedback': 'approved'} }, callback);
};

exports.rejectTweet = function (tweetId, callback) {
    db.tweets.update({'id_str': tweetId}, { $set : {'userFeedback': 'rejected'} }, callback);
};