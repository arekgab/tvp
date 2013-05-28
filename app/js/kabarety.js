var PROCESS = require('child_process');
var HTTP = require('http');
var URL = require('url');
var CHEERIO = require('cheerio');
var REQUEST = require('request');
var Events = require('events');

var EventType = {
    BeginProcess: "beginEvent",
    IdvEvent: "idvEvent",
    PlayerObjectId: "playerEvent",
    NumberObjectId: "numberEvent",
    SpawnVlc: "SpawnVlcEvent",
    EndRequest: "endEvent",
    ErrorEvent: "errorEvent"

}

function VideoGrabber() {

    var res = null;
    var eventBus = new Events.EventEmitter();

    var CONSTANTS = {
        tvpVideoInfo: "http://www.tvp.pl/pub/stat/videofileinfo?video_id=",
        kabaretLoadSkecz: "http://kabaret.tworzymyhistorie.pl/inc/load_skecz.php?i=",
        initParams: "object param[name='InitParams']",
        kabaretIframe: "iframe[src*='tvp.pl']",
        kabaretMainIDVparam: "input[name='idv']",
        stateOK: "OK",
        stateERROR: "ERROR"
    };

    var state = CONSTANTS.stateOK;

    function getState() {
        return state;
    }

    this.getAddressParam = function(request) {
        var urlInfo = URL.parse(request.url, true);
        return urlInfo.query.address;
    }
    ;

    function getIdvParamFormAddress(url) {
        console.log("RUN request");
        REQUEST(url, function(err, response, body) {
            $ = CHEERIO.load(body);
            var idv = $(CONSTANTS.kabaretMainIDVparam).val();
            console.log("idv: " + idv);

            eventBus.emit(EventType.IdvEvent, idv);
        });
    }
    ;

    function getTvpObjectIdFromURL(tvpUrl) {
        return tvpUrl.substring(tvpUrl.lastIndexOf('/') + 1);
    }
    ;

    function getObjectIdFromPageSkecz(idv) {
        var url = CONSTANTS.kabaretLoadSkecz + idv;
        console.log("Getting: " + url);
        REQUEST(url, function(err, response, body) {
            $ = CHEERIO.load(body);
            var tvpUrl = $(CONSTANTS.kabaretIframe).attr('src');
            console.log("tvpUrl: " + tvpUrl);
            var objectId = getTvpObjectIdFromURL(tvpUrl);
            console.log("objectId: " + objectId);

            if (objectId == "player") {
                eventBus.emit(EventType.PlayerObjectId, tvpUrl);
            } else {
                eventBus.emit(EventType.NumberObjectId, objectId);
            }
        });
    }
    ;


    function processTvpVideoInfo(objectId) {
        var urlInfo = CONSTANTS.tvpVideoInfo + objectId;
        REQUEST(urlInfo, function(err, response, body) {
            console.log("Getting: " + urlInfo);
            var json = JSON.parse(body);
            console.log("VideoUrl: " + json.video_url);

            eventBus.emit(EventType.SpawnVlc, json.video_url);
        });
    }
    ;

    function spawnVLC(videoUrl) {
        PROCESS.spawn("vlc", [videoUrl], {detached: true});

        eventBus.emit(EventType.EndRequest, "end");
    }
    ;


    function processFrameContent(iframeUrl) {
        console.log("Looking for objectId in body...");
        console.log("Getting iframeUrl: " + iframeUrl);
        REQUEST(iframeUrl, function(err, response, body, next) {
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

            eventBus.emit(EventType.NumberObjectId, objectId);
            ;
        });
    }
    ;

    this.process = function(url, response) {
        res = response;
        eventBus.emit(EventType.BeginProcess, url);
    }

    eventBus.on(EventType.BeginProcess, function(url) {
        console.log("====> EVENT: " + EventType.BeginProcess);
        getIdvParamFormAddress(url);
    });

    eventBus.on(EventType.IdvEvent, function(idv) {
        console.log("====> EVENT: " + EventType.IdvEvent);
        getObjectIdFromPageSkecz(idv);
    });

    eventBus.on(EventType.NumberObjectId, function(objectId) {
        console.log("====> EVENT: " + EventType.NumberObjectId);
        processTvpVideoInfo(objectId);
    });

    eventBus.on(EventType.SpawnVlc, function(videoUrl) {
        console.log("====> EVENT: " + EventType.SpawnVlc);
        spawnVLC(videoUrl);
    });

    eventBus.on(EventType.PlayerObjectId, function(iframeUrl) {
        console.log("====> EVENT: " + EventType.PlayerObjectId);
        processFrameContent(iframeUrl);
    });

    eventBus.on(EventType.EndRequest, function() {
        console.log("====> EVENT: " + EventType.EndRequest);
        res.writeHead(200, {'Content-Type': 'text/html'});

        res.write("ok: ");

        console.log("DONE");
        res.end();
    });

    eventBus.on(EventType.ErrorEvent, function(error) {
        console.log("====> EVENT: " + EventType.ErrorEvent);
        //TODO error handling
    });

}
;

var vg = new VideoGrabber();

HTTP.createServer(function(req, res) {

    var url = vg.getAddressParam(req);
    vg.process(url, res);

}).listen(9000);