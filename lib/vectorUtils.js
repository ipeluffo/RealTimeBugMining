/*jslint node:true */
'use strict';

exports.vectorModulus = function vectorModulus(vector) {
    var sum = 0,
        key;

    for (key in vector) {
        sum += Math.pow(vector[key], 2);
    }

    return Math.sqrt(sum);
};

exports.vectorsSimilarity = function (vectorA, vectorB, normVectorA, normVectorB) {
    var sum = 0,
        keyword;

    for (keyword in vectorA) {
        if (vectorB[keyword]) {
            sum += vectorA[keyword] * vectorB[keyword];
        }
    }

    return (sum / (normVectorA * normVectorB));
};

exports.normalizeArrayVector = function normalizeArrayVector(vector) {
    var vectorMod = exports.vectorModulus(vector),
        normalizedVector = [];
    
    for (var index in vector) {
        normalizedVector[index] = vector[index] / vectorMod;
    }
    
    return normalizedVector;
};
    
exports.normalizeMapVector = function normalizeMapVector(vector) {
    var vectorMod = exports.vectorModulus(vector),
        normalizedVector = {};
    
    for (var key in vector) {
        normalizedVector[key] = vector[key] / vectorMod;
    }
    
    return normalizedVector;
};