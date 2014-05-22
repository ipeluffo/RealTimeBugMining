/*jslint node:true */
'use strict';

exports.vectorModulus = function (vector) {
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