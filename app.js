/*jslint node:true */
'use strict';

/* ******************************************************************************** */
// Correct usage check
if (process.argv.length < 4) {
    console.log("\n=== Real Time Bug Mining ===\n");
    console.log("usage: node app.js thresholdDocumentVectors thresholdSuperVector\n");
    console.log("  thresholdDocumentVectors\tThreshold used to filter tweets found according the similarity with the single document vectors\n");
    console.log("  thresholdSuperVector\tThreshold used to filter tweets found according the similarity with the super vector\n");
    process.exit(1);
}
var thresholdDocument = process.argv[2],
    thresholdSuperVector = process.argv[3];

/* ******************************************************************************** */

var vectorDao = require('./lib/vectorDao'),
    vectorsUtils = require('./lib/vectorUtils'),
    fs = require('fs');

var superVector,
    searchVector,
    superVectorNorma,
    documentVectors = [];

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
        superVector = vectorsUtils.normalizeMapVector(superVector);
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

vectorDao.getDocumentVectors(function (err, vectorsArray) {
    if (err) {
        console.error('ERROR: failed to connect to MongoDB database');
        process.exit(1);
    }
    
    if (vectorsArray.length > 0) {
        documentVectors = vectorsArray;
    } else {
        var documentVectorsFile = fs.readFileSync(__dirname + '/documentVectors.json');
        var documentVectorsArray = JSON.parse(documentVectorsFile.toString())['documentVectorsArray'];
        for (var documentVectorIndex in documentVectorsArray) {
            var documentVector = documentVectorsArray[documentVectorIndex];
            documentVector = vectorsUtils.normalizeMapVector(documentVector);
            vectorDao.insertDocumentVector(documentVector, function (err, vector) {
                if (err) { throw err; }
                documentVectors.push(vector[0]);
            });
        }
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
    statisticsDao = require('./lib/statisticsDao'),
    originalWordWeight = configHelper.originalWordWeight ? configHelper.originalWordWeight : 0.1,
    rejectedWordWeight = configHelper.rejectedWordWeight ? configHelper.rejectedWordWeight : 0.02,
    approvedWordWeight = configHelper.approvedWordWeight ? configHelper.approvedWordWeight : 0.08;

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

app.route('/visualization').get(function (req, res, next) {
    res.sendfile(__dirname + '/views/visualization.html');
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

app.route('/docVectors').get(function (req, res, next) {
    res.send(documentVectors);
});

function buildWordsCountsMapFromTweetsArray(tweetsArray) {
    var tweetsWords = {},
        tweet = null,
        words = [],
        word = '',
        wordIndex = 0;

    for (var tweetIndex in tweetsArray) {
        tweet = tweetsArray[tweetIndex];
        if (tweet && tweet.text && tweet.text.length > 0) {
            words = tweet.text.split(/\s+/);
            for (wordIndex in words) {
                if ( !isValidURL(words[wordIndex]) ) {
                    word = words[wordIndex].toLowerCase().replace(/[^A-Za-z@#]/gi, '');

                    if (word.length > 0 && !stopWords[word]) {
                        tweetsWords[word] = tweetsWords[word] ? tweetsWords[word]+1 : 1;
                    }
                }
            }
        }
    }
    
    return tweetsWords;
};

app.route('/noFeedbackTweetsWords').get(function (request, response, next) {
    tweetDao.findNoFeedbackTweets(function (err, tweetsArray) {
        if (err) { throw err; }
        
        var tweetsWords = buildWordsCountsMapFromTweetsArray(tweetsArray);
        response.send(tweetsWords);
    });
});

app.route('/approvedTweetsWords').get(function (request, response, next) {
    tweetDao.findApprovedTweets(function (err, tweetsArray) {
        if (err) { throw err; }
        
        var tweetsWords = buildWordsCountsMapFromTweetsArray(tweetsArray);
        response.send(tweetsWords);
    });
});

app.route('/rejectedTweetsWords').get(function (request, response, next) {
    tweetDao.findRejectedTweets(function (err, tweetsArray) {
        if (err) { throw err; }
        
        var tweetsWords = buildWordsCountsMapFromTweetsArray(tweetsArray);
        response.send(tweetsWords);
    });
});

app.route('/vectorsWords').get(function (request, response, next) {
    var vectorsWords = {};
    vectorDao.getDocumentVectors(function (err, documentVectorsArray) {
        for (var documentVectorIdx in documentVectorsArray) {
            vectorsWords["documentVector"+documentVectorIdx] = documentVectorsArray[documentVectorIdx].vectorValue;
        }
        
        vectorDao.getSuperVector(function (err, superVector) {
            vectorsWords[superVector.name] = superVector.vectorValue;
            
            response.send(vectorsWords);
        });
    });
});

app.route('/tweetsAmounts').get(function (request, response, next) {
    var tweetsAmounts = [];
    tweetDao.approvedTweetsCount(function (err, count) {
        if (err) { throw err; }
        
        tweetsAmounts.push({"tweetsType" : "Approved Tweets", "count" : count});
        
        tweetDao.rejectedTweetsCount(function (err, count){
            if (err) { throw err; }
            
            tweetsAmounts.push({"tweetsType" : "Rejected Tweets", "count" : count});
            
            tweetDao.noFeedbackTweetsCount(function (err, count) {
                if (err) { throw err; }
            
                tweetsAmounts.push({"tweetsType" : "No-Feedback Tweets", "count" : count});
                
                statisticsDao.getDiscardedTweetsCount(function (err, metric){
                    if (err) { throw err; }
                    tweetsAmounts.push({"tweetsType": "Discarded Tweets", "count" : metric.count});
                    response.send(tweetsAmounts);
                });
            });
        });
    });
});

/* ******************************************************************************** */

// Create the HTTP server
var server = http.createServer(app);

// Initialize WebSockets module Sockets.io
var io = socketIO.listen(server);

io.set('log level', 1);

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
            if (data.text !== undefined && !data["retweeted_status"]) {
                var tweetVectorTF = buildTweetVectorTF(data),
                    tweetVectorTF = vectorsUtils.normalizeMapVector(tweetVectorTF),
                    tweetVectorMod = 1,
                    similar = false,
                    documentVectorIndex = 0,
                    similarity = 0;
                
                // Search similarity of tweet with document vectors
                for (documentVectorIndex = 0; documentVectorIndex < documentVectors.length; documentVectorIndex++) {
                    var documentVector = documentVectors[documentVectorIndex],
                        documentVectorValues = documentVector.vectorValue;
                    
                    similarity = vectorsUtils.vectorsSimilarity(documentVectorValues, tweetVectorTF, vectorsUtils.vectorModulus(documentVectorValues), tweetVectorMod);
                 
                    if (similarity > thresholdDocument){
                        similarity = similarity + " (documentVector)";
                        similar = true;
                        break;
                    }
                }
                
                // If there is no similar document vector ===> try with super vector
                if (!similar) {
                    similarity = vectorsUtils.vectorsSimilarity(superVector, tweetVectorTF, superVectorNorma, tweetVectorMod);
                    if (similarity > thresholdSuperVector){
                        similarity = similarity + " (superVector)";
                        similar = true;
                    }
                }
                
                if (similar){
                    io.sockets.emit('newTweet', { 'tweet' : data, 'similarity' : similarity });
//                    socket.emit('newTweet', data);
                    tweetDao.saveTweet(data);
                } else {
                    statisticsDao.incrementDiscardedTweets(1);
                }
            }
        });

        twitterStream.on('disconnect', function (data) {
            console.log(data);
        });
    });
};

function stopTwitterStream() {
    if (twitterStream) {
        console.log("Twitter streaming stopped by user!");
        twitterStream.destroy();
        twitterStream = null;
    }
};

/* ******************************************************************************** */

io.sockets.on('connection', function (socket) {
    if (twitterStream) {
        socket.emit('twitterStreamOn');
    }
    
    socket.on('startStreaming', function (data) {
        if (twitterStream === null){
            initializeTwitterStream(socket);
            io.sockets.emit('twitterStreamStartedByUser');
        }else{
//            twitterStream.on('data')
        }
    });

    socket.on('stopStreaming', function (data) {
        stopTwitterStream();
        io.sockets.emit('twitterStreamOff');
    });
    
    socket.on('approveTweet', function (data) {
        if ( data.tweetId ){
            tweetDao.approveTweet(data.tweetId, function (err, result) {
                if (err) { throw err; }
            });
            applyRocchioApprovedTweet(data.tweetId);
        }
    });
    
    socket.on('rejectTweet', function (data) {
        if ( data.tweetId ){
            tweetDao.rejectTweet(data.tweetId, function (err, result) {
                if (err) { throw err; }
            });
            applyRocchioRejectedTweet(data.tweetId);
        }
    });
});

function applyRejectRocchio(vector, tweet) {
    var wordsToDelete = [];
    
    for (var word in vector) {
        if (tweet[word]) {
            vector[word] = vector[word] * originalWordWeight - tweet[word] * rejectedWordWeight;
            if (vector[word] <= 0) { wordsToDelete.push(word); }
        } else {
            vector[word] = vector[word] * originalWordWeight;
        }
    }
    
    for (var wordToDeleteIndex in wordsToDelete) {
        delete vector[wordsToDelete[wordToDeleteIndex]];
    }
    
    return vector;
};

var applyRocchioRejectedTweet = function(tweetId) {
    tweetDao.getTweet(tweetId, function(err, tweet){
        if (err) { throw err; }
        if (tweet) {
            var tweetVectorTF = buildTweetVectorTF(tweet);
            tweetVectorTF = vectorsUtils.normalizeMapVector(tweetVectorTF);
            
            var documentVectorIndex,
                similarity = 0;
            
            // Punish words of rejected tweet on similar document vector
            for (documentVectorIndex = 0; documentVectorIndex < documentVectors.length; documentVectorIndex++) {
                var documentVector = documentVectors[documentVectorIndex],
                    documentVectorValues = documentVector.vectorValue;

                similarity = vectorsUtils.vectorsSimilarity(documentVectorValues, tweetVectorTF, vectorsUtils.vectorModulus(documentVectorValues), 1);

                if (similarity > thresholdDocument){
                    documentVectorValues = applyRejectRocchio(documentVectorValues, tweetVectorTF);
                    documentVectorValues = vectorsUtils.normalizeMapVector(documentVectorValues);
                    documentVector.vectorValue = documentVectorValues;
                    vectorDao.updateDocumentVector(documentVector, function (err, result) {
                        if (err) { throw err; }
                    });
                    break;
                }
            }

            // Punish words of rejected tweet on super vector
            superVector = applyRejectRocchio(superVector, tweetVectorTF);
            superVector = vectorsUtils.normalizeMapVector(superVector);
            vectorDao.updateSuperVector(superVector);
            superVectorNorma = vectorsUtils.vectorModulus(superVector);
        }
    });
};

function applyApproveRocchio(vector, tweet) {
    for (var word in tweet) {
        if (vector[word]) {
            vector[word] = vector[word] * originalWordWeight + tweet[word] * approvedWordWeight;
        } else {
            vector[word] = tweet[word] * approvedWordWeight;
        }
    }
    
    for (var word in vector) {
        if (!tweet[word]) {
            vector[word] = vector[word] * originalWordWeight;
        }
    }
    
    return vector;
};

var applyRocchioApprovedTweet = function(tweetId) {
    tweetDao.getTweet(tweetId, function(err, tweet){
        if (err) { throw err; }
        if (tweet) {
            var tweetVectorTF = buildTweetVectorTF(tweet);
            tweetVectorTF = vectorsUtils.normalizeMapVector(tweetVectorTF);

            var documentVectorIndex,
                similarity = 0,
                similar = false;
            
            // Reward words of approved tweet on similar document vector
            for (documentVectorIndex = 0; documentVectorIndex < documentVectors.length; documentVectorIndex++) {
                var documentVector = documentVectors[documentVectorIndex],
                    documentVectorValues = documentVector.vectorValue;

                similarity = vectorsUtils.vectorsSimilarity(documentVectorValues, tweetVectorTF, vectorsUtils.vectorModulus(documentVectorValues), 1);

                if (similarity > thresholdDocument){
                    documentVectorValues = applyApproveRocchio(documentVectorValues, tweetVectorTF);
                    documentVectorValues = vectorsUtils.normalizeMapVector(documentVectorValues);
                    documentVector.vectorValue = documentVectorValues;
                    vectorDao.updateDocumentVector(documentVector, function (err, result) {
                        if (err) { throw err; }
                    });
                    similar = true;
                    break;
                }
            }

            // A new document vector has to be created!
            if (!similar) {
                vectorDao.insertDocumentVector(tweetVectorTF, function(err, vector) {
                    if (err) { throw err; }
                    
                    if (vector[0]){
                        documentVectors.push(vector[0]);
                    }
                    
                    io.sockets.emit('newDocumentVector');
                });
            }
            
            // Reward words of approved tweet on super vector
            superVector = applyApproveRocchio(superVector, tweetVectorTF);
            superVector = vectorsUtils.normalizeMapVector(superVector);
            vectorDao.updateSuperVector(superVector);
            superVectorNorma = vectorsUtils.vectorModulus(superVector);
        }
    });
}

/* ******************************************************************************** */

// Create the server
server.listen(app.get('port'), function () {
    console.log('Server initialized and listening on port ' + app.get('port'));
});
