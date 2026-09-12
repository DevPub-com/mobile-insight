import type { AppInfo, MetricObservation } from '@/domain/types';

export function parseGoogleStoreRating(html: string): number {
  for (const match of html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    const data = JSON.parse(match[1]);
    const value = Number(data.aggregateRating?.ratingValue);
    if (Number.isFinite(value) && value >= 1 && value <= 5) return value;
  }
  throw new Error('Google Play 공개 평점이 없습니다.');
}

export async function fetchGoogleStoreRating(app: AppInfo, now = new Date()): Promise<MetricObservation> {
  if (!app.androidPackageName) throw new Error('Android package missing');
  const query = new URLSearchParams({id:app.androidPackageName,hl:'ko',gl:'KR'});
  const response = await fetch(`https://play.google.com/store/apps/details?${query}`, {signal:AbortSignal.timeout(20000)});
  if (!response.ok) throw new Error(`Google Play rating HTTP ${response.status}`);
  return {appId:app.id,platform:'android',date:new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul'}).format(now),metricKey:'google_play_public_rating_kr',value:parseGoogleStoreRating(await response.text()),source:'mobile_insight',quality:'exact',observedAt:now.toISOString(),description:'Google Play 공개 페이지 · KR · 일별 마지막 관측값'};
}
