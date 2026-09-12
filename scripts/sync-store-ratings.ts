import {loadScriptEnv} from '../src/config/load-script-env';
import {getActiveApps} from '../src/db/dashboard.repository';
import {getDb} from '../src/db';
import {upsertMetricObservations,upsertRatingSnapshots} from '../src/db/upsert';
import {fetchGoogleStoreRating} from '../src/services/google/google-store-rating';
import {toAppleRatingReport} from '../src/services/apple/apple-reviews';
loadScriptEnv();
const db=getDb();
for(const app of await getActiveApps()) {
 const now=new Date();const date=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul'}).format(now);
 if(app.androidPackageName){const observation=await fetchGoogleStoreRating(app,now);await upsertMetricObservations(db,[{...observation,observedAt:now}]);console.info({app:app.code,platform:'android',date,value:observation.value});}
 if(app.iosAppId){
  const response=await fetch(`https://itunes.apple.com/lookup?id=${app.iosAppId}&country=kr`);
  if(!response.ok)throw new Error(`Apple ${response.status}`);
  const result=await response.json();if(!result.results?.[0])throw new Error('Apple rating missing');
  const report=toAppleRatingReport(app.id,date,'KOR',result.results[0]);
  if(report){const {appId,platform,averageRating,ratingCount}=report.snapshot;await upsertRatingSnapshots(db,[{appId,platform,date,averageRating,ratingCount}]);console.info({app:app.code,platform,date,value:averageRating});}
 }
}
process.exit(0);
