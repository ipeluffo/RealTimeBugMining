var socket = null;

$(function () {
    $("#startStreaming").click(function (event) {
        if (socket) {
            $("#startStreaming").attr('disabled','disabled');
            $("#stopStreaming").removeAttr('disabled');

            socket.emit("startStreaming");
        }
    });

    $("#stopStreaming").click(function (event){
        if (socket) {
            $("#stopStreaming").attr('disabled','disabled');
            $("#startStreaming").removeAttr('disabled');

            socket.emit("stopStreaming");
        }
    });
    
    $("#superVectorTabButton").click(function (event){
        jQuery.getJSON(window.location.origin+"/superVector", {}, function(data, textStatus, jqXHR){
            // Remove super vector table rows
            $("#superVectorTable tbody tr").remove();
            
            $("#normaSuperVector").text(data.normaSuperVector);
            
            var $superVectorTableBody = $('#superVectorTable tbody');
            for (var keyword in data.superVector){
                var keywordRow = $('<tr>')
                                    .append($('<td>').text(keyword))
                                    .append($('<td>').text(data.superVector[keyword]));
                $superVectorTableBody.append(keywordRow);
            }
        });
    });
    
    /* ******************************************************************************** */
    
    $("#searchVectorTabButton").click(function (event){
        updateSearchVectorTable();
    });
    
    var updateSearchVectorTable = function () {
        jQuery.getJSON(window.location.origin+"/searchVector", {}, function(data, textStatus, jqXHR){
            // Remove search vector table rows
            $("#searchVectorTable tbody tr").remove();
            
            var $searchVectorTableBody = $('#searchVectorTable tbody');
            
            var searchVectorSortedKeys = Object.keys(data.searchVector).sort();
            for (var keywordIndex in searchVectorSortedKeys){
                var keyword = searchVectorSortedKeys[keywordIndex];
                var keywordRow = $('<tr>')
                                    .attr('data-keyword', keyword)
                                    .append($('<td>').text(keyword))
                                    .append(
                                        $('<td>').append(buildDeleteSearchVectorKeywordButton(keyword))
                                    );
                $searchVectorTableBody.append(keywordRow);
            }
        });
    };
    
    var buildDeleteSearchVectorKeywordButton = function (keyword) {
        var button = $('<button>').addClass("btn btn-sm btn-danger").text("Delete");
        button.click({'keyword':keyword}, function (eventObject) {
            var keyword = eventObject.data.keyword;
            $("#searchVectorTable tr[data-keyword='"+keyword+"']").fadeOut(function () {
                // Send searchVector keyword to delete to back-end
                socket.emit('deleteSearchVectorKeyword', { 'keyword' : keyword });

                // Delete row
                $(this).remove();
            });
        });
        return button;
    };
    
    /* ******************************************************************************** */
    
    $("#addSearchVectorKeywordBtn").click(function (event) {
        var keyword = $("#searchVectorKeywordInput").val();
        if ( keyword ) {
            if ( socket ) {
                socket.emit('addSearchVectorKeyword', {'keyword' : keyword });
                $("#searchVectorKeywordInput").val("");
                updateSearchVectorTable();
            }
        }
    });
    
    /* ******************************************************************************** */
    
    var updatePagination = function (paginationId, activePage, pagesCount, tweetTableRowBuilder, tweetsSrcURL, tweetsTableId) {
        var $pagination = $("#"+paginationId);
        if ($pagination) {
            $pagination.children().remove();
            var $paginationPageItem = null;
            for (var i = 0; i < pagesCount; i++){
                $paginationPageItem = $("<li>").attr("data-page",i+1)
                                                .append($("<a>").attr("href","#").text(i+1))
                                                .click({
                                                    'page': i+1,
                                                    'tweetTableRowBuilder':tweetTableRowBuilder,
                                                    'tweetsSrcURL':tweetsSrcURL,
                                                    'tweetsTableId' : tweetsTableId,
                                                    'paginationId' : paginationId }, refreshTweetsEvent);
                
                if (activePage === (i+1)) {
                    $paginationPageItem.attr("class","active");
                } 
                $pagination.append($paginationPageItem);
            }
        }
    };
    
    var refreshTweetsEvent = function(eventObject) {
        var data = eventObject.data;
        refreshTweets(data.page, data.tweetTableRowBuilder, data.tweetsSrcURL, data.tweetsTableId, data.paginationId);
    };
    
    var refreshTweets = function(activePage, tweetTableRowBuilder, tweetsSrcURL, tweetsTableId, paginationId){
        jQuery.getJSON(window.location.origin+"/"+tweetsSrcURL, {'page':activePage}, function(data, textStatus, jqXHR) {
            var $tweetsTable = $("#"+tweetsTableId);
            $tweetsTable.find("tbody tr").remove();
            
            if (data) {
                updatePagination(paginationId, activePage, data.pages, tweetTableRowBuilder, tweetsSrcURL, tweetsTableId);
                
                for (tweetIndex in data.tweets) {
                    var tweet = data.tweets[tweetIndex];
                    $tweetsTable.append(tweetTableRowBuilder(tweet));
                }
            }
        });
    };
    
    var buildNoFeedbackTweetTableRow = function (tweet) {
        var $tweetRow = $('<tr>').attr('data-tweetid', tweet.id_str);

        var $usrImg = $('<a>').attr('target','_blank').attr('href','http://www.twitter.com/'+tweet.user.screen_name).append($('<img>').attr('src',tweet.user.profile_image_url).attr('style',"margin-right:3px;").tooltip({ placement : 'top', title : tweet.user.screen_name }));

        var $buttonApprove = $('<button>').attr('class','btn btn-sm btn-success').attr('style','margin-right:2px;').append('<span class="glyphicon glyphicon-ok"></span>').click({'tweetId' : tweet.id_str, 'socket' : socket, 'tweetsTableId' : 'noFeedbackTweetsTable'}, approveTweet);

        var $buttonReject = $('<button>').attr('class','btn btn-sm btn-danger').append('<span class="glyphicon glyphicon-remove"></span>').click({'tweetId' : tweet.id_str, 'socket':socket, 'tweetsTableId' : 'noFeedbackTweetsTable'}, rejectTweet);

        $tweetRow.append($('<td>').append($usrImg));
        $tweetRow.append($('<td>').text(tweet.text));
        $tweetRow.append($('<td>').text(new Date(tweet.created_at)));
        $tweetRow.append($('<td>').html('<a target="_blank" href="http://www.twitter.com/'+tweet.user.screen_name+'/statuses/'+tweet.id_str+'">Tweet URL</a>'));
        $tweetRow.append($('<td>').append($buttonApprove).append($buttonReject));
        
        return $tweetRow;
    };
    
    $("#noFeedbackTweetsTabButton").click(function (event){
        refreshTweets(1, buildNoFeedbackTweetTableRow, 'noFeedbackTweets', 'noFeedbackTweetsTable', 'paginationNoFeedbackTweets');
    });
    
    var buildFeedbackTweetTableRow = function (tweet) {
        var $tweetRow = $('<tr>').attr('data-tweetid', tweet.id_str);

        var $usrImg = $('<a>').attr('target','_blank').attr('href','http://www.twitter.com/'+tweet.user.screen_name).append($('<img>').attr('src',tweet.user.profile_image_url).attr('style',"margin-right:3px;").tooltip({ placement : 'top', title : tweet.user.screen_name }));

        $tweetRow.append($('<td>').append($usrImg));
        $tweetRow.append($('<td>').text(tweet.text));
        $tweetRow.append($('<td>').text(new Date(tweet.created_at)));
        $tweetRow.append($('<td>').html('<a target="_blank" href="http://www.twitter.com/'+tweet.user.screen_name+'/statuses/'+tweet.id_str+'">Tweet URL</a>'));
        
        return $tweetRow;
    };
    
    $("#approvedTweetsTabButton").click(function (event) {
        refreshTweets(1, buildFeedbackTweetTableRow, 'approvedTweets', 'approvedTweetsTable', 'paginationApprovedTweets');
    });
    
    $("#rejectedTweetsTabButton").click(function(event) {
        refreshTweets(1, buildFeedbackTweetTableRow, 'rejectedTweets', 'rejectedTweetsTable', 'paginationRejectedTweets');
    });
});

$(function (){
    socket = io.connect(window.location.origin);

    socket.on('twitterStreamOn', function (data) {
        $("#startStreaming").attr('disabled','disabled');
        $("#stopStreaming").removeAttr('disabled');
    });
    
    socket.on('twitterStreamOff', function (data){
        $("#startStreaming").removeAttr('disabled');
        $("#stopStreaming").attr('disabled','disabled');
    });
    
    socket.on('twitterStreamStartedByUser', function (data) {
        $("#startStreaming").attr('disabled','disabled');
        $("#stopStreaming").removeAttr('disabled');
        showFloatingAlert("Another user has started the stream");
    });
    
    socket.on('twitterStreamStoppedByUser', function(data) {
        $("#stopStreaming").attr('disabled','disabled');
        $("#startStreaming").removeAttr('disabled');
        showFloatingAlert("Another user has stopped the stream", 'danger');
    });
    
    socket.on('newTweet', function (data) {
        var $tweetsTableBody = $('#tweetsTable tbody');
        var $tweetRow = $('<tr>').attr('data-tweetid', data.tweet.id_str);

        var $usrImg = $('<a>').attr('target','_blank').attr('href','http://www.twitter.com/'+data.tweet.user.screen_name).append($('<img>').attr('src',data.tweet.user.profile_image_url).attr('style',"margin-right:3px;").tooltip({ placement : 'top', title : data.tweet.user.screen_name }));

        var $buttonApprove = $('<button>').attr('class','btn btn-sm btn-success').attr('style','margin-right:2px;').append('<span class="glyphicon glyphicon-ok"></span>').click({'tweetId' : data.tweet.id_str, 'socket' : socket, 'tweetsTableId' : 'tweetsTable'}, approveTweet);

        var $buttonReject = $('<button>').attr('class','btn btn-sm btn-danger').append('<span class="glyphicon glyphicon-remove"></span>').click({'tweetId' : data.tweet.id_str, 'socket':socket, 'tweetsTableId' : 'tweetsTable'}, rejectTweet);

        $tweetRow.append($('<td>').append($usrImg));
        $tweetRow.append($('<td>').text(data.tweet.text));
        $tweetRow.append($('<td>').text(data.similarity));
        $tweetRow.append($('<td>').text(new Date(data.tweet.created_at)));
        $tweetRow.append($('<td>').html('<a target="_blank" href="http://www.twitter.com/'+data.tweet.user.screen_name+'/statuses/'+data.tweet.id_str+'">Tweet URL</a>'));
        $tweetRow.append($('<td>').append($buttonApprove).append($buttonReject));
        $tweetsTableBody.append($tweetRow);
    });
    
    socket.on('newDocumentVector', function (data) {
        showFloatingAlert("A new document vector has been created!");
    });
});

var approveTweet = function (eventObject) {
    var tweetId = eventObject.data.tweetId;
    $("#"+eventObject.data.tweetsTableId+" tr[data-tweetid="+tweetId+"]").fadeOut(function () {
        // Send approved tweet id to back-end
        var socket = eventObject.data.socket;
        socket.emit('approveTweet', { 'tweetId' : tweetId });

        // Delete row
        $(this).remove();
    });
};

var rejectTweet = function (eventObject) {
    var tweetId = eventObject.data.tweetId;
    $("#"+eventObject.data.tweetsTableId+" tr[data-tweetid="+tweetId+"]").fadeOut(function () {
        // Send rejected tweet id to back-end
        var socket = eventObject.data.socket;
        socket.emit('rejectTweet', { 'tweetId' : tweetId });
        
        // Delete row
        $(this).remove();
    });
};

var showFloatingAlert = function(message, style) {
    var cssStyle = "alert-success";
    if (style === 'danger'){
        cssStyle = "alert-danger";
    }
    $('<div class="alert '+cssStyle+' floatingAlertMessage" style="display: none;">').append(message).appendTo($('body')).fadeIn(300).delay(1500).fadeOut(500);
};
