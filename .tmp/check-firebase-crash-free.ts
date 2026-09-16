import nextEnv from '@next/env';
import {loadFirebaseCrashFree} from '../src/services/firebase/crash-free';
nextEnv.loadEnvConfig(process.cwd());
try {console.log(JSON.stringify(await loadFirebaseCrashFree('kis',{startDate:'2026-08-18',endDate:'2026-09-16'})));}
catch(error){console.log(JSON.stringify({status:(error as {response?:{status:number}}).response?.status,message:(error as Error).message}));process.exitCode=1;}
