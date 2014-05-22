/*jslint node:true */
'use strict';

var db = require('./mongoConfig');

db.bind('tweets');

exports.findApprovedTweets = function (callback) {
    db.tweets.find({'userFeedback': 'approved'}).toArray(callback);
};

exports.findRejectedTweets = function (callback) {
    db.tweets.find({'userFeedback': 'rejected'}).toArray(callback);
};

exports.findAllTweets = function (callback) {
    db.tweets.find().toArray(callback);
};

exports.findNonReviewedTweets = function (callback) {
    db.tweets.find({'userFeedback': 'none'}).toArray(callback);
};

exports.saveTweet = function (tweet) {
    db.tweets.insert(tweet);
};

exports.approveTweet = function (tweetId) {
    db.tweets.update({'id_str': tweetId}, { $set : {'userFeedback': 'approved'} });
};

exports.rejectTweet = function (tweetId) {
    db.tweets.update({'id_str': tweetId}, { $set : {'userFeedback': 'rejected'} });
};