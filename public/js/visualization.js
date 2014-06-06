//{children:[{word:"aaa",value:2},{word:"zzz",value:50}]}

var processWordsForVisualization = function (words) {
    var data = { children : [] };
    
    for (var word in words) {
        data.children.push( {"word":word, "value":words[word]} );
    }
    
    return data;
};

var renderWordsBubbles = function (renderContainerId, wordsCallUrl) {
    var diameter = 1000,
        format = d3.format(",d"),
        color = d3.scale.category20c();

    var bubble = d3.layout.pack()
        .sort(null)
        .size([diameter, diameter])
        .padding(1.5);

    var svg = d3.select("#"+renderContainerId).append("svg")
        .attr("width", diameter)
        .attr("height", diameter)
        .attr("class", "bubble");

    d3.json(window.location.origin+"/"+wordsCallUrl, function(error, words) {
        var wordsForVisualization = processWordsForVisualization(words);
        
        var node = svg.selectAll(".node")
                    .data(bubble.nodes(wordsForVisualization)
                                .filter(function(d) { return !d.children; }))
                    .enter().append("g")
                        .attr("class", "node")
                        .attr("transform", function(d) { return "translate(" + d.x + "," + d.y + ")"; });

        node.append("title")
            .text(function(d) { return d.word + ": " + format(d.value); });

        node.append("circle")
            .attr("r", function(d) { return d.r; })
            .style("fill", function(d) { return color(d.word); });

        node.append("text")
            .text(function(d) { return d.word; })
            .style("font-size", function(d) { return Math.min(2 * d.r, (2 * d.r - 8) / this.getComputedTextLength() * 24) + "px"; })
            .attr("dy", ".35em");
        
//        node.append("text")
//            .attr("dy", ".3em")
//            .style("text-anchor", "middle")
//            .text(function(d) { var bubbleText = d.word+" ("+d.value+")"; return bubbleText.substring(0, d.r / 3); });
    });

    d3.select(self.frameElement).style("height", diameter + "px");
};

var renderVectorsWordsTree = function (vectorsWordsContainerId){
    var width = 960,
    height = 2200;

    var cluster = d3.layout.cluster()
        .size([height, width - 160]);

    var diagonal = d3.svg.diagonal()
        .projection(function(d) { return [d.y, d.x]; });

    var svg = d3.select("#"+vectorsWordsContainerId).append("svg")
        .attr("width", width)
        .attr("height", height)
        .append("g")
            .attr("transform", "translate(40,0)");

    d3.json("/vectorsWords", function(error, vectorsMap) {
        var root = {"name":"vectors", "children": []};
        
        for (var vectorName in vectorsMap) {
            var vectorVisualization = {"name":vectorName, "children" : []},
                vector = vectorsMap[vectorName];
            for (var word in vector){
                vectorVisualization.children.push({"name":word, "size":vector[word]});
            }
            root.children.push(vectorVisualization);
        }
        
        var nodes = cluster.nodes(root),
            links = cluster.links(nodes);

        var link = svg.selectAll(".link")
                        .data(links)
                        .enter().append("path")
                                .attr("class", "link")
                                .attr("d", diagonal);

        var node = svg.selectAll(".node")
                        .data(nodes)
                        .enter().append("g")
                                .attr("class", "nodeVector")
                                .attr("transform", function(d) { return "translate(" + d.y + "," + d.x + ")"; });

        node.append("circle")
            .attr("r", 4.5);

        node.append("text")
            .attr("dx", function(d) { return d.children ? -8 : 8; })
            .attr("dy", 3)
            .style("text-anchor", function(d) { return d.children ? "end" : "start"; })
            .text(function(d) { return d.name; });
    });

    d3.select(self.frameElement).style("height", height + "px");
};

$(function() {
    $('#noFeedbackTweetsWordsTabButton').click(function (event){
        $("#noFeedbackTweetsWordsContainer").empty();
        renderWordsBubbles("noFeedbackTweetsWordsContainer", "noFeedbackTweetsWords");
    });
    
    $('#approvedTweetsWordsTabButton').click(function (event){
        $("#approvedTweetsWordsContainer").empty();
        renderWordsBubbles("approvedTweetsWordsContainer", "approvedTweetsWords");
    });
    
    $('#rejectedTweetsWordsTabButton').click(function (event){
        $("#rejectedTweetsWordsContainer").empty();
        renderWordsBubbles("rejectedTweetsWordsContainer", "rejectedTweetsWords");
    });
    
    $('#vectorsWordsTabButton').click(function (event){
        $("#vectorsWordsContainer").empty();
        renderVectorsWordsTree("vectorsWordsContainer");
    });
    
    renderWordsBubbles("noFeedbackTweetsWordsContainer", "noFeedbackTweetsWords");
});
