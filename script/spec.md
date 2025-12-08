Prebid

1. Find the pbjs namespace \_pbjsGlobals -> array the contains all the namespaces (there could be more than one)

2. Simulate bid (https://docs.prebid.org/dev-docs/bidders/ozone.html#test-parameters)

3. Subscribe to the appropriate events:

auctionEnd
bidResponse
bidWon
seatNonBid
bidRequested
bidderDone
bidRejected
bidderError
bidTimeout
The example below shows how these events can be used.

pbjs.getEvents().forEach(event => {
console.log("event: "+event.eventType)
});

one possibility is to just look at auctionEnd

4. What we want to know

- How many # a bidder was called
- How many # they responded
- How much time it took it to responde (latency)
- How many # they won (win rate)
- What is the CPM (bidResponse.cpm)
- How many # bidder timed out

- Request ID
- Response ID
- Session ID
- Page view ID
- bidder name
- User agent
- Domain
- User IP -> country code (later)
- ad unit code
- ad unit request sizes (request)
- ad unit response size (request)
- ad unit format
- pbjs timeout
- bidder timout
- timestamp
- bidder response time (delay in ms) - timeElapsed

5. What do we do if the auction already happened?

6. In prod, maybe batch events
