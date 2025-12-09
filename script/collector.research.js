(function () {
    var pbjs = window.pbjs || {};
    pbjs.que = window.pbjs.que || [];

    var pageviewID = '1234'; // generate UUID
    sessionKey = '__sid__'; // don't collide

    function getSessionId () {
        var sessionId = sessionStorage.getItem(sessionKey); // try... catch, throws in private
        if (!sessionId) {
            sessionId = '5678'; // generate UUID
            sessionStorage.setItem(sessionKey, sessionId);
        }
        return sessionId;
    }

    var events = ['bidRequested', 'bidTimeout', 'bidResponse', 'bidRejected', 'bidWon'];

    function addRequiredParams (data) {
        data.sessionId = getSessionId();
        // add session/pageview IDs, domain, timestamp, whatever else
    }
    
    function send (data) {
        var completeData = data.map(addRequiredParams);
        // ... ajax
    }

    function handleBidRequested (bidderRequest) {
        var bids = bidderRequest.bids.map(function (bid) {
            return {
                bidder: bid.bidder, // bidder name, e.g. pubmatic
                adUnitCode: bid.adUnitCode, //ad unit name, e.g. skyscraper_atf_desktop-1
                auctionId: bid.auctionId, // auction UUID, e.g. f135a729-0ab1-4c30-8097-8050dae01610
                bidId: bid.bidId, // bid request UUID, e.g. 510eb5c4e0c0ac87
                bidderRequestId: bid.bidderRequestId, // bidder request UUID (1 bidder request : N bid requests, 1 per ad unit), e.g. 5094e9ddba5973bc
                mediaTypes: Object.keys(bid.mediaTypes), // array of media types e.g. ['banner', 'video']
                sizes: bid.sizes, // array of sizes e.g. [[970,90],[728,90]]
                auctionStart: bidderRequest.auctionStart, // auction start timestamp, e.g. 1765274243382
                timeout: bidderRequest.timeout, // auction timeout in ts, e.g. 3000
            }
        });
        send(bids); 
    }

    function handleBidTimeout (timeoutedBids) {
        var now = Date.now();
        var bids = timeoutedBids.map(function (bid) {
            return {
                bidder: bid.bidder, // bidder name, e.g. pubmatic
                adUnitCode: bid.adUnitCode, //ad unit name, e.g. skyscraper_atf_desktop-1
                auctionId: bid.auctionId, // auction UUID, e.g. f135a729-0ab1-4c30-8097-8050dae01610
                bidId: bid.bidId, // bid request UUID, e.g. 510eb5c4e0c0ac87
                bidderRequestId: bid.bidderRequestId, // bidder request UUID (1 bidder request : N bid requests, 1 per ad unit), e.g. 5094e9ddba5973bc
                sizes: bid.sizes, // array of sizes e.g. [[970,90],[728,90]]
//  N/A         auctionStart: bidderRequest.auctionStart, // auction start timestamp, e.g. 1765274243382
                timeout: bid.timeout, // auction timeout in ts, e.g. 3000
            }
        });
        send(bids); 
    }

    function handleBidResponse (bidRepsonse) {
        var bid = {
            bidder,
            adUnitCode,
            auctionId,
            bidId, // matches the bid request's bid ID. Docs says it should be "requestId" here, it seems both present
//  N/A     bidderRequestId: bid.bidderRequestId, // bidder request UUID (1 bidder request : N bid requests, 1 per ad unit), e.g. 5094e9ddba5973bc
            size,
            requestTimestamp,
            responseTimestamp,
            timeToRespond, // only keep this?
            cpm,
            currency,
            status, // is "rendered" when won
        } = bidRepsonse;
        // queue?
        send([bid]);
    }

    function createHandlerFor (event) {
        return function (data) {
            if (event === 'bidRequested') {
                // here, data is a "bidderRequest" that contains multiple bids (one per each ad unit that the bidder is bidding on)
                return handleBidRequested(data);
            }
            if (event === 'bidTimeout') {
                // here, data is an array of "bid" (request per specfic ad unit) objects
                return handleBidTimeout(data);
            }
            // here, data is a bid response object (per specific ad unit)
            return handleBidResponse(data);
        }
    }

    pbjs.que.push(function () {
        events.forEach(event => pbjs.onEvent(event, createHandlerFor(event)));
    });
})();