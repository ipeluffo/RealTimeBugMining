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
    
    $('#tweetsPieTabButton').click(function (event) {
        $('#tweetsPieContainer').empty();
        renderTweetsPie('tweetsPieContainer');
    });
    
    renderWordsBubbles("noFeedbackTweetsWordsContainer", "noFeedbackTweetsWords");
});

/****************************************************************************************/

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

    var tip = d3.tip()
          .attr('class', 'd3-tip')
          .offset([-10, 0])
          .html(function(d) {
            return "<strong>"+d.word+":</strong> <span style='color:red'>" + d.value + "</span>";
          });
    
    var svg = d3.select("#"+renderContainerId).append("svg")
        .attr("width", diameter)
        .attr("height", diameter)
        .attr("class", "bubble");

    svg.call(tip);
    
    d3.json(window.location.origin+"/"+wordsCallUrl, function(error, words) {
        var wordsForVisualization = processWordsForVisualization(words);
        
        var node = svg.selectAll(".node")
                    .data(bubble.nodes(wordsForVisualization)
                                .filter(function(d) { return !d.children; }))
                    .enter().append("g")
                        .attr("class", "nodeBubble")
                        .attr("transform", function(d) { return "translate(" + d.x + "," + d.y + ")"; });

        node.append("title")
            .text(function(d) { return d.word + ": " + format(d.value); });

        node.append("circle")
            .attr("r", function(d) { return d.r; })
            .style("fill", function(d) { return color(d.word); })
            .on('mouseover', tip.show)
            .on('mouseout', tip.hide);

        node.append("text")
            .text(function(d) { return d.word; })
            .style("font-size", function(d) { return Math.min(2 * d.r, (2 * d.r - 8) / this.getComputedTextLength() * 24) + "px"; })
            .attr("dy", ".35em");
    });

    d3.select(self.frameElement).style("height", diameter + "px");
};

/****************************************************************************************/

var tree, root, svg, i, duration, diagonal;

var renderVectorsWordsTree = function (vectorsWordsContainerId){
    i = 0;
    duration = 750;
    
    var margin = {top: 20, right: 120, bottom: 20, left: 120},
    width = 960 - margin.right - margin.left,
    height = 1000 - margin.top - margin.bottom;

    tree = d3.layout.tree().size([height, width]);

    diagonal = d3.svg.diagonal().projection(function(d) { return [d.y, d.x]; });

    svg = d3.select("#"+vectorsWordsContainerId).append("svg")
            .attr("width", width + margin.right + margin.left)
            .attr("height", height + margin.top + margin.bottom)
            .append("g")
                .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    d3.json("/vectorsWords", function(error, vectorsMap) {
        root = {"name":"vectors", "children": []};
        
        for (var vectorName in vectorsMap) {
            var vectorVisualization = {"name":vectorName, "children" : []},
                vector = vectorsMap[vectorName];
            for (var word in vector){
                vectorVisualization.children.push({"name":word, "size":vector[word]});
            }
            root.children.push(vectorVisualization);
        }
        
        root.x0 = height / 2;
        root.y0 = 0;

        function collapse(d) {
            if (d.children) {
                d._children = d.children;
                d._children.forEach(collapse);
                d.children = null;
            }
        };

        root.children.forEach(collapse);
        updateVectorsWords(root);
    });

    d3.select(self.frameElement).style("height", "800px");
};

function updateVectorsWords(source) {
    // Compute the new tree layout.
    var nodes = tree.nodes(root).reverse(),
      links = tree.links(nodes);

    // Normalize for fixed-depth.
    nodes.forEach(function(d) { d.y = d.depth * 180; });

    // Update the nodes…
    var node = svg.selectAll("g.nodeVector")
      .data(nodes, function(d) { return d.id || (d.id = ++i); });

    // Enter any new nodes at the parent's previous position.
    var nodeEnter = node.enter().append("g")
      .attr("class", "nodeVector")
      .attr("transform", function(d) { return "translate(" + source.y0 + "," + source.x0 + ")"; })
      .on("click", nodeVectorClick);

    nodeEnter.append("circle")
      .attr("r", 1e-6)
      .style("fill", function(d) { return d._children ? "lightsteelblue" : "#fff"; });

    nodeEnter.append("text")
                .attr("x", function(d) { return d.children || d._children ? -10 : 10; })
                .attr("dy", ".35em")
                .attr("text-anchor", function(d) { return d.children || d._children ? "end" : "start"; })
                .text(function(d) { return d.name; })
                .style("fill-opacity", 1e-6);

    // Transition nodes to their new position.
    var nodeUpdate = node.transition()
      .duration(duration)
      .attr("transform", function(d) { return "translate(" + d.y + "," + d.x + ")"; });

    nodeUpdate.select("circle")
      .attr("r", 4.5)
      .style("fill", function(d) { return d._children ? "lightsteelblue" : "#fff"; });

    nodeUpdate.select("text")
      .style("fill-opacity", 1);

    // Transition exiting nodes to the parent's new position.
    var nodeExit = node.exit().transition()
      .duration(duration)
      .attr("transform", function(d) { return "translate(" + source.y + "," + source.x + ")"; })
      .remove();

    nodeExit.select("circle")
      .attr("r", 1e-6);

    nodeExit.select("text")
      .style("fill-opacity", 1e-6);

    // Update the links…
    var link = svg.selectAll("path.link")
      .data(links, function(d) { return d.target.id; });

    // Enter any new links at the parent's previous position.
    link.enter().insert("path", "g")
      .attr("class", "link")
      .attr("d", function(d) {
        var o = {x: source.x0, y: source.y0};
        return diagonal({source: o, target: o});
      });

    // Transition links to their new position.
    link.transition()
      .duration(duration)
      .attr("d", diagonal);

    // Transition exiting nodes to the parent's new position.
    link.exit().transition()
                .duration(duration)
                .attr("d", function(d) {
                    var o = {x: source.x, y: source.y};
                    return diagonal({source: o, target: o});
                })
                .remove();

    // Stash the old positions for transition.
    nodes.forEach(function(d) {
        d.x0 = d.x;
        d.y0 = d.y;
    });
};

// Toggle children on click.
function nodeVectorClick(d) {
    if (d.children) {
        d._children = d.children;
        d.children = null;
    } else {
        d.children = d._children;
        d._children = null;
    }
    updateVectorsWords(d);
};

/****************************************************************************************/

function renderTweetsPie(tweetsPieContainerId) {
    var width = 600,
        height = 500,
        radius = Math.min(width, height) / 2;
    
    var color = d3.scale.category20();

    var arc = d3.svg.arc()
        .outerRadius(radius - 10)
        .innerRadius(0);

    var pie = d3.layout.pie()
        .sort(null)
        .value(function(d) { return d.count; });

    var tip = d3.tip()
          .attr('class', 'd3-tip')
          .offset([-10, 0])
          .html(function(d) {
            return "<strong>"+d.data.tweetsType+":</strong> <span style='color:red'>" + d.data.count + "</span>";
          });
    
    var svg = d3.select("#"+tweetsPieContainerId).append("svg")
        .attr("width", width)
        .attr("height", height)
        .append("g")
            .attr("transform", "translate(" + width / 2 + "," + height / 2 + ")");

    svg.call(tip);
    
    var svgAcceptedTweets = d3.select("#acceptedTweetsPieContainer").append("svg")
        .attr("width", width)
        .attr("height", height)
        .append("g")
            .attr("transform", "translate(" + width / 2 + "," + height / 2 + ")");

    svgAcceptedTweets.call(tip);
    
    d3.json("/tweetsAmounts", function(error, data) {
        data.forEach(function(d) {
            d.count = +d.count;
        });
        
        var tweetsCounts = [],
            acceptedTweetsCount = 0,
            allTweetsCount = 0,
            acceptedTweetsCountsData = [];
        
        for (var dataIndex in data){
            var tweetsCount = data[dataIndex];
            allTweetsCount += tweetsCount.count;
            if (tweetsCount.tweetsType !== "Discarded Tweets"){
                acceptedTweetsCount += tweetsCount.count;
                acceptedTweetsCountsData.push(tweetsCount);
            }else{
                tweetsCounts.push(tweetsCount);
            }
        }
        
        tweetsCounts.push({"tweetsType":"Accepted Tweets", "count":acceptedTweetsCount});

        var g = svg.selectAll(".arc")
                    .data(pie(tweetsCounts))
                    .enter().append("g")
                                .attr("class", "arc");

        g.append("path")
            .attr("d", arc)
            .style("fill", function(d) { return color(d.data.tweetsType); })
            .on('mouseover', tip.show)
            .on('mouseout', tip.hide);

        g.append("text")
            .attr("transform", function(d) { return "translate(" + arc.centroid(d) + ")"; })
            .attr("dy", ".35em")
            .style("text-anchor", "middle")
            .style("font","10px sans-serif")
            .text(function(d) { return d.data.tweetsType; });
        
        var gAcceptedTweets = svgAcceptedTweets.selectAll(".arc")
                    .data(pie(acceptedTweetsCountsData))
                    .enter().append("g")
                                .attr("class", "arc");

        gAcceptedTweets.append("path")
            .attr("d", arc)
            .style("fill", function(d) { return color(d.data.tweetsType); })
            .on('mouseover', tip.show)
            .on('mouseout', tip.hide);

        gAcceptedTweets.append("text")
            .attr("transform", function(d) { return "translate(" + arc.centroid(d) + ")"; })
            .attr("dy", ".35em")
            .style("text-anchor", "middle")
            .style("font","10px sans-serif")
            .text(function(d) { return d.data.tweetsType; });
    });
};