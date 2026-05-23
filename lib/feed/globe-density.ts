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
};

const DEFAULT_MAX_VISIBLE_PER_BUCKET = 4;
const DEFAULT_BUCKET_SIZE_DEGREES = 0.08;

export function limitFeedGlobeDensity<TPoint extends FeedGlobeDensityPoint>(
  points: TPoint[],
  options: FeedGlobeDensityOptions = {},
): FeedGlobeDensityResult<TPoint> {
  const maxVisiblePerBucket = options.maxVisiblePerBucket ?? DEFAULT_MAX_VISIBLE_PER_BUCKET;
  const bucketSizeDegrees = options.bucketSizeDegrees ?? DEFAULT_BUCKET_SIZE_DEGREES;
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

  return {
    visiblePoints: visiblePoints.sort(compareNewestFirst),
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
