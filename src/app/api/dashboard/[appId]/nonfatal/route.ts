import {NextResponse} from 'next/server';
import {and,eq} from 'drizzle-orm';
import {GoogleAuth} from 'google-auth-library';
import {getDb} from '@/db';
import {apps,releases} from '@/db/schema';
import {getStoreCredentialProfile} from '@/config/store-config';
import {fetchCrashlyticsNonfatal} from '@/services/firebase/crashlytics';
export const maxDuration=60;
export const dynamic='force-dynamic';
export async function GET(request:Request,{params}:{params:Promise<{appId:string}>}) {
  const {appId}=await params; const query=new URL(request.url).searchParams;
  try {
    const [target]=await getDb().select({app:apps,release:releases}).from(releases).innerJoin(apps,eq(apps.id,releases.appId))
      .where(and(eq(apps.id,appId),eq(releases.id,query.get('releaseId')??''),eq(apps.isActive,true)));
    if(!target) return NextResponse.json({error:'버전을 찾을 수 없습니다.'},{status:404});
    if(target.release.platform !== 'android' && target.release.platform !== 'ios') return NextResponse.json({unavailable:'지원되지 않는 플랫폼입니다.'});
    const profile=getStoreCredentialProfile(target.app.code)?.crashlytics;
    const raw=profile&&process.env[profile.serviceAccountJsonEnv];
    if(!profile||!raw) return NextResponse.json({unavailable:'Firebase Crashlytics 연결이 필요합니다.'});
    const auth=new GoogleAuth({credentials:JSON.parse(raw),scopes:['https://www.googleapis.com/auth/cloud-platform']});
    const client=await auth.getClient();
    const data=await fetchCrashlyticsNonfatal(profile,{
      platform:target.release.platform, version:target.release.version,
      releasedAt:target.release.releasedAt.toISOString(), os:query.get('os')||undefined, issueId:query.get('issueId')||undefined,
    },options=>client.request({...options,timeout:30000}));
    return NextResponse.json({data},{headers:{'Cache-Control':'no-store'}});
  }catch {return NextResponse.json({error:'커스텀 로그를 조회하지 못했습니다. 잠시 후 다시 시도해주세요.'},{status:502});}
}
