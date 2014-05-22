/*jslint node:true */
'use strict';

/* ******************************************************************************** */
// Correct usage check
if (process.argv.length < 3){
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

vectorDao.getSuperVector(function(err, vector){
    if (err){
        console.log('ERROR: failed to connect to MongoDB database');
        process.exit(1);
    }

    if (vector) {
        superVector = vector.vectorValue;
    }else{
        // Get the default super vector from file and store in mongo db database
        var superVectorFile = fs.readFileSync(__dirname+'/superVector.json');
        superVector = JSON.parse(superVectorFile.toString());
        vectorDao.updateSuperVector(superVector);
    }
    superVectorNorma = vectorsUtils.vectorModulus(superVector);
});

vectorDao.getSearchVector(function(err, vector){
    if (err){
        console.log('ERROR: failed to connect to MongoDB database');
        process.exit(1);
    }

    if (vector) {
        searchVector = vector.vectorValue;
    }else{
        // Get the default search vector from file and store in mongo db database
        var searchVectorFile = fs.readFileSync(__dirname+'/searchVector.json');
        searchVector = JSON.parse(searchVectorFile.toString());
        vectorDao.updateSearchVector(searchVector);
    }
}); 

/* ******************************************************************************** */

// Module dependencies
var util = require('util'),
    twitter = require('twitter'),
    express = require('express'),
    http = require('http'),
    socketIO = require('socket.io'),
    path = require('path');

/* ******************************************************************************** */

// Create Express app
var app = express();

// Create the HTTP server
var server = http.createServer(app);

// Initialize WebSockets module Sockets.io
var io = socketIO.listen(server);

// Express Setup
app.set('port', process.env.PORT || 5555);
//app.use(express.logger('dev'));
//app.use(express.bodyParser());
app.use(express.static(path.join(__dirname, 'public')));

/* ******************************************************************************** */

// Configure routes
app.route('/').get(function (request, response, next) {
    response.sendfile(__dirname + "/index.html");
});

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

function buildVectorTF (tweet) {
    var words = tweet.text.split(/\s+/),
        vectorTF = {},
        word = '',
        wordIndex;

    for (wordIndex in words) {
        word = words[wordIndex].toLowerCase().replace(/[^A-Za-z@#]/gi, '');

        if (!stopWords[word]) {
            vectorTF[word] = vectorTF[word] ? vectorTF[word]+1 : 1;
        }
    }

    return vectorTF;
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
                var tweetVectorTF = buildVectorTF(data),
                    tweetVectorMod = vectorsUtils.vectorModulus(tweetVectorTF),
                    similarity = vectorsUtils.vectorsSimilarity(superVector, tweetVectorTF, superVectorNorma, tweetVectorMod);

                if (similarity > threshold){
                    io.sockets.emit('newTweet', { 'tweet' : data, 'similarity' : similarity });
//                    socket.emit('newTweet', data);
//                    console.log(util.inspect(data, { colors : true }));
                    console.log("\nTweet: " + data.text + "\nVector: " + JSON.stringify(tweetVectorTF) + "\nNorma Vector: " + tweetVectorMod + "\nNorma SV: " + superVectorNorma + "\nSimilarity = " + similarity);
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
    socket.emit('superVector', {
        "superVector" : superVector,
        "normaSuperVector" : superVectorNorma
    });

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
});

/* ******************************************************************************** */

// Create the server
server.listen(app.get('port'), function () {
    console.log('Server initialized and listening on port ' + app.get('port'));
});
