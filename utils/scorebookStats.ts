import { PlateAppearanceEvent, ScorebookDocument, SprayData } from './scorebookTypes';
export type BattingTotals = { PA:number; AB:number; H:number; singles:number; doubles:number; triples:number; HR:number; R:number; RBI:number; BB:number; HBP:number; SO:number; SF:number; SAC:number; AVG:number|null; OBP:number|null; SLG:number|null; OPS:number|null };
const zero = ():BattingTotals => ({PA:0,AB:0,H:0,singles:0,doubles:0,triples:0,HR:0,R:0,RBI:0,BB:0,HBP:0,SO:0,SF:0,SAC:0,AVG:null,OBP:null,SLG:null,OPS:null});
/** Stats are derived from events rather than independently edited totals. */
export function battingStats(doc: ScorebookDocument, playerId: string, teamId: string): BattingTotals {
  const t=zero();
  const events=doc.events.filter((e):e is PlateAppearanceEvent => e.kind==='plateAppearance');
  for(const e of events){
    if(e.battingTeamId===teamId && e.playerId===playerId){
      t.PA++; t.RBI+=e.rbis;
      if(e.result==='1B'){t.H++;t.singles++;}
      if(e.result==='2B'){t.H++;t.doubles++;}
      if(e.result==='3B'){t.H++;t.triples++;}
      if(e.result==='HR'){t.H++;t.HR++;}
      if(e.result==='BB'||e.result==='IBB')t.BB++;
      if(e.result==='HBP')t.HBP++;
      if(e.result==='K')t.SO++;
      if(e.result==='SF')t.SF++;
      if(e.result==='SAC')t.SAC++;
      if(!['BB','IBB','HBP','CI','SAC','SF'].includes(e.result))t.AB++;
    }
    // A runner can score on another batter's plate appearance.
    for(const runner of e.runners){if(e.battingTeamId===teamId && runner.playerId===playerId && runner.to===4 && !runner.isOut) t.R++;}
  }
  for(const e of doc.events){if(e.kind==='runner' && e.battingTeamId===teamId)for(const runner of e.advances)if(runner.playerId===playerId && runner.to===4 && !runner.isOut)t.R++;}
  const totalBases=t.singles+2*t.doubles+3*t.triples+4*t.HR;
  const obpDen=t.AB+t.BB+t.HBP+t.SF;
  t.AVG=t.AB?t.H/t.AB:null; t.OBP=obpDen?(t.H+t.BB+t.HBP)/obpDen:null;
  t.SLG=t.AB?totalBases/t.AB:null; t.OPS=t.OBP!==null&&t.SLG!==null?t.OBP+t.SLG:null;
  return t;
}
/** Only the player's own team's scorebook should feed their published season spray chart. */
export function playerSprayEvents(doc:ScorebookDocument,playerId:string,teamId:string): {eventId:string; inning:number; spray:SprayData}[] {
  return doc.events.filter((e):e is PlateAppearanceEvent=>e.kind==='plateAppearance')
    .filter(e=>e.battingTeamId===teamId && e.playerId===playerId && !!e.spray)
    .map(e=>({eventId:e.id,inning:e.inning,spray:e.spray!}));
}
export const SPRAY_STYLES = {
  hit: {color:'#16803C',dashed:false},
  error: {color:'#A47700',dashed:true},
  out: {color:'#C62828',dashed:true},
} as const;
