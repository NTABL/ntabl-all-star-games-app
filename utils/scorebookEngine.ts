import { HalfInning, PlateAppearanceEvent, PlateAppearanceResult, RunnerAdvance, ScorebookDocument, TeamLineup } from './scorebookTypes';

export type LiveState = { inning: number; half: HalfInning; outs: number; bases: (string|null)[]; homeRuns: number; awayRuns: number; nextSlot: Record<string, number> };
export const isHit = (r: PlateAppearanceResult) => ['1B','2B','3B','HR'].includes(r);
export function activePlayer(lineup: TeamLineup, slot: number) {
  const entries = lineup.slots.find(s=>s.slot===slot)?.appearances || [];
  return [...entries].reverse().find(e=>e.exitedAtEvent===undefined) || entries[entries.length-1];
}
export function battingTeam(doc: ScorebookDocument, state: LiveState) { return state.half==='top'?doc.away:doc.home; }
export function replay(doc: ScorebookDocument): LiveState {
  const state: LiveState={inning:1,half:'top',outs:0,bases:[null,null,null],homeRuns:0,awayRuns:0,nextSlot:{[doc.homeTeamId]:1,[doc.awayTeamId]:1}};
  for(const e of doc.events){
    if(e.kind!=='plateAppearance') continue;
    // The recorded runner advances are the source of truth. Replaying them makes undo deterministic.
    state.inning=e.inning; state.half=e.half;
    const next=[...state.bases];
    for(const r of e.runners){
      if(r.from>0 && next[r.from-1]===r.playerId) next[r.from-1]=null;
    }
    for(const r of e.runners){
      if(!r.isOut && r.to>=1 && r.to<=3) next[r.to-1]=r.playerId;
    }
    state.bases=next;
    if(e.battingTeamId===doc.homeTeamId)state.homeRuns+=e.runsOnPlay;
    else state.awayRuns+=e.runsOnPlay;
    state.outs+=e.outsOnPlay;
    const team=e.battingTeamId===doc.homeTeamId?doc.home:doc.away;
    const slots=team.slots.map(s=>s.slot).sort((a,b)=>a-b);
    const idx=slots.indexOf(e.battingSlot);
    state.nextSlot[e.battingTeamId]=slots[(idx+1)%slots.length]||1;
    if(state.outs>=3){state.outs=0;state.bases=[null,null,null];if(state.half==='top')state.half='bottom';else {state.half='top';state.inning++;}}
  }
  return state;
}
export function makeSimplePlay(doc:ScorebookDocument,result:PlateAppearanceResult,fielders:number[],notes=''):PlateAppearanceEvent {
  const state=replay(doc), team=battingTeam(doc,state),slot=state.nextSlot[team.teamId]||1;
  const entry=activePlayer(team,slot);if(!entry)throw new Error('A batting lineup is required before scoring.');
  const advances:RunnerAdvance[]=[];let outs=0,rbis=0;
  const bases=state.bases;
  if(isHit(result)){
    const steps=result==='HR'?4:result==='3B'?3:result==='2B'?2:1;
    for(let i=2;i>=0;i--)if(bases[i]){
      const to=Math.min(4,i+1+steps) as 1|2|3|4;
      advances.push({playerId:bases[i]!,from:(i+1) as 1|2|3,to});if(to===4)rbis++;
    }
    advances.push({playerId:entry.player.id,from:0,to:steps as 1|2|3|4});if(steps===4)rbis++;
  } else if(['BB','IBB','HBP'].includes(result)){
    // Force only runners that are pushed by the batter; do not move unforced runners.
    let forced=true;
    for(let i=0;i<3;i++){
      if(forced && bases[i]){const to=(i+2) as 2|3|4;advances.push({playerId:bases[i]!,from:(i+1) as 1|2|3,to});if(to===4)rbis++;}
      else forced=false;
    }
    advances.push({playerId:entry.player.id,from:0,to:1});
  } else if(['K','OUT'].includes(result)){
    outs=1;advances.push({playerId:entry.player.id,from:0,to:1,isOut:true});
  } else if(result==='ROE'){
    // Only safe when first base is unoccupied; otherwise advancement requires manual scoring.
    if(bases[0])throw new Error('Runner on first: this error requires the advanced scoring editor.');
    advances.push({playerId:entry.player.id,from:0,to:1});
  } else throw new Error(`${result} requires the advanced scoring editor (not included in Phase 1).`);
  if(outs>3-state.outs)throw new Error('Cannot record more than three outs.');
  // Prevent collisions and ambiguous scoring. Advanced runner control comes in the next phase.
  const destinations=new Set<number>();
  for(const a of advances)if(!a.isOut && a.to<4){if(destinations.has(a.to))throw new Error('Ambiguous runner advancement.');destinations.add(a.to);}
  for(let i=0;i<3;i++)if(bases[i]&&!advances.some(a=>a.from===i+1)&&destinations.has(i+1))throw new Error('Runner movement needs manual scoring.');
  const runs=advances.filter(a=>a.to===4&&!a.isOut).length;
  const notation=result==='OUT'?(fielders.length?fielders.join('-'):'OUT'):result==='ROE'?`E${fielders[0]||'?'}`:result;
  return {kind:'plateAppearance',id:`pa-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,sequence:doc.events.length+1,at:new Date().toISOString(),half:state.half,inning:state.inning,battingTeamId:team.teamId,playerId:entry.player.id,lineupEntryId:entry.entryId,battingSlot:slot,result,notation,runners:advances,outsOnPlay:outs,runsOnPlay:runs,rbis,notes};
}
