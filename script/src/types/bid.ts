export type Bid = Record<string, unknown> & {
  bidder?: string;
  bidderCode?: string;
  adUnitCode?: string;
  auctionId?: string;
  requestId?: string;
  bidId?: string;
  bidderRequestId?: string;
  sizes?: number[][];
  mediaTypes?: Record<string, unknown>;
  timeout?: number;
  size?: string;
  width?: number;
  height?: number;
  rejectionReason?: string;
  mediaType?: string;
  requestTimestamp?: number;
  responseTimestamp?: number;
  timeToRespond?: number;
  cpm?: number;
  currency?: string;
};

