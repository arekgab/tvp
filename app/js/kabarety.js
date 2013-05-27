var PROCESS = require('child_process');
var HTTP = require('http');
var URL = require('url');
var CHEERIO = require('cheerio');
var REQUEST = require('request');
var FUTURES = require('futures');



var videoGrabber = function() {
    var CONSTANTS = {
        tvpVideoInfo: "http://www.tvp.pl/pub/stat/videofileinfo?video_id=",
        kabaretLoadSkecz: "http://kabaret.tworzymyhistorie.pl/inc/load_skecz.php?i=",
        initParams: "object param[name='InitParams']",
        kabaretIframe: "iframe[src*='tvp.pl']",
        kabaretMainIDVparam: "input[name='idv']",
        stateOK : "OK",
        stateERROR : "ERROR"
    };
    
    var state = CONSTANTS.stateOK;
    
    this.getState = function() {
        return state;
    }

    this.getAddressParam = function(request) {
        var urlInfo = URL.parse(request.url, true);
        return urlInfo.query.address;
    };

    function spawnVLC(videoUrl) {
        PROCESS.spawn("vlc", [videoUrl], {detached: true});
    };

    function parseAndLaunchTvpVideoInfo(objectId) {
        var url = CONSTANTS.tvpVideoInfo + objectId

        REQUEST(url, function(err, resp, body) {
            console.log("Getting: " + url);

            var json = JSON.parse(body);
//        console.log("BODY: " + body)
            console.log("VideoUrl: " + json.video_url);
            spawnVLC(json.video_url);
        });
    };

    function getTvpObjectIdFromURL(tvpUrl) {
        return tvpUrl.substring(tvpUrl.lastIndexOf('/') + 1);
    };

    function getTvpObjectIdFromBody(iframeUrl) {
        console.log("Looking for objectId in body...");
        REQUEST(iframeUrl, function(err, resp, body) {
            console.log("Getting iframeUrl: " + iframeUrl);
            $ = CHEERIO.load(body);
            var tvpUrl = $(CONSTANTS.initParams).attr("value");
            var arr = tvpUrl.split(",");
            var objectId = "xxxxx";
            for (var i = 0; i < arr.length; i++) {
                if (arr[i].indexOf("video_id") == 0) {
                    objectId = arr[i].split("=")[1];
                    break;
                }
            }
            console.log("video_id param: " + objectId);
            parseAndLaunchTvpVideoInfo(objectId);
        });
    };

    function getPopupPageContents(idv) {
        var url = CONSTANTS.kabaretLoadSkecz + idv;
        REQUEST(url, function(err, resp, body) {
            console.log("Getting: " + url);
            $ = CHEERIO.load(body);
            var tvpUrl = $(CONSTANTS.kabaretIframe).attr('src');
            console.log("tvpUrl: " + tvpUrl);
            var objectId = getTvpObjectIdFromURL(tvpUrl);
            console.log("objectId: " + objectId);
            if (objectId != 'player') {
                parseAndLaunchTvpVideoInfo(objectId);
            } else {
                getTvpObjectIdFromBody(tvpUrl);
            }
        });
    };
    
    this.getMainPageContents = function(url) {
//        console.log("URL from param: " + url);
//        REQUEST(url, function(err, resp, body) {
//            if (resp.statusCode == 200) {
//                $ = CHEERIO.load(body);
//                var idv = $(CONSTANTS.kabaretMainIDVparam).val();
//                console.log("idv: " + idv);
//
//                getPopupPageContents(idv);
//            }
//        });  

        test(url);
        return state;
    };
    
    
    function test(url){
        
        FUTURES.sequence()
            .then(function(next) {
                console.log("RUN request");
                REQUEST(url, next);
            })
            .then(function(next, err, response, body){
                $ = CHEERIO.load(body);
                var idv = $(CONSTANTS.kabaretMainIDVparam).val();
                console.log("idv: " + idv);
                next(err, idv);
            })
            .then(function(next, err, idv){
                var url = CONSTANTS.kabaretLoadSkecz + idv;
                REQUEST(url,next);
            })
            .then(function(next, err, response, body){
                console.log("Getting: " + url);
                $ = CHEERIO.load(body);
                var tvpUrl = $(CONSTANTS.kabaretIframe).attr('src');
                console.log("tvpUrl: " + tvpUrl);
                var objectId = getTvpObjectIdFromURL(tvpUrl);
                console.log("objectId: " + objectId);
                
                next(err, objectId, tvpUrl);
            })
             .then(function(next, err, objectId, tvpUrl){
                console.log("Trying to launch player..");
                if (objectId != 'player') {
                    FUTURES.sequence()
                        .then(function(next){
                            var urlInfo = CONSTANTS.tvpVideoInfo + objectId;
                            REQUEST(urlInfo, next);
                        })
                        .then(function(next, err, response, body){
                            console.log("Getting: " + url);
                            var json = JSON.parse(body);
                            console.log("VideoUrl: " + json.video_url);
                            spawnVLC(json.video_url);   
                        });
                } else {
                    console.log("processing tvpurl")
                    next(err, tvpUrl);
                }
            })
            .then(function(next, err, iframeUrl){
                console.log("Looking for objectId in body...");
                console.log("Getting iframeUrl: " + iframeUrl);
                REQUEST(iframeUrl, next); 
            })
            .then(function(next, err, response, body){
                $ = CHEERIO.load(body);
                var tvpUrl = $(CONSTANTS.initParams).attr("value");
                var arr = tvpUrl.split(",");
                var objectId = "xxxxx";
                for (var i = 0; i < arr.length; i++) {
                    if (arr[i].indexOf("video_id") == 0) {
                        objectId = arr[i].split("=")[1];
                        break;
                    }
                }
                console.log("video_id param: " + objectId);
                next(err, objectId);
            })
            .then(function(next, err, objectId){
                FUTURES.sequence()
                    .then(function(next){
                        var urlInfo = CONSTANTS.tvpVideoInfo + objectId;
                        REQUEST(urlInfo, next);
                    })
                    .then(function(next, err, response, body){
                        console.log("Getting: " + url);
                        var json = JSON.parse(body);
                        console.log("VideoUrl: " + json.video_url);
                        spawnVLC(json.video_url);   
                    });
            });
            
    };
};



HTTP.createServer(function(req, res) {
    res.writeHead(200, {'Content-Type': 'text/html'});
//    res.write("ok: " + getMainPageContents(getAddressParam(req)));
    var vg = new videoGrabber();
    var url = vg.getAddressParam(req);
    console.log("result: " + vg.getMainPageContents(url));
    res.write("ok: ");

    
    res.end();
}).listen(9000);
