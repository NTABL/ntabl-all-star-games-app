/** Event-derived, independently owned pitching lines. No cross-team reconciliation. */
export type PitchLine={outs:number;ip:string;balls:number;strikes:number;pitches:number;hits:number;walks:number;strikeouts:number;hbp:number;runs:number;earnedRuns:number|null;era:string;whip:string;opponentAverage:string;lob:number|null;complete:boolean};
const hit=(v:string)=>['1B','2B','3B','HR'].includes(v);
export function pitcherForEvent(doc:any, event:any):string|null{
 if(event.pitcherId)return String(event.pitcherId);
 const defense=event.battingTeamId===doc.awayTeamId?doc.home:doc.away;
 const seq=Number(event.sequence)||0;
 const matches=(defense?.slots||[]).flatMap((s:any)=>s.appearances||[]).filter((a:any)=>String(a.position||a.player?.position||'').toUpperCase()==='P'&&Number(a.enteredAtEvent||0)<=seq&&(a.exitedAtEvent==null||Number(a.exitedAtEvent)>seq));
 const ids=[...new Set(matches.map((a:any)=>String(a.player?.id||'')).filter(Boolean))];
 return ids.length===1?ids[0]:null;
}
export function teamPitching(doc:any,teamId:string):Record<string,PitchLine>{
 const opp=teamId===doc.homeTeamId?doc.awayTeamId:doc.homeTeamId;
 const evs=(doc.events||[]).filter((e:any)=>e.battingTeamId===opp&&['pitch','plateAppearance','runner'].includes(e.kind)).sort((a:any,b:any)=>Number(a.sequence)-Number(b.sequence));
 const out:Record<string,PitchLine>={};
 const ensure=(id:string)=>out[id]||(out[id]={outs:0,ip:'0.0',balls:0,strikes:0,pitches:0,hits:0,walks:0,strikeouts:0,hbp:0,runs:0,earnedRuns:0,era:'—',whip:'—',opponentAverage:'—',lob:null,complete:true});
 const team=teamId===doc.homeTeamId?doc.home:doc.away;
 for(const a of (team?.slots||[]).flatMap((s:any)=>s.appearances||[]))if(String(a.position||'').toUpperCase()==='P')ensure(String(a.player.id));
 let unknown=false;
 // Runner responsibility survives pitching changes. Reconstruct by runner's reaching play.
 const responsible=new Map<string,string>();const unearned=new Map<string,boolean>();
 let half='';let virtualOuts=0;
 for(const e of evs){
  const key=String(e.inning)+':'+String(e.half);if(key!==half){half=key;responsible.clear();unearned.clear();virtualOuts=0;}
  if(e.kind==='runner'&&String(e.action||'').toUpperCase()==='CR')continue;
  const pid=pitcherForEvent(doc,e);if(!pid){unknown=true;continue;}
  const row=ensure(pid);
  if(e.kind==='pitch'){
   row.pitches++;if(e.pitch==='ball')row.balls++;else row.strikes++;
   continue;
  }
  const result=String(e.result||'');
  if(e.kind==='plateAppearance'&&e.specialResult!=='SKIP_BATTER'){
   if(hit(result))row.hits++;
   if(['BB','IBB'].includes(result))row.walks++;
   if(result==='K')row.strikeouts++;
   if(result==='HBP')row.hbp++;
  }
  row.outs+=Number(e.outsOnPlay||0);
  const error= result==='ROE'||!!e.errorPosition||(e.runnerDetails||[]).some((r:any)=>!!r.errorPosition)||String(e.action||'').toUpperCase()==='E';
  if(error)virtualOuts++;
  for(const r of e.runners||[]){
   const rid=String(r.playerId||'');if(!rid)continue;
   if(Number(r.from)===0){responsible.set(rid,pid);unearned.set(rid,error||virtualOuts>=3);}
   if(Number(r.to)===4&&!r.isOut){
    const owner=responsible.get(rid)||pid;const pitcher=ensure(owner);pitcher.runs++;
    // Explicit earned markers are authoritative. Otherwise flag errors conservatively.
    if(r.earned===false||unearned.get(rid)===true){/* unearned */}
    else if(r.earned===true&&!error&&virtualOuts<3){pitcher.earnedRuns=(pitcher.earnedRuns||0)+1;}
    else {pitcher.earnedRuns=null;}
    responsible.delete(rid);unearned.delete(rid);
   }else if(r.isOut){responsible.delete(rid);unearned.delete(rid);}
  }
  virtualOuts+=Number(e.outsOnPlay||0);
 }
 for(const r of Object.values(out)){
  r.ip=Math.floor(r.outs/3)+'.'+r.outs%3;
  r.whip=r.outs?((r.walks+r.hits)*3/r.outs).toFixed(2):'—';
  r.era=r.earnedRuns!=null&&r.outs?(r.earnedRuns*27/r.outs).toFixed(2):'—';
  r.complete=!unknown;
 }
 return out;
}
