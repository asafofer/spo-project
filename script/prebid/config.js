// Prebid Configuration
window.pbjs = window.pbjs || {};
window.pbjs.que = window.pbjs.que || [];

var pbjs = window.pbjs;

// Configure Prebid with Ozone bidder (test parameters)
pbjs.que.push(() => {
  var adUnits = [
    {
      code: "ad-container",
      mediaTypes: {
        banner: {
          sizes: [
            [300, 250],
            [300, 600],
          ], // Match Ozone test example
        },
      },
      bids: [
        {
          bidder: "ozone",
          params: {
            publisherId: "OZONETST0001", // Test publisher ID
            siteId: "4204204201", // Test site ID
            placementId: "8000000125", // Test placement ID for banner
          },
        },
      ],
    },
  ];
  pbjs.addAdUnits(adUnits);
});

// Request bids after Prebid is ready
pbjs.que.push(() => {
  // Request bids
  pbjs.requestBids({
    timeout: 3000,
    bidsBackHandler: (_bidResponses) => {
      var adUnitCode = "ad-container";
      var bid = pbjs.getHighestCpmBids(adUnitCode)[0];
      if (bid) {
        pbjs.renderAd(document, adUnitCode);
      }
    },
  });
});
