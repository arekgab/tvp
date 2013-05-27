var PROCESS = require('child_process');
var HTTP = require('http');
var URL = require('url');
var CHEERIO = require('cheerio');
var REQUEST = require('request');


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
        console.log("URL from param: " + url);
        REQUEST(url, function(err, resp, body) {
            if (resp.statusCode == 200) {
                $ = CHEERIO.load(body);
                var idv = $(CONSTANTS.kabaretMainIDVparam).val();
                console.log("idv: " + idv);

                getPopupPageContents(idv);
            }
        });
        
        return state;
    };
};



//function getAddressParam(req) {
//    var urlInfo = URL.parse(req.url, true);
//    return urlInfo.query.address;
//}
//
//function spawnVLC(videoUrl) {
//    PROCESS.spawn("vlc", [videoUrl], {detached: true});
//}
//
//function getVideoUrl(objectId) {
//    var url = "http://www.tvp.pl/pub/stat/videofileinfo?video_id=" + objectId
//    REQUEST(url, function(err, resp, body) {
//        console.log("Getting: " + url);
//
//        var json = JSON.parse(body);
////        console.log("BODY: " + body)
//        console.log("VideoUrl: " + json.video_url);
//        spawnVLC(json.video_url);
//    });
//}
//
//
//function getTvpObjectId(tvpUrl) {
//    return tvpUrl.substring(tvpUrl.lastIndexOf('/') + 1);
//}
//
//function getTvpObjectIdFromBody(iframeUrl) {
//    console.log("Looking for objectId in body...");
//    REQUEST(iframeUrl, function(err, resp, body) {
//        console.log("Getting iframeUrl: " + iframeUrl);
//        $ = CHEERIO.load(body);
//        var tvpUrl = $("object param[name='InitParams']").attr("value");
//        var arr = tvpUrl.split(",");
//        var objectId = "xxxxx";
//        for (var i = 0; i < arr.length; i++) {
//            if (arr[i].indexOf("video_id") == 0) {
//                objectId = arr[i].split("=")[1];
//                break;
//            }
//        }
//        console.log("video_id param: " + objectId);
//        getVideoUrl(objectId);
//    });
//}
//
//function getPopupPageContents(idv) {
//    var url = "http://kabaret.tworzymyhistorie.pl/inc/load_skecz.php?i=" + idv;
//    REQUEST(url, function(err, resp, body) {
//        console.log("Getting: " + url);
//        $ = CHEERIO.load(body);
//        var tvpUrl = $("iframe[src*='tvp.pl']").attr('src');
//        console.log("tvpUrl: " + tvpUrl);
//        var objectId = getTvpObjectId(tvpUrl);
//        console.log("objectId: " + objectId);
//        if (objectId != 'player') {
//            getVideoUrl(objectId);
//        } else {
//            getTvpObjectIdFromBody(tvpUrl);
//        }
//    });
//}
//
//function getMainPageContents(url) {
//    console.log("URL from param: " + url);
//    REQUEST(url, function(err, resp, body) {
//        if (resp.statusCode == 200) {
//            $ = CHEERIO.load(body);
//            var idv = $('input[name="idv"]').val();
//            console.log("idv: " + idv);
//
//            getPopupPageContents(idv);
//        }
//    });
//}



HTTP.createServer(function(req, res) {
    res.writeHead(200, {'Content-Type': 'text/html'});
//    res.write("ok: " + getMainPageContents(getAddressParam(req)));
    var vg = new videoGrabber();
    var url = vg.getAddressParam(req);
    console.log("result: " + vg.getMainPageContents(url));
    res.write("ok: ");

    
    res.end();
}).listen(9000);




//var url = "http://sdtvod.v3.tvp.pl/snode13/51207b27cb2e93be-f261e69bf1e34cdc-6920950cd3f055e9.tvp2_restauracja_od_tylu_37803.wmv"
//process.spawn("vlc", [], { detached: true });
