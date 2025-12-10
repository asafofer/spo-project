// Production-ready Prebid Data Collector
// Minimal version: Only locates and logs Prebid instance

import { generateUUID, getSessionId } from "./utils";

(function () {
  "use strict";

  // Initialize pbjs.que before Prebid loads to ensure we run first
  // This queue executes callbacks before Prebid processes anything
  window.pbjs = window.pbjs || {};
  window.pbjs.que = window.pbjs.que || [];

  // Endpoint configuration
  var ENDPOINT_URL = "http://localhost:3001/events";

  /**
   * Generate pageview ID on script load
   * Each page load gets a new pageview ID
   */
  var pageviewID = generateUUID();

  /**
   * Get current domain
   * @returns {string} Domain name
   */
  function getDomain() {
    try {
      return window.location.hostname || null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Extract common bid fields and add required parameters
   * Unifies common bid extraction and required params enrichment
   * @param {Object} bid - The bid object
   * @param {Object} event - The event object (optional, for fallback values)
   * @returns {Object} Object with common bid fields and required params
   */
  function extractCommonBidFields(bid, event) {
    return {
      // Common bid fields
      adUnitCode: bid ? bid.adUnitCode || null : null,
      adUnitRequestSizes: bid ? bid.sizes || null : null,
      adUnitFormat:
        bid && bid.mediaTypes ? Object.keys(bid.mediaTypes)[0] || null : null,
      mediaTypes: bid && bid.mediaTypes ? Object.keys(bid.mediaTypes) : null,
      bidId: bid ? bid.bidId || null : null,
      auctionId: bid
        ? bid.auctionId || (event && event.auctionId) || null
        : (event && event.auctionId) || null,
      // Required params
      sessionId: getSessionId(),
      pageViewId: (event && event.pageViewId) || pageviewID,
      domain: getDomain(),
      timestamp: Date.now(), // Will be overridden by event-specific timestamp if provided
    };
  }

  /**
   * Locate Prebid instance from _pbjsGlobals namespace array
   * Prebid can have multiple instances, so we check the global namespace
   */
  function locatePrebidInstance() {
    // Check for _pbjsGlobals array (contains all Prebid namespaces)
    if (window._pbjsGlobals && Array.isArray(window._pbjsGlobals)) {
      return window._pbjsGlobals;
    }
    return null;
  }

  /**
   * Get namespace name for an instance by finding which property on window points to it
   * Optimized to avoid iterating through all window properties (performance)
   */
  function getNamespaceName(pbjsInstance) {
    // Check if it's the default pbjs (most common case)
    if (pbjsInstance === window.pbjs) {
      return "pbjs";
    }

    // First check _pbjsGlobals for string namespaces (faster than iterating window)
    var namespaces = locatePrebidInstance();
    if (namespaces) {
      for (var i = 0; i < namespaces.length; i++) {
        if (
          typeof namespaces[i] === "string" &&
          window[namespaces[i]] === pbjsInstance
        ) {
          return namespaces[i];
        }
      }
    }

    // Last resort: search window properties (slow, but only if namespace not found above)
    // Limit search to common Prebid namespace patterns to avoid full window scan
    var commonNames = ["pbjs", "prebid", "pbjs_0", "pbjs_1"];
    for (var j = 0; j < commonNames.length; j++) {
      if (window[commonNames[j]] === pbjsInstance) {
        return commonNames[j];
      }
    }

    return "unknown";
  }

  /**
   * Get all pbjs instances (from default and all namespaces)
   * Returns array of objects with {instance, namespace}
   */
  function getAllPbjsInstances() {
    var instances = [];

    // Add default pbjs if it exists
    if (window.pbjs && typeof window.pbjs === "object") {
      instances.push({
        instance: window.pbjs,
        namespace: "pbjs",
      });
    }

    // Get all instances from _pbjsGlobals
    var namespaces = locatePrebidInstance();
    if (namespaces && namespaces.length > 0) {
      namespaces.forEach(function (namespace) {
        var pbjsInstance = null;
        var namespaceName = null;

        // If namespace is an object with pbjs property
        if (namespace && typeof namespace === "object" && namespace.pbjs) {
          pbjsInstance = namespace.pbjs;
          namespaceName = getNamespaceName(pbjsInstance);
        }
        // If namespace is a string like 'pbjs', try window[namespace]
        else if (typeof namespace === "string" && window[namespace]) {
          pbjsInstance = window[namespace];
          namespaceName = namespace;
        }

        // Add instance if found and not already in array
        if (pbjsInstance) {
          var alreadyAdded = instances.some(function (item) {
            return item.instance === pbjsInstance;
          });

          if (!alreadyAdded && pbjsInstance !== window.pbjs) {
            instances.push({
              instance: pbjsInstance,
              namespace: namespaceName || getNamespaceName(pbjsInstance),
            });
          }
        }
      });
    }

    return instances;
  }

  // Event queue: stores events grouped by auctionId
  // Structure: { auctionId: [event1, event2, ...], ... }
  var eventQueue = {};

  /**
   * Extract auctionId from event(s)
   * @param {Object|Array} eventData - Single event or array of events
   * @returns {string|null} Auction ID or null
   */
  function extractAuctionId(eventData) {
    if (Array.isArray(eventData)) {
      // Get auctionId from first event that has it
      for (var i = 0; i < eventData.length; i++) {
        var auctionId = eventData[i].auctionId || eventData[i].requestId;
        if (auctionId) return auctionId;
      }
      return null;
    }
    return eventData.auctionId || eventData.requestId || null;
  }

  /**
   * Add events to queue grouped by auctionId
   * @param {Object|Array} eventData - Single event or array of events
   */
  function addToQueue(eventData) {
    var events = Array.isArray(eventData) ? eventData : [eventData];
    var auctionId = extractAuctionId(events);

    if (!auctionId) {
      // If no auctionId, use a fallback key for orphaned events
      auctionId = "__orphaned__";
    }

    if (!eventQueue[auctionId]) {
      eventQueue[auctionId] = [];
    }

    // Add all events to the queue for this auction
    events.forEach(function (event) {
      eventQueue[auctionId].push(event);
    });
  }

  /**
   * Flush and send all events for a specific auction
   * @param {string} auctionId - The auction ID to flush
   */
  function flushQueueByAuctionId(auctionId) {
    if (!auctionId || !eventQueue[auctionId]) return;

    var events = eventQueue[auctionId];
    if (events.length > 0) {
      fetch(ENDPOINT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(events),
      })
        .then(function () {
          // Only remove from queue after successful send
          delete eventQueue[auctionId];
        })
        .catch(function (error) {
          // Silently fail - don't log errors to avoid console spam
          // Events remain in queue for potential retry on next auctionEnd
        });
    }
  }

  /**
   * Flush and send all queued events (for session end)
   */
  function flushAllQueuedEvents() {
    var allEvents = [];
    var auctionIds = Object.keys(eventQueue);

    // Collect all events from all auctions
    auctionIds.forEach(function (auctionId) {
      allEvents = allEvents.concat(eventQueue[auctionId]);
    });

    if (allEvents.length > 0) {
      // Use sendBeacon for session end (more reliable when page is unloading)
      var jsonData = JSON.stringify(allEvents);
      var blob = new Blob([jsonData], { type: "application/json" });
      navigator.sendBeacon(ENDPOINT_URL, blob);
      // Clear the queue
      eventQueue = {};
    }
  }

  /**
   * Handle bidRequested event
   * @param {Object} event - The bidRequested event
   * @param {string} namespace - The namespace name
   */
  function handleBidRequested(event, namespace) {
    console.log(`[Collector Event] ${namespace} bidRequested (raw):`, event);

    var bids = event.bids || [];
    var ortb2 = event.ortb2 || {};

    // Map over all bids to create one event per bid
    var formattedDataArray = bids.map(function (bid) {
      var bidOrtb2 = bid.ortb2 || ortb2;
      var commonFields = extractCommonBidFields(bid, event);
      return Object.assign({}, commonFields, {
        eventType: "bidRequested",
        requestId: event.auctionId || null,
        bidderCode: event.bidderCode || null,
        userAgent: bidOrtb2.device ? bidOrtb2.device.ua || null : null,
        domain: (bidOrtb2.site && bidOrtb2.site.domain) || commonFields.domain,
        pbjsTimeout: event.timeout || null,
        timestamp: event.auctionStart || event.start || commonFields.timestamp,
        bidderRequestId: event.bidderRequestId || null,
      });
    });

    console.log(
      `[Collector Event] ${namespace} bidRequested (formatted):`,
      formattedDataArray
    );
    addToQueue(formattedDataArray);
  }

  /**
   * Handle bidderDone event
   * @param {Object} event - The bidderDone event
   * @param {string} namespace - The namespace name
   */
  function handleBidderDone(event, namespace) {
    console.log(`[Collector Event] ${namespace} bidderDone (raw):`, event);

    var bids = event.bids || [];
    var metrics = event.metrics || {};

    // Calculate bidder response time (total time for bidder)
    var bidderResponseTime = null;
    if (metrics["adapters.client." + event.bidderCode + ".total"]) {
      bidderResponseTime =
        metrics["adapters.client." + event.bidderCode + ".total"];
    } else if (metrics["adapter.client.total"]) {
      bidderResponseTime = metrics["adapter.client.total"];
    }

    // Map over all bids to create one event per bid
    var formattedDataArray = bids.map(function (bid) {
      var ortb2 = bid.ortb2 || event.ortb2 || {};

      var commonFields = extractCommonBidFields(bid, event);
      return Object.assign({}, commonFields, {
        eventType: "bidderDone",
        requestId: event.auctionId || null,
        bidderCode: event.bidderCode || null,
        userAgent: ortb2.device ? ortb2.device.ua || null : null,
        domain: (ortb2.site && ortb2.site.domain) || commonFields.domain,
        timestamp: event.timestamp || commonFields.timestamp,
        bidderRequestId: event.bidderRequestId || null,
        bidderResponseTime: bidderResponseTime,
      });
    });

    console.log(
      `[Collector Event] ${namespace} bidderDone (formatted):`,
      formattedDataArray
    );
    addToQueue(formattedDataArray);
  }

  /**
   * Generic handler for bid response events (bidResponse, bidRejected, bidWon, etc.)
   * @param {string} eventType - The event type name
   * @param {Object} bidResponse - The bid response object
   * @param {string} namespace - The namespace name
   */
  function handleBidResponse(eventType, bidResponse, namespace) {
    console.log(
      `[Collector Event] ${namespace} ${eventType} (raw):`,
      bidResponse
    );

    var formattedData = {
      eventType: eventType,
      requestId: bidResponse.auctionId || null,
      auctionId: bidResponse.auctionId || null,
      pageViewId: pageviewID,
      bidderCode: bidResponse.bidder || null,
      adUnitCode: bidResponse.adUnitCode || null,
      adUnitRequestSizes: bidResponse.size ? [bidResponse.size] : null,
      adUnitFormat: null, // Not available in bid response events
      mediaTypes: null, // Not available in bid response events
      bidId: bidResponse.bidId || bidResponse.requestId || null,
      userAgent: null, // Not available in bid response events
      domain: getDomain(),
      timestamp:
        bidResponse.responseTimestamp ||
        bidResponse.requestTimestamp ||
        Date.now(),
      bidderRequestId: null, // Not available in bid response events
      cpm: bidResponse.cpm || null,
      currency: bidResponse.currency || null,
      status: bidResponse.status || null,
      requestTimestamp: bidResponse.requestTimestamp || null,
      responseTimestamp: bidResponse.responseTimestamp || null,
      timeToRespond: bidResponse.timeToRespond || null,
      sessionId: getSessionId(),
    };

    console.log(
      `[Collector Event] ${namespace} ${eventType} (formatted):`,
      formattedData
    );
    addToQueue(formattedData);
  }

  /**
   * Handle bidTimeout event
   * @param {Array} timeoutedBids - Array of timed-out bid objects
   * @param {string} namespace - The namespace name
   */
  function handleBidTimeout(timeoutedBids, namespace) {
    console.log(
      `[Collector Event] ${namespace} bidTimeout (raw):`,
      timeoutedBids
    );

    // Map over all timeouted bids to create one event per bid
    var formattedDataArray = timeoutedBids.map(function (bid) {
      var commonFields = extractCommonBidFields(bid, null);
      return Object.assign({}, commonFields, {
        eventType: "bidTimeout",
        requestId: bid.auctionId || null,
        bidderCode: bid.bidder || null,
        userAgent: null, // Not available in timeout event
        pbjsTimeout: bid.timeout || null,
        bidderRequestId: bid.bidderRequestId || null,
      });
    });

    console.log(
      `[Collector Event] ${namespace} bidTimeout (formatted):`,
      formattedDataArray
    );
    addToQueue(formattedDataArray);
  }

  /**
   * Subscribe to Prebid events and log them
   * @param {Object} pbjs - The pbjs instance to subscribe to
   * @param {string} namespace - The namespace name (e.g., 'pbjs')
   */
  function subscribeToEvents(pbjs, namespace) {
    // Events we care about
    var events = [
      "bidRequested",
      "bidTimeout",
      "bidResponse",
      "bidRejected",
      "bidWon",
    ];

    // Subscribe to events using the unified handler pattern
    events.forEach(function (eventType) {
      try {
        pbjs.onEvent(eventType, function (data) {
          if (eventType === "bidRequested") {
            // data is a "bidderRequest" that contains multiple bids
            return handleBidRequested(data, namespace);
          }
          if (eventType === "bidTimeout") {
            // data is an array of "bid" (request per specific ad unit) objects
            return handleBidTimeout(data, namespace);
          }
          // All other events emit bid response object (per specific ad unit)
          return handleBidResponse(eventType, data, namespace);
        });
      } catch (error) {
        console.error(
          `[Collector] Error subscribing to ${namespace} ${eventType}:`,
          error
        );
      }
    });

    // Keep bidderDone as separate handler (not in research list but we use it)
    try {
      pbjs.onEvent("bidderDone", function (event) {
        handleBidderDone(event, namespace);
      });
    } catch (error) {
      console.error(
        `[Collector] Error subscribing to ${namespace} bidderDone:`,
        error
      );
    }

    // Handle auctionEnd - flush queue for this auction
    try {
      pbjs.onEvent("auctionEnd", function (event) {
        console.log(`[Collector Event] ${namespace} auctionEnd:`, event);
        var auctionId = event.auctionId || null;
        if (auctionId) {
          flushQueueByAuctionId(auctionId);
        }
      });
    } catch (error) {
      console.error(
        `[Collector] Error subscribing to ${namespace} auctionEnd:`,
        error
      );
    }

    // Other events (generic log only)
    var otherEventTypes = ["auctionInit", "seatNonBid"];

    otherEventTypes.forEach(function (eventType) {
      try {
        pbjs.onEvent(eventType, function (event) {
          console.log(`[Collector Event] ${namespace} ${eventType}:`, event);
        });
      } catch (error) {
        console.error(
          `[Collector] Error subscribing to ${namespace} ${eventType}:`,
          error
        );
      }
    });
  }

  // Setup session end handler using visibilitychange event
  // Sends all queued events when page becomes hidden
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "hidden") {
      // Page is being hidden - flush all queued events using sendBeacon
      flushAllQueuedEvents();
    }
  });

  // Track which instances we've already subscribed to (avoid duplicates)
  var subscribedInstances = [];
  var retryCount = 0;
  var MAX_RETRIES = 50; // 50 retries × 100ms = 5 seconds max

  /**
   * Initialize collector - wait for Prebid to be ready
   */
  function initCollector() {
    var instances = getAllPbjsInstances();

    if (instances.length > 0) {
      // Subscribe to events on all instances
      instances.forEach(function (item) {
        var pbjs = item.instance;
        var namespace = item.namespace;

        // Skip if already subscribed to this instance
        if (subscribedInstances.indexOf(pbjs) !== -1) {
          return;
        }

        if (typeof pbjs.onEvent === "function") {
          // Subscribe to future events
          subscribeToEvents(pbjs, namespace);

          // Mark as subscribed
          subscribedInstances.push(pbjs);
        }
      });
    } else {
      // Prebid not ready yet - retry with limit
      if (retryCount >= MAX_RETRIES) {
        console.error(
          `[Collector] Max retries (${MAX_RETRIES}) reached. Prebid not found.`
        );
        return;
      }

      retryCount++;
      setTimeout(initCollector, 100);
    }
  }

  /**
   * Setup subscription using Prebid's queue system
   * This ensures we subscribe before Prebid processes any events
   */
  function setupSubscriptionViaQueue() {
    // Add to Prebid's queue - this will execute before Prebid processes anything
    window.pbjs.que.push(function () {
      // Now pbjs is fully initialized, subscribe to events
      var instances = getAllPbjsInstances();

      if (instances.length > 0) {
        instances.forEach(function (item) {
          var pbjs = item.instance;
          var namespace = item.namespace;

          // Skip if already subscribed to this instance
          if (subscribedInstances.indexOf(pbjs) !== -1) {
            return;
          }

          if (typeof pbjs.onEvent === "function") {
            // Subscribe to future events
            subscribeToEvents(pbjs, namespace);

            // Mark as subscribed
            subscribedInstances.push(pbjs);
          }
        });
      }
    });
  }

  // Setup subscription via queue immediately (before Prebid loads)
  setupSubscriptionViaQueue();

  // Also try direct initialization as fallback (for cases where queue already processed)
  initCollector();
})();
