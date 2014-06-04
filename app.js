/*jslint node:true */
'use strict';

/* ******************************************************************************** */
// Correct usage check
if (process.argv.length < 3) {
    console.log("\n=== Real Time Bug Mining ===\n");
    console.log("usage: node app.js thresholdSimilarity\n");
    console.log("  thresholdSimilarity\tThreshold used to filter tweets found according the similarity with the super vector\n");
    process.exit(1);
}
var threshold = process.argv[2];

/* ******************************************************************************** */

var vectorDao = require('./lib/vectorDao'),
    vectorsUtils = require('./lib/vectorUtils'),
    fs = require('fs');

var superVector,
    searchVector,
    superVectorNorma;

vectorDao.getSuperVector(function (err, vector) {
    if (err) {
        console.log('ERROR: failed to connect to MongoDB database');
        process.exit(1);
    }

    if (vector) {
        superVector = vector.vectorValue;
    } else {
        // Get the default super vector from file and store in mongo db database
        var superVectorFile = fs.readFileSync(__dirname + '/superVector.json');
        superVector = JSON.parse(superVectorFile.toString());
        vectorDao.updateSuperVector(superVector);
    }
    superVectorNorma = vectorsUtils.vectorModulus(superVector);
});

vectorDao.getSearchVector(function (err, vector) {
    if (err) {
        console.log('ERROR: failed to connect to MongoDB database');
        process.exit(1);
    }

    if (vector) {
        searchVector = vector.vectorValue;
    } else {
        // Get the default search vector from file and store in mongo db database
        var searchVectorFile = fs.readFileSync(__dirname + '/searchVector.json');
        searchVector = JSON.parse(searchVectorFile.toString());
        vectorDao.updateSearchVector(searchVector);
    }
});

/* ******************************************************************************** */

// Module dependencies
var util = require('util'),
    twitter = require('twitter'),
    express = require('express'),
    path = require('path'),
    http = require('http'),
    socketIO = require('socket.io'),
    tweetDao = require('./lib/tweetDao'),
    configHelper = require('./lib/configHelper'),
    originalWordWeight = configHelper.originalWordWeight ? configHelper.originalWordWeight : 0.98,
    rejectedWordWeight = configHelper.rejectedWordWeight ? configHelper.rejectedWordWeight : 0.1,
    approvedWordWeight = configHelper.approvedWordWeight ? configHelper.approvedWordWeight : 0.8;

/* ******************************************************************************** */

// Express App Initialization
// Create Express app
var app = express();

// Express Setup
app.set('port', process.env.PORT || 5555);
//app.use(express.logger('dev'));
//app.use(express.bodyParser());
app.use(express.static(path.join(__dirname, 'public')));

// Configure routes
app.route('/').get(function (request, response, next) {
    response.sendfile(__dirname + "/index.html");
});

app.route('/d3').get(function (req, res, next) {
    res.sendfile(__dirname + '/d3.html');
});

app.route('/superVector').get(function (request, response, next) {
    response.send({'superVector' : superVector, 'normaSuperVector' : superVectorNorma});
});

app.route('/noFeedbackTweets').get(function (request, response, next) {
    var page = request.query.page || 1;
    tweetDao.findNoFeedbackTweetsWithPagination(page, function(err, tweets) {
        if (err) { throw err; }
        
        tweetDao.noFeedbackTweetsCount(function (err, count){
            if (err) { throw err; }
            response.send({'count' : count, 'pages' : Math.ceil(count / 100), 'tweets':tweets});
        });
    });
});

app.route('/approvedTweets').get(function (request, response, next) {
    var page = request.query.page || 1;
    tweetDao.findApprovedTweetsWithPagination(page, function(err, tweets) {
        if (err) { throw err; }
        
        tweetDao.approvedTweetsCount(function (err, count){
            if (err) { throw err; }
            response.send({'count' : count, 'pages' : Math.ceil(count / 100), 'tweets':tweets});
        });
    });
});

app.route('/rejectedTweets').get(function (request, response, next) {
    var page = request.query.page || 1;
    tweetDao.findRejectedTweetsWithPagination(page, function(err, tweets) {
        if (err) { throw err; }
        
        tweetDao.rejectedTweetsCount(function (err, count){
            if (err) { throw err; }
            response.send({'count' : count, 'pages' : Math.ceil(count / 100), 'tweets':tweets});
        });
    });
});

/* ******************************************************************************** */

// Create the HTTP server
var server = http.createServer(app);

// Initialize WebSockets module Sockets.io
var io = socketIO.listen(server);

/* ******************************************************************************** */

var stopWords = {};

var stopWordsDirPath = __dirname + '/stop-words/';
var stopWordsFiles = fs.readdirSync(stopWordsDirPath);

for (var stopWordsFileIndex in stopWordsFiles){
    var stopWordsFile = fs.readFileSync(stopWordsDirPath + stopWordsFiles[stopWordsFileIndex]);
    stopWordsFile.toString().split(/\r?\n/).forEach(function (word) {
        stopWords[word] = true;
    });
}

/* ******************************************************************************** */

function buildTweetVectorTF (tweet) {
    var words = tweet.text.split(/\s+/),
        vectorTF = {},
        word = '',
        wordIndex;

    for (wordIndex in words) {
        if ( !isValidURL(words[wordIndex]) ) {
            word = words[wordIndex].toLowerCase().replace(/[^A-Za-z@#]/gi, '');

            if ((word.length > 0) && !stopWords[word]) {
                vectorTF[word] = vectorTF[word] ? vectorTF[word]+1 : 1;
            }
        }
    }

    return vectorTF;
};

function isValidURL (url) {
    var urlregex = /^(ftp|http|https):\/\/(\w+:{0,1}\w*@)?(\S+)(:[0-9]+)?(\/|\/([\w#!:.?+=&%@!\-\/]))?$/;
    return urlregex.test(url);
};

/* ******************************************************************************** */

// Twitter Node module
var twit = new twitter({
    consumer_key : 'awaQ1vqxiG4mJIhoNH7svg',
    consumer_secret : 'H5nrtPkkmOD35IcnGilHDMO6xZz6KGmuszUNjVz2c',
    access_token_key : '2416048434-XserUsN4WcM953QET4kxH8vU8C3Yhk5P4fk8rR1',
    access_token_secret : '33DVcA2Z2GxztbuWBY5hBj8b6a4AHsJbqlGXQvV2KZq79'
});

var twitterStream = null;

function initializeTwitterStream(socket){
    twit.stream('statuses/filter', {track : Object.keys(searchVector), language : 'en' }, function (stream) {
    
        twitterStream = stream;

        twitterStream.on('data', function (data) {
            if (data.text !== undefined) {
                var tweetVectorTF = buildTweetVectorTF(data),
                    tweetVectorMod = vectorsUtils.vectorModulus(tweetVectorTF),
                    similarity = vectorsUtils.vectorsSimilarity(superVector, tweetVectorTF, superVectorNorma, tweetVectorMod);

                if (similarity > threshold){
                    io.sockets.emit('newTweet', { 'tweet' : data, 'similarity' : similarity });
//                    socket.emit('newTweet', data);
                    tweetDao.saveTweet(data);
                }
            }
        });

        twitterStream.on('disconnect', function (data) {
            console.log(data);
        });
    });
}

/* ******************************************************************************** */

io.sockets.on('connection', function (socket) {
    socket.on('startStreaming', function (data) {
        if (twitterStream === null){
            initializeTwitterStream(socket);
        }else{
//            twitterStream.on('data')
        }
    });

    socket.on('stopStreaming', function (data) {
        if (twitterStream) {
            console.log("Twitter streaming stopped by user!");
            twitterStream.destroy();
            twitterStream = null;
        }
    });
    
    socket.on('approveTweet', function (data) {
        if ( data.tweetId ){
            tweetDao.approveTweet(data.tweetId);
            applyRocchioApprovedTweet(data.tweetId);
        }
    });
    
    socket.on('rejectTweet', function (data) {
        if ( data.tweetId ){
            tweetDao.rejectTweet(data.tweetId);
            applyRocchioRejectedTweet(data.tweetId);
        }
    });
});

var applyRocchioRejectedTweet = function(tweetId) {
    tweetDao.getTweet(tweetId, function(err, tweet){
        if (err) { throw err; }
        if (tweet) {
            var tweetVectorTF = buildTweetVectorTF(tweet);

            for (var word in tweetVectorTF){
                if (superVector[word]){
                    superVector[word] = superVector[word] * originalWordWeight - tweetVectorTF[word] * rejectedWordWeight;
                    if (superVector[word] <= 0) { delete superVector[word]; }
                }
            }
            
            vectorDao.updateSuperVector(superVector);
            superVectorNorma = vectorsUtils.vectorModulus(superVector);
        }
    });
};

var applyRocchioApprovedTweet = function(tweetId) {
    tweetDao.getTweet(tweetId, function(err, tweet){
        if (err) { throw err; }
        if (tweet) {
            var tweetVectorTF = buildTweetVectorTF(tweet);
            
            for (var word in tweetVectorTF) {
                if (superVector[word]) {
                    superVector[word] = superVector[word] * originalWordWeight + tweetVectorTF[word] * approvedWordWeight;
                } else {
                    superVector[word] = tweetVectorTF[word] * approvedWordWeight;
                }
            }
            vectorDao.updateSuperVector(superVector);
            superVectorNorma = vectorsUtils.vectorModulus(superVector);
        }
    })
}

/* ******************************************************************************** */

// Create the server
server.listen(app.get('port'), function () {
    console.log('Server initialized and listening on port ' + app.get('port'));
});
