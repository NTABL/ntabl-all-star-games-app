import {ScorebookV2Document,ScorebookV2Event,PitchKind,RunnerAdvance,PlateAppearanceEvent,PlateAppearanceResult,HalfInning} from './scorebookTypes';
import {activePlayer} from './scorebookEngine';
export type V2State={inning:number;half:HalfInning;outs:number;bases:(string|null)[];homeRuns:number;awayRuns:number;nextSlot:Record<string,number>;balls:number;strikes:number;pitchCount:number};
export const id=()=>`${Date.now()}-${Math.random().toString(36).slice(2,9)}`;
export function replayV2(doc:ScorebookV2Document):V2State{
 const s:V2State={inning:1,half:'top',outs:0,bases:[null,null,null],homeRuns:0,awayRuns:0,nextSlot:{[doc.homeTeamId]:1,[doc.awayTeamId]:1},balls:0,strikes:0,pitchCount:0};
 const turn=()=>{if(s.outs>=3){s.outs=0;s.bases=[null,null,null];if(s.half==='top')s.half='bottom';else{s.half='top';s.inning++;}}};
 for(const e of doc.events){
  if(e.kind==='lineupChange')continue;
  if(e.kind==='pitch'){
   s.pitchCount++;
   if(e.pitch==='ball')s.balls=Math.min(4,s.balls+1);
   if(e.pitch==='calledStrike'||e.pitch==='swingingStrike')s.strikes=Math.min(3,s.strikes+1);
   if(e.pitch==='foul'&&s.strikes<2)s.strikes++;
   if(e.pitch==='foulBunt')s.strikes=Math.min(3,s.strikes+1);
   continue;
  }
  // Courtesy runner is recorded for play-by-play only; never changes game state.
  if(e.kind==='runner' && (e as any).action==='CR')continue;
  const advances=e.runners;
  const next=[...s.bases];
  for(const r of advances)if(r.from>0&&next[r.from-1]===r.playerId)next[r.from-1]=null;
  for(const r of advances)if(!r.isOut&&r.to<4)next[r.to-1]=r.playerId;
  s.bases=next;
  if(e.battingTeamId===doc.homeTeamId)s.homeRuns+=e.runsOnPlay;else s.awayRuns+=e.runsOnPlay;
  s.outs+=e.outsOnPlay;
  if(e.kind==='plateAppearance'){
   const lineup=e.battingTeamId===doc.homeTeamId?doc.home:doc.away;
   const slots=(lineup?.slots||[]).map(x=>x.slot).sort((a,b)=>a-b);
   const idx=slots.indexOf(e.battingSlot);
   s.nextSlot[e.battingTeamId]=slots[(idx+1)%slots.length]||1;
   s.balls=0;s.strikes=0;
  }
  turn();
 }
 const adjustments=((doc as any).scoreAdjustments||[]) as {away?:number;home?:number}[];
 s.awayRuns+=adjustments.reduce((n,a)=>n+(Number(a.away)||0),0);
 s.homeRuns+=adjustments.reduce((n,a)=>n+(Number(a.home)||0),0);
 return s;
}
export function makePitch(doc:ScorebookV2Document,pitch:PitchKind):ScorebookV2Event{
 const s=replayV2(doc),team=s.half==='top'?doc.away:doc.home,slot=s.nextSlot[team.teamId]||1,entry=activePlayer(team,slot);
 if(!entry)throw new Error('Batting order is empty.');
 return {kind:'pitch',id:id(),sequence:doc.events.length+1,at:new Date().toISOString(),half:s.half,inning:s.inning,battingTeamId:team.teamId,playerId:entry.player.id,pitch};
}
export function makePlay(doc:ScorebookV2Document,result:PlateAppearanceResult,advances:RunnerAdvance[],fielders:number[],rbis:number,notation?:string):PlateAppearanceEvent{
 const s=replayV2(doc),team=s.half==='top'?doc.away:doc.home,slot=s.nextSlot[team.teamId]||1,entry=activePlayer(team,slot);
 if(!entry)throw new Error('No active batter.');
 const outs=advances.filter(a=>a.isOut).length;
 if(outs+s.outs>3)throw new Error('Too many outs in this half inning.');
 const dest=new Set<number>();
 for(const a of advances)if(!a.isOut&&a.to<4){if(dest.has(a.to))throw new Error('Two runners cannot occupy one base.');dest.add(a.to);}
 for(let i=0;i<3;i++)if(s.bases[i]&&!advances.some(a=>a.from===i+1&&a.playerId===s.bases[i])&&dest.has(i+1))throw new Error('An existing runner must advance first.');
 return {kind:'plateAppearance',id:id(),sequence:doc.events.length+1,at:new Date().toISOString(),half:s.half,inning:s.inning,battingTeamId:team.teamId,playerId:entry.player.id,lineupEntryId:entry.entryId,battingSlot:slot,result,notation:notation||result,runners:advances,outsOnPlay:outs,runsOnPlay:advances.filter(a=>a.to===4&&!a.isOut).length,rbis};
}
export function suggestedAdvances(doc:ScorebookV2Document,result:PlateAppearanceResult):RunnerAdvance[]{
 const s=replayV2(doc),team=s.half==='top'?doc.away:doc.home,entry=activePlayer(team,s.nextSlot[team.teamId]||1);
 if(!entry)throw new Error('No active batter.');
 const a:RunnerAdvance[]=[];
 if(['1B','2B','3B','HR'].includes(result)){
  const steps=result==='HR'?4:result==='3B'?3:result==='2B'?2:1;
  for(let i=2;i>=0;i--)if(s.bases[i])a.push({playerId:s.bases[i]!,from:(i+1) as 1|2|3,to:Math.min(4,i+1+steps) as 1|2|3|4});
  a.push({playerId:entry.player.id,from:0,to:steps as 1|2|3|4});
 }else if(['BB','IBB','HBP','CI'].includes(result)){
  let force=true;for(let i=0;i<3;i++){if(force&&s.bases[i])a.push({playerId:s.bases[i]!,from:(i+1) as 1|2|3,to:(i+2) as 2|3|4});else force=false;}
  a.push({playerId:entry.player.id,from:0,to:1});
 }else if(['K','OUT','SAC','SF'].includes(result))a.push({playerId:entry.player.id,from:0,to:1,isOut:true});
 else a.push({playerId:entry.player.id,from:0,to:1});
 return a;
}
export function pitchSummary(doc:ScorebookV2Document,playerId:string){
 const events=doc.events.filter(e=>e.kind==='pitch'&&e.playerId===playerId);
 let balls=0,strikes=0;
 for(const e of events){if(e.kind!=='pitch')continue;if(e.pitch==='ball')balls++;if(['calledStrike','swingingStrike','foul','foulBunt'].includes(e.pitch))strikes++;}
 return {total:events.length,balls,strikes};
}
