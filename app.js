/*jslint node:true */
'use strict';

// Module dependencies
var util = require('util'),
    twitter = require('twitter'),
    express = require('express'),
    http = require('http'),
    socketIO = require('socket.io'),
    path = require('path'),
    fs = require('fs');

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

/* ******************************************************************************************** */

var stopWords = {};

var stopWordsDirPath = __dirname + '/stop-words/';
var stopWordsFiles = fs.readdirSync(stopWordsDirPath);

for (var stopWordsFileIndex in stopWordsFiles){
    var stopWordsFile = fs.readFileSync(stopWordsDirPath + stopWordsFiles[stopWordsFileIndex]);
    stopWordsFile.toString().split(/\r?\n/).forEach(function (word) {
        stopWords[word] = true;
    });
}

var superVector = {"software" : 293, "bugs" : 142, "web":71,"bug":207,"security":211,"openssl":72,"heartbleed":144,"error":63,"nasa":45,"problem":50,"errors":38,"data":89,"number":50,"crash":45,"report":36,"problems":56,"control":47,"failure":40,"news":39,"windows":71,"risk":63,"digest":46,"risks":74,"microsoft":51,"code":75,"time":49,"network":43,"space":53,"article":36,"program":56,"systems":85,"management":49,"services":38,"internet":40,"access":37,"site":44,"vulnerability":38,"retrieved":86},
    superVectorNorma = vectorNorm(superVector);

var threshold = process.argv[2];

/* ******************************************************************************** */

function vectorNorm(vector) {
    var sum = 0,
        key;

    for (key in vector){
        sum += Math.pow(vector[key] , 2);
    }

    return Math.sqrt(sum);
}

function obtenerVectorTF(tweet){
    var words = tweet.text.split(/\s+/),
        vectorTF = {},
        word = '',
        wordIndex;

    for (wordIndex in words){
        word = words[wordIndex].toLowerCase().replace(/[^A-Za-z@#]/gi, '');

        if ( !stopWords[word] ) {
            vectorTF[word] = vectorTF[word] ? vectorTF[word]+1 : 1;
        }
    }

    return vectorTF;
}

function sim(vectorA, vectorB, normVectorA, normVectorB){
    var sum = 0,
        keyword;

    for (keyword in vectorA){
        if (vectorB[keyword]){
            sum += vectorA[keyword] * vectorB[keyword];
        }
    }

    return (sum / (normVectorA * normVectorB));
}

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
    //twit.stream('statuses/filter', {track : 'bug,vulnerability', language : 'en,es' }, function (stream) {
    //twit.stream('statuses/filter', {track : 'bug,vulnerability,application bug, application vulnerability, works bad, app broken, app bad', language : 'en' }, function (stream) {
    //twit.stream('statuses/filter', {track : 'facebook bug, facebook problem, facebook work bad, facebook works bad', language : 'en' }, function (stream) {
    twit.stream('statuses/filter', {track : ["software", "bugs", "web", "bug", "security", "openssl", "heartbleed", "error", "nasa", "problem", "errors", "data", "number", "crash", "report", "problems", "control", "failure", "news", "windows", "risk", "digest", "risks", "microsoft", "code", "time", "network", "space", "article", "program", "systems", "management", "services", "internet", "access", "site", "vulnerability", "retrieved"], language : 'en' }, function (stream) {

        twitterStream = stream;

        twitterStream.on('data', function (data) {
            if (data.text !== undefined) {
                var tweetVectorTF = obtenerVectorTF(data),
                    normaTweet = vectorNorm(tweetVectorTF),
                    similarity = sim(superVector, tweetVectorTF, superVectorNorma, normaTweet);

                if (similarity > threshold){
                    io.sockets.emit('newTweet', { 'tweet' : data, 'similarity' : similarity });
//                    socket.emit('newTweet', data);
    //                console.log(util.inspect(data, { colors : true }));
                    console.log("\nTweet: " + data.text + "\nVector: " + JSON.stringify(tweetVectorTF) + "\nNorma Vector: " + normaTweet + "\nNorma SV: " + superVectorNorma + "\nSimilarity = " + similarity);
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
