export type FeedGlobeDensityPoint = {
  id: number;
  createdAt: number;
  lat: number;
  long: number;
};

export type FeedGlobeOverflowIndicator = {
  id: string;
  bucketKey: string;
  hiddenCount: number;
  lat: number;
  long: number;
};

export type FeedGlobeDensityResult<TPoint extends FeedGlobeDensityPoint> = {
  visiblePoints: TPoint[];
  hiddenPointIds: number[];
  fadingPointIds: number[];
  overflowIndicators: FeedGlobeOverflowIndicator[];
};

export type FeedGlobeDensityOptions = {
  maxVisiblePerBucket?: number;
  bucketSizeDegrees?: number;
  maxVisible?: number;
};

const DEFAULT_MAX_VISIBLE_PER_BUCKET = 4;
const DEFAULT_BUCKET_SIZE_DEGREES = 0.08;
// Global ceiling on simultaneously-rendered points. Each visible point is a real
// DOM marker that the globe repositions on every spin frame, so an unbounded
// count tanks the frame rate once posts spread worldwide. The newest points stay
// visible; the rest fold into their bucket's "+N" overflow indicator.
const DEFAULT_MAX_VISIBLE_TOTAL = 80;

export function limitFeedGlobeDensity<TPoint extends FeedGlobeDensityPoint>(
  points: TPoint[],
  options: FeedGlobeDensityOptions = {},
): FeedGlobeDensityResult<TPoint> {
  const maxVisiblePerBucket = options.maxVisiblePerBucket ?? DEFAULT_MAX_VISIBLE_PER_BUCKET;
  const bucketSizeDegrees = options.bucketSizeDegrees ?? DEFAULT_BUCKET_SIZE_DEGREES;
  const maxVisible = options.maxVisible ?? DEFAULT_MAX_VISIBLE_TOTAL;
  const buckets = new Map<string, TPoint[]>();

  for (const point of points.filter(isValidPoint)) {
    const bucketKey = getFeedGlobeBucketKey(point, bucketSizeDegrees);
    const bucket = buckets.get(bucketKey) ?? [];
    bucket.push(point);
    buckets.set(bucketKey, bucket);
  }

  const visiblePoints: TPoint[] = [];
  const hiddenPointIds: number[] = [];
  const fadingPointIds: number[] = [];
  const overflowIndicators: FeedGlobeOverflowIndicator[] = [];

  for (const [bucketKey, bucketPoints] of buckets.entries()) {
    const sorted = [...bucketPoints].sort(compareNewestFirst);
    const visible = sorted.slice(0, maxVisiblePerBucket);
    const hidden = sorted.slice(maxVisiblePerBucket);

    visiblePoints.push(...visible);
    hiddenPointIds.push(...hidden.map(point => point.id));
    fadingPointIds.push(...hidden.map(point => point.id));

    if (hidden.length > 0) {
      const anchor = visible[0] ?? sorted[0];
      overflowIndicators.push({
        id: `${bucketKey}:overflow`,
        bucketKey,
        hiddenCount: hidden.length,
        lat: anchor.lat,
        long: anchor.long,
      });
    }
  }

  const orderedVisible = visiblePoints.sort(compareNewestFirst);

  // Per-bucket capping alone can still leave hundreds of points when posts are
  // spread across many regions. Apply a global ceiling on top: keep the newest
  // `maxVisible` and demote the rest into their bucket's overflow indicator.
  if (orderedVisible.length <= maxVisible) {
    return {
      visiblePoints: orderedVisible,
      hiddenPointIds,
      fadingPointIds,
      overflowIndicators,
    };
  }

  const keptVisible = orderedVisible.slice(0, maxVisible);
  const demotedVisible = orderedVisible.slice(maxVisible);

  hiddenPointIds.push(...demotedVisible.map(point => point.id));
  fadingPointIds.push(...demotedVisible.map(point => point.id));

  const overflowByBucket = new Map<string, FeedGlobeOverflowIndicator>();
  for (const indicator of overflowIndicators)
    overflowByBucket.set(indicator.bucketKey, indicator);

  for (const point of demotedVisible) {
    const bucketKey = getFeedGlobeBucketKey(point, bucketSizeDegrees);
    const existing = overflowByBucket.get(bucketKey);
    if (existing) {
      existing.hiddenCount += 1;
      continue;
    }

    const indicator: FeedGlobeOverflowIndicator = {
      id: `${bucketKey}:overflow`,
      bucketKey,
      hiddenCount: 1,
      lat: point.lat,
      long: point.long,
    };
    overflowByBucket.set(bucketKey, indicator);
    overflowIndicators.push(indicator);
  }

  return {
    visiblePoints: keptVisible,
    hiddenPointIds,
    fadingPointIds,
    overflowIndicators,
  };
}

export function getFeedGlobeBucketKey(point: FeedGlobeDensityPoint, bucketSizeDegrees = DEFAULT_BUCKET_SIZE_DEGREES) {
  const latBucket = Math.floor((point.lat + 90) / bucketSizeDegrees);
  const longBucket = Math.floor((point.long + 180) / bucketSizeDegrees);
  return `${latBucket}:${longBucket}`;
}

function compareNewestFirst(a: FeedGlobeDensityPoint, b: FeedGlobeDensityPoint) {
  if (b.createdAt !== a.createdAt)
    return b.createdAt - a.createdAt;

  return b.id - a.id;
}

function isValidPoint(point: FeedGlobeDensityPoint) {
  return Number.isFinite(point.lat)
    && Number.isFinite(point.long)
    && point.lat >= -90
    && point.lat <= 90
    && point.long >= -180
    && point.long <= 180;
}
