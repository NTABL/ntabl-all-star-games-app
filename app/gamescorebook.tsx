import {buildTraditionalScorebookHtml} from '../utils/scorebookPdfHtml';
import {teamPitching} from '../utils/scorebookPitching';
import {Ionicons} from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Svg,{Rect,Path,Line,Circle,Text as SvgText,G,Polygon} from 'react-native-svg';
import {router,Stack,useLocalSearchParams} from 'expo-router';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import React,{useEffect,useRef,useState} from 'react';
import {ActivityIndicator,Alert,Modal,Pressable,ScrollView,StyleSheet,Text,TextInput,View,Platform,useWindowDimensions} from 'react-native';
import {API_BASE} from '../utils/appconfig';
import {importGameLineup} from '../utils/scorebookLineups';
import {activePlayer} from '../utils/scorebookEngine';
import {loadScorebook,saveScorebook,resetGameScorebook} from '../utils/scorebookStorage';
import {ScorebookV2Document,ScorebookV2Event,PlateAppearanceResult,RunnerAdvance,PitchKind,SprayPoint} from '../utils/scorebookTypes';
import {id,makePitch,makePlay,pitchSummary,replayV2,suggestedAdvances} from '../utils/scorebookV2';
// V2 batting totals must be computed from V2 events, not the legacy V1 stats helper.
type BoxBatting={AB:number;R:number;H:number;RBI:number;BB:number;SO:number};
function v2BattingStats(doc:ScorebookV2Document,playerId:string,teamId:string):BoxBatting{
 const totals:BoxBatting={AB:0,R:0,H:0,RBI:0,BB:0,SO:0};
 for(const event of doc.events||[]){
  if(event.kind!=='plateAppearance'&&event.kind!=='runner')continue;
  if(event.battingTeamId!==teamId)continue;
  if(event.kind==='plateAppearance'&&event.playerId===playerId){
    if((event as any).specialResult==='SKIP_BATTER')continue;
   const result=String(event.result||'');
   if(!['BB','IBB','HBP','CI','SAC','SF'].includes(result))totals.AB++;
   if(['1B','2B','3B','HR'].includes(result))totals.H++;
   if(['BB','IBB'].includes(result))totals.BB++;
   if(result==='K')totals.SO++;
   totals.RBI+=Number(event.rbis||0);
  }
  for(const runner of event.runners||[]){
   if(runner.playerId===playerId&&runner.to===4&&!runner.isOut)totals.R++;
  }
 }
 return totals;
}
type PlayerToday={PA:number;AB:number;H:number;R:number;RBI:number;BB:number;K:number;SB:number;AVG:string};
function todayBatting(doc:ScorebookV2Document,pid:string,tid:string):PlayerToday{
 const base=v2BattingStats(doc,pid,tid);
 let PA=0,SB=0;
 for(const e of doc.events){
  if(e.kind==='plateAppearance'&&e.battingTeamId===tid&&e.playerId===pid&&(e as any).specialResult!=='SKIP_BATTER')PA++;
  if(e.kind==='runner'&&e.battingTeamId===tid&&['SB','STOLEN_BASE','stolenBase'].includes(String(e.action||''))){
   SB+=(e.runners||[]).filter(r=>r.playerId===pid&&!r.isOut).length;
  }
 }
 return {PA,...base,K:base.SO,SB,AVG:base.AB?(base.H/base.AB).toFixed(3).replace(/^0/,''):'.---'};
}
function todayPitching(doc:ScorebookV2Document,pid:string,tid:string){
 const defensive=tid===doc.homeTeamId?doc.home:doc.away;
 const activePitcher=defensive.slots.flatMap(slot=>slot.appearances)
  .find(a=>a.exitedAtEvent===undefined&&a.position?.toUpperCase()==='P')?.player.id
  ||defensive.bench.find(p=>((defensive as any).benchDefenderIds||[]).includes(p.id)&&p.position?.toUpperCase()==='P')?.id;
 const opponent=tid===doc.homeTeamId?doc.awayTeamId:doc.homeTeamId;
 // Existing games have no pitcherId. When this is the currently assigned pitcher,
 // show their existing team pitch log provisionally, not a blank stat line.
 const historicalFallback=activePitcher===pid;
 const attributable=(e:ScorebookV2Event)=>(e as any).pitcherId===pid||
   (!(e as any).pitcherId&&historicalFallback);
 const pitches=doc.events.filter(e=>e.kind==='pitch'&&e.battingTeamId===opponent&&attributable(e));
 const balls=pitches.filter(e=>e.pitch==='ball').length;
 const strikes=pitches.filter(e=>e.pitch!=='ball').length;
 const runs=doc.events.filter(e=>(e.kind==='plateAppearance'||e.kind==='runner')&&e.battingTeamId===opponent&&attributable(e)).reduce((n,e)=>n+(e.runsOnPlay||0),0);
 return {attributed:historicalFallback||doc.events.some(e=>(e as any).pitcherId===pid),pitches:pitches.length,balls,strikes,runs,estimated:historicalFallback&&pitches.some(e=>!(e as any).pitcherId)};
}

const enc=encodeURIComponent;
const str=(x:unknown)=>String(x||'');
const RESULTS:PlateAppearanceResult[]=['1B','2B','3B','HR','ROE','FC','SAC','HBP'];
const COLORS={hit:'#16803C',error:'#A47700',out:'#C62828'};
const btn=(selected=false)=>[styles.chip,selected&&styles.selected];
const INK='#075486',PALE='#eaf7fd',RULE='#85b9d4';
// Vector score square: all art and markings share one 600x600 coordinate space.
// There is no image-background dependency or separately scaled overlay.
const SCORE_BLUE='#07569a', RUN_GREEN='#16803C', OUT_RED='#C62828';
const ABBRS:[string,number,number][]=[['1B',58,52],['2B',58,106],['3B',58,160],['HR',58,214],['BB',544,52],['HP',544,106],['BT',544,160],['SF',544,214],['FC',544,268]];
const BASES:[[number,number],[number,number],[number,number],[number,number]]=[[288,395],[362,315],[288,243],[213,315]];
// Fielding diagram: one shared 600 x 600 coordinate system for the artwork AND taps.
// Geometry is deliberately fitted to the blue box, with home at the bottom and
// the outfield fence near the top. Do not scale the artwork independently of markers.
const FIELD_POSITIONS=[
 {n:1,x:300,y:405}, // Pitcher, centered in the infield
 {n:2,x:300,y:518}, // Catcher, at home plate
 {n:3,x:414,y:356}, // First baseman, INSIDE right foul line
 {n:4,x:348,y:285}, // Second baseman, nearer second base
 {n:5,x:186,y:356}, // Third baseman, INSIDE left foul line
 {n:6,x:252,y:285}, // Shortstop, nearer second base
 {n:7,x:158,y:202}, // Left fielder, below the fence
 {n:8,x:300,y:166}, // Center fielder, below the fence
 {n:9,x:442,y:202}, // Right fielder, below the fence
] as const;
function FieldingDiamond({onSelect,sequence=[]}:{onSelect:(position:number)=>void;sequence?:number[]}){
 const {width}=useWindowDimensions();
 // Nearly edge-to-edge inside the scoring modal, without horizontal clipping.
 const dimension=Math.round(Math.min(540,Math.max(200,width-32))*(width<600?.94248:.84));
 const marker=Math.max(23,Math.min(31,dimension*.099));
 return <View style={{width:dimension,height:dimension,alignSelf:'center'}}>
  <Svg width={dimension} height={dimension} viewBox="0 0 600 600">
   <Rect x={5} y={5} width={590} height={590} fill="#fffef7" stroke={SCORE_BLUE} strokeWidth={7}/>
   {/* Foul lines extend the exact home-to-third and home-to-first base paths. */}
   <Path d="M 300 510 L 28 213 M 300 510 L 572 213" fill="none" stroke="#b5b5b5" strokeWidth={4}/>
   {/* Outfield wall is high, but every outfielder sits below it. */}
   <Path d="M 28 213 Q 300 -65 572 213" fill="none" stroke="#64748b" strokeWidth={4} strokeDasharray="13 9"/>
   {/* Full-size infield diamond, home plate at the bottom. */}
   <Polygon points="300,510 410,390 300,270 190,390" fill="#f1f7ec" stroke="#8cad88" strokeWidth={4}/>
   <Path d="M 126 365 Q 300 112 474 365" fill="none" stroke="#9abf91" strokeWidth={4} strokeDasharray="11 9"/>
   {([[300,510],[410,390],[300,270],[190,390]] as const).map(([x,y],i)=><Rect key={i} x={x-7} y={y-7} width={14} height={14} fill="#263746" transform={`rotate(45 ${x} ${y})`}/>)}
   <Circle cx={300} cy={405} r={20} fill="#e1d5b4" stroke="#9ebc97" strokeWidth={2}/>
   {/* A complete catcher circle centered at home plate. */}
   <Circle cx={300} cy={518} r={35} fill="none" stroke="#b0b5bd" strokeWidth={2.5}/>
  </Svg>
  {FIELD_POSITIONS.map(pos=>{
   const selected=sequence.includes(pos.n);
   return <Pressable key={pos.n} accessibilityRole="button" accessibilityLabel={`Fielder ${pos.n}`} onPress={()=>onSelect(pos.n)} style={{position:'absolute',left:pos.x*dimension/600-marker/2,top:pos.y*dimension/600-marker/2,width:marker,height:marker,borderRadius:marker/2,backgroundColor:INK,alignItems:'center',justifyContent:'center',borderWidth:selected?3:2,borderColor:selected?'#fbbf24':'white'}}><Text style={{color:'white',fontWeight:'900',fontSize:Math.round(marker*.48)}}>{pos.n}</Text></Pressable>;
  })}
 </View>;
}
type HistoricalSpray={id:string;landing:SprayPoint;outcome:'hit'|'out'|'error';homeRun:boolean;name:string};
function HistoricalSprayOverlay({items,size}:{items:HistoricalSpray[];size:number}){
 return <View pointerEvents="none" style={{position:'absolute',left:0,top:0,width:size,height:size}}>
  <Svg width={size} height={size} viewBox="0 0 600 600">
   {items.map(item=>{const x=100+400*Math.max(0,Math.min(1,item.landing.x));const y=item.homeRun?Math.min(95,380-315*Math.max(0,Math.min(1,item.landing.y))):380-315*Math.max(0,Math.min(1,item.landing.y));const color=item.outcome==='out'?OUT_RED:item.outcome==='error'?'#A47700':RUN_GREEN;return <G key={item.id}><Line x1={288} y1={394} x2={x} y2={y} stroke={color} strokeWidth={3} opacity={.72}/><Circle cx={x} cy={y} r={6} fill={color} opacity={.85}/></G>;})}
  </Svg>
 </View>;
}
function ScoreSquare({plays,allEvents=[],active,finalized=false,large=false,compact=false,balls=0,strikes=0,onPress,onAbbr,onRbi,rbi=0,previewResult,outsCount=0,onLanding,landing,trajectory='ground',baseRunners=[],onRunnerTap}:{plays:any[];allEvents?:ScorebookV2Event[];active?:boolean;finalized?:boolean;large?:boolean;compact?:boolean;balls?:number;strikes?:number;onPress?:()=>void;onAbbr?:(x:string)=>void;onRbi?:(n:number)=>void;rbi?:number;previewResult?:string;outsCount?:number;onLanding?:(p:SprayPoint)=>void;landing?:SprayPoint|null;trajectory?:'ground'|'line'|'fly';baseRunners?:{base:number;name:string;playerId:string}[];onRunnerTap?:(base:number)=>void}){
 const size=compact?270:large?350:110;
 const last=plays[plays.length-1];
 const label=(v:string)=>v==='HBP'?'HP':v==='SAC'?(trajectory==='fly'?'SF':'BT'):v;
 const selected=label(previewResult||last?.result||'');
 // Find all movement of the original batter, including movement on later batters' plays.
 const runnerId=last?.playerId;
 const isSkipped=(last as any)?.specialResult==='SKIP_BATTER';
 // A skipped batter never advances or scores. Do not inherit any prior run by this player.
 const movements=runnerId&&!isSkipped?allEvents.filter((e:any)=>e.sequence>=last.sequence).flatMap((e:any)=>e.runners||[]).filter((r:any)=>r.playerId===runnerId):[];
 const runnerMarks=!isSkipped&&runnerId?allEvents.filter((e:any)=>Number(e.sequence)>=Number(last.sequence)&&e.kind==='runner'&&((e.runners||[]).some((r:any)=>r.playerId===runnerId)||(e.runnerDetails||[]).some((r:any)=>r.playerId===runnerId))).map((e:any)=>String(e.action||'').toUpperCase()).filter((a:string)=>['SB','STOLEN_BASE','STOLENBASE','CS','CAUGHT_STEALING'].includes(a)).map((a:string)=>a.startsWith('S')?'SB':'CS'):[];
 const runnerMarkText=Array.from(new Set(runnerMarks)).join(' / ');
 const scored=!isSkipped&&movements.some((r:any)=>r.to===4&&!r.isOut);
 let highest=0;
 for(const m of movements)if(!m.isOut)highest=Math.max(highest,m.to);
 // The home-run batter's run is included in its own event.
 const notation=last?.result==='K'?'K':last?.notation||'';
 const isK=last?.result==='K'||previewResult==='K';
 const looking=!!last?.strikeoutLooking;
 const batterOut=!!last?.runners?.some((r:any)=>r.playerId===last.playerId&&r.isOut);
 // The runner's original batting square owns the out when he is retired later.
 const runnerOutEvent=runnerId&&!isSkipped?allEvents.find((e:any)=>Number(e.sequence)>=Number(last.sequence)&&(e.kind==='plateAppearance'||e.kind==='runner')&&(e.runners||[]).some((r:any)=>r.playerId===runnerId&&r.isOut)):null;
 const runnerOutAdvance=runnerOutEvent?(runnerOutEvent as any).runners.find((r:any)=>r.playerId===runnerId&&r.isOut):null;
 const runnerOutOrdinal=runnerOutEvent?Math.min(3,allEvents.filter((e:any)=>(e.kind==='plateAppearance'||e.kind==='runner')&&e.inning===runnerOutEvent.inning&&e.half===runnerOutEvent.half&&e.battingTeamId===runnerOutEvent.battingTeamId&&Number(e.sequence)<Number(runnerOutEvent.sequence)).reduce((n:number,e:any)=>n+(Number(e.outsOnPlay)||0),0)+1):0;
 const batterOutOrdinal=batterOut?Math.min(3,Math.max(0,outsCount)):0;
 const outNumber=batterOutOrdinal||runnerOutOrdinal;
 // Active plate appearances must never inherit the previous batter's spray.
 const spray=landing??(last?.spray?.landing??null);
 const sprayOutcome=previewResult==='ROE'?'error':(landing?'hit':last?.spray?.outcome)||(['OUT','K','SAC','SF'].includes(selected)?'out':selected==='ROE'?'error':'hit');
 const sprayColor=sprayOutcome==='out'?OUT_RED:sprayOutcome==='error'?'#A47700':RUN_GREEN;
 const endX=spray?100+400*Math.max(0,Math.min(1,spray.x)):0;
 const endY=spray?(selected==='HR'?Math.min(95,380-315*Math.max(0,Math.min(1,spray.y))):380-315*Math.max(0,Math.min(1,spray.y))):0;
 const sprayShape=spray?(trajectory==='fly'||last?.notes?.includes('fly')?`M 288 394 Q ${Math.round((288+endX)/2)} ${Math.round(endY-85)} ${endX} ${endY}`:`M 288 394 L ${endX} ${endY}`):'';
 const drawing=<Svg width={size} height={size} viewBox="0 0 600 600">
  <Rect x={8} y={8} width={584} height={584} fill={active?(finalized?"#e5e7eb":"#fff9df"):"white"} stroke={SCORE_BLUE} strokeWidth={7}/>
  <Path d="M 98 192 L 213 315 L 288 395 M 288 395 L 362 315 L 476 192" fill="none" stroke="#b8b8b8" strokeWidth={2.5}/>
  {/* Outfield fence: a visible arc above the outfielders. Home-run spray crosses it. */}
  <Path d="M 100 175 Q 288 -22 476 175" fill="none" stroke="#64748b" strokeWidth={4} strokeDasharray="11 6"/>
  <Polygon points="288,395 362,315 288,243 213,315" fill={scored?RUN_GREEN:'none'} stroke="#b8b8b8" strokeWidth={2.5}/>
  {baseRunners.map(r=>{const [x,y]=BASES[r.base];return <G key={'occupied'+r.base}><Circle cx={x} cy={y} r={25} fill="#f59e0b" stroke="#78350f" strokeWidth={3}/><SvgText fontFamily="Arial" x={x} y={y+8} textAnchor="middle" fontSize={26} fontWeight="900" fill="#111827">{r.base}</SvgText></G>;})}
  {BASES.map(([x,y],i)=><G key={'base'+i}><Rect x={x-6} y={y-6} width={12} height={12} fill="black" transform={`rotate(45 ${x} ${y})`}/></G>)}
  <Circle cx={288} cy={408} r={38} stroke="#b8b8b8" strokeWidth={2} fill="white"/>
  <Polygon points="282,393 294,393 294,404 288,411 282,404" fill="black"/>
  {Array.from({length:Math.min(4,highest)},(_,i)=>{const [x,y]=BASES[i],[xx,yy]=BASES[(i+1)%4];return <Line key={'runner'+i} x1={x} y1={y} x2={xx} y2={yy} stroke="#222" strokeWidth={5} strokeLinecap="round"/>;})}
  {/* When this runner is retired attempting the next base, draw HALF the segment
      and cap its endpoint perpendicular to the baseline. Never draw to that base. */}
  {runnerOutAdvance&&runnerOutAdvance.from>0&&runnerOutAdvance.from<4?(()=>{const from=BASES[runnerOutAdvance.from],to=BASES[(runnerOutAdvance.from+1)%4];const dx=to[0]-from[0],dy=to[1]-from[1],len=Math.hypot(dx,dy)||1;const mx=from[0]+dx*.5,my=from[1]+dy*.5;return <G><Line x1={from[0]} y1={from[1]} x2={mx} y2={my} stroke="#222" strokeWidth={5} strokeLinecap="round"/><Line x1={mx-dy/len*13} y1={my+dx/len*13} x2={mx+dy/len*13} y2={my-dx/len*13} stroke="#222" strokeWidth={5} strokeLinecap="round"/></G>;})():null}
  {/* A safely occupied base is a COMPLETE segment, with no stop bar.
      Only a recorded runner out gets the halfway segment and perpendicular cap. */}
  {runnerMarkText?<SvgText x={288} y={220} textAnchor="middle" fontSize={29} fontWeight="bold" fill={runnerMarks.includes('CS')?OUT_RED:SCORE_BLUE}>{runnerMarkText}</SvgText>:null}
  {spray?<Path d={sprayShape} fill="none" stroke={sprayColor} strokeWidth={4} strokeDasharray={sprayOutcome==='error'||trajectory==='ground'||last?.notes?.includes('ground')?'10 7':undefined} strokeLinecap="round"/>:null}
  {spray?<Circle cx={endX} cy={endY} r={6} fill={sprayColor}/>:null}
  {ABBRS.map(([name,x,y])=><G key={name}>
   <SvgText fontFamily="Arial" x={x} y={y+12} textAnchor="middle" fontSize={36} fontWeight="bold" fill={SCORE_BLUE}>{name}</SvgText>
   {selected===name?<Circle cx={x} cy={y} r={32} stroke={['BT','SF','FC'].includes(name)?'#A47700':RUN_GREEN} strokeWidth={3.5} fill="none"/>:null}
  </G>)}
  {isK?<SvgText fontFamily="Arial" x={288} y={353} textAnchor="middle" fontSize={105} fontWeight="600" fill="#333" transform={looking?'translate(576 0) scale(-1 1)':undefined}>K</SvgText>:notation?<SvgText fontFamily="Arial" x={288} y={345} textAnchor="middle" fontSize={notation.length>4?35:48} fontWeight="600" fill={isSkipped||last?.result==='OUT'?OUT_RED:'#173b57'}>{notation}</SvgText>:null}
  {[[48,483],[107,483],[166,483]].map(([x,y],i)=><Circle key={'ball'+i} cx={x} cy={y} r={24} stroke={SCORE_BLUE} strokeWidth={3.5} fill={i<balls?RUN_GREEN:'white'}/>)}
  {[[48,540],[107,540]].map(([x,y],i)=><Circle key={'strike'+i} cx={x} cy={y} r={24} stroke={SCORE_BLUE} strokeWidth={3.5} fill={i<strikes?OUT_RED:'white'}/>)}
  {[400,469,539].map((x,i)=><G key={'out'+i}><SvgText fontFamily="Arial" x={x} y={545} textAnchor="middle" fontSize={38} fontWeight="bold" fill={SCORE_BLUE}>{i+1}</SvgText>{(i+1===(batterOutOrdinal||runnerOutOrdinal))?<Circle cx={x} cy={533} r={25} stroke={OUT_RED} strokeWidth={3.5} fill="none"/>:null}</G>)}
 </Svg>;
  function tapSquare(e:any){
   // On react-native-web, nativeEvent.locationX/Y can be undefined or relative
   // to a nested SVG child rather than the outer Pressable. Calculate from the
   // actual square's bounding box instead. Native Expo keeps locationX/Y.
   const native=e?.nativeEvent||{};
   let locationX=Number(native.locationX),locationY=Number(native.locationY);
   if(Platform.OS==='web'){
    const target=e?.currentTarget;
    const rect=target?.getBoundingClientRect?.();
    const clientX=Number(native.clientX??e?.clientX);
    const clientY=Number(native.clientY??e?.clientY);
    if(rect&&Number.isFinite(clientX)&&Number.isFinite(clientY)){
     locationX=(clientX-rect.left)*size/rect.width;
     locationY=(clientY-rect.top)*size/rect.height;
    }else if(Number.isFinite(Number(native.pageX))&&Number.isFinite(Number(native.pageY))&&rect){
     locationX=Number(native.pageX)-rect.left;
     locationY=Number(native.pageY)-rect.top;
    }
   }
   if(!Number.isFinite(locationX)||!Number.isFinite(locationY)){onPress?.();return;}
   const x=locationX*600/size,y=locationY*600/size;
   if(onRunnerTap&&baseRunners.length){const hit=baseRunners.find(r=>Math.hypot(BASES[r.base][0]-x,BASES[r.base][1]-y)<52);if(hit){onRunnerTap(hit.base);return;}}
   if(onLanding){
    if(x>95&&x<505&&y>40&&y<395){onLanding({x:Math.max(0,Math.min(1,(x-100)/400)),y:Math.max(0,Math.min(1,(380-y)/315))});return;}
   }
   if(onAbbr){
    const hit=ABBRS.find(([,cx,cy])=>Math.abs(cx-x)<45&&Math.abs(cy-y)<30);if(hit){onAbbr(hit[0]);return;}
   }
   onPress?.();
  }
 return <View style={{alignItems:'center'}}>
  <Pressable onPress={tapSquare} style={{width:size,height:size,borderWidth:0,backgroundColor:active?(finalized?'#e5e7eb':'#fff7d6'):'white'}}>{drawing}</Pressable>

 </View>;
}


// Read-only history generated from the same locally saved events as the scorebook.
// No second history database is maintained; Undo/Redo is reflected automatically.
const pitchLetter=(kind:string)=>kind==='ball'?'B':kind==='foul'?'F':kind==='foulBunt'?'F':'S';
const pitchName=(kind:string)=>({ball:'Ball',foul:'Foul',foulBunt:'Foul bunt',calledStrike:'Called strike',swingingStrike:'Swinging strike'} as Record<string,string>)[kind]||kind;
const playName=(result:string)=>({BB:'Walk',IBB:'Intentional Walk',HBP:'Hit by Pitch',CI:'Catcher Interference',K:'Strikeout',OUT:'Out',ROE:'Reached on Error',FC:"Fielder's Choice",SAC:'Sacrifice',SF:'Sacrifice Fly','1B':'Single','2B':'Double','3B':'Triple',HR:'Home Run'} as Record<string,string>)[result]||result;
function HistoryView({doc,onReview}:{doc:ScorebookV2Document;onReview:(eventId:string,inning:number,half:'top'|'bottom')=>void}){
 const [filter,setFilter]=useState(0);
 const [expanded,setExpanded]=useState<string|null>(null);
 const events=doc.events as any[];
 const players=new Map<string,string>();
 for(const team of [doc.away,doc.home])for(const slot of team.slots)for(const appearance of slot.appearances)players.set(appearance.player.id,`${appearance.player.jerseyNumber?'#'+appearance.player.jerseyNumber+' ':''}${appearance.player.name}`);
 const rows:{event:any;pitches:any[]}[]=[];
 let pending:any[]=[];
 for(const event of events){
  if(event.kind==='pitch'){pending.push(event);continue;}
  if(event.kind==='plateAppearance'){
   // Runner events can occur during an at-bat; preserve pitch history until the PA completes.
   const mine=pending.filter(p=>p.playerId===event.playerId&&p.inning===event.inning&&p.half===event.half);
   rows.push({event,pitches:mine});
   pending=pending.filter(p=>!mine.includes(p));
  }else if(event.kind==='runner'||event.kind==='lineupChange')rows.push({event,pitches:[]});
 }
 const innings=Math.max(1,...events.map(e=>e.inning||1));
 const visible=rows.filter(r=>!filter||r.event.inning===filter);
 const pitchEvents=events.filter(e=>e.kind==='pitch');
 const pitchesByTeam=(teamId:string)=>pitchEvents.filter(e=>e.battingTeamId!==teamId);
 const pitchStats=(p:any[])=>({total:p.length,balls:p.filter(e=>e.pitch==='ball').length,strikes:p.filter(e=>e.pitch!=='ball').length});
 return <View style={{gap:12}}>
  <Text style={styles.heading}>Play-by-Play · Saved Game History</Text>
  <Text style={styles.muted}>Every saved play appears in event order. Pitch sequences are grouped with their batter. Undo and Redo update this history.</Text>
  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:6,paddingBottom:4}}>
   {[0,...Array.from({length:innings},(_,i)=>i+1)].map(n=><Pressable key={n} onPress={()=>setFilter(n)} style={[styles.chip,{backgroundColor:filter===n?INK:'#dcecf6'}]}><Text style={{fontWeight:'800',color:filter===n?'white':INK}}>{n===0?'All innings':`Inning ${n}`}</Text></Pressable>)}
  </ScrollView>
  {visible.length===0?<Text style={styles.muted}>No completed plays recorded for this selection yet.</Text>:null}
  {visible.map(({event,pitches})=>{
   const isPA=event.kind==='plateAppearance';
   const title=isPA?`${players.get(event.playerId)||'Batter'} — ${event.result==='K'?(event.specialResult==='DP3K'?'(D3 Out) - Dropped Third Strike':event.strikeoutLooking?'Strikeout Looking':'Strikeout Swinging'):event.notes?.toLowerCase().includes('double play')?'Double Play — Batter and Runner Retired':event.result==='OUT'?(event.trajectory==='ground'?'Ground Out':event.trajectory==='line'?'Line Drive':event.trajectory==='fly'?'Fly Out':'Out'):playName(event.result)}`:event.kind==='runner'?(event.action==='CR'?'Courtesy Runner':`Runner Action — ${event.action||'Advance'}`):`Lineup Change — ${event.action||'Substitution'}`;
   const detail=isPA?(event.notation||event.result):event.kind==='runner'&&event.action==='CR'?'':event.kind==='runner'?(event.runners||[]).map((r:any)=>`${players.get(r.playerId)||'Runner'}: ${r.from}B → ${r.to===4?'HOME':r.to+'B'}${r.isOut?' (OUT)':''}`).join('; '):`${event.player?.name||'Player'} · ${event.position||''}`;
   const open=expanded===event.id;
   return <View key={event.id} style={[styles.paper,{backgroundColor:'white',gap:6}]}>
    <Pressable onPress={()=>setExpanded(open?null:event.id)} style={{gap:4}}>
     <Text style={{color:INK,fontWeight:'900',fontSize:12}}>{event.inning?`${event.half==='bottom'?'BOTTOM':'TOP'} ${event.inning} · `:''}{event.kind==='lineupChange'?'SUBSTITUTION':isPA?'AT BAT':'RUNNER PLAY'}</Text>
     <Text style={{color:'#183153',fontWeight:'900',fontSize:15}}>{title}</Text>
     <Text style={{color:'#334155',fontSize:12}}>{detail}{event.notes?` · ${String(event.notes).replace(/\s*·?\s*Trajectory: (ground|line|fly)/gi,'')}`:''}</Text>
    </Pressable>
    {isPA?<View style={{backgroundColor:'#edf5fa',padding:8,borderRadius:7,gap:4}}><Text style={{fontSize:11,color:INK,fontWeight:'800'}}>PITCHES ({pitches.length} recorded) · {pitches.map(p=>pitchLetter(p.pitch)).join('')||'No individual pitches recorded'}</Text>{open?<Text style={{fontSize:11,color:'#475569'}}>{pitches.map((p,i)=>`${i+1}. ${pitchName(p.pitch)}`).join('  ·  ')||'The at-bat result was entered without individual pitch events.'}</Text>:null}</View>:null}
    {open?<View style={{gap:6}}>{event.fielders?.length?<Text style={styles.muted}>Fielding sequence: {event.fielders.join('–')}</Text>:null}{isPA?<Pressable style={[styles.button,{backgroundColor:INK,padding:10}]} onPress={()=>onReview(event.id,event.inning,event.half)}><Text style={styles.white}>View scoring square</Text></Pressable>:null}</View>:null}
   </View>;
  })}
  {pending.length?<Text style={styles.muted}>Current at-bat: {pending.map(p=>pitchLetter(p.pitch)).join('')} ({pending.length} pitches recorded since last completed at-bat).</Text>:null}
  <View style={[styles.paper,{gap:8}]}><Text style={styles.heading}>Pitch Tracking · Preliminary</Text>
   <Text style={styles.muted}>Recorded pitch events by DEFENSIVE TEAM. Pitcher-specific counts require pitcher IDs and substitution tracking; these are not yet available. Balls put into play may also be missing their final pitch, so these are recorded-event totals, not official pitch counts.</Text>
   {[doc.away,doc.home].map(team=>{const s=pitchStats(pitchesByTeam(team.teamId));return <Text key={team.teamId} style={{color:INK,fontWeight:'700'}}>{team.teamName}: {s.total} recorded · {s.balls} balls · {s.strikes} strikes/fouls</Text>;})}
  </View>
 </View>;
}
export default function GameScorebook(){
 const safeAreaInsets=useSafeAreaInsets();
 const {width:screenWidth}=useWindowDimensions();
 const phoneScorebook=screenWidth<700;
 const inningScrollRef=useRef<ScrollView>(null);
 const lineupScrollRef=useRef<ScrollView>(null);
 const scrollTargetRef=useRef(0);
 const lastScrollTargetRef=useRef<string>('');
 const p=useLocalSearchParams();const programId=str(p.programId),gameId=str(p.gameId),teamId=str(p.teamId),opponentTeamId=str(p.opponentTeamId),managerPersonId=str(p.managerPersonId);
 const teamName=str(p.teamName)||'My Team',opponentName=str(p.opponentName)||'Opponent',myHome=str(p.homeAway).toLowerCase()==='home';
 const [doc,setDoc]=useState<ScorebookV2Document|null>(null),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const [inning,setInning]=useState(1),[side,setSide]=useState<'home'|'away'>('away'),[selectedId,setSelectedId]=useState<string|null>(null),[stats,setStats]=useState(false);
 const [menu,setMenu]=useState<'ball'|'strike'|'foul'|'inplay'|'out'|'other'|'strikeout'|'hitType'|'fielding'|'runners'|'runnerOnly'|'runnerOther'|'inplayOther'|'runnerOut'|'runnerActionOther'|'runnerActionFielding'|'outOther'|'sacrificeChoice'|null>(null),[result,setResult]=useState<PlateAppearanceResult>('1B');
 const [sacrificeSource,setSacrificeSource]=useState<'inplay'|'outOther'>('inplay');
 const [sacrificeSelection,setSacrificeSelection]=useState<'SACRIFICE FLY'|'SACRIFICE BUNT'|null>(null);
 const [fielders,setFielders]=useState<number[]>([]),[advances,setAdvances]=useState<RunnerAdvance[]>([]),[rbis,setRbis]=useState(0),[newOpponent,setNewOpponent]=useState('');
 const [optionsOpen,setOptionsOpen]=useState(false);
 const [adjustScoreOpen,setAdjustScoreOpen]=useState(false);
 const [adjustAway,setAdjustAway]=useState('0'),[adjustHome,setAdjustHome]=useState('0'),[adjustReason,setAdjustReason]=useState('');
 const [editPlayOpen,setEditPlayOpen]=useState(false);
 const [editPlayResult,setEditPlayResult]=useState<PlateAppearanceResult>('1B');
 const [editPlayError,setEditPlayError]=useState('');
 const [miscOpen,setMiscOpen]=useState(false);
 const [skipConfirmOpen,setSkipConfirmOpen]=useState(false);
 const [balkConfirmOpen,setBalkConfirmOpen]=useState(false);
 const [inningsOpen,setInningsOpen]=useState(false);
 const [historyOpen,setHistoryOpen]=useState(false);
 const [boxScoreOpen,setBoxScoreOpen]=useState(false);
 const [boxScoreSide,setBoxScoreSide]=useState<'away'|'home'>('away');
 const [gameSummaryOpen,setGameSummaryOpen]=useState(false);
 const [postgameOpen,setPostgameOpen]=useState(false);
 const [postgameWin,setPostgameWin]=useState('');
 const [postgameLoss,setPostgameLoss]=useState('');
 const [postgameSave,setPostgameSave]=useState('');
 const [postgameError,setPostgameError]=useState('');
 const [pitchDecisionPicker,setPitchDecisionPicker]=useState<null|'win'|'loss'|'save'>(null);
 const [missingLineupTeam,setMissingLineupTeam]=useState<null|'away'|'home'>(null);
 const [gameActionError,setGameActionError]=useState('');
 const missingLineupShown=useRef(false);
 const [substitutionOpen,setSubstitutionOpen]=useState(false);
 const [subTeam,setSubTeam]=useState<'away'|'home'>('away');
 const [subSlot,setSubSlot]=useState(1);
 const [subPlayerId,setSubPlayerId]=useState('');
 const [subPosition,setSubPosition]=useState('');
 const [playerEdit,setPlayerEdit]=useState<null|{team:'away'|'home';slot:number;entryId:string;name:string;number:string;position:string;courtesyRunner:boolean}>(null);
 const [playerEditMode,setPlayerEditMode]=useState<'edit'|'replace'>('edit');
 const [individualStats,setIndividualStats]=useState<null|{playerId:string;teamId:string;name:string;pitcher:boolean}>(null);
 const [replacementId,setReplacementId]=useState('');
 const [benchOpen,setBenchOpen]=useState(false);
 const [benchAllowBatting,setBenchAllowBatting]=useState(false);
 const [benchPendingAction,setBenchPendingAction]=useState<'defense'|'bottom'>('defense');
 const [benchReturnToEdit,setBenchReturnToEdit]=useState(false);
 const [benchPlayerId,setBenchPlayerId]=useState('');
 const [benchName,setBenchName]=useState('');
 const [benchNumber,setBenchNumber]=useState('');
 const [benchPosition,setBenchPosition]=useState('--');
 const [benchError,setBenchError]=useState('');
 const [benchConflict,setBenchConflict]=useState<null|{name:string;position:string}>(null);
 const [positionConflict,setPositionConflict]=useState<null|{name:string;position:string}>(null);
 const [playerEditError,setPlayerEditError]=useState('');
 const [lineupEditorOpen,setLineupEditorOpen]=useState(false);
 const [lineupCorrectionConfirm,setLineupCorrectionConfirm]=useState(false);
 const [lineupEditorTeam,setLineupEditorTeam]=useState<'home'|'away'>('away');
 const [lineupDraft,setLineupDraft]=useState<{number:string;name:string;position:string}[]>([]);
 const [massAddOpen,setMassAddOpen]=useState(false);
 const [massAddCount,setMassAddCount]=useState('12');
 const [massAddPrefix,setMassAddPrefix]=useState('Player');
 const [sideChangePending,setSideChangePending]=useState(false);
 const sideChangeTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
 useEffect(()=>()=>{if(sideChangeTimer.current)clearTimeout(sideChangeTimer.current);},[]);
 const [historicalSprays,setHistoricalSprays]=useState<HistoricalSpray[]>([]);
 const [historyLoading,setHistoryLoading]=useState(false);
 const [showSprayHistory,setShowSprayHistory]=useState(true);
 const [scoreOpen,setScoreOpen]=useState(false),[selectedEntry,setSelectedEntry]=useState('');
 const [startHelpOpen,setStartHelpOpen]=useState(false);
 const startHelpShown=useRef(false);
 const [confirmAction,setConfirmAction]=useState<null|'start'|'end'|'edit'|'reset'>(null);
 const [confirmBusy,setConfirmBusy]=useState(false);
 const [resetPhrase,setResetPhrase]=useState('');
 const [swapOpen,setSwapOpen]=useState(false);
 const [swapBusy,setSwapBusy]=useState(false);
 const [assignmentRevision,setAssignmentRevision]=useState(0);
 const [screenRedo,setScreenRedo]=useState<any[]>([]);
 const [previewResult,setPreviewResult]=useState<PlateAppearanceResult|null>(null);
 const [runnerOtherFor,setRunnerOtherFor]=useState<string|null>(null);
 const [runnerOtherReasons,setRunnerOtherReasons]=useState<Record<string,string>>({});
 const [screenUndo,setScreenUndo]=useState<any[]>([]);
 const [runnerReasons,setRunnerReasons]=useState<Record<string,'batter'|'error'|'same'|'throw'|'other'>>({});
 const [runnerErrors,setRunnerErrors]=useState<Record<string,number>>({});
 const [playErrorPosition,setPlayErrorPosition]=useState<number|null>(null);
 const [errorFor,setErrorFor]=useState<string|null>(null);
 const [runnerOutFor,setRunnerOutFor]=useState<string|null>(null);
 const [runnerOutDetails,setRunnerOutDetails]=useState<Record<string,{reason:string;fielders:number[]}>>({});
 const [runnerBase,setRunnerBase]=useState<number|null>(null);
 const [runnerChoice,setRunnerChoice]=useState<string|null>(null);
 const [runnerDestination,setRunnerDestination]=useState<1|2|3|4>(2);
 const [runnerSafe,setRunnerSafe]=useState(true);
 const [runnerFielders,setRunnerFielders]=useState<number[]>([]);
 const [specialCode,setSpecialCode]=useState<string|null>(null);
 const [specialOut,setSpecialOut]=useState(false);
 const [runnerCourtesy,setRunnerCourtesy]=useState<string|null>(null);
 const [runnerCourtesyId,setRunnerCourtesyId]=useState<string|null>(null);
 const [courtesyError,setCourtesyError]=useState('');
 const [courtesySaving,setCourtesySaving]=useState(false);
 const [destinationWarning,setDestinationWarning]=useState(false);
 const [courtesyInfoVisible,setCourtesyInfoVisible]=useState(false);
 const [courtesyConfirmed,setCourtesyConfirmed]=useState(false);
 const [fieldingHelpVisible,setFieldingHelpVisible]=useState(false);
 const [trajectory,setTrajectory]=useState<'ground'|'line'|'fly'>('ground'),[landing,setLanding]=useState<SprayPoint|null>(null);
 const docRef=useRef<ScorebookV2Document|null>(null);const lock=useRef(false);
 // Full-document snapshots are required: lineup substitutions change slots and bench,
 // not just the event log. Keep undo history for this open scoring session.
 const undoStack=useRef<ScorebookV2Document[]>([]);
 const redoStack=useRef<ScorebookV2Document[]>([]);
 const [undoCount,setUndoCount]=useState(0);
 const [redoCount,setRedoCount]=useState(0);
 const saveQueue=useRef<Promise<void>>(Promise.resolve());
 useEffect(()=>{let cancelled=false;(async()=>{try{
  if(!programId||!gameId||!teamId||!opponentTeamId||!managerPersonId)throw new Error('Open Score Game from the game lineup screen.');
  const old=await loadScorebook(programId,gameId,teamId,managerPersonId);
  if(old&&old.ownerTeamId!==teamId)throw new Error('This scorebook belongs to a different scoring team.');
  // Always fetch the latest Game Lineup, even when a scorebook already exists.
  const base=`${API_BASE}/api/game-lineups/${enc(programId)}/${enc(teamId)}/${enc(gameId)}`;
  const [a,b]=await Promise.all([fetch(`${base}?managerPersonId=${enc(managerPersonId)}`,{cache:'no-store'}),fetch(`${base}/opponent/${enc(opponentTeamId)}?managerPersonId=${enc(managerPersonId)}`,{cache:'no-store'}).catch(()=>null)]);
  const mine=await a.json();if(!a.ok||!mine?.ok)throw new Error(mine?.message||'Could not load team lineup.');
  let opp:any={ok:true,shared:false,players:[]};
  if(b?.ok){try{const data=await b.json();if(data?.ok)opp=data;}catch{}}
  const own=importGameLineup(teamId,teamName,Array.isArray(mine.players)?mine.players:[]),other=importGameLineup(opponentTeamId,opponentName,opp.shared&&Array.isArray(opp.players)?opp.players:[]);
  // The server assignment is authoritative for both scoring managers.
  const assignmentResponse=await fetch(`${API_BASE}/api/scorebook-assignment/${enc(programId)}/${enc(gameId)}?teamId=${enc(teamId)}&managerPersonId=${enc(managerPersonId)}`,{cache:'no-store'});
  const assignmentData=await assignmentResponse.json().catch(()=>({}));
  if(!assignmentResponse.ok||!assignmentData.ok)throw new Error(assignmentData.message||'Could not verify official home/visitor assignment.');
  let assignment=assignmentData.assignment;
  if(!cancelled)setAssignmentRevision(assignment?.revision||0);
  if(assignment&&(![teamId,opponentTeamId].includes(assignment.homeTeamId)||![teamId,opponentTeamId].includes(assignment.awayTeamId)||assignment.homeTeamId===assignment.awayTeamId))throw new Error('Official assignment does not match this matchup.');
  if(old&&assignment&&(old.homeTeamId!==assignment.homeTeamId||old.awayTeamId!==assignment.awayTeamId)&&(old.events.length||old.status!=='draft'))throw new Error('Official home/visitor assignment differs from this scored game. No plays were changed. Contact the league to resolve this before scoring.');
  if(!assignment&&!old){
   // First manager establishes the official assignment before creating a scorebook.
   const homeTeamId=myHome?teamId:opponentTeamId,awayTeamId=myHome?opponentTeamId:teamId;
   const createdResponse=await fetch(`${API_BASE}/api/scorebook-assignment/${enc(programId)}/${enc(gameId)}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({teamId,managerPersonId,homeTeamId,awayTeamId,expectedRevision:0})});
   const created=await createdResponse.json().catch(()=>({}));
   if(!createdResponse.ok||!created.ok)throw new Error(created.message||'Could not establish official home/visitor assignment. Reopen Score Game.');
   if(!cancelled)setAssignmentRevision(created.assignment.revision);
   assignment=created.assignment;
  }
  if(old){
   // Before scoring starts, the saved Game Lineup is authoritative. Once plays
   // exist, never reorder slots or replace historical lineup entries: those
   // identifiers are referenced by recorded pitches, runners and substitutions.
   const safeToReplace=(old.events||[]).length===0;
   const mergeTeam=(previous:typeof own,incoming:typeof own)=>{
    if(safeToReplace)return incoming.slots.length>0?incoming:previous;
    const existingIds=new Set([...previous.slots.flatMap(s=>s.appearances.map(a=>String(a.player.id))),...previous.bench.map(p=>String(p.id))]);
    const additions=[...incoming.slots.flatMap(s=>s.appearances.map(a=>a.player)),...incoming.bench]
     .filter(p=>!existingIds.has(String(p.id))&&existingIds.add(String(p.id)));
    const currentById=new Map([...incoming.slots.flatMap(s=>s.appearances.map(a=>a.player)),...incoming.bench].map(p=>[String(p.id),p]));
    const refresh=(player:typeof incoming.bench[number])=>{const latest=currentById.get(String(player.id));return latest?{...player,name:latest.name||player.name,jerseyNumber:latest.jerseyNumber||player.jerseyNumber}:player;};
    return {...previous,slots:previous.slots.map(slot=>({...slot,appearances:slot.appearances.map(a=>({...a,player:refresh(a.player)}))})),bench:[...previous.bench.map(refresh),...additions]};
   };
   const effectiveHome=assignment?.homeTeamId||old.homeTeamId;
   const effectiveAway=assignment?.awayTeamId||old.awayTeamId;
   const priorHome=effectiveHome===old.homeTeamId?old.home:old.away;
   const priorAway=effectiveAway===old.awayTeamId?old.away:old.home;
   const updated:ScorebookV2Document={...old,homeTeamId:effectiveHome,awayTeamId:effectiveAway,
    home:mergeTeam(priorHome,effectiveHome===teamId?own:other),
    away:mergeTeam(priorAway,effectiveAway===teamId?own:other)};
   if(JSON.stringify(updated.home)!==JSON.stringify(old.home)||JSON.stringify(updated.away)!==JSON.stringify(old.away)||updated.homeTeamId!==old.homeTeamId||updated.awayTeamId!==old.awayTeamId){
    await saveScorebook(updated);
   }
   if(!cancelled){docRef.current=updated;setDoc(updated);const state=replayV2(updated);setInning(state.inning);setSide(state.half==='top'?'away':'home');}
   return;
  }
  const now=new Date().toISOString();const fresh:ScorebookV2Document={schemaVersion:1,programId,gameId,ownerTeamId:teamId,homeTeamId:assignment?.homeTeamId||(myHome?teamId:opponentTeamId),awayTeamId:assignment?.awayTeamId||(myHome?opponentTeamId:teamId),home:(assignment?assignment.homeTeamId===teamId:myHome)?own:other,away:(assignment?assignment.awayTeamId===teamId:!myHome)?own:other,createdAt:now,updatedAt:now,events:[],status:'draft'};
  await saveScorebook(fresh);if(!cancelled){docRef.current=fresh;setDoc(fresh);}
 }catch(e:any){if(!cancelled)setMessage(e?.message||'Could not open scorebook.');}finally{if(!cancelled)setLoading(false);}})();return()=>{cancelled=true;};},[programId,gameId,teamId,opponentTeamId,managerPersonId,myHome,teamName,opponentName]);
 // Explain why scoring controls are disabled before the first game start.
 useEffect(()=>{if(doc?.status==='draft'&&!startHelpShown.current){startHelpShown.current=true;setScoreOpen(false);setStartHelpOpen(true);}},[doc?.status]);
 // Pitch taps must not re-read every saved game from AsyncStorage. Refresh spray
 // history when the active plate appearance or lineup changes, not every pitch.
 const sprayHistoryVersion=doc?.events.filter(e=>e.kind==='plateAppearance').length||0;
 // Local history: all saved games for this program on THIS device. Season IDs and
 // server-backed history must be added before treating this as an official season chart.
 useEffect(()=>{let cancelled=false;
  if(!scoreOpen||!doc||selectedId||!activePlayer(replayV2(doc).half==='top'?doc.away:doc.home,replayV2(doc).nextSlot[(replayV2(doc).half==='top'?doc.away:doc.home).teamId]||1)?.player?.id){setHistoricalSprays([]);return;}
  const state=replayV2(doc);const batting=state.half==='top'?doc.away:doc.home;const player=activePlayer(batting,state.nextSlot[batting.teamId]||1)?.player;
  if(!player){setHistoricalSprays([]);return;}
  setHistoryLoading(true);setShowSprayHistory(true);
  (async()=>{try{
   const prefix='ntabl-scorebook-v1:';
   const keys=(await AsyncStorage.getAllKeys()).filter(k=>k.startsWith(prefix));
   const values=await AsyncStorage.multiGet(keys);
   const items:HistoricalSpray[]=[];
   const seen=new Set<string>();
   for(const [,raw] of values){if(!raw)continue;let other:ScorebookV2Document;try{other=JSON.parse(raw);}catch{continue;}
    if(other.programId!==programId||other.ownerTeamId!==teamId)continue;
    const players=[...other.home.slots,...other.away.slots].flatMap(s=>s.appearances.map(a=>a.player));
    const matchingIds=new Set(players.filter(p=>p.id===player.id||(player.personId&&p.personId===player.personId)).map(p=>p.id));
    for(const e of other.events){if(e.kind!=='plateAppearance'||!matchingIds.has(e.playerId)||!e.spray?.landing)continue;
     const unique=other.ownerTeamId+':'+other.gameId+':'+e.id;if(seen.has(unique))continue;seen.add(unique);
     items.push({id:unique,landing:e.spray.landing,outcome:e.spray.outcome,homeRun:e.result==='HR',name:player.name});
    }
   }
   if(!cancelled)setHistoricalSprays(items);
  }catch{if(!cancelled)setHistoricalSprays([]);}finally{if(!cancelled)setHistoryLoading(false);}})();
  return()=>{cancelled=true;};
 },[scoreOpen,selectedId,doc?.gameId,sprayHistoryVersion,doc?.home.slots,doc?.away.slots,programId]);
 async function commit(next:ScorebookV2Document,historyAction:'normal'|'undo'|'redo'='normal'){
  if(lock.current)return false;
  // Protect team-owned scorebook identity through every edit, undo and finalization.
  if(next.ownerTeamId!==teamId||next.gameId!==gameId||next.programId!==programId){
   setMessage('Cannot save: this scorebook belongs to another team or game.');return false;
  }
  // Update the display immediately; serialize local writes without blocking taps on disk I/O.
  if(historyAction==='normal' && docRef.current &&
     (next.events!==docRef.current.events || next.home!==docRef.current.home || next.away!==docRef.current.away)){
   undoStack.current.push(docRef.current);
   if(undoStack.current.length>100)undoStack.current.shift();
   setUndoCount(undoStack.current.length);
   redoStack.current=[];setRedoCount(0);
  }
  const previousDoc=docRef.current;
  const previousState=previousDoc?replayV2(previousDoc):null;
  docRef.current=next;setDoc(next);
  const state=replayV2(next);setInning(state.inning);setSide(state.half==='top'?'away':'home');
  if(previousState && (previousState.inning!==state.inning || previousState.half!==state.half)){
    setScoreOpen(false);setMenu(null);setLanding(null);setPreviewResult(null);setSelectedId(null);
    if(sideChangeTimer.current)clearTimeout(sideChangeTimer.current);
    // A short view of the scorebook gives the scorer a chance to see the next yellow cell.
    if(next.status==='inProgress'){
     // Standard seven-inning game: prompt before an unnecessary bottom half,
     // or after the home half. User can continue for scheduled nine-inning games.
     if(previousState && previousState.inning>=((next as any).scheduledInnings===9?9:7) &&
        ((previousState.half==='top'&&state.half==='bottom'&&state.homeRuns>state.awayRuns)||
         (previousState.half==='bottom'&&state.half==='top'&&state.inning>previousState.inning&&state.homeRuns!==state.awayRuns))){
       // Use the same End Game confirmation as Options, not a native alert stacked over a modal.
       setSideChangePending(false);
       setConfirmAction('end');
     }else{
     setSideChangePending(true);
     sideChangeTimer.current=setTimeout(()=>{
      const latest=docRef.current;
      if(latest?.status==='inProgress' && activePlayer(replayV2(latest).half==='top'?latest.away:latest.home,replayV2(latest).nextSlot[(replayV2(latest).half==='top'?latest.away:latest.home).teamId]||1))setScoreOpen(true);
      setSideChangePending(false);
     },3000);
     }
    }
  }
  saveQueue.current=saveQueue.current.catch(()=>{}).then(()=>saveScorebook(next));
  saveQueue.current.catch((e:any)=>Alert.alert('Scorebook save failed',e?.message||'Unable to save scorebook.'));
  return true;
 }
   async function pitch(kind:PitchKind,third?:'swinging'|'looking'|'droppedOut'|'droppedSafe'){
   const d=docRef.current;if(!d||d.status!=='inProgress'||lock.current)return;
   try{
    const state=replayV2(d),team=state.half==='top'?d.away:d.home;
    if(!activePlayer(team,state.nextSlot[team.teamId]||1)){Alert.alert('Lineup required','Add the batting order for this team before recording pitches.');return;}
    if(kind==='ball'&&state.balls>=4)return;
    if(['calledStrike','swingingStrike','foulBunt'].includes(kind)&&state.strikes>=3)return;
    if(['calledStrike','swingingStrike','foulBunt'].includes(kind)&&state.strikes===2&&!third){setMenu('strikeout');return;}
    if(third==='droppedOut'){const ev=makePitch(d,kind);const pitched={...d,events:[...d.events,ev]};if(await commit(pitched)){choose('K');setSpecialCode('DP3K');setResult('K');setPreviewResult('K');setTrajectory('ground');setMenu('fielding');}return;}
    if(third==='droppedSafe'&&state.outs<2&&state.bases[0]){Alert.alert('Dropped third strike','The batter cannot reach first on an uncaught third strike with first base occupied and fewer than two outs.');return;}
    const ev=makePitch(d,kind);const pitched={...d,events:[...d.events,ev]};
    if(third){
     const advances=suggestedAdvances(pitched,'K');
     if(third==='droppedSafe')advances[advances.length-1].isOut=false;
     const play=makePlay(pitched,'K',advances,[],0,third==='droppedSafe'?'K (D3 safe)':third==='droppedOut'?'K (D3 out)':'K');
     play.strikeoutLooking=third==='looking';
     if(third==='droppedSafe'||third==='droppedOut')play.notes='Uncaught third strike; '+(third==='droppedSafe'?'batter safe at first':'batter out');
     if(await commit({...pitched,events:[...pitched.events,play]})){setSelectedId(null);setMenu(null);setPreviewResult(null);setFielders([]);setLanding(null);setTrajectory('ground');}
    }else if(kind==='ball'&&state.balls===3){
     const advances=suggestedAdvances(pitched,'BB'),play=makePlay(pitched,'BB',advances,[],0,'BB');
     if(await commit({...pitched,events:[...pitched.events,play]})){setSelectedId(null);setMenu(null);setLanding(null);setPreviewResult(null);}
    }else await commit(pitched);
   }catch(e:any){Alert.alert('Scoring error',e?.message||'Could not record pitch.');}
  }
function choose(r:PlateAppearanceResult){if(!doc)return;try{setScreenUndo([]);setScreenRedo([]);setSpecialCode(null);setSpecialOut(false);const state=replayV2(doc);const suggested=suggestedAdvances(doc,r);for(let i=0;i<3;i++){const runner=state.bases[i];if(runner&&!suggested.some(a=>a.playerId===runner))suggested.unshift({playerId:runner,from:(i+1) as 1|2|3,to:(i+1) as 1|2|3});}setAdvances(suggested);setResult(r);setPreviewResult(r);setRbis(0);setRunnerReasons({});setRunnerErrors({});setPlayErrorPosition(null);setLanding(null);setFielders([]);if(r==='HR')setTrajectory('fly');setMenu(r==='HBP'||r==='CI'?'runners':'hitType');}catch(e:any){Alert.alert('Lineup required',e?.message||'Add the batting order first.');}}
 function rememberScreen(){setScreenRedo([]);setScreenUndo(old=>[...old.slice(-29),{menu,result,trajectory,landing,fielders:[...fielders],advances:advances.map(a=>({...a})),runnerReasons:{...runnerReasons},runnerErrors:{...runnerErrors},playErrorPosition,runnerOtherReasons:{...runnerOtherReasons},runnerOutDetails:{...runnerOutDetails},runnerOutFor}]);}
 function undoScreen(){setScreenUndo(old=>{if(!old.length)return old;setScreenRedo(r=>[...r,{menu,result,trajectory,landing,fielders:[...fielders],advances:advances.map(a=>({...a})),runnerReasons:{...runnerReasons},runnerErrors:{...runnerErrors},playErrorPosition,runnerOtherReasons:{...runnerOtherReasons},runnerOutDetails:{...runnerOutDetails},runnerOutFor}]);const snap=old[old.length-1];setResult(snap.result);setTrajectory(snap.trajectory);setLanding(snap.landing);setFielders(snap.fielders);setAdvances(snap.advances);setRunnerReasons(snap.runnerReasons);setRunnerErrors(snap.runnerErrors);setPlayErrorPosition(snap.playErrorPosition);setRunnerOtherReasons(snap.runnerOtherReasons);setRunnerOutDetails(snap.runnerOutDetails||{});setRunnerOutFor(snap.runnerOutFor||null);setMenu(snap.menu);return old.slice(0,-1);});}
 function setRunner(index:number,to:number,out=false){rememberScreen();if(!out&&to===advances[index].from){const playerId=advances[index].playerId;setRunnerReasons(old=>{const next={...old};delete next[playerId];return next;});setRunnerErrors(old=>{const next={...old};delete next[playerId];return next;});setRunnerOtherReasons(old=>{const next={...old};delete next[playerId];return next;});}if(out){setRunnerOutFor(advances[index].playerId);setMenu('runnerOut');}else{setRunnerOutDetails(v=>{const next={...v};delete next[advances[index].playerId];return next;});}setAdvances(old=>old.map((a,i)=>i===index?{...a,to:to as 1|2|3|4,isOut:out}:a));}
 const autoRbi=advances.filter(a=>a.to===4&&a.to!==a.from&&!a.isOut&&runnerReasons[a.playerId]!=='error'&&runnerReasons[a.playerId]!=='same'&&runnerReasons[a.playerId]!=='throw'&&runnerReasons[a.playerId]!=='other'&&result!=='FC').length;
 function chooseSpecial(code:string,isOut=false){
  const mapped:PlateAppearanceResult=code==='GR2B'?'2B':code==='COBS'?'CI':code==='SCBT'||code==='BUNT'||code==='SACRIFICE BUNT'?'SAC':code==='SACRIFICE FLY'?'SF':code==="FIELDER'S CHOICE"?'FC':code==='DP3K'||code==='WP3K'?'K':isOut?'OUT':'FC';
  choose(mapped);setSpecialCode(code);setSpecialOut(isOut);if(code==='SACRIFICE FLY')setTrajectory('fly');if(code==='SACRIFICE BUNT')setTrajectory('ground');
  if(code==='COBS'||['OUT OF TURN','OUT OF BOX','THROWN BAT','LEFT PATH','HIT BY BALL','RUN INT','OTHER'].includes(code))setMenu('runners');
  else setMenu('hitType');
 }
 function setReason(playerId:string,reason:'batter'|'error'|'same'|'throw'|'other'){
  rememberScreen();if(reason==='other'){setRunnerOtherFor(playerId);setMenu('runnerOther');}
  setRunnerReasons(v=>({...v,[playerId]:reason}));if(reason==='error')setErrorFor(playerId);else if(reason==='same'&&playErrorPosition)setRunnerErrors(v=>({...v,[playerId]:playErrorPosition}));else setRunnerErrors(v=>{const copy={...v};delete copy[playerId];return copy;});
 }
 const positionLabels:Record<number,string>={1:'P',2:'C',3:'1B',4:'2B',5:'3B',6:'SS',7:'LF',8:'CF',9:'RF'};
 function currentDefensiveAssignments(d:ScorebookV2Document){
  const state=replayV2(d),defense=state.half==='top'?d.home:d.away;
  const assigned=[...defense.slots.flatMap(slot=>slot.appearances.filter(a=>a.exitedAtEvent===undefined)),...defense.bench.filter(p=>((defense as any).benchDefenderIds||[]).includes(p.id)&&fieldPositions.includes((p.position||'').toUpperCase())).map(p=>({entryId:`bench-defense:${p.id}`,player:p,position:p.position}))];
  return {team:defense,assigned};
 }
 function defenseIdentity(position:number,d=docRef.current){
  if(!d)return null;
  const {assigned}=currentDefensiveAssignments(d);
  const label=positionLabels[position];
  const entry=assigned.find(a=>a.position.trim().toUpperCase()===label);
  return entry?{position,code:label,playerId:entry.player.id,entryId:entry.entryId,playerName:entry.player.name}:null;
 }
 function defensePlayer(position:number){return defenseIdentity(position)?.playerName||`Position ${position}`;}
 function fieldingAttribution(positions:number[]){return positions.map(position=>defenseIdentity(position)||{position,code:positionLabels[position],playerId:null,entryId:null,playerName:null});}
 // Main scoring > Other: award first base immediately without a hit-type screen.
 async function recordOtherAward(resultCode:'BB'|'IBB'|'HBP'|'CI'){
  const d=docRef.current;if(!d||d.status!=='inProgress')return;
  try{
   const advances=suggestedAdvances(d,resultCode);
   const play=makePlay(d,resultCode,advances,[],0,resultCode);
   // Forced advances on a walk/HBP/interference are part of the award; no hit or AB.
   const saved=await commit({...d,events:[...d.events,play]});
   if(saved){setMenu(null);setPreviewResult(null);setLanding(null);setSelectedId(null);setScreenUndo([]);}
  }catch(e:any){Alert.alert('Other Scoring',e?.message||'Unable to award first base.');}
 }
 // A balk is a runner-only, dead-ball event; the current plate appearance stays open.
 async function recordScoringBalk(){
  const d=docRef.current;if(!d||d.status!=='inProgress')return;
  try{
   const state=replayV2(d),batting=state.half==='top'?d.away:d.home;
   const advances:RunnerAdvance[]=state.bases.flatMap((playerId,i)=>playerId?[{playerId,from:(i+1) as 1|2|3,to:Math.min(4,i+2) as 1|2|3|4}]:[]);
   if(!advances.length){Alert.alert('Balk','There are no runners on base to advance.');return;}
   const runs=advances.filter(a=>a.to===4).length;
   const ev={kind:'runner',id:id(),sequence:d.events.length+1,at:new Date().toISOString(),half:state.half,inning:state.inning,battingTeamId:batting.teamId,action:'BK',runners:advances,outsOnPlay:0,runsOnPlay:runs,fielders:[],notes:'Balk: dead ball; each occupied base advances one base; no RBI',rbis:0} as ScorebookV2Event;
   const saved=await commit({...d,events:[...d.events,ev]});
   if(saved){setMenu(null);setScreenUndo([]);setRunnerBase(null);setRunnerChoice(null);setPreviewResult(null);}
  }catch(e:any){Alert.alert('Balk',e?.message||'Could not record balk.');}
 }
  async function skipCurrentBatter(countAsOut:boolean){
   const d=docRef.current;if(!d||d.status!=='inProgress')return;
   try{
    const state=replayV2(d);
    if(countAsOut&&state.outs>=3){Alert.alert('Skip Batter','Three outs have already been recorded.');return;}
    // A skip is an explicit plate-appearance event so replay advances the batting slot,
    // retains all existing baserunners, and Undo/Redo can restore the prior batter.
    const play=makePlay(d,'OUT',[],[],0,countAsOut?'SKIP (OUT)':'SKIP (NO OUT)');
    play.outsOnPlay=countAsOut?1:0;
    (play as any).specialResult='SKIP_BATTER';
    play.notes=countAsOut?'Batter skipped — charged one out':'Batter skipped — no out charged';
    await commit({...d,events:[...d.events,play]});
    setSkipConfirmOpen(false);setMiscOpen(false);setMenu(null);setScoreOpen(true);
   }catch(e:any){Alert.alert('Skip Batter',e?.message||'Unable to skip batter.');}
  }
 async function selectedRunnerAction(action:string){
  const d=docRef.current;if(!d||d.status!=='inProgress'||runnerBase===null)return;
  const state=replayV2(d),playerId=state.bases[runnerBase-1];if(!playerId)return;
  if(action==='OTHER'){setMenu('runnerActionOther');return;}
  if(action==='CR'){setCourtesyConfirmed(false);setRunnerChoice('CR');setRunnerCourtesy(null);setRunnerCourtesyId(null);setCourtesyError('');setCourtesyInfoVisible(true);return;}
  if(action==='PR'){Alert.alert('Pinch Runner','A pinch runner changes the official lineup. Complete the substitution in Game Lineup Builder before recording this action.');return;}
  setRunnerChoice(action);
  if(action==='CS'||action==='PICKED OFF'){setRunnerSafe(false);setRunnerFielders([]);setMenu('runnerActionFielding');return;}
  if(action==='E'){setRunnerFielders([]);setMenu('runnerActionFielding');}
 }
 async function saveCourtesyRunner(){
  if(courtesySaving)return;
  setCourtesyError('');
  const d=docRef.current;
  if(!d||d.status!=='inProgress'){setCourtesyError('Start the game before assigning a courtesy runner.');return;}
  if(!runnerCourtesyId){setCourtesyError('Select Last Out or 2nd Out before confirming.');return;}
  const state=replayV2(d);
  // The base is normally supplied by the tapped diamond. Never silently ignore a missing base.
  const base=runnerBase!==null&&state.bases[runnerBase-1]?runnerBase:
    state.bases.filter(Boolean).length===1?state.bases.findIndex(Boolean)+1:null;
  if(base===null){setCourtesyError('Tap the occupied base on the scoring diamond, then select Courtesy Runner.');return;}
  const originalId=state.bases[base-1];
  if(!originalId){setCourtesyError('There is no runner on the selected base.');return;}
  if(originalId===runnerCourtesyId){setCourtesyError('That player is already on the selected base.');return;}
  if(state.bases.includes(runnerCourtesyId)){setCourtesyError('That player is already running on another base.');return;}
  const batting=state.half==='top'?d.away:d.home;
  const players=[...batting.slots.flatMap(x=>x.appearances).map(x=>x.player),...batting.bench];
  const substitute=players.find(x=>x.id===runnerCourtesyId);
  const original=players.find(x=>x.id===originalId);
  if(!substitute){setCourtesyError('Selected player was not found on the batting team.');return;}
  const ev={kind:'runner',id:id(),sequence:d.events.length+1,at:new Date().toISOString(),half:state.half,inning:state.inning,battingTeamId:batting.teamId,action:'CR',runners:[],outsOnPlay:0,runsOnPlay:0,fielders:[],notes:`${substitute.name}, courtesy runner for ${original?.name||'runner'}, inning ${state.inning}`} as unknown as ScorebookV2Event;
  setCourtesySaving(true);
  try{
   const next={...d,events:[...d.events,ev]};
   if(!await commit(next)){setCourtesyError('Scorebook is busy. Please tap Confirm again.');return;}
   setCourtesyInfoVisible(false);setCourtesyConfirmed(false);setCourtesyError('');setRunnerBase(null);setRunnerChoice(null);setRunnerCourtesy(null);setRunnerCourtesyId(null);setMenu(null);setScoreOpen(false);
  }catch(e:any){setCourtesyError(e?.message||'Unable to save courtesy runner.');}
  finally{setCourtesySaving(false);}
 }
 async function saveSelectedRunnerAction(){
  const d=docRef.current;if(!d||d.status!=='inProgress'||runnerBase===null||!runnerChoice)return;
  const state=replayV2(d),playerId=state.bases[runnerBase-1];if(!playerId)return;
  const batting=state.half==='top'?d.away:d.home;
  if(!runnerSafe&&state.outs>=3)return;
  if(runnerChoice==='CR'){if(courtesyConfirmed){setCourtesyConfirmed(false);setRunnerBase(null);setRunnerChoice(null);setRunnerCourtesy(null);setRunnerCourtesyId(null);setMenu(null);setScoreOpen(false);return;}setCourtesyInfoVisible(true);return;}
  if(runnerSafe&&runnerDestination<=runnerBase){setDestinationWarning(true);return;}
  if((['E','CS','PICKED OFF'].includes(runnerChoice)||!runnerSafe)&&!runnerFielders.length){Alert.alert('Fielders required','Select the defensive position(s) involved.');return;}
  const advance:RunnerAdvance={playerId,from:runnerBase as 1|2|3,to:runnerDestination,isOut:!runnerSafe};
  const ev:ScorebookV2Event={kind:'runner',id:id(),sequence:d.events.length+1,at:new Date().toISOString(),half:state.half,inning:state.inning,battingTeamId:batting.teamId,action:runnerChoice,runners:[advance],outsOnPlay:runnerSafe?0:1,runsOnPlay:runnerDestination===4&&runnerSafe?1:0,fielders:[...runnerFielders],notes:`${runnerChoice} ${runnerSafe?'SAFE':'OUT'} at ${runnerDestination===4?'HOME':runnerDestination+'B'}` } as ScorebookV2Event;
  (ev as any).defensivePlayers=fieldingAttribution(runnerFielders);
  (ev as any).runnerDetail={action:runnerChoice,safe:runnerSafe,fielders:[...runnerFielders],from:runnerBase,to:runnerDestination};
  try{await commit({...d,events:[...d.events,ev]});setRunnerBase(null);setRunnerChoice(null);setRunnerFielders([]);setMenu(null);}catch(e:any){Alert.alert('Runner action',e?.message||'Could not save runner action.');}
 }
 function openSacrificeChoice(source:'inplay'|'outOther'){setSacrificeSource(source);setSacrificeSelection(null);setMenu('sacrificeChoice');}
 function previousScoringStep(){
  if(menu==='runnerActionFielding'){setMenu('runnerOnly');}
  else if(menu==='runnerActionOther'){setMenu('runnerOnly');}
  else if(menu==='outOther'){setMenu('hitType');}
  else if(menu==='sacrificeChoice'){setMenu(sacrificeSource);}
  else if(menu==='runnerOut'){setMenu('runners');setRunnerOutFor(null);}
  else if(menu==='inplayOther'){setMenu('inplay');}
  else if(menu==='runnerOther'){setRunnerOtherFor(null);setMenu('runners');}
        else if(menu==='runnerOut'){setRunnerOutFor(null);setMenu('runners');}
  else if(menu==='runners')setMenu(['OUT','FC','ROE','SAC','SF'].includes(result)?'fielding':'hitType');
  else if(menu==='fielding')setMenu('hitType');
  else if(menu==='hitType')setMenu((result==='SAC'||result==='SF')&&specialCode?.startsWith('SACRIFICE ')?'sacrificeChoice':specialCode?(specialOut?'outOther':'inplayOther'):['OUT','K','SAC','SF'].includes(result)?null:['BB','IBB','HBP','CI'].includes(result)?'other':'inplay');
  else if(menu==='strikeout')setMenu(null);
  else if(menu==='runnerOnly')setMenu(null);
        else if(menu==='runnerActionFielding')setMenu('runnerOnly');
        else if(menu==='runnerActionOther')setMenu('runnerOnly');
  else setMenu(null);
 }
 function continueScoring(next:'fielding'|'runners'){
  if(next==='runners'&&result==='ROE'&&!playErrorPosition){Alert.alert('Error position required','Select the fielder who committed the error.');return;}
  if(next==='runners'&&!live.bases.some(Boolean)){
   // No existing baserunners: the batter's result is already selected.
   // Do not present a runner-management screen that could undo an out.
   void record();return;
  }
  setMenu(next);
 }
 async function record(){const d=docRef.current;if(!d||d.status!=='inProgress'||lock.current)return;try{
  const s=replayV2(d);if(advances.some(a=>a.from>0&&s.bases[a.from-1]!==a.playerId))throw new Error('Runner state changed; reopen this play.');
  if(advances.some(a=>a.isOut&&a.from>0&&!runnerOutDetails[a.playerId]?.reason))throw new Error('Choose how each retired runner was put out.');
  if(advances.some(a=>a.from>0&&a.isOut&&runnerOutDetails[a.playerId]?.reason==='Double Play')&&!(result==='OUT'&&fielders.length>=2))throw new Error('A double play needs a batter out and a recorded defensive sequence.');
  const play=makePlay(d,result,advances.map(a=>({...a,rbiCredited:a.to===4&&!a.isOut&&runnerReasons[a.playerId]!=='error'&&runnerReasons[a.playerId]!=='same'&&runnerReasons[a.playerId]!=='throw'&&runnerReasons[a.playerId]!=='other'})),fielders,autoRbi,result==='OUT'&&fielders.length?fielders.join('-'):result==='ROE'&&fielders.length?`E${fielders[0]}`:result==='SAC'?(trajectory==='fly'?'SF':'BT'):result==='SF'?'SF':specialCode||result);
  (play as any).defensivePlayers=fieldingAttribution(fielders);
  if(result==='SAC'&&trajectory==='fly'){play.result='SF';play.notation='SF';}
  if(specialCode){play.notation=(result==='SAC'||result==='SF')?(trajectory==='fly'||result==='SF'?'SF':'BT'):(specialCode==='DP3K'?'D3 Out':specialCode);(play as any).specialResult=specialCode;play.notes=specialCode==='DP3K'?'Dropped Third Strike — Batter Out':`Result: ${specialCode}`;}
  if(result==='ROE'&&!playErrorPosition)throw new Error('Select the fielder responsible for the error before saving.');
  if(result==='ROE'&&playErrorPosition){(play as any).errorPosition=playErrorPosition;(play as any).errorPlayer=defensePlayer(playErrorPosition);}
  if(result==='OUT'&&advances.some(a=>a.from>0&&a.isOut&&runnerOutDetails[a.playerId]?.reason==='Double Play')){play.notation=`DP ${fielders.join('-')}`;play.notes=`Double play ${fielders.join('–')}: batter and runner retired`; }
  (play as any).runnerDetails=advances.map(a=>({playerId:a.playerId,from:a.from,to:a.to,isOut:!!a.isOut,reason:!a.isOut&&a.to===a.from?null:(runnerReasons[a.playerId]||'batter'),errorPosition:runnerReasons[a.playerId]==='same'?playErrorPosition:(runnerErrors[a.playerId]||null),samePlayError:runnerReasons[a.playerId]==='same',errorPlayer:runnerErrors[a.playerId]?defensePlayer(runnerErrors[a.playerId]):null,otherReason:runnerOtherReasons[a.playerId]||null,outReason:runnerOutDetails[a.playerId]?.reason||null,outFielders:runnerOutDetails[a.playerId]?.fielders||[],outDefensivePlayers:fieldingAttribution(runnerOutDetails[a.playerId]?.fielders||[])}));
  if(result==='ROE'&&playErrorPosition)play.notes=`Error by E${playErrorPosition} (${defensePlayer(playErrorPosition)})`;
  if(result==='CI')play.notes="Catcher's interference";
  if(landing){play.spray={landing,outcome:result==='ROE'?'error':['OUT','K','SAC','SF'].includes(result)?'out':'hit',fielders:[...fielders],path:[{x:.5,y:0},landing]};(play as any).trajectory=trajectory;}
  if(await commit({...d,events:[...d.events,play]})){setMenu(null);setFielders([]);setAdvances([]);setSelectedId(null);setPreviewResult(null);setLanding(null);setTrajectory('ground');setRbis(0);setRunnerReasons({});setRunnerErrors({});setPlayErrorPosition(null);setRunnerOutDetails({});setRunnerOutFor(null);setSpecialCode(null);setSpecialOut(false);}
 }catch(e:any){Alert.alert('Review scoring',e?.message||'This play needs correction.');}}
 async function runnerAction(action:'SB'|'CS'|'PO'|'WP'|'PB'|'BK'|'OTHER'){
  const d=docRef.current;if(!d||d.status!=='inProgress')return;const s=replayV2(d),team=s.half==='top'?d.away:d.home;
  const occupied=s.bases.map((x,i)=>({x,i})).filter(x=>!!x.x);if(!occupied.length){Alert.alert('No runners','No occupied bases.');return;}
  Alert.alert('Select runner',`Record ${action} for which base?`,occupied.map(({x,i})=>({text:`${i+1}${i===0?'st':i===1?'nd':'rd'} base`,onPress:()=>{
   const isOut=action==='CS'||action==='PO';const to=isOut?Math.min(4,i+2):Math.min(4,i+2);
   const advance:RunnerAdvance={playerId:x!,from:(i+1) as 1|2|3,to:to as 1|2|3|4,isOut};
   const ev:ScorebookV2Event={kind:'runner',id:id(),sequence:d.events.length+1,at:new Date().toISOString(),half:s.half,inning:s.inning,battingTeamId:team.teamId,action,runners:[advance],outsOnPlay:isOut?1:0,runsOnPlay:to===4&&!isOut?1:0,fielders:[...fielders]};
   if(isOut&&s.outs>=3){Alert.alert('Three outs already');return;}void commit({...d,events:[...d.events,ev]});setMenu(null);
  }})).concat([{text:'Cancel',onPress:()=>{}}]));
 }
 function undo(){
  const d=docRef.current;
  if(!d||d.status!=='inProgress'||!undoStack.current.length||lock.current)return;
  const previous=undoStack.current.pop()!;
  redoStack.current.push(d);
  setUndoCount(undoStack.current.length);
  setRedoCount(redoStack.current.length);
  void commit(previous,'undo');
  setLanding(null);setPreviewResult(null);setMenu(null);
 }
 function redo(){
  const d=docRef.current;
  if(!d||d.status!=='inProgress'||!redoStack.current.length||lock.current)return;
  const next=redoStack.current.pop()!;
  undoStack.current.push(d);
  setUndoCount(undoStack.current.length);
  setRedoCount(redoStack.current.length);
  void commit(next,'redo');
  setLanding(null);setPreviewResult(null);setMenu(null);
 }
 function redoScreen(){setScreenRedo(old=>{if(!old.length)return old;const snap=old[old.length-1];setScreenUndo(u=>[...u,{menu,result,trajectory,landing,fielders:[...fielders],advances:advances.map(a=>({...a})),runnerReasons:{...runnerReasons},runnerErrors:{...runnerErrors},playErrorPosition,runnerOtherReasons:{...runnerOtherReasons},runnerOutDetails:{...runnerOutDetails},runnerOutFor}]);setResult(snap.result);setTrajectory(snap.trajectory);setLanding(snap.landing);setFielders(snap.fielders);setAdvances(snap.advances);setRunnerReasons(snap.runnerReasons);setRunnerErrors(snap.runnerErrors);setPlayErrorPosition(snap.playErrorPosition);setRunnerOtherReasons(snap.runnerOtherReasons);setRunnerOutDetails(snap.runnerOutDetails||{});setRunnerOutFor(snap.runnerOutFor||null);setMenu(snap.menu);return old.slice(0,-1);});}
 function setScheduledInnings(n:7|9){const d=docRef.current;if(!d)return;void commit({...d,scheduledInnings:n} as ScorebookV2Document);setInningsOpen(false);}
 function swapHomeAway(){
  const d=docRef.current;if(!d)return;
  if(d.status!=='draft'||d.events.length){setGameActionError('Home/visitor can only be changed before scoring begins. Existing plays must not be relabeled.');return;}
  setSwapOpen(true);
 }
 async function confirmSwapHomeAway(){
  const d=docRef.current;if(!d||swapBusy)return;
  setSwapBusy(true);
  try{
   await saveQueue.current;
   const response=await fetch(`${API_BASE}/api/scorebook-assignment/${enc(programId)}/${enc(gameId)}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({teamId,managerPersonId,homeTeamId:d.awayTeamId,awayTeamId:d.homeTeamId,expectedRevision:assignmentRevision})});
   const data=await response.json().catch(()=>({}));
   if(!response.ok||!data.ok)throw new Error(data.message||'Could not save official home/visitor assignment.');
   setAssignmentRevision(data.assignment.revision);
   const next:ScorebookV2Document={...d,home:d.away,away:d.home,homeTeamId:d.awayTeamId,awayTeamId:d.homeTeamId};
   const saved=await commit(next);
   if(!saved)throw new Error('Official assignment saved, but this scorebook did not refresh. Reopen Score Game before scoring.');
   setSide('away');setSwapOpen(false);setMessage('Official home/visitor assignment saved for both teams. Other manager must reopen Score Game to refresh.');
  }catch(e:any){setGameActionError(e?.message||'Could not swap teams.');setSwapOpen(false);}
  finally{setSwapBusy(false);}
 }
 function openAdjustScore(){const d=docRef.current;if(!d)return;const a=(d as any).scoreAdjustments||[];setAdjustAway(String(a.reduce((n:number,x:any)=>n+(Number(x.away)||0),0)));setAdjustHome(String(a.reduce((n:number,x:any)=>n+(Number(x.home)||0),0)));setAdjustReason('');setAdjustScoreOpen(true);}
 async function saveAdjustScore(){const d=docRef.current;if(!d||lock.current)return;const away=Number(adjustAway),home=Number(adjustHome);if(!Number.isInteger(away)||!Number.isInteger(home)||Math.abs(away)>99||Math.abs(home)>99){Alert.alert('Invalid score adjustment','Enter whole-number adjustments between -99 and 99.');return;}if(!adjustReason.trim()){Alert.alert('Reason required','Explain why the official score is being adjusted.');return;}
 const existing=((d as any).scoreAdjustments||[]) as any[];const oldAway=existing.reduce((n,x)=>n+(Number(x.away)||0),0),oldHome=existing.reduce((n,x)=>n+(Number(x.home)||0),0);
 if(away===oldAway&&home===oldHome){setAdjustScoreOpen(false);return;}
 const next={...d,scoreAdjustments:[...existing,{id:id(),at:new Date().toISOString(),away:away-oldAway,home:home-oldHome,reason:adjustReason.trim()}],editHistory:[...(d.editHistory||[]),{at:new Date().toISOString(),description:`Score adjustment: visitors ${away-oldAway>=0?'+':''}${away-oldAway}, home ${home-oldHome>=0?'+':''}${home-oldHome}; ${adjustReason.trim()}`}]} as ScorebookV2Document;
 if(await commit(next))setAdjustScoreOpen(false);
 }
 function openEditSavedPlay(){if(!chosen||chosen.kind!=='plateAppearance'||doc?.status!=='inProgress')return;setEditPlayResult(chosen.result);setEditPlayError('');setEditPlayOpen(true);}
 async function saveEditedPlay(){
  const d=docRef.current;
  const original=d?.events.find(e=>e.id===selectedId);
  if(!d||!original||original.kind!=='plateAppearance'||d.status!=='inProgress'||lock.current)return;
  const oldResult=original.result,newResult=editPlayResult;
  const compatible:PlateAppearanceResult[]=['BB','IBB','HBP','1B','ROE','FC'];
  const batterAdvance=original.runners.find(r=>r.playerId===original.playerId&&r.from===0);
  if(!compatible.includes(oldResult)||!compatible.includes(newResult)||!batterAdvance||batterAdvance.to!==1||batterAdvance.isOut){
   setEditPlayError('This editor supports BB, IBB, HBP, 1B, Error, and Fielder’s Choice only when the batter safely reached first. Other corrections require a full baserunning editor.');return;
  }
  if(oldResult===newResult){setEditPlayOpen(false);return;}
  // Keep every recorded pitch and runner advance intact. Pitch counts reflect pitches
  // actually logged, even if the official outcome is corrected afterward.
  const oldNotation=String(original.notation||'');
  const updated={...original,result:newResult,
   notation:newResult==='ROE'?(oldNotation.startsWith('E')?oldNotation:'E?'):newResult,
   notes:[original.notes,`Official scoring correction: ${oldResult} to ${newResult}. Recorded pitches and runner movements retained.`].filter(Boolean).join(' | '),
   spray:original.spray?{...original.spray,outcome:newResult==='ROE'?'error':'hit'}:undefined};
  const next={...d,events:d.events.map(e=>e.id===original.id?updated:e),editHistory:[...(d.editHistory||[]),{at:new Date().toISOString(),description:`Play ${original.id} (${original.inning} ${original.half}): ${oldResult} → ${newResult}; pitches and advances preserved`}]} as ScorebookV2Document;
  if(await commit(next)){setEditPlayOpen(false);setScoreOpen(false);setSelectedId(null);}
 }

 function changeStatus(){
  const d=docRef.current;if(!d)return;
  setOptionsOpen(false);
  // The edit confirmation is only initiated by an explicit Options tap.
  if(d.status==='final')setPostgameOpen(false);
  setConfirmAction(d.status==='draft'?'start':d.status==='inProgress'?'end':'edit');
 }
 async function confirmGameAction(){
  const d=docRef.current,action=confirmAction;if(!d||!action||confirmBusy)return;
  setConfirmBusy(true);
  try{
   if(action==='reset'){
    if(resetPhrase.trim().toUpperCase()!=='RESET')throw new Error('Type RESET to confirm.');
    await saveQueue.current;
    await resetGameScorebook(programId,gameId,teamId,managerPersonId);
    docRef.current=null;setDoc(null);setScoreOpen(false);setMessage('Game scorebook reset. Return to lineup and reopen Score Game.');
   }else if(action==='start'){
    const started:ScorebookV2Document={...d,status:'inProgress'};
    const saved=await commit(started);
    if(saved){
     const opponent=started.ownerTeamId===started.awayTeamId?started.home:started.away;
     if(!missingLineupShown.current&&!opponent.slots.some(slot=>slot.appearances.some(a=>a.player.name?.trim()))){
      missingLineupShown.current=true;
      setMissingLineupTeam(started.ownerTeamId===started.awayTeamId?'home':'away');
     }
     setSide('away');setInning(1);setSelectedId(null);setSelectedEntry('');setMenu(null);setPreviewResult(null);setLanding(null);setScoreOpen(true);}
   }
   else if(action==='end'){
    // Both the automatic and Options paths converge here. Never stack modals.
    setOptionsOpen(false);setScoreOpen(false);setPostgameOpen(false);
    setPostgameError('');
   }
   else if(action==='edit')await commit({...d,status:'inProgress',editHistory:[...(d.editHistory||[]),{at:new Date().toISOString(),description:'Reopened final game for editing'}]});
   setConfirmAction(null);setResetPhrase('');
   if(action==='end')openPostgame();
  }catch(e:any){setGameActionError(e?.message||'Please try again.');}
  finally{setConfirmBusy(false);}
 }

 async function finalizePostgame(){
  const d=docRef.current;if(!d||confirmBusy)return;
  if(d.ownerTeamId!==teamId){setPostgameError('This scorebook is owned by a different team.');return;}
  if(postgameWin&&postgameWin===postgameLoss){setPostgameError('Winning and losing pitcher must be different.');return;}
  if(postgameSave&&(postgameSave===postgameWin||postgameSave===postgameLoss)){setPostgameError('Save pitcher must be different from winning and losing pitchers.');return;}
  setConfirmBusy(true);
  try{
   const oldRevision=Number((d as any).finalRevision||0);
   const finalized={...d,status:'final' as const,finalRevision:oldRevision+1,finalizedAt:new Date().toISOString(),pitchingDecisions:{win:postgameWin||null,loss:postgameLoss||null,save:postgameSave||null},editHistory:[...(d.editHistory||[]),{at:new Date().toISOString(),description:`Game finalized (revision ${oldRevision+1})`}]};
   const saved=await commit(finalized as ScorebookV2Document);
   if(!saved)throw new Error('The scorebook could not be saved.');
   setConfirmAction(null);setPostgameOpen(true);setPostgameError('');
   setMessage(`${d.ownerTeamId===d.awayTeamId?d.away.teamName:d.home.teamName} scorebook finalized (revision ${oldRevision+1}). The opposing manager's scorebook was not changed.`);
  }catch(e:any){setPostgameError(e?.message||'Could not finalize game.');}
  finally{setConfirmBusy(false);}
 }
 async function exportScorebookPdf(){
  const d=docRef.current;if(!d)return;
  const html=buildTraditionalScorebookHtml(d,(pid,tid)=>todayBatting(d,pid,tid),{win:postgameWin,loss:postgameLoss,save:postgameSave});
  if(Platform.OS==='web'){
   const w=(globalThis as any).window?.open('','_blank');
   if(!w){setPostgameError('Allow pop-ups for NTABL, then try again.');return;}
   w.document.open();w.document.write(html.replace('<\\/script>','</script>'));w.document.close();
   // Automatically offer the browser print dialog; choose Save as PDF.
   w.addEventListener('load',()=>{w.focus();w.print();},{once:true});
   return;
  }
  try{
   const Print=await import('expo-print');
   const Sharing=await import('expo-sharing');
   const result=await Print.printToFileAsync({html,base64:false});
   if(await Sharing.isAvailableAsync()){
    await Sharing.shareAsync(result.uri,{mimeType:'application/pdf',UTI:'com.adobe.pdf',dialogTitle:'Save or Share NTABL Scorebook PDF'});
   }else{
    setPostgameError('PDF created at '+result.uri+'. Sharing is not available on this device.');
   }
  }catch(err:any){setPostgameError('Unable to generate PDF: '+(err?.message||String(err))+'. Make sure expo-print and expo-sharing are installed with npx expo install expo-print expo-sharing, then restart Expo with --clear.');}

 }
 function openPostgame(){const d=docRef.current;if(!d)return;const p=(d as any).pitchingDecisions||{};setPostgameWin(p.win&&p.win!==p.loss?p.win:'');setPostgameLoss(p.loss&&p.loss!==p.win?p.loss:'');const winningTeamId=replayV2(d).awayRuns>replayV2(d).homeRuns?d.awayTeamId:d.homeTeamId;
  const winningTeam=winningTeamId===d.awayTeamId?d.away:d.home;
  const eligible=[...new Set(winningTeam.slots.flatMap(slot=>slot.appearances).filter(a=>a.position?.toUpperCase()==='P').map(a=>a.player.id))];
  setPostgameSave(eligible.length>1&&p.save&&p.save!==p.win&&p.save!==p.loss&&eligible.includes(p.save)?p.save:'');setPostgameError('');setPostgameOpen(true);}
 function applyMassNames(){
  const count=Math.max(1,Math.min(60,parseInt(massAddCount,10)||12));
  const prefix=massAddPrefix.trim()||'Player';
  setLineupDraft(old=>Array.from({length:Math.max(old.length,count)},(_,i)=>{
   const row=old[i]||{number:'',name:'',position:''};
   return i<count&&!row.name.trim()?{...row,name:`${prefix} ${i+1}`}:row;
  }));
  setMassAddOpen(false);
 }
 function updateLineupDraft(index:number,key:'number'|'name'|'position',value:string){
  setLineupDraft(old=>old.map((row,i)=>i===index?{...row,[key]:value}:row));
 }
 function openSubstitution(which:'away'|'home'){
  const d=docRef.current;if(!d)return;
  const team=which==='away'?d.away:d.home;
  const first=team.slots.find(slot=>slot.appearances.some(a=>a.exitedAtEvent===undefined));
  setSubTeam(which);setSubSlot(first?.slot||1);setSubPlayerId('');setSubPosition('');setSubstitutionOpen(true);
 }
 async function saveSubstitution(){
  const d=docRef.current;if(!d||d.status!=='inProgress')return;
  const team=subTeam==='away'?d.away:d.home;
  const slot=team.slots.find(x=>x.slot===subSlot);
  const active=slot?.appearances.find(a=>a.exitedAtEvent===undefined);
  const incoming=team.bench.find(p=>p.id===subPlayerId);
  if(!slot||!active||!incoming){Alert.alert('Choose a substitute','Select a batting slot and a bench player.');return;}
  const position=(subPosition.trim()||active.position).toUpperCase();
  const valid=['P','C','1B','2B','3B','SS','LF','CF','RF','DH','EH','EP',''].includes(position);
  if(!valid){Alert.alert('Position','Use P, C, 1B, 2B, 3B, SS, LF, CF, RF, DH, EH, or EP.');return;}
  // An active player cannot simultaneously occupy the incoming defensive position.
  const conflict=team.slots.some(s=>s.slot!==subSlot&&s.appearances.some(a=>a.exitedAtEvent===undefined&&a.position.toUpperCase()===position&&['P','C','1B','2B','3B','SS','LF','CF','RF'].includes(position)));
  if(conflict){Alert.alert('Position already occupied',`Another player is assigned to ${position}. Update that assignment before making this substitution.`);return;}
  const sequence=d.events.length+1;
  const change:any={kind:'lineupChange',id:id(),sequence,at:new Date().toISOString(),teamId:team.teamId,slot:subSlot,player:incoming,action:'substitution',position};
  const revised={...team,slots:team.slots.map(s=>s.slot===subSlot?{...s,appearances:[...s.appearances.map(a=>a.exitedAtEvent===undefined?{...a,exitedAtEvent:sequence}:a),{entryId:change.id,player:{...incoming,position},enteredAtEvent:sequence,position,reason:'substitution' as const}]}:s),bench:[...team.bench.filter(p=>p.id!==incoming.id),active.player]};
  const next={...d,events:[...d.events,change],home:subTeam==='home'?revised:d.home,away:subTeam==='away'?revised:d.away,editHistory:[...(d.editHistory||[]),{at:change.at,description:`${team.teamName}: ${incoming.name} replaces ${active.player.name} in batting slot ${subSlot} (${position||'no field position'})`}]};
  if(await commit(next as ScorebookV2Document)){setSubstitutionOpen(false);setSubPlayerId('');}
 }
 const fieldPositions=['P','C','1B','2B','3B','SS','LF','CF','RF'];
 const editPositions=[...fieldPositions,'DH','EH','--'];
 function openPlayerEdit(which:'away'|'home',slotNumber:number,entryId?:string){
  const d=docRef.current;if(!d)return;
  const team=which==='away'?d.away:d.home;
  const slot=team.slots.find(x=>x.slot===slotNumber);
  const active=slot?.appearances.find(a=>a.exitedAtEvent===undefined)||slot?.appearances[slot.appearances.length-1];
  if(!active)return;
  setPlayerEdit({team:which,slot:slotNumber,entryId:active.entryId,name:active.player.name,number:active.player.jerseyNumber||'',position:active.position||'--',courtesyRunner:!!active.player.courtesyRunner});
  setPlayerEditMode('edit');setReplacementId('');setPlayerEditError('');setPositionConflict(null);
 }
 async function savePlayerEdit(clearConflict=false){
  const d=docRef.current,edit=playerEdit;if(!d||!edit)return;
  const team=edit.team==='away'?d.away:d.home;
  const slot=team.slots.find(x=>x.slot===edit.slot);
  const active=slot?.appearances.find(a=>a.exitedAtEvent===undefined);
  if(!slot||!active){setPlayerEditError('Player is no longer active in this batting slot.');return;}
  const position=(edit.position.trim().toUpperCase()||'--');
  if(!editPositions.includes(position)){setPlayerEditError('Select a valid defensive position.');return;}
  const replacing=playerEditMode==='replace';
  const incoming=replacing?team.bench.find(p=>p.id===replacementId):active.player;
  if(!incoming){setPlayerEditError('Select an incoming bench player.');return;}
  if(!replacing&&!edit.name.trim()){setPlayerEditError('Player name is required.');return;}
  const conflict=fieldPositions.includes(position)?team.slots.flatMap(s=>s.appearances.filter(a=>a.exitedAtEvent===undefined).map(a=>({slot:s.slot,a}))).find(x=>x.slot!==edit.slot&&x.a.position.toUpperCase()===position):undefined;
  if(conflict&&!clearConflict){setPositionConflict({name:conflict.a.player.name,position});return;}
  const changedPosition=position!==active.position.toUpperCase();
  const changedCourtesy=!replacing&&edit.courtesyRunner!==!!active.player.courtesyRunner;
  const sequence=d.events.length+1;
  const at=new Date().toISOString();
  const change:any={kind:'lineupChange',id:id(),sequence,at,teamId:team.teamId,slot:edit.slot,player:incoming,action:replacing?'substitution':'positionChange',position,previousPosition:active.position,previousPlayerId:active.player.id};
  const newSlots=team.slots.map(s=>{
   if(conflict&&clearConflict&&s.slot===conflict.slot){return {...s,appearances:s.appearances.map(a=>a.entryId===conflict.a.entryId?{...a,position:'--',player:{...a.player,position:'--'}}:a)};}
   if(s.slot!==edit.slot)return s;
   if(replacing){return {...s,appearances:[...s.appearances.map(a=>a.entryId===active.entryId?{...a,exitedAtEvent:sequence}:a),{entryId:change.id,player:{...incoming,position},enteredAtEvent:sequence,position,reason:'substitution' as const}]};}
   // Position-only change keeps the batter's identity and batting appearance intact.
   return {...s,appearances:s.appearances.map(a=>a.entryId===active.entryId?{...a,position,player:{...a.player,name:edit.name.trim(),jerseyNumber:edit.number.trim(),position,courtesyRunner:edit.courtesyRunner}}:a)};
  });
  const newTeam={...team,slots:newSlots,bench:replacing?[...team.bench.filter(p=>p.id!==incoming.id),{...active.player,position:'--'}]:team.bench,benchDefenderIds:replacing?((team as any).benchDefenderIds||[]).filter((pid:string)=>pid!==incoming.id):(team as any).benchDefenderIds};
  const recordEvent=replacing||changedPosition||!!conflict; // CR flag changes are metadata, not scoring plays.
  const next={...d,home:edit.team==='home'?newTeam:d.home,away:edit.team==='away'?newTeam:d.away,events:recordEvent?[...d.events,change]:d.events,editHistory:[...(d.editHistory||[]),{at,description:replacing?`${incoming.name} replaces ${active.player.name} in batting slot ${edit.slot}`:`${edit.name}: ${active.position||'--'} → ${position}${conflict?' (previous defender moved to --)':''}${changedCourtesy?` · CR ${edit.courtesyRunner?'enabled':'disabled'}`:''}`} ]};
  if(await commit(next as ScorebookV2Document)){setPlayerEdit(null);setPositionConflict(null);setPlayerEditError('');}
 }
 function openBench(which:'away'|'home',allowBatting=false,returnToEdit=false){
  setBenchAllowBatting(allowBatting);setBenchReturnToEdit(returnToEdit);
  setSubTeam(which);setBenchPlayerId('');setBenchPosition('--');setBenchError('');setBenchConflict(null);setBenchOpen(true);
 }
 async function saveBenchPlayer(action:'defense'|'bottom',resolve=false){
  const d=docRef.current;if(!d)return;
  const team=subTeam==='away'?d.away:d.home;
  const original=team.bench.find(p=>p.id===benchPlayerId);
  const player=original?{...original,name:benchName.trim(),jerseyNumber:benchNumber.trim()}:undefined;
  if(!benchName.trim()){setBenchError('Player name is required.');return;}
  if(!player){setBenchError('Select a bench player.');return;}
  const position=(action==='bottom'?'--':(benchPosition||'--')).toUpperCase();
  const sequence=d.events.length+1,at=new Date().toISOString();
  const conflicts=fieldPositions.includes(position)?[
   ...team.slots.flatMap(s=>s.appearances.filter(a=>a.exitedAtEvent===undefined&&a.position===position).map(a=>({name:a.player.name,id:a.player.id}))),
   ...team.bench.filter(p=>p.id!==player.id&&((team as any).benchDefenderIds||[]).includes(p.id)&&p.position===position).map(p=>({name:p.name,id:p.id}))
  ]:[];
  if(conflicts.length&&!resolve){setBenchPendingAction(action);setBenchConflict({name:conflicts[0].name,position});return;}
  const slots=team.slots.map(s=>({...s,appearances:s.appearances.map(a=>resolve&&a.exitedAtEvent===undefined&&a.position===position?{...a,position:'--',player:{...a.player,position:'--'}}:a)}));
  const bench=team.bench.map(p=>resolve&&p.id!==player.id&&p.position===position?{...p,position:'--'}:p);
  const change:any={kind:'lineupChange',id:id(),sequence,at,teamId:team.teamId,slot:action==='bottom'?Math.max(0,...slots.map(s=>s.slot))+1:0,player:{...player,position},action:action==='bottom'?'substitution':'positionChange',position,previousPosition:player.position||'--'};
  const defenderIds=(team as any).benchDefenderIds||[];
  const keptDefenders=defenderIds.filter((pid:string)=>pid!==player.id&&!(resolve&&team.bench.some(p=>p.id===pid&&p.position===position)));
  const newTeam=action==='bottom'?{...team,slots:[...slots,{slot:change.slot,appearances:[{entryId:change.id,player:{...player,position},enteredAtEvent:sequence,position,reason:'substitution' as const}]}],bench:bench.filter(p=>p.id!==player.id),benchDefenderIds:keptDefenders}:{...team,slots,bench:bench.map(p=>p.id===player.id?{...p,position}:p),benchDefenderIds:fieldPositions.includes(position)?[...keptDefenders,player.id]:keptDefenders};
  const next={...d,home:subTeam==='home'?newTeam:d.home,away:subTeam==='away'?newTeam:d.away,events:[...d.events,change],editHistory:[...(d.editHistory||[]),{at,description:action==='bottom'?`${player.name} added to bottom of batting order during inning ${replayV2(d).inning}`:`${player.name} assigned ${position} on defense (remains outside batting order)`}]};
  if(await commit(next as ScorebookV2Document)){setBenchOpen(false);setBenchPlayerId('');setBenchConflict(null);setBenchError('');setBenchReturnToEdit(false);if(action==='bottom'){setSide(subTeam);setInning(replayV2(next as ScorebookV2Document).inning);}}
 }
 function openScorebookLineupEditor(which:'away'|'home'){
  const d=docRef.current;if(!d)return;
  const team=which==='away'?d.away:d.home;
  setLineupEditorTeam(which);
  setLineupDraft(Array.from({length:Math.max(20,...team.slots.map(s=>s.slot),0)},(_,i)=>{
   const entry=team.slots.find(s=>s.slot===i+1)?.appearances.slice(-1)[0];
   return {number:entry?.player.jerseyNumber||'',name:entry?.player.name||'',position:entry?.position||entry?.player.position||''};
  }));
  setLineupEditorOpen(true);
 }
 async function saveLineupEdits(confirmed=false){
  const d=docRef.current;if(!d)return;
  const team=lineupEditorTeam==='away'?d.away:d.home;
  // Placeholder identities can be filled in at any time. Only warn when changing
  // an established player's name after scoring has begun.
  const changesEstablishedIdentity=lineupDraft.some((row,i)=>{
   const previous=team.slots.find(s=>s.slot===i+1)?.appearances.slice(-1)[0]?.player;
   if(!previous||!row.name.trim()||row.name.trim()===previous.name)return false;
   const name=previous.name.trim();
   const generic=/^(player|opponent|unknown|visitor|batter|generic|tbd)([\\s#-]*\\d+)?$/i.test(name);
   return !generic;
  });
  if(!confirmed&&d.status==='inProgress'&&d.events.length>0&&changesEstablishedIdentity){
   setLineupCorrectionConfirm(true);return;
  }
  const original=lineupEditorTeam==='away'?d.away:d.home;
  const slots=[...original.slots];
  for(let i=0;i<lineupDraft.length;i++){
   const row=lineupDraft[i],existing=slots.find(s=>s.slot===i+1);
   if(!row.name.trim())continue;
   if(existing?.appearances.length){
    const previous=existing.appearances[existing.appearances.length-1];
    const revised={...previous,position:row.position.trim(),player:{...previous.player,name:row.name.trim(),jerseyNumber:row.number.trim(),position:row.position.trim()}};
    const idx=slots.indexOf(existing);
    slots[idx]={...existing,appearances:[...existing.appearances.slice(0,-1),revised]};
   }else{
    const pid=`manual-${id()}`;
    slots.push({slot:i+1,appearances:[{entryId:`starter:${pid}`,player:{id:pid,name:row.name.trim(),jerseyNumber:row.number.trim(),position:row.position.trim(),manual:true},enteredAtEvent:d.events.length,position:row.position.trim(),reason:'starter' as const}]});
   }
  }
  slots.sort((a,b)=>a.slot-b.slot);
  const updated={...original,slots};
  if(await commit({...d,away:lineupEditorTeam==='away'?updated:d.away,home:lineupEditorTeam==='home'?updated:d.home})){setLineupCorrectionConfirm(false);setLineupEditorOpen(false);}
 }
 async function addOpponent(){const d=docRef.current;if(!d||!newOpponent.trim())return;const lineup=d.home.teamId===opponentTeamId?d.home:d.away,slot=Math.max(0,...lineup.slots.map(s=>s.slot))+1,pid=`manual-${id()}`;
  const next={...lineup,slots:[...lineup.slots,{slot,appearances:[{entryId:`starter:${pid}`,player:{id:pid,name:newOpponent.trim(),jerseyNumber:'',position:''},enteredAtEvent:0,position:'',reason:'starter' as const}]}]};
  if(await commit({...d,home:d.home.teamId===opponentTeamId?next:d.home,away:d.away.teamId===opponentTeamId?next:d.away}))setNewOpponent('');
 }
 useEffect(()=>{
  if(!doc||!sideChangePending)return;
  const state=replayV2(doc);
  const batting=state.half==='top'?doc.away:doc.home;
  if((side==='away'?doc.away:doc.home).teamId!==batting.teamId)return;
  const slot=state.nextSlot[batting.teamId]||1;
  // The lineup begins beneath the compact scoreboard and team tabs.
  // Scroll the next hitter into the upper visible portion of the page
  // before the three-second scoring window opens.
  const y=Math.max(0,slot*110-160);
  const frame=requestAnimationFrame(()=>lineupScrollRef.current?.scrollTo({y,animated:true}));
  return ()=>cancelAnimationFrame(frame);
 },[sideChangePending,side,doc?.events.length,doc?.gameId]);
 useEffect(()=>{
  if(!doc||!phoneScorebook)return;
  const state=replayV2(doc);
  const battingTeam=state.half==='top'?doc.away:doc.home;
  if((side==='away'?doc.away:doc.home).teamId!==battingTeam.teamId)return;
  const slot=state.nextSlot[battingTeam.teamId]||1;
  const paEvents=doc.events.filter(e=>e.kind==='plateAppearance');
  const counts=new Map<number,number>();
  const appearances=new Map<string,number>();
  for(const e of paEvents){
   const key=`${e.battingTeamId}:${e.inning}:${e.half}:${e.battingSlot}`;
   const n=appearances.get(key)||0;appearances.set(key,n+1);
   counts.set(e.inning,Math.max(counts.get(e.inning)||1,n+1));
  }
  const key=`${battingTeam.teamId}:${state.inning}:${state.half}:${slot}`;
  const repeat=appearances.get(key)||0;
  counts.set(state.inning,Math.max(counts.get(state.inning)||1,repeat+1));
  let index=repeat;
  for(let i=1;i<state.inning;i++)index+=counts.get(i)||1;
  const scrollKey=`${battingTeam.teamId}:${state.inning}:${state.half}:${slot}:${repeat}:${side}`;
  if(lastScrollTargetRef.current===scrollKey)return;
  lastScrollTargetRef.current=scrollKey;
  scrollTargetRef.current=index*110;
  const frame=requestAnimationFrame(()=>inningScrollRef.current?.scrollTo({x:scrollTargetRef.current,animated:true}));
  return ()=>cancelAnimationFrame(frame);
 },[doc,side,phoneScorebook]);
 if(loading)return <View style={styles.center}><ActivityIndicator/><Text>Loading scorebook...</Text></View>;
 if(!doc)return <View style={styles.center}><Text>{message||'No scorebook loaded.'}</Text><Pressable onPress={()=>router.back()} style={styles.button}><Text style={styles.white}>Back</Text></Pressable></View>;
 const live=replayV2(doc),liveTeam=live.half==='top'?doc.away:doc.home,liveSlot=live.nextSlot[liveTeam.teamId]||1,current=activePlayer(liveTeam,liveSlot),shown=side==='away'?doc.away:doc.home;
 const pa=doc.events.filter((e):e is Extract<ScorebookV2Event,{kind:'plateAppearance'}>=>e.kind==='plateAppearance');
 // Record cumulative outs at the time of each completed plate appearance.
 const outAtPlay=new Map<string,number>();
 const countAtPlay=new Map<string,{balls:number;strikes:number}>();
 let trackedBalls=0,trackedStrikes=0;
 let trackedInning=1;
 let trackedHalf:'top'|'bottom'='top';
 let trackedOuts=0;
 for(const event of doc.events){
  if(event.kind==='pitch'){
   if(event.pitch==='ball')trackedBalls=Math.min(4,trackedBalls+1);
   if(event.pitch==='calledStrike'||event.pitch==='swingingStrike'||event.pitch==='foulBunt')trackedStrikes=Math.min(3,trackedStrikes+1);
   if(event.pitch==='foul'&&trackedStrikes<2)trackedStrikes++;
   continue;
  }
  if(event.kind!=='plateAppearance'&&event.kind!=='runner')continue;
  if(event.inning!==trackedInning||event.half!==trackedHalf){trackedInning=event.inning;trackedHalf=event.half;trackedOuts=0;}
  trackedOuts=Math.min(3,trackedOuts+(event.outsOnPlay||0));
  if(event.kind==='plateAppearance'){
   outAtPlay.set(event.id,trackedOuts);
   countAtPlay.set(event.id,{balls:trackedBalls,strikes:trackedStrikes});
   trackedBalls=0;trackedStrikes=0;
  }
 }

 const inningEndMarkers=new Set<string>();
 const subMarkers=new Set<string>();
 let lastHalfKey='',outsInHalf=0;
 for(const e of doc.events){
  if(e.kind!=='plateAppearance'&&e.kind!=='runner')continue;
  const key=`${e.battingTeamId}:${e.inning}:${e.half}`;
  if(key!==lastHalfKey){lastHalfKey=key;outsInHalf=0;}
  const old=outsInHalf;outsInHalf=Math.min(3,outsInHalf+(e.outsOnPlay||0));
  if(old<3&&outsInHalf===3){
   const finalPa=e.kind==='plateAppearance'?e:pa.filter(p=>p.battingTeamId===e.battingTeamId&&p.inning===e.inning&&p.half===e.half&&p.sequence<=e.sequence).slice(-1)[0];
   if(finalPa)inningEndMarkers.add(finalPa.id);
  }
 }
 for(const team of [doc.away,doc.home])for(const slot of team.slots)for(const entry of slot.appearances.slice(1)){
  if(entry.enteredAtEvent>0){
   const event=doc.events[Math.max(0,entry.enteredAtEvent-1)];
   if(event){const previous=pa.filter(p=>p.battingTeamId===team.teamId&&p.battingSlot===slot.slot&&p.sequence<entry.enteredAtEvent).slice(-1)[0];subMarkers.add(`${team.teamId}:${slot.slot}:${previous?.inning||Math.max(1,event.inning)}`);}
  }
 }
 // Each repeat of a batting-order slot within one half-inning receives a continuation column.
 // Store the column on the plate appearance ID so the same inning never overwrites an earlier trip.
 const paColumn=new Map<string,number>();
 const halfSlotCounts=new Map<string,number>();
 const continuationCounts=new Map<number,number>();
 for(const e of pa){
  const key=`${e.battingTeamId}:${e.inning}:${e.half}:${e.battingSlot}`;
  const occurrence=halfSlotCounts.get(key)||0;
  paColumn.set(e.id,occurrence);
  halfSlotCounts.set(key,occurrence+1);
  continuationCounts.set(e.inning,Math.max(continuationCounts.get(e.inning)||1,occurrence+1));
 }
 // Reserve the continuation column as soon as the batting order wraps,
 // before the first batter's second plate appearance has been recorded.
 // Otherwise the active yellow square cannot appear until AFTER that at-bat.
 if(doc.status==='inProgress' && liveSlot>0){
  const liveKey=`${liveTeam.teamId}:${live.inning}:${live.half}:${liveSlot}`;
  const activeOccurrence=halfSlotCounts.get(liveKey)||0;
  continuationCounts.set(live.inning,Math.max(continuationCounts.get(live.inning)||1,activeOccurrence+1));
 }
 const inningColumns=Array.from({length:Math.max(7,live.inning,...Array.from(continuationCounts.keys()))},(_,j)=>j+1).flatMap(n=>Array.from({length:continuationCounts.get(n)||1},(_,repeat)=>({inning:n,repeat})));
 const paBySequence=[...pa].sort((a,b)=>a.sequence-b.sequence);
 const eventColumn=(e:ScorebookV2Event)=>{
  if(e.kind==='lineupChange')return 0;
  if(e.kind==='plateAppearance')return paColumn.get(e.id)||0;
  const earlier=paBySequence.filter(p=>p.battingTeamId===e.battingTeamId&&p.inning===e.inning&&p.half===e.half&&p.sequence<=e.sequence).slice(-1)[0];
  return earlier?paColumn.get(earlier.id)||0:0;
 };
 const chosen=pa.find(x=>x.id===selectedId),displayPlayer=chosen?.playerId||current?.player.id;
 const own=doc.home.teamId===teamId?doc.home:doc.away;
 const pitchEvents=doc.events.filter(e=>e.kind==='pitch');
 const hitCount=(team:string)=>pa.filter(e=>e.battingTeamId===team&&['1B','2B','3B','HR'].includes(e.result)).length;
 const errorCount=(team:string)=>doc.events.filter((e:any)=>e.battingTeamId!==team&&(e.kind==='plateAppearance'||e.kind==='runner')).reduce((total:number,e:any)=>total+(e.result==='ROE'?1:0)+(e.kind==='runner'&&e.action==='E'?1:0)+(e.runnerDetails||[]).filter((r:any)=>r.reason==='error'&&r.errorPosition&&!(e.result==='ROE'&&r.errorPosition===e.errorPosition)).length,0);
 const baseRunners=live.bases.flatMap((pid,i)=>pid?[{base:i+1,name:[...doc.home.slots,...doc.away.slots].flatMap(x=>x.appearances).find(x=>x.player.id===pid)?.player.name||'Runner',playerId:pid}]:[]);
 const runnerTeamId=runnerBase!==null&&live.bases[runnerBase-1]?(live.half==='top'?doc.away.teamId:doc.home.teamId):null;
 const recentOutIds=doc.events.filter((e:any)=>e.battingTeamId===runnerTeamId&&e.outsOnPlay>0).flatMap((e:any)=>{
  const outs=(e.runners||[]).filter((r:any)=>r.isOut).map((r:any)=>r.playerId);
  return outs.length?outs:e.kind==='plateAppearance'?[e.playerId]:[];
 }).slice(-2).reverse();
 const runnerTeam=runnerTeamId===doc.home.teamId?doc.home:doc.away;
 const recentOutNames=recentOutIds.map(pid=>[...runnerTeam.slots.flatMap(slot=>slot.appearances).map(a=>a.player),...runnerTeam.bench].find(a=>a.id===pid)?.name||'Unknown');
 const active=doc.status==='inProgress';
 return <View style={styles.screen}><Stack.Screen options={{headerShown:false}}/>
  <View style={styles.header}><Pressable onPress={()=>router.back()} style={styles.back}><Ionicons name="arrow-back" size={22} color="#fff"/></Pressable><Pressable onPress={()=>setGameSummaryOpen(true)} style={{flex:1}} accessibilityLabel="Open full game summary"><Text style={styles.title}>NTABL Scorebook</Text><Text style={styles.sub}>{doc.away.teamName} @ {doc.home.teamName}  ⓘ</Text></Pressable></View>
  <View style={{flex:1}}><ScrollView ref={lineupScrollRef} contentContainerStyle={{padding:8,paddingBottom:20}}>
   {/* Compact, high-contrast live game board inspired by the Announcer screen. */}
   <View style={{backgroundColor:'#0f172a',borderRadius:15,borderWidth:2,borderColor:'#334155',paddingVertical:12,paddingHorizontal:10,marginBottom:5}}>
    <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:6}}>
     <View style={{flex:1,alignItems:'center',minWidth:0}}>
      <Text numberOfLines={2} style={{color:'#cbd5e1',fontWeight:'800',fontSize:12,textAlign:'center'}}>VISITOR</Text>
      <Text numberOfLines={2} style={{color:'#ffffff',fontWeight:'900',fontSize:15,textAlign:'center',marginTop:3}}>{doc.away.teamName}</Text>
      <Text style={{color:'#ffffff',fontWeight:'900',fontSize:36,lineHeight:43}}>{live.awayRuns}</Text>
     </View>
     <View style={{alignItems:'center',justifyContent:'center',paddingHorizontal:5,minWidth:95}}>
      <Text style={{color:'#facc15',fontWeight:'900',fontSize:17,textAlign:'center'}}>{doc.status==='final'?'FINAL':`${live.half==='top'?'▲ TOP':'▼ BOTTOM'} ${live.inning}`}</Text>
      <Text style={{color:'#e2e8f0',fontWeight:'900',fontSize:15,marginTop:5}}>OUTS  {live.outs} / 3</Text>
      <Text style={{color:'#facc15',fontWeight:'900',fontSize:17,marginTop:4}}>{'●'.repeat(Math.min(3,Math.max(0,live.outs)))}{'○'.repeat(3-Math.min(3,Math.max(0,live.outs)))}</Text>
     </View>
     <View style={{flex:1,alignItems:'center',minWidth:0}}>
      <Text style={{color:'#cbd5e1',fontWeight:'800',fontSize:12,textAlign:'center'}}>HOME</Text>
      <Text numberOfLines={2} style={{color:'#ffffff',fontWeight:'900',fontSize:15,textAlign:'center',marginTop:3}}>{doc.home.teamName}</Text>
      <Text style={{color:'#ffffff',fontWeight:'900',fontSize:36,lineHeight:43}}>{live.homeRuns}</Text>
     </View>
    </View>
    <View style={{height:1,backgroundColor:'#475569',marginVertical:8}}/>
    <View style={{flexDirection:'row',justifyContent:'space-around',flexWrap:'wrap',gap:8}}>
     <Text style={{color:'#f8fafc',fontWeight:'900',fontSize:15}}>COUNT  {live.balls}–{live.strikes}</Text>
     <Text style={{color:'#f8fafc',fontWeight:'900',fontSize:15}}>PITCHES  {live.pitchCount}</Text>
    </View>
   </View>
   <View style={{flexDirection:'row',gap:4,marginVertical:8}}>{(['away','home'] as const).map(x=><Pressable key={x} onPress={()=>setSide(x)} style={{flex:1,backgroundColor:side===x?INK:'#d7edf8',padding:9,alignItems:'center'}}><Text style={{color:side===x?'white':INK,fontWeight:'800',fontSize:12}}>{x==='away'?doc.away.teamName:doc.home.teamName}</Text></Pressable>)}</View>
   {<>
   {sideChangePending?<Text style={{fontWeight:'900',color:'#0e7490',textAlign:'center',padding:9}}>Next half-inning — opening the next batter in 3 seconds…</Text>:null}
   <Text style={{fontWeight:'900',color:INK,marginVertical:8}}>Scroll Horizontally to View All Innings</Text>
   <View style={{position:'relative'}}><ScrollView ref={inningScrollRef} horizontal showsHorizontalScrollIndicator={true} onContentSizeChange={()=>{if(phoneScorebook)inningScrollRef.current?.scrollTo({x:scrollTargetRef.current,animated:false});}}><View style={{borderTopWidth:1,borderLeftWidth:1,borderColor:RULE,backgroundColor:'white'}}>
    <View style={{flexDirection:'row',backgroundColor:INK,height:26,alignItems:'center'}}>{[['#',26],['UNI #',40],['PLAYER NAME',142],['POS',39],...inningColumns.map(col=>['INNING '+col.inning,110])].map(([label,width],headerIndex)=><View key={headerIndex} style={{width:Number(width),alignItems:'center'}}><Text style={{fontSize:10,fontWeight:'900',color:'white'}}>{label}</Text></View>)}</View>
    {Array.from({length:Math.max(20,shown.slots.length)},(_,i)=>{const slot=shown.slots[i];const entries=slot?.appearances||[];const row=entries[0];const matching=entries.flatMap(entry=>pa.filter(e=>e.battingTeamId===shown.teamId&&e.playerId===entry.player.id&&e.inning===inning&&e.half===(side==='away'?'top':'bottom')));
     const isCurrent=!!slot&&shown.teamId===liveTeam.teamId&&slot.slot===liveSlot&&inning===live.inning;
     return <View key={i} style={{flexDirection:'row',height:110,backgroundColor:entries.some(e=>(e.player as any).courtesyRunner)?'#fee9e9':i%2===0?'#e7f5fc':'#d7eef9',borderBottomWidth:1,borderBottomColor:RULE}}>
      <View style={{width:26,backgroundColor:'white',alignItems:'center',justifyContent:'flex-start',paddingTop:5}}><Text style={{color:INK,fontWeight:'900',fontSize:12}}>{i+1}</Text></View>
      <View style={{width:40,borderRightWidth:1,borderColor:RULE}}>{[0,1,2].map(j=><View key={j} style={{backgroundColor:entries[j]&&(entries[j].player as any).courtesyRunner?'#fee9e9':j===0?'white':(i%2===0?'#e7f5fc':'#d7eef9'),height:36.5,borderBottomWidth:j<2?1:0,borderColor:RULE,justifyContent:'center',paddingHorizontal:3}}><Text style={{fontSize:13,color:INK,fontWeight:'800',textAlign:'center'}}>{entries[j]?.player.jerseyNumber||''}</Text></View>)}</View>
      <View style={{width:142,borderRightWidth:1,borderColor:RULE}}>{[0,1,2].map(j=><View key={j} style={{backgroundColor:entries[j]&&(entries[j].player as any).courtesyRunner?'#fee9e9':j===0?'white':(i%2===0?'#e7f5fc':'#d7eef9'),height:36.5,borderBottomWidth:j<2?1:0,borderColor:RULE,justifyContent:'center',paddingHorizontal:4}}><Pressable disabled={!entries[j]} onPress={()=>openPlayerEdit(side,i+1,entries[j]?.entryId)} style={{flex:1,justifyContent:"center"}}><Text numberOfLines={1} style={{fontSize:13,color:INK,fontWeight:"800",textDecorationLine:entries[j]?"underline":"none"}}>{entries[j]?.player.name||""}</Text></Pressable></View>)}</View>
      <View style={{width:39,borderRightWidth:1,borderColor:RULE}}>{[0,1,2].map(j=><View key={j} style={{backgroundColor:entries[j]&&(entries[j].player as any).courtesyRunner?'#fee9e9':j===0?'white':(i%2===0?'#e7f5fc':'#d7eef9'),height:36.5,borderBottomWidth:j<2?1:0,borderColor:RULE,justifyContent:'center',alignItems:'center'}}><Text style={{fontSize:12,color:INK,fontWeight:'800'}}>{entries[j]?.position||''}</Text></View>)}</View>
      {inningColumns.map(({inning:colInning,repeat:colRepeat},j)=>{
       const colMatching=entries.flatMap(entry=>pa.filter(e=>e.battingTeamId===shown.teamId&&e.playerId===entry.player.id&&e.inning===colInning&&e.half===(side==='away'?'top':'bottom')&&(paColumn.get(e.id)||0)===colRepeat));
       const currentSlotKey=`${shown.teamId}:${colInning}:${side==='away'?'top':'bottom'}:${slot?.slot||0}`;
       const lastRecorded=pa[pa.length-1];
       const colFinal=doc.status==='final'&&!!lastRecorded&&colMatching.some(e=>e.id===lastRecorded.id);
       const colCurrent=doc.status!=='final'&&!!slot&&shown.teamId===liveTeam.teamId&&slot.slot===liveSlot&&colInning===live.inning&&(halfSlotCounts.get(currentSlotKey)||0)===colRepeat;
       const colLast=colMatching[colMatching.length-1];
       const inningEnd=colMatching.some(e=>inningEndMarkers.has(e.id));
       const subBoundary=!!slot&&subMarkers.has(`${shown.teamId}:${slot.slot}:${colInning}`)&&colRepeat===0;
       return <View key={`${colInning}-${colRepeat}`} style={{width:110,borderRightWidth:subBoundary?4:1,borderRightColor:subBoundary?INK:RULE,position:'relative'}}><ScoreSquare plays={colMatching} allEvents={doc.events} outsCount={colLast?outAtPlay.get(colLast.id)||0:0} active={colCurrent||colFinal} finalized={colFinal} balls={colCurrent?live.balls:colLast?countAtPlay.get(colLast.id)?.balls||0:0} strikes={colCurrent?live.strikes:colLast?countAtPlay.get(colLast.id)?.strikes||0:0} previewResult={colCurrent&&previewResult?(previewResult==='SAC'&&trajectory==='fly'?'SF':previewResult):undefined} onPress={()=>{if(!slot)return;setInning(colInning);setSelectedEntry(row?.entryId||'');setSelectedId(colCurrent?null:colMatching[0]?.id||null);setMenu(null);setPreviewResult(null);if(doc.status==='draft'){setScoreOpen(false);setStartHelpOpen(true);}else setScoreOpen(true);}}/>{inningEnd?<View pointerEvents="none" style={{position:'absolute',bottom:0,left:0,right:0,height:6,backgroundColor:'#111827',zIndex:5}}/>:null}{subBoundary?<View pointerEvents="none" style={{position:'absolute',right:0,top:0,bottom:0,width:5,backgroundColor:'#111827',zIndex:5}}/>:null}</View>;
      })}
     </View>;
    })}
    <View style={{height:30,backgroundColor:'#d7eef9',flexDirection:'row',alignItems:'center'}}><Text style={{width:247,color:INK,fontWeight:'900',textAlign:'right',paddingRight:6}}>RUNS PER INNING</Text>{inningColumns.map(({inning:colInning,repeat:colRepeat})=><Text key={`${colInning}-${colRepeat}`} style={{width:110,textAlign:'center',color:INK}}>{doc.events.filter(e=>e.kind!=='lineupChange'&&e.inning===colInning&&e.battingTeamId===shown.teamId&&eventColumn(e)===colRepeat).reduce((total,e)=>total+(e.runsOnPlay||0),0)}</Text>)}</View>
   </View></ScrollView>
   {phoneScorebook?<View style={{position:'absolute',left:0,top:0,width:247,backgroundColor:'white',borderLeftWidth:1,borderTopWidth:1,borderColor:RULE,elevation:4}}>
    <View style={{flexDirection:'row',backgroundColor:INK,height:26,alignItems:'center'}}>{([['#',26],['UNI #',40],['PLAYER NAME',142],['POS',39]] as const).map(([label,width])=><View key={label} style={{width,alignItems:'center'}}><Text style={{fontSize:10,fontWeight:'900',color:'white'}}>{label}</Text></View>)}</View>
    {Array.from({length:Math.max(20,shown.slots.length)},(_,i)=>{const slot=shown.slots[i];const entries=slot?.appearances||[];return <View key={i} style={{flexDirection:'row',height:110,backgroundColor:entries.some(e=>(e.player as any).courtesyRunner)?'#fee9e9':i%2===0?'#e7f5fc':'#d7eef9',borderBottomWidth:1,borderBottomColor:RULE}}>
      <View style={{width:26,backgroundColor:'white',alignItems:'center',justifyContent:'flex-start',paddingTop:5}}><Text style={{color:INK,fontWeight:'900',fontSize:12}}>{i+1}</Text></View>
      <View style={{width:40,borderRightWidth:1,borderColor:RULE}}>{[0,1,2].map(j=><View key={j} style={{backgroundColor:entries[j]&&(entries[j].player as any).courtesyRunner?'#fee9e9':j===0?'white':(i%2===0?'#e7f5fc':'#d7eef9'),height:36.5,borderBottomWidth:j<2?1:0,borderColor:RULE,justifyContent:'center',paddingHorizontal:3}}><Text style={{fontSize:13,color:INK,fontWeight:'800',textAlign:'center'}}>{entries[j]?.player.jerseyNumber||''}</Text></View>)}</View>
      <View style={{width:142,borderRightWidth:1,borderColor:RULE}}>{[0,1,2].map(j=><View key={j} style={{backgroundColor:entries[j]&&(entries[j].player as any).courtesyRunner?'#fee9e9':j===0?'white':(i%2===0?'#e7f5fc':'#d7eef9'),height:36.5,borderBottomWidth:j<2?1:0,borderColor:RULE,justifyContent:'center',paddingHorizontal:4}}><Pressable disabled={!entries[j]} onPress={()=>openPlayerEdit(side,i+1,entries[j]?.entryId)} style={{flex:1,justifyContent:"center"}}><Text numberOfLines={1} style={{fontSize:13,color:INK,fontWeight:"800",textDecorationLine:entries[j]?"underline":"none"}}>{entries[j]?.player.name||""}</Text></Pressable></View>)}</View>
      <View style={{width:39,borderRightWidth:1,borderColor:RULE}}>{[0,1,2].map(j=><View key={j} style={{backgroundColor:entries[j]&&(entries[j].player as any).courtesyRunner?'#fee9e9':j===0?'white':(i%2===0?'#e7f5fc':'#d7eef9'),height:36.5,borderBottomWidth:j<2?1:0,borderColor:RULE,justifyContent:'center',alignItems:'center'}}><Text style={{fontSize:12,color:INK,fontWeight:'800'}}>{entries[j]?.position||''}</Text></View>)}</View>
     </View>;})}
   </View>:null}</View>
   {shown.teamId===opponentTeamId&&!shown.slots.length?<View style={styles.paper}><Text style={styles.heading}>Opponent batting order</Text><TextInput placeholder="Player name" style={styles.input} value={newOpponent} onChangeText={setNewOpponent}/><Pressable style={styles.button} onPress={()=>void addOpponent()}><Text style={styles.white}>Add Batter</Text></Pressable></View>:null}
   <Pressable onPress={()=>openBench(side,false,false)} style={[styles.button,{marginTop:10,backgroundColor:'#334155',minHeight:50}]}><Text style={[styles.white,{fontSize:16}]}>Access Bench Players</Text></Pressable>
   <Pressable onPress={()=>openScorebookLineupEditor(side)} style={[styles.button,{marginTop:10,backgroundColor:'#075486'}]}><View style={{flexDirection:'row',gap:8,alignItems:'center'}}><Ionicons name="create-outline" size={19} color="white"/><Text style={styles.white}>Edit {side==='away'?'Visiting':'Home'} Lineup</Text></View></Pressable>
   <Text style={{fontSize:11,color:INK,marginTop:8}}>Tap a player's inning square to open the enlarged traditional scoring box. Existing plays open for review.</Text>
   </>}
   <Text style={styles.muted}>{message||'Saved locally on this device.'}</Text>
    
  </ScrollView>
  <View style={{backgroundColor:'#e1eff7',borderTopWidth:1,borderColor:RULE,paddingHorizontal:10,paddingTop:10,paddingBottom:Math.max(safeAreaInsets.bottom,44)+8}}>
   <View style={{flexDirection:'row',gap:8}}>
    <Pressable onPress={()=>setOptionsOpen(true)} style={[styles.button,{flex:1,backgroundColor:INK,minHeight:49,justifyContent:'center'}]}><Text style={styles.white}>☰ Options</Text></Pressable>
    <Pressable onPress={undo} disabled={!undoCount||!active} style={[styles.button,{flex:1,backgroundColor:active&&undoCount?'#a16207':'#94a3b8',minHeight:49,justifyContent:'center'}]}><Text style={styles.white}>↶ Undo</Text></Pressable>
    <Pressable onPress={redo} disabled={!redoCount} style={[styles.button,{flex:1,backgroundColor:redoCount?'#0e7490':'#94a3b8',minHeight:49,justifyContent:'center'}]}><Text style={styles.white}>↷ Redo</Text></Pressable>
   </View>
  </View>
  </View>
   <Modal visible={startHelpOpen&&doc.status==='draft'} transparent animationType="fade" onRequestClose={()=>setStartHelpOpen(false)}>
    <View style={{flex:1,backgroundColor:'#000a',justifyContent:'center',padding:22}}>
     <View style={{backgroundColor:'white',borderRadius:18,padding:20,gap:14,borderWidth:2,borderColor:INK}}>
      <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between'}}><Text style={{fontSize:21,fontWeight:'900',color:INK,flex:1}}>Ready to Score?</Text><Pressable accessibilityLabel="Close notice" onPress={()=>setStartHelpOpen(false)}><Ionicons name="close-circle" size={30} color={INK}/></Pressable></View>
      <Text style={{fontSize:17,lineHeight:25,color:INK}}>Select <Text style={{fontWeight:'900'}}>Options</Text> and choose <Text style={{fontWeight:'900',color:'#15803d'}}>Start Game</Text> to begin scoring.</Text>
      <Text style={{color:'#475569',fontSize:14}}>Until the game is started, the individual scoring controls are intentionally inactive.</Text>
      <Pressable onPress={()=>{setStartHelpOpen(false);setScoreOpen(false);setOptionsOpen(true);}} style={[styles.button,{backgroundColor:INK,minHeight:50}]}><Text style={[styles.white,{fontSize:16}]}>Open Options</Text></Pressable>
     </View>
    </View>
   </Modal>
   <Modal visible={adjustScoreOpen} transparent animationType="none" onRequestClose={()=>setAdjustScoreOpen(false)}><View style={{flex:1,backgroundColor:'#0009',justifyContent:'center',padding:18}}><View style={{backgroundColor:'white',borderRadius:14,padding:18,gap:12}}><Text style={styles.heading}>Adjust Official Score</Text><Text style={styles.muted}>Enter the total manual adjustment for each team, relative to runs recorded from plays. Player runs and RBIs will not change.</Text><Text style={styles.bold}>Visiting team adjustment (+/-)</Text><TextInput keyboardType="numbers-and-punctuation" value={adjustAway} onChangeText={setAdjustAway} style={styles.input}/><Text style={styles.bold}>Home team adjustment (+/-)</Text><TextInput keyboardType="numbers-and-punctuation" value={adjustHome} onChangeText={setAdjustHome} style={styles.input}/><Text style={styles.bold}>Reason (required)</Text><TextInput value={adjustReason} onChangeText={setAdjustReason} placeholder="Official scoring correction" style={styles.input}/><View style={{flexDirection:'row',gap:8}}><Pressable onPress={()=>setAdjustScoreOpen(false)} style={[styles.button,{flex:1,backgroundColor:'#64748b'}]}><Text style={styles.white}>Cancel</Text></Pressable><Pressable onPress={()=>void saveAdjustScore()} style={[styles.button,{flex:1,backgroundColor:'#15803d'}]}><Text style={styles.white}>Save Adjustment</Text></Pressable></View></View></View></Modal>
       <Modal visible={editPlayOpen} transparent animationType="none" onRequestClose={()=>setEditPlayOpen(false)}><View style={{flex:1,backgroundColor:'#0009',justifyContent:'center',padding:18}}><View style={{backgroundColor:'white',borderRadius:14,padding:18,gap:12}}><Text style={styles.heading}>Correct Saved Play</Text><Text style={styles.muted}>Correct a batter who safely reached first. This updates the official batting/pitching result while preserving all recorded pitches, runner movements, outs, and later plays.</Text><View style={{flexDirection:'row',flexWrap:'wrap',gap:8}}>{(['BB','IBB','HBP','1B','ROE','FC'] as PlateAppearanceResult[]).map(r=><Pressable key={r} onPress={()=>{setEditPlayResult(r);setEditPlayError('');}} style={[styles.chip,{width:'30%',backgroundColor:editPlayResult===r?'#bfdbfe':'#e2e8f0'}]}><Text style={[styles.bold,{textAlign:'center'}]}>{r==='ROE'?'Error':r==='FC'?'Fielder’s Choice':r==='BB'?'Walk':r==='IBB'?'Intentional Walk':r==='HBP'?'Hit by Pitch':'Single'}</Text></Pressable>)}</View><Text style={styles.muted}>Pitch history is not rewritten. For example, correcting BB to 1B removes the statistical walk but retains the pitches entered during that plate appearance.</Text>{editPlayError?<Text style={{color:'#b91c1c'}}>{editPlayError}</Text>:null}<View style={{flexDirection:'row',gap:8}}><Pressable onPress={()=>setEditPlayOpen(false)} style={[styles.button,{flex:1,backgroundColor:'#64748b'}]}><Text style={styles.white}>Cancel</Text></Pressable><Pressable onPress={()=>void saveEditedPlay()} style={[styles.button,{flex:1,backgroundColor:'#15803d'}]}><Text style={styles.white}>Save Correction</Text></Pressable></View></View></View></Modal>
   <Modal visible={optionsOpen&&!confirmAction&&!postgameOpen} transparent animationType="none" onRequestClose={()=>setOptionsOpen(false)}><View style={{flex:1,backgroundColor:'#0009',justifyContent:'center',padding:18}}><View style={{backgroundColor:'white',borderRadius:16,overflow:'hidden',maxHeight:'90%'}}><View style={{backgroundColor:INK,padding:16,flexDirection:'row',alignItems:'center',justifyContent:'space-between'}}><Text style={{color:'white',fontWeight:'900',fontSize:19,flex:1}}>Scorebook Options</Text><Pressable accessibilityLabel="Close window" onPress={()=>setOptionsOpen(false)} style={{padding:3}}><Ionicons name="close-circle" size={29} color="white"/></Pressable></View><ScrollView contentContainerStyle={{padding:12,gap:8}}>
    {([{label:doc.status==='draft'?'Start Game':doc.status==='final'?'Edit Game':'End Game',run:changeStatus},...(doc.status==='final'?[{label:'Postgame Summary',run:openPostgame}]:[]),{label:'Edit Visiting Lineup',run:()=>openScorebookLineupEditor('away')},{label:'Edit Home Lineup',run:()=>openScorebookLineupEditor('home')},{label:'Access Bench Players',run:()=>openBench(side,true,false)},{label:'Play-by-Play',run:()=>setHistoryOpen(true)},{label:'Team Stats',run:()=>{setBoxScoreSide(side);setBoxScoreOpen(true);}},{label:'Adjust Score',run:openAdjustScore},{label:`Set Innings (${(doc as any).scheduledInnings===9?9:7})`,run:()=>setInningsOpen(true)},{label:'Swap Home/Away',run:swapHomeAway},{label:'Reset Game Data',run:()=>setConfirmAction('reset')}] as {label:string;run:()=>void}[]).map(item=><Pressable key={item.label} style={[styles.chip,{minHeight:48,alignItems:'center'},item.label==='Start Game'?{backgroundColor:'#15803d',borderColor:'#15803d'}:item.label==='End Game'?{backgroundColor:'#b91c1c',borderColor:'#b91c1c'}:null]} onPress={()=>{setOptionsOpen(false);item.run();}}><View style={{flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8}}>{item.label==='Start Game'?<Ionicons name="play-circle-outline" size={21} color="white"/>:item.label==='End Game'?<Ionicons name="flag-outline" size={21} color="white"/>:null}<Text style={[styles.bold,{fontSize:15,textAlign:'center'},(item.label==='Start Game'||item.label==='End Game')?{color:'#ffffff'}:null]}>{item.label}</Text></View></Pressable>)}
   </ScrollView></View></View></Modal>
   <Modal visible={inningsOpen} transparent animationType="fade" onRequestClose={()=>setInningsOpen(false)}><View style={{flex:1,backgroundColor:'#0009',justifyContent:'center',padding:24}}><View style={{backgroundColor:'white',borderRadius:16,padding:20,gap:12}}><Text style={[styles.heading,{fontSize:20}]}>Scheduled Innings</Text><Text style={styles.muted}>Choose the regulation game length. Tied games can continue into extra innings.</Text>{([7,9] as const).map(n=><Pressable key={n} onPress={()=>setScheduledInnings(n)} style={[styles.chip,{minHeight:50,backgroundColor:((doc as any).scheduledInnings===9?9:7)===n?'#bfdbfe':'#f1f5f9'}]}><Text style={styles.bold}>{n} Innings</Text></Pressable>)}<Pressable onPress={()=>setInningsOpen(false)} style={styles.chip}><Text style={styles.bold}>Cancel</Text></Pressable></View></View></Modal>
   <Modal visible={(!!playerEdit||!!benchPlayerId)&&!individualStats} transparent animationType="fade" onRequestClose={()=>{setPlayerEdit(null);setBenchPlayerId('');}}>
    <View style={{flex:1,backgroundColor:'#0009',justifyContent:'center',padding:15}}><View style={{backgroundColor:'white',borderRadius:16,padding:16,maxHeight:'90%'}}>
     <Text style={[styles.heading,{fontSize:21,textAlign:'center'}]}>{benchPlayerId?'Edit Bench Player':'Edit Player'}</Text>
     <Text style={[styles.muted,{textAlign:'center',marginBottom:10}]}>{benchPlayerId?`Bench · ${subTeam==='away'?'Visitors':'Home'} (not batting)`:`Batting slot #${playerEdit?.slot} · ${playerEdit?.team==='away'?'Visitors':'Home'}`}</Text>
     {!benchPlayerId?<View style={{flexDirection:'row',gap:8,marginBottom:12}}>{(['edit','replace'] as const).map(mode=><Pressable key={mode} onPress={()=>{setPlayerEditMode(mode);setPlayerEditError('');}} style={[styles.chip,{flex:1,backgroundColor:playerEditMode===mode?'#bfdbfe':'#e2e8f0'}]}><Text style={[styles.bold,{textAlign:'center',fontSize:12}]}>{mode==='edit'?'Edit Player / Defense':'Replace Batter'}</Text></Pressable>)}</View>:null}
     
     {!benchPlayerId?<Pressable onPress={()=>{if(playerEdit){openBench(playerEdit.team,false,true);setPlayerEdit(null);}}} style={[styles.button,{backgroundColor:INK,minHeight:48,marginBottom:10,justifyContent:'center'}]}><Text style={[styles.white,{fontSize:16,textAlign:'center'}]}>Access Bench Players</Text></Pressable>:null}
     {!benchPlayerId&&playerEdit&&playerEditMode==='edit'?<View style={{flexDirection:'row',gap:8,marginBottom:10}}>
       {(['batting',...(playerEdit.position.toUpperCase()==='P'?['pitching']:[])] as string[]).map(kind=><Pressable key={kind} onPress={()=>{
         const team=playerEdit.team==='home'?doc.home:doc.away;
         const entry=team.slots.flatMap(x=>x.appearances).find(e=>e.entryId===playerEdit.entryId);
         if(!entry)return;
         setIndividualStats({playerId:entry.player.id,teamId:team.teamId,name:entry.player.name,pitcher:kind==='pitching'});
       }} style={[styles.button,{flex:1,backgroundColor:kind==='pitching'?'#64748b':'#334155',minHeight:46,justifyContent:'center',paddingHorizontal:4}]}>
        <Text style={[styles.white,{fontSize:14,textAlign:'center'}]}>{kind==='pitching'?'Pitcher Stats':'Player Stats'}</Text>
       </Pressable>)}
      </View>:null}
     <ScrollView keyboardShouldPersistTaps="handled" style={{maxHeight:430}}>
      {benchPlayerId?<><Text style={styles.muted}>Player name</Text><TextInput style={styles.input} value={benchName} onChangeText={setBenchName}/><Text style={[styles.muted,{marginTop:10}]}>Uniform number</Text><TextInput style={styles.input} value={benchNumber} onChangeText={setBenchNumber}/></>:playerEditMode==='edit'?<><Text style={styles.muted}>Name correction (same player)</Text><TextInput style={styles.input} value={playerEdit?.name||''} onChangeText={name=>setPlayerEdit(e=>e?{...e,name}:e)}/><Text style={[styles.muted,{marginTop:10}]}>Uniform number</Text><TextInput style={styles.input} value={playerEdit?.number||''} onChangeText={number=>setPlayerEdit(e=>e?{...e,number}:e)}/></>:<><Text style={styles.muted}>Choose a bench player to enter this batting slot. The original batter's earlier stats remain intact.</Text>{(playerEdit?.team==='away'?doc.away:doc.home).bench.map(p=><Pressable key={p.id} style={[styles.chip,{marginTop:5,backgroundColor:replacementId===p.id?'#bbf7d0':'#f1f5f9'}]} onPress={()=>setReplacementId(p.id)}><Text style={styles.bold}>#{p.jerseyNumber||'--'} {p.name}</Text></Pressable>)}</>}
      {!benchPlayerId&&playerEditMode==='edit'&&playerEdit?<Pressable accessibilityRole="checkbox" accessibilityState={{checked:playerEdit.courtesyRunner}} onPress={()=>setPlayerEdit(e=>e?{...e,courtesyRunner:!e.courtesyRunner}:e)} style={{flexDirection:'row',alignItems:'center',gap:12,marginTop:16,padding:12,borderRadius:10,borderWidth:1,borderColor:playerEdit.courtesyRunner?'#fca5a5':'#cbd5e1',backgroundColor:playerEdit.courtesyRunner?'#fee9e9':'#f8fafc'}}><View style={{width:26,height:26,borderRadius:6,borderWidth:2,borderColor:playerEdit.courtesyRunner?'#b91c1c':'#64748b',backgroundColor:playerEdit.courtesyRunner?'#b91c1c':'white',alignItems:'center',justifyContent:'center'}}>{playerEdit.courtesyRunner?<Ionicons name="checkmark" size={19} color="white"/>:null}</View><View style={{flex:1}}><Text style={{fontSize:15,fontWeight:'800',color:playerEdit.courtesyRunner?'#991b1b':INK}}>Courtesy Runner (CR)</Text><Text style={{fontSize:12,color:'#475569'}}>Highlight this player light red in the scorebook. Does not place a runner on base.</Text></View></Pressable>:null}
      <Text style={[styles.heading,{fontSize:16,marginTop:14}]}>Defensive Position</Text><Text style={styles.muted}>DH, EH and -- are not defensive positions. Changing a position does not change batting order.</Text>
      <View style={{flexDirection:'row',flexWrap:'wrap',justifyContent:'center',gap:7,marginTop:8}}>{editPositions.map(pos=><Pressable key={pos} onPress={()=>benchPlayerId?setBenchPosition(pos):setPlayerEdit(e=>e?{...e,position:pos}:e)} style={[styles.chip,{minWidth:57,backgroundColor:(benchPlayerId?benchPosition:(playerEdit?.position||'--'))===pos?'#bfdbfe':'#f1f5f9',alignItems:'center'}]}><Text style={styles.bold}>{pos}</Text></Pressable>)}</View>
      {benchError&&benchPlayerId?<Text style={{color:'#b91c1c',fontWeight:'800',marginTop:12}}>{benchError}</Text>:null}
      {playerEditError&&!benchPlayerId?<Text style={{color:'#b91c1c',fontWeight:'800',marginTop:12}}>{playerEditError}</Text>:null}
     </ScrollView>
     {benchPlayerId?<View style={{gap:8,marginTop:14}}><Pressable onPress={()=>void saveBenchPlayer('defense')} style={[styles.button,{backgroundColor:'#075486',minHeight:48}]}><Text style={[styles.white,{textAlign:'center'}]}>Save Defensive Assignment</Text></Pressable>{benchAllowBatting?<Pressable onPress={()=>void saveBenchPlayer('bottom')} style={[styles.button,{backgroundColor:'#15803d',minHeight:48}]}><Text style={[styles.white,{textAlign:'center'}]}>Add to Bottom of Lineup</Text></Pressable>:null}<Pressable onPress={()=>{setBenchPlayerId('');setBenchOpen(true);}} style={[styles.chip,{alignItems:'center'}]}><Text style={styles.bold}>Back to Bench</Text></Pressable></View>:<View style={{flexDirection:'row',gap:10,marginTop:14}}><Pressable onPress={()=>setPlayerEdit(null)} style={[styles.chip,{flex:1}]}><Text style={[styles.bold,{textAlign:'center'}]}>Cancel</Text></Pressable><Pressable onPress={()=>void savePlayerEdit()} style={[styles.button,{flex:1,backgroundColor:'#15803d'}]}><Text style={styles.white}>Save Changes</Text></Pressable></View>}
    </View></View>
   </Modal>
   <Modal visible={!!individualStats} transparent animationType="fade" onRequestClose={()=>setIndividualStats(null)}>
    <View style={{flex:1,backgroundColor:'#0009',justifyContent:'center',padding:14}}>
     <View style={{backgroundColor:'white',borderRadius:16,padding:16,gap:12}}>
      <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between'}}>
       <Text style={[styles.heading,{fontSize:20}]}>{individualStats?.pitcher?'Pitcher Stats':'Player Stats'}</Text>
       <Pressable accessibilityLabel="Close player statistics" onPress={()=>setIndividualStats(null)}><Ionicons name="close-circle" size={30} color={INK}/></Pressable>
      </View>
      <Text style={[styles.bold,{fontSize:16}]}>{individualStats?.name||''}</Text>
      {individualStats?.pitcher?(()=>{
       const t=todayPitching(doc,individualStats.playerId,individualStats.teamId);
       const headers=['','Pitches','Balls','Strikes','R','ER'];
       const today=t.attributed?[String(t.pitches),String(t.balls),String(t.strikes),String(t.runs),'—']:['—','—','—','—','—'];
       return <><ScrollView horizontal><View>
        <View style={{flexDirection:'row',backgroundColor:INK}}>{headers.map((h,i)=><Text key={i} style={{width:i?67:70,color:'white',paddingVertical:12,textAlign:'center',fontWeight:'900',fontSize:12}}>{h}</Text>)}</View>
        {[['Today',...today],['Season',...Array(5).fill('—')]].map((row,i)=><View key={i} style={{flexDirection:'row',backgroundColor:i?'#edf4f8':'white'}}>{row.map((v,j)=><Text key={j} style={{width:j?67:70,paddingVertical:12,textAlign:'center',fontSize:13,color:INK,fontWeight:j? '500':'900'}}>{v}</Text>)}</View>)}
       </View></ScrollView>
       <Text style={styles.muted}>{t.estimated?'Pitch counts are estimated from the opposing team’s pitch log for the current pitcher. Earlier pitching changes cannot yet be separated. ':''}Earned runs require additional scoring attribution and display as —.</Text></>;
      })():(()=>{
       const t=todayBatting(doc,individualStats?.playerId||'',individualStats?.teamId||'');
       const headers=['','PA','AB','H','R','RBI','BB','K','SB','AVG'];
       const vals=[t.PA,t.AB,t.H,t.R,t.RBI,t.BB,t.K,t.SB,t.AVG];
       return <ScrollView horizontal><View>
        <View style={{flexDirection:'row',backgroundColor:INK}}>{headers.map((h,i)=><Text key={i} style={{width:i===0?66:i===9?60:43,color:'white',paddingVertical:12,textAlign:'center',fontWeight:'900',fontSize:12}}>{h}</Text>)}</View>
        {[['Today',...vals],['Season',...Array(9).fill('—')]].map((row,i)=><View key={i} style={{flexDirection:'row',backgroundColor:i?'#edf4f8':'white'}}>{row.map((v,j)=><Text key={j} style={{width:j===0?66:j===9?60:43,paddingVertical:12,textAlign:'center',fontSize:13,color:INK,fontWeight:j?'500':'900'}}>{v}</Text>)}</View>)}
       </View></ScrollView>;
      })()}
      <Text style={styles.muted}>Today uses this local Scorebook. Season totals will become available when multi-game storage and season aggregation are implemented.</Text>
      <Pressable onPress={()=>setIndividualStats(null)} style={[styles.button,{backgroundColor:'#64748b'}]}><Text style={styles.white}>Back to Edit Player</Text></Pressable>
     </View>
    </View>
   </Modal>
   <Modal visible={fieldingHelpVisible} transparent animationType="fade" onRequestClose={()=>setFieldingHelpVisible(false)}><View style={{flex:1,backgroundColor:'#0009',justifyContent:'center',padding:20}}><View style={{backgroundColor:'white',borderRadius:16,padding:20,gap:12}}><Text style={[styles.heading,{fontSize:20}]}>Fielding Scenario Help</Text><Text style={{color:INK,fontSize:16}}>{result==='ROE'?'Touch the fielder who committed the error. That player will be charged with one error for this play.':'Tap fielding positions in the exact order of the play. For example, 5 → 3 records a 5–3 out.'}</Text><Pressable onPress={()=>setFieldingHelpVisible(false)} accessibilityLabel="Close help" style={{alignSelf:'center',padding:6}}><Ionicons name="close-circle" size={32} color={INK}/></Pressable></View></View></Modal>
   <Modal visible={destinationWarning} transparent animationType="fade" onRequestClose={()=>setDestinationWarning(false)}>
    <View style={{flex:1,backgroundColor:'#0009',justifyContent:'center',padding:20}}>
     <View style={{backgroundColor:'white',borderRadius:16,padding:20,gap:12}}>
      <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center'}}><Text style={[styles.heading,{fontSize:20}]}>Select Destination</Text><Pressable onPress={()=>setDestinationWarning(false)} accessibilityLabel="Close"><Ionicons name="close-circle" size={30} color={INK}/></Pressable></View>
      <Text style={{color:INK,fontSize:16}}>Choose a base ahead of the runner's current base to record an advance. Courtesy Runner does not require a destination change.</Text>
      <Pressable onPress={()=>setDestinationWarning(false)} style={[styles.button,{backgroundColor:INK}]}><Text style={styles.white}>Choose Destination</Text></Pressable>
     </View>
    </View>
   </Modal>
   <Modal visible={benchOpen} transparent animationType="fade" onRequestClose={()=>setBenchOpen(false)}>
    <View style={{flex:1,backgroundColor:'#0009',justifyContent:'center',padding:15}}><View style={{backgroundColor:'white',borderRadius:16,padding:16,maxHeight:'88%'}}>
     <Text style={[styles.heading,{fontSize:23,textAlign:'center'}]}>Bench</Text>
     <Text style={[styles.muted,{textAlign:'center',fontSize:14,marginBottom:10}]}>{subTeam==='away'?'Visitors':'Home'} · {benchAllowBatting?'Assign defense or add a new hitter at the bottom of the batting order.':'Assign a bench player on defense without changing the batting order.'}</Text>
     <ScrollView style={{maxHeight:380}} keyboardShouldPersistTaps="handled">
      {(subTeam==='away'?doc.away:doc.home).bench.length===0?<Text style={[styles.muted,{textAlign:'center'}]}>No bench players available. Add them to the Game Lineup roster before creating a new scorebook.</Text>:null}
      {(subTeam==='away'?doc.away:doc.home).bench.map(p=><Pressable key={p.id} onPress={()=>{setBenchPlayerId(p.id);setBenchName(p.name);setBenchNumber(p.jerseyNumber||'');setBenchPosition(editPositions.includes((p.position||'').toUpperCase())?p.position.toUpperCase():'--');setBenchError('');setBenchOpen(false);}} style={[styles.chip,{marginVertical:3,minHeight:52,justifyContent:'center',alignItems:'center',backgroundColor:'#e2e8f0'}]}><Text style={[styles.bold,{fontSize:16,textAlign:'center'}]}>#{p.jerseyNumber||'--'}  {p.name}  ·  {p.position||'--'}</Text></Pressable>)}
     </ScrollView>
     <Pressable accessibilityLabel="Close bench" onPress={()=>setBenchOpen(false)} style={{alignSelf:"center",padding:6,marginTop:12}}><Ionicons name="close-circle" size={32} color={INK}/></Pressable>
    </View></View>
   </Modal>
   <Modal visible={!!benchConflict} transparent animationType="fade" onRequestClose={()=>setBenchConflict(null)}><View style={{flex:1,backgroundColor:'#0009',justifyContent:'center',padding:20}}><View style={{backgroundColor:'white',borderRadius:16,padding:20,gap:12}}><Text style={[styles.heading,{fontSize:21,textAlign:'center'}]}>Position Already Occupied</Text><Text style={{fontSize:16,color:INK,textAlign:'center',lineHeight:24}}>{benchConflict?.name} is currently assigned to {benchConflict?.position}. Move that player to -- and assign this position to the selected bench player?</Text><Pressable onPress={()=>{setBenchConflict(null);void saveBenchPlayer(benchPendingAction,true);}} style={[styles.button,{backgroundColor:'#15803d'}]}><Text style={styles.white}>Move Current Defender to --</Text></Pressable><Pressable onPress={()=>setBenchConflict(null)} style={[styles.chip,{alignItems:'center'}]}><Text style={styles.bold}>Cancel</Text></Pressable></View></View></Modal>
   <Modal visible={!!positionConflict} transparent animationType="fade" onRequestClose={()=>setPositionConflict(null)}><View style={{flex:1,backgroundColor:'#0009',justifyContent:'center',padding:20}}><View style={{backgroundColor:'white',borderRadius:16,padding:20,gap:12}}><Text style={[styles.heading,{fontSize:20,textAlign:'center'}]}>Position Already Occupied</Text><Text style={{color:INK,textAlign:'center',lineHeight:22}}>{positionConflict?.name} is currently assigned to {positionConflict?.position}. Move that player to -- (no defensive assignment) and assign this position to the selected player?</Text><Pressable onPress={()=>{setPositionConflict(null);void savePlayerEdit(true);}} style={[styles.button,{backgroundColor:'#15803d'}]}><Text style={styles.white}>Move Current Fielder to --</Text></Pressable><Pressable onPress={()=>setPositionConflict(null)} style={styles.chip}><Text style={[styles.bold,{textAlign:'center'}]}>Cancel / Choose Another Position</Text></Pressable></View></View></Modal>
   <Modal visible={lineupCorrectionConfirm} transparent animationType="fade" onRequestClose={()=>setLineupCorrectionConfirm(false)}>
    <View style={{flex:1,backgroundColor:'#0009',justifyContent:'center',padding:18}}>
     <View style={{backgroundColor:'white',borderRadius:16,padding:20,gap:14,borderWidth:2,borderColor:INK}}>
      <Text style={[styles.heading,{fontSize:20,textAlign:'center'}]}>Confirm Lineup Correction</Text>
      <Text style={{color:INK,lineHeight:21,textAlign:'center'}}>You're changing an established player's name during a game. Use Substitute Player if a different player entered the game. If you're correcting a name or number for the SAME player, you can save it here. Recorded plays keep their player IDs.</Text>
      <View style={{flexDirection:'row',gap:10}}>
       <Pressable style={[styles.button,{flex:1,backgroundColor:'#64748b'}]} onPress={()=>setLineupCorrectionConfirm(false)}><Text style={styles.white}>Back to Lineup</Text></Pressable>
       <Pressable style={[styles.button,{flex:1}]} onPress={()=>void saveLineupEdits(true)}><Text style={styles.white}>Save Correction</Text></Pressable>
      </View>
     </View>
    </View>
   </Modal>
   <Modal visible={lineupEditorOpen} animationType="slide" onRequestClose={()=>setLineupEditorOpen(false)}>
    <View style={{flex:1,backgroundColor:'#e7f3fb',paddingTop:Math.max(safeAreaInsets.top,18),paddingBottom:Math.max(safeAreaInsets.bottom,18)}}>
     <View style={{backgroundColor:INK,padding:14,flexDirection:'row',alignItems:'center',justifyContent:'space-between'}}><Text style={{color:'white',fontWeight:'900',fontSize:19}}>Edit {lineupEditorTeam==='away'?'Visiting':'Home'} Lineup</Text><Pressable accessibilityLabel="Close lineup editor" onPress={()=>setLineupEditorOpen(false)} style={{padding:4}}><Ionicons name="close-circle" size={29} color="white"/></Pressable></View>
     <Text style={{padding:12,color:INK}}>Enter missing batters or correct uniform numbers, names, and positions. These changes are saved only in this local scorebook.</Text>
     <View style={{flexDirection:'row',paddingHorizontal:12,gap:8,marginBottom:8}}><Pressable style={[styles.chip,{flex:1,backgroundColor:'#dbeafe'}]} onPress={()=>setMassAddOpen(true)}><Text style={[styles.bold,{textAlign:'center'}]}>Mass Add Names</Text></Pressable><Pressable style={[styles.chip,{flex:1,backgroundColor:'#dbeafe'}]} onPress={()=>setLineupDraft(old=>[...old,...Array.from({length:5},()=>({number:'',name:'',position:''}))])}><Text style={[styles.bold,{textAlign:'center'}]}>Add 5 Rows</Text></Pressable></View>
     <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{paddingHorizontal:10,paddingBottom:25,gap:6}}>
      <View style={{flexDirection:'row',gap:6}}><Text style={{width:26,fontWeight:'900'}}>#</Text><Text style={{width:55,fontWeight:'900'}}>UNI #</Text><Text style={{flex:1,fontWeight:'900'}}>PLAYER NAME</Text><Text style={{width:55,fontWeight:'900'}}>POS</Text></View>
      {lineupDraft.map((row,i)=><View key={i} style={{flexDirection:'row',alignItems:'center',gap:6}}><Text style={{width:26,fontWeight:'800',color:INK}}>{i+1}</Text><TextInput value={row.number} onChangeText={v=>updateLineupDraft(i,'number',v)} placeholder="#" style={[styles.input,{width:55,textAlign:'center',paddingHorizontal:3}]} autoCapitalize="characters"/><TextInput value={row.name} onChangeText={v=>updateLineupDraft(i,'name',v)} placeholder="Player name" style={[styles.input,{flex:1,minWidth:0}]} autoCapitalize="words"/><TextInput value={row.position} onChangeText={v=>updateLineupDraft(i,'position',v)} placeholder="POS" style={[styles.input,{width:55,textAlign:'center',paddingHorizontal:3}]} autoCapitalize="characters"/></View>)}
     </ScrollView>
     <View style={{flexDirection:'row',gap:10,margin:12}}><Pressable onPress={()=>setLineupEditorOpen(false)} style={[styles.button,{flex:1,backgroundColor:'#64748b',minHeight:48}]}><Text style={styles.white}>Cancel</Text></Pressable><Pressable onPress={()=>void saveLineupEdits()} style={[styles.button,{flex:1,backgroundColor:'#16803c',minHeight:48}]}><Text style={styles.white}>Save Lineup</Text></Pressable></View>
    </View>
   </Modal>
    <Modal visible={miscOpen} transparent animationType="fade" onRequestClose={()=>setMiscOpen(false)}><View style={{flex:1,backgroundColor:'#0009',justifyContent:'center',padding:20}}><View style={{backgroundColor:'white',borderRadius:16,padding:18,gap:12}}><Text style={[styles.heading,{fontSize:20,textAlign:'center'}]}>Misc Scoring</Text><Text style={[styles.muted,{textAlign:'center'}]}>Select a scoring action.</Text><Pressable style={[styles.chip,{minHeight:54}]} onPress={()=>{setMiscOpen(false);setBalkConfirmOpen(true);}}><Text style={styles.bold}>Balk</Text></Pressable><Pressable style={[styles.chip,{minHeight:54}]} onPress={()=>{setMiscOpen(false);setSkipConfirmOpen(true);}}><Text style={styles.bold}>Skip Batter</Text></Pressable><Pressable style={styles.chip} onPress={()=>setMiscOpen(false)}><Text style={styles.bold}>Cancel</Text></Pressable></View></View></Modal>
    <Modal visible={balkConfirmOpen} transparent animationType="fade" onRequestClose={()=>setBalkConfirmOpen(false)}><View style={{flex:1,backgroundColor:'#0009',justifyContent:'center',padding:20}}><View style={{backgroundColor:'white',borderRadius:16,padding:18,gap:12}}><Text style={[styles.heading,{fontSize:20,textAlign:'center'}]}>Confirm Balk</Text><Text style={[styles.muted,{textAlign:'center'}]}>Advance each occupied runner one base. The batter remains at bat; no RBI is credited.</Text><View style={{flexDirection:'row',gap:10}}><Pressable style={[styles.chip,{flex:1}]} onPress={()=>setBalkConfirmOpen(false)}><Text style={styles.bold}>Cancel</Text></Pressable><Pressable style={[styles.button,{flex:1}]} onPress={()=>{setBalkConfirmOpen(false);void recordScoringBalk();}}><Text style={styles.white}>Record Balk</Text></Pressable></View></View></View></Modal>
    <Modal visible={skipConfirmOpen} transparent animationType="fade" onRequestClose={()=>setSkipConfirmOpen(false)}><View style={{flex:1,backgroundColor:'#0009',justifyContent:'center',padding:20}}><View style={{backgroundColor:'white',borderRadius:16,padding:18,gap:12}}><Text style={[styles.heading,{fontSize:20,textAlign:'center'}]}>Skip Batter</Text><Text style={[styles.muted,{textAlign:'center',fontSize:15}]}>Count as Out?</Text><View style={{flexDirection:'row',gap:10}}><Pressable style={[styles.button,{flex:1,backgroundColor:'#b91c1c'}]} onPress={()=>void skipCurrentBatter(true)}><Text style={styles.white}>Yes — Out</Text></Pressable><Pressable style={[styles.button,{flex:1,backgroundColor:INK}]} onPress={()=>void skipCurrentBatter(false)}><Text style={styles.white}>No — No Out</Text></Pressable></View><Pressable style={styles.chip} onPress={()=>setSkipConfirmOpen(false)}><Text style={styles.bold}>Cancel</Text></Pressable></View></View></Modal>
   <Modal visible={massAddOpen} transparent animationType="fade" onRequestClose={()=>setMassAddOpen(false)}><View style={{flex:1,backgroundColor:'#0009',justifyContent:'center',padding:18}}><View style={{backgroundColor:'white',borderRadius:14,padding:18,gap:12}}><Text style={styles.heading}>Mass Add Names</Text><Text style={styles.muted}>Fill blank lineup names without overwriting names already entered. Maximum 60 players.</Text><Text style={styles.bold}>Number of Players</Text><TextInput style={styles.input} keyboardType="number-pad" value={massAddCount} onChangeText={setMassAddCount}/><Text style={styles.bold}>Naming Convention</Text><TextInput style={styles.input} value={massAddPrefix} onChangeText={setMassAddPrefix} placeholder="Player"/><Text style={styles.muted}>Example: {massAddPrefix.trim()||'Player'} 1, {massAddPrefix.trim()||'Player'} 2, {massAddPrefix.trim()||'Player'} 3…</Text><View style={{flexDirection:'row',gap:8}}><Pressable style={[styles.button,{flex:1,backgroundColor:'#64748b'}]} onPress={()=>setMassAddOpen(false)}><Text style={styles.white}>Cancel</Text></Pressable><Pressable style={[styles.button,{flex:1,backgroundColor:'#16803c'}]} onPress={applyMassNames}><Text style={styles.white}>Add Names</Text></Pressable></View></View></View></Modal>
   <Modal visible={!!gameActionError} transparent animationType="fade" onRequestClose={()=>setGameActionError('')}>
    <View style={{flex:1,backgroundColor:'#0009',justifyContent:'center',padding:20}}>
     <View style={{backgroundColor:'white',borderRadius:18,padding:20,gap:14,borderWidth:2,borderColor:INK}}>
      <View style={{alignItems:'center',gap:9}}>
       <Ionicons name="alert-circle-outline" size={44} color="#b91c1c"/>
       <Text style={[styles.heading,{fontSize:21,textAlign:'center'}]}>Unable to Complete Action</Text>
       <Text style={[styles.muted,{fontSize:15,lineHeight:22,textAlign:'center'}]}>{gameActionError}</Text>
      </View>
      <Pressable style={[styles.button,{backgroundColor:INK,minHeight:48,alignItems:'center',justifyContent:'center'}]} onPress={()=>setGameActionError('')}>
       <Text style={[styles.white,{textAlign:'center'}]}>OK</Text>
      </Pressable>
     </View>
    </View>
   </Modal>
   <Modal visible={missingLineupTeam!==null} transparent animationType="fade" onRequestClose={()=>setMissingLineupTeam(null)}>
    <View style={{flex:1,backgroundColor:'#0009',justifyContent:'center',padding:18}}>
     <View style={{backgroundColor:'white',borderRadius:16,padding:18,gap:12}}>
      <Text style={[styles.heading,{fontSize:20,textAlign:'center'}]}>Opponent Lineup Not Available</Text>
      <Text style={[styles.muted,{fontSize:15,lineHeight:22}]}>The opposing team has not shared a lineup in this scorebook. You can ask their manager to share it, or enter the lineup yourself if they are not using the app.</Text>
      <Text style={[styles.muted,{fontSize:15,lineHeight:22}]}>Use Add Player at the bottom of the Scorebook to enter players individually, or Options → Edit {missingLineupTeam==='away'?'Visiting':'Home'} Lineup → Mass Add Names to add placeholders in bulk.</Text>
      <Pressable style={[styles.button,{backgroundColor:INK,height:44,padding:0,alignItems:'center',justifyContent:'center'}]} onPress={()=>{const which=missingLineupTeam;setMissingLineupTeam(null);setScoreOpen(false);if(which)openScorebookLineupEditor(which);setMassAddOpen(true);}}><Text style={[styles.white,{textAlign:'center'}]}>Mass Add Names Now</Text></Pressable>
      <Pressable style={[styles.button,{backgroundColor:'#64748b',minHeight:48,alignItems:'center',justifyContent:'center'}]} onPress={()=>setMissingLineupTeam(null)}><Text style={[styles.white,{textAlign:'center'}]}>Continue Scoring</Text></Pressable>
     </View>
    </View>
   </Modal>
   <Modal visible={postgameOpen&&!confirmAction&&!optionsOpen&&!boxScoreOpen&&!gameSummaryOpen} animationType="none" onRequestClose={()=>setPostgameOpen(false)}>
    <View style={{flex:1,backgroundColor:'#e7f3fb',paddingTop:Math.max(safeAreaInsets.top,18),paddingBottom:Math.max(safeAreaInsets.bottom,12)}}>
     <View style={{backgroundColor:INK,padding:14,flexDirection:'row',justifyContent:'space-between',alignItems:'center'}}><Text style={{fontSize:20,color:'white',fontWeight:'900'}}>Postgame Summary</Text><Pressable onPress={()=>setPostgameOpen(false)} accessibilityLabel="Close postgame summary"><Ionicons name="close-circle" size={29} color="white"/></Pressable></View>
     <ScrollView contentContainerStyle={{padding:14,gap:12,paddingBottom:36}}>
      <Text style={[styles.heading,{textAlign:'center'}]}>{doc.away.teamName} at {doc.home.teamName}</Text>
      <Text style={[styles.muted,{textAlign:'center'}]}>Status: {doc.status==='final'?'Final':'Awaiting finalization'} · Revision {Number((doc as any).finalRevision||0)}</Text>
      <View style={[styles.paper,{gap:5,backgroundColor:'#e0f2fe'}]}><Text style={styles.bold}>Independent Team Scorebook</Text><Text style={styles.muted}>Owned and scored by: {doc.ownerTeamId===doc.awayTeamId?doc.away.teamName:doc.home.teamName}. Your scoring decisions and revisions remain separate from the opposing manager's scorebook. Only your team's player statistics will count toward your team's future league totals.</Text><Text style={styles.muted}>Final scores should agree between managers, but differing hits, errors, and other scoring judgments do not require reconciliation.</Text></View>
      <View style={[styles.paper,{alignItems:'center'}]}><Text style={styles.heading}>{doc.away.teamName} {live.awayRuns} — {live.homeRuns} {doc.home.teamName}</Text></View>
      <Text style={styles.heading}>Pitching Decisions</Text>
      
      {(()=>{
       const teams=[doc.away,doc.home];
       const pitchers=teams.flatMap(t=>t.slots.flatMap(slot=>slot.appearances.filter(a=>a.position?.toUpperCase()==='P').map(a=>({id:a.player.id,name:a.player.name,team:t.teamId}))));
       const unique=pitchers.filter((p,i)=>pitchers.findIndex(q=>q.id===p.id&&q.team===p.team)===i);
       const winner=live.awayRuns>live.homeRuns?doc.awayTeamId:live.homeRuns>live.awayRuns?doc.homeTeamId:'';
       const loser=winner===''?'':winner===doc.awayTeamId?doc.homeTeamId:doc.awayTeamId;
       const eligible=(type:'win'|'loss'|'save')=>unique.filter(p=>type==='loss'?p.team===loser:p.team===winner&&(type!=='save'||p.id!==postgameWin)&&
         (type!=='save'||unique.filter(q=>q.team===winner).length>1));
       const fields=[{type:'win' as const,label:'Winning Pitcher',value:postgameWin,set:setPostgameWin},
                     {type:'loss' as const,label:'Losing Pitcher',value:postgameLoss,set:setPostgameLoss},
                     {type:'save' as const,label:'Save',value:postgameSave,set:setPostgameSave}];
       return <>
        {fields.map(f=><View key={f.type} style={[styles.paper,{gap:6}]}>
          <Text style={styles.bold}>{f.label}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel={`Select ${f.label}`} onPress={()=>setPitchDecisionPicker(f.type)} style={{minHeight:43,borderWidth:1,borderColor:'#94a3b8',borderRadius:8,backgroundColor:'white',flexDirection:'row',justifyContent:'space-between',alignItems:'center',paddingHorizontal:12}}>
            <Text style={{color:INK,fontSize:15}}>{eligible(f.type).find(p=>p.id===f.value)?.name||'Select pitcher (optional)'}</Text>
            <Ionicons name="chevron-down" size={19} color={INK}/>
          </Pressable>
        </View>)}
        <Modal transparent visible={pitchDecisionPicker!==null} animationType="fade" onRequestClose={()=>setPitchDecisionPicker(null)}>
         <View style={{flex:1,backgroundColor:'#0009',justifyContent:'center',padding:18}}>
          <View style={{backgroundColor:'white',borderRadius:14,padding:16,gap:8,maxHeight:'75%'}}>
           <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between'}}>
            <Text style={[styles.heading,{fontSize:19}]}>{fields.find(f=>f.type===pitchDecisionPicker)?.label||'Select Pitcher'}</Text>
            <Pressable onPress={()=>setPitchDecisionPicker(null)}><Ionicons name="close-circle" size={28} color={INK}/></Pressable>
           </View>
           <ScrollView>
            {[{id:'',name:'No selection'},...(pitchDecisionPicker?eligible(pitchDecisionPicker):[])].map(p=><Pressable key={p.id||'none'} onPress={()=>{
              const field=fields.find(f=>f.type===pitchDecisionPicker);
              field?.set(p.id);
              if(pitchDecisionPicker==='win')setPostgameSave('');
              setPitchDecisionPicker(null);
            }} style={{paddingVertical:14,paddingHorizontal:10,borderBottomWidth:1,borderColor:'#e2e8f0'}}>
             <Text style={{fontSize:16,color:INK}}>{p.name}</Text>
            </Pressable>)}
           </ScrollView>
          </View>
         </View>
        </Modal>
       </>;
      })()}
      <Text style={styles.heading}>Review Game Statistics</Text>
      <Text style={styles.muted}>The opponent's batting line below is a reference from YOUR scoring, not their official team statistics. Their own finalized scorebook will supply their players' league totals.</Text>
      <View style={{flexDirection:'row',gap:8}}>{(['away','home'] as const).map(t=><Pressable key={t} onPress={()=>{setBoxScoreSide(t);setBoxScoreOpen(true);}} style={[styles.button,{flex:1,backgroundColor:INK}]}><Text style={[styles.white,{fontSize:12,textAlign:'center'}]}>{t==='away'?'Visiting':'Home'} {doc.ownerTeamId===(t==='away'?doc.awayTeamId:doc.homeTeamId)?'Team Stats':'Stats (Reference)'}</Text></Pressable>)}</View>
      <Pressable onPress={()=>{setGameSummaryOpen(true);}} style={[styles.button,{backgroundColor:'#334155'}]}><Text style={styles.white}>Full Game Summary</Text></Pressable>
      <Text style={styles.muted}>Individual batting lines are available under Team Stats. Pitching totals remain preliminary until every pitch is assigned to a pitcher.</Text>
      <View style={[styles.paper,{gap:8}]}><Text style={styles.heading}>Download Game Summary</Text><Text style={styles.muted}>Generate a printable scorebook with each team's batting grid and a game summary. On the web, choose Save as PDF in the print dialog. On iPhone or Android, use the native share sheet to save or share the generated PDF. Traditional diamond rendering is still being developed.</Text><Pressable onPress={exportScorebookPdf} style={[styles.button,{backgroundColor:INK,height:44,padding:0,alignItems:'center',justifyContent:'center'}]}><Text style={[styles.white,{textAlign:'center'}]}>Download Game Summary</Text></Pressable></View>
      {postgameError?<Text style={{color:'#b91c1c',fontWeight:'800'}}>{postgameError}</Text>:null}
      <Pressable disabled={confirmBusy} onPress={()=>void finalizePostgame()} style={[styles.button,{backgroundColor:'#15803d',height:44,padding:0,alignItems:'center',justifyContent:'center'}]}><Text style={[styles.white,{textAlign:'center'}]}>{confirmBusy?'Saving…':doc.status==='final'?'Re-finalize Game':'Finalize Game'}</Text></Pressable>
      <Pressable onPress={()=>setPostgameOpen(false)} style={[styles.button,{backgroundColor:'#64748b'}]}><Text style={styles.white}>Return to Scorebook</Text></Pressable>
      <Text style={styles.muted}>On production web, this team's scorebook is saved to the NTABL backend independently of the opposing team's scorebook. Development builds continue to save locally. League-wide statistics are not yet connected.</Text>
     </ScrollView>
    </View>
   </Modal>
   <Modal visible={boxScoreOpen} animationType="slide" onRequestClose={()=>setBoxScoreOpen(false)}>
    <View style={{flex:1,backgroundColor:'#e7f3fb',paddingTop:Math.max(safeAreaInsets.top,18),paddingBottom:Math.max(safeAreaInsets.bottom,12)}}>
     <View style={{backgroundColor:INK,padding:14,flexDirection:'row',alignItems:'center',justifyContent:'space-between'}}><Text style={{color:'white',fontSize:19,fontWeight:'900'}}>Team Stats</Text><Pressable accessibilityLabel="Close window" onPress={()=>setBoxScoreOpen(false)} style={{padding:3}}><Ionicons name="close-circle" size={29} color="white"/></Pressable></View>
     <View style={{flexDirection:'row',gap:8,padding:10}}>{(['away','home'] as const).map(which=><Pressable key={which} onPress={()=>setBoxScoreSide(which)} style={[styles.chip,{flex:1,backgroundColor:boxScoreSide===which?INK:'#e2e8f0',minHeight:48,justifyContent:'center'}]}><Text numberOfLines={2} style={{color:boxScoreSide===which?'white':INK,fontWeight:'900',textAlign:'center'}}>{(which==='away'?doc.away:doc.home).teamName}</Text></Pressable>)}</View>
     <ScrollView contentContainerStyle={{padding:12,paddingBottom:32,gap:12}}>
      {(()=>{const team=boxScoreSide==='away'?doc.away:doc.home;const teamPA=pa.filter(p=>p.battingTeamId===team.teamId);const runs=teamPA.reduce((n,p)=>n+(p.runsOnPlay||0),0)+doc.events.filter((e:any)=>e.kind==='runner'&&e.battingTeamId===team.teamId).reduce((n:any,e:any)=>n+(e.runsOnPlay||0),0);const hits=hitCount(team.teamId);const errors=errorCount(team.teamId);const entries=team.slots.flatMap(slot=>slot.appearances);const cols=['# / Player','G','PA','AB','R','H','1B','2B','3B','HR','XBH','TB','OB','RBI','AVG','BB','SO','HBP','SB','SAC'];const widths=cols.map((_,i)=>i===0?175:i===14?56:43);
       const getLine=(entry:any)=>{const pid=entry.player.id;const st=v2BattingStats(doc,pid,team.teamId);const plays=teamPA.filter(e=>e.playerId===pid&&(e as any).specialResult!=='SKIP_BATTER');const count=(code:string)=>plays.filter(e=>String(e.result)===code).length;const singles=count('1B'),doubles=count('2B'),triples=count('3B'),homers=count('HR');const hbp=count('HBP'),sac=count('SAC')+count('SF');const sb=doc.events.filter((e:any)=>e.kind==='runner'&&e.battingTeamId===team.teamId&&['SB','STOLEN_BASE','stolenBase'].includes(String(e.action||''))).reduce((n:any,e:any)=>n+(e.runners||[]).filter((r:any)=>r.playerId===pid&&!r.isOut).length,0);const PA=plays.length;const ob=st.H+st.BB+hbp;return [entry.player.jerseyNumber?'#'+entry.player.jerseyNumber+' '+entry.player.name:entry.player.name,PA?1:0,PA,st.AB,st.R,st.H,singles,doubles,triples,homers,doubles+triples+homers,singles+2*doubles+3*triples+4*homers,ob,st.RBI,st.AB?(st.H/st.AB).toFixed(3):'—',st.BB,st.SO,hbp,sb,sac]};
       const lines=entries.map(getLine);const totals=cols.map((_,i)=>i===0?'TOTALS':i===14?(lines.reduce((n,row)=>n+Number(row[5]||0),0)/Math.max(1,lines.reduce((n,row)=>n+Number(row[3]||0),0))).toFixed(3):lines.reduce((n,row)=>n+Number(row[i]||0),0));
       const pitcherEntries=entries.filter(e=>String(e.position||'').toUpperCase()==='P');const pitchingCols=['# / Pitcher','IP','Ball','Str','B/S','PIT','R','ER','ERA','K','H','BB','WHIP','OBP','LOB'];const pitchingWidths=pitchingCols.map((_,i)=>i===0?175:54);
       const pitching=teamPitching(doc,team.teamId);
       const pitchLine=(entry:any)=>{const st=pitching[String(entry.player.id)];const name=entry.player.jerseyNumber?'#'+entry.player.jerseyNumber+' '+entry.player.name:entry.player.name;if(!st)return [name,...Array(14).fill('—')];return [name,st.ip,st.balls,st.strikes,st.strikes?(st.balls/st.strikes).toFixed(2):'—',st.pitches,st.runs,st.earnedRuns??'—',st.era,st.strikeouts,st.hits,st.walks,st.whip,st.opponentAverage,st.lob??'—'];};
       return <>
       <View style={{backgroundColor:'white',borderColor:RULE,borderWidth:1,borderRadius:8,padding:12}}><Text style={[styles.heading,{textAlign:'center'}]}>{team.teamName}</Text><View style={{flexDirection:'row',justifyContent:'space-around',marginTop:8}}>{[{k:'R',v:runs},{k:'H',v:hits},{k:'E',v:errors}].map(item=><View key={item.k} style={{alignItems:'center'}}><Text style={{color:INK,fontWeight:'900'}}>{item.k}</Text><Text style={{fontSize:25,fontWeight:'900',color:INK}}>{item.v}</Text></View>)}</View><Text style={[styles.muted,{textAlign:'center',marginTop:6}]}>LOB pending complete runner accounting</Text></View>
       <Text style={styles.heading}>Batting - Detailed</Text><ScrollView horizontal showsHorizontalScrollIndicator><View><View style={{flexDirection:'row',backgroundColor:INK,paddingVertical:9}}>{cols.map((c,i)=><Text key={c} style={{width:widths[i],color:'white',fontWeight:'900',textAlign:i?'center':'left',paddingLeft:i?0:6,fontSize:11}}>{c}</Text>)}</View>{lines.map((line,i)=><View key={i} style={{flexDirection:'row',backgroundColor:i%2?'#dbe7ef':'white',paddingVertical:8,borderBottomWidth:1,borderColor:RULE}}>{line.map((v,j)=><Text key={j} numberOfLines={1} style={{width:widths[j],textAlign:j?'center':'left',paddingLeft:j?0:6,color:'#0f2747',fontSize:11}}>{v}</Text>)}</View>)}<View style={{flexDirection:'row',backgroundColor:INK,paddingVertical:9}}>{totals.map((v,j)=><Text key={j} style={{width:widths[j],color:'white',fontWeight:'900',textAlign:j?'center':'left',paddingLeft:j?0:6,fontSize:11}}>{v}</Text>)}</View></View></ScrollView>
       <Text style={styles.heading}>Pitching - Basic</Text><ScrollView horizontal showsHorizontalScrollIndicator><View><View style={{flexDirection:'row',backgroundColor:INK,paddingVertical:9}}>{pitchingCols.map((c,i)=><Text key={c} style={{width:pitchingWidths[i],color:'white',fontWeight:'900',textAlign:i?'center':'left',paddingLeft:i?0:6,fontSize:11}}>{c}</Text>)}</View>{pitcherEntries.map((entry,i)=><View key={entry.entryId} style={{flexDirection:'row',backgroundColor:i%2?'#dbe7ef':'white',paddingVertical:8,borderBottomWidth:1,borderColor:RULE}}>{pitchLine(entry).map((v,j)=><Text key={j} numberOfLines={1} style={{width:pitchingWidths[j],textAlign:j?'center':'left',paddingLeft:j?0:6,color:'#0f2747',fontSize:11}}>{v}</Text>)}</View>)}</View></ScrollView>
       <Text style={styles.muted}>Pitching is calculated from this team-owned play-by-play. IP, hits, walks, strikeouts and runs use recorded events and lineup pitcher intervals. ERA remains — where earned-run responsibility is not explicitly established; OBA and LOB require complete tracking. Historical events with ambiguous pitcher assignments are not guessed.</Text>
       <Text style={styles.muted}>Batting totals are preliminary and calculated from locally recorded plays.</Text>
      </>})()}
     </ScrollView>
    </View>
   </Modal>
   <Modal visible={gameSummaryOpen} animationType="slide" onRequestClose={()=>setGameSummaryOpen(false)}><View style={{flex:1,backgroundColor:'#e7f3fb',paddingTop:Math.max(safeAreaInsets.top,18)}}><View style={{backgroundColor:INK,padding:14,flexDirection:'row',justifyContent:'space-between',alignItems:'center'}}><Text style={{fontSize:19,color:'white',fontWeight:'900'}}>Full Game Summary</Text><Pressable accessibilityLabel="Close window" onPress={()=>setGameSummaryOpen(false)} style={{padding:3}}><Ionicons name="close-circle" size={29} color="white"/></Pressable></View><ScrollView contentContainerStyle={{padding:12,gap:14}}><Text style={[styles.heading,{textAlign:'center'}]}>{doc.away.teamName} at {doc.home.teamName}</Text><ScrollView horizontal><View><View style={{flexDirection:'row',backgroundColor:INK,paddingVertical:9}}>{['Team',...Array.from({length:Math.max(7,...pa.map(p=>p.inning),live.inning)},(_,i)=>String(i+1)),'R','H','E'].map((h,i)=><Text key={i} style={{width:i===0?165:39,textAlign:i?'center':'left',color:'white',fontWeight:'900',paddingLeft:i?0:5}}>{h}</Text>)}</View>{[doc.away,doc.home].map((team,i)=>{const max=Math.max(7,...pa.map(p=>p.inning),live.inning);const innings=Array.from({length:max},(_,j)=>{const evs=doc.events.filter((e:any)=>e.battingTeamId===team.teamId&&e.inning===j+1&&(e.kind==='plateAppearance'||e.kind==='runner'));return evs.length?evs.reduce((n:any,e:any)=>n+(e.runsOnPlay||0),0):'–'});const runs=doc.events.filter((e:any)=>e.battingTeamId===team.teamId&&(e.kind==='plateAppearance'||e.kind==='runner')).reduce((n:any,e:any)=>n+(e.runsOnPlay||0),0);return <View key={team.teamId} style={{flexDirection:'row',backgroundColor:i?'#dbe7ef':'white',paddingVertical:12}}>{[team.teamName,...innings,runs,hitCount(team.teamId),errorCount(team.teamId)].map((v,j)=><Text key={j} numberOfLines={1} style={{width:j===0?165:39,textAlign:j?'center':'left',paddingLeft:j?0:5,color:INK,fontSize:12}}>{v}</Text>)}</View>})}</View></ScrollView><Text style={styles.muted}>Inning totals are based on recorded events. Unplayed innings display a dash. Winning/losing pitchers, saves and LOB will follow when pitching and runner accounting are complete.</Text></ScrollView></View></Modal>
   <Modal visible={historyOpen} animationType="slide" onRequestClose={()=>setHistoryOpen(false)}><View style={{flex:1,backgroundColor:'#e7f3fb',paddingTop:35}}><View style={{backgroundColor:INK,padding:14,flexDirection:'row',justifyContent:'space-between',alignItems:'center'}}><Text style={{color:'white',fontWeight:'900',fontSize:19}}>Game Play-by-Play</Text><Pressable accessibilityLabel="Close window" onPress={()=>setHistoryOpen(false)} style={{padding:3}}><Ionicons name="close-circle" size={29} color="white"/></Pressable></View><ScrollView contentContainerStyle={{padding:12,paddingBottom:50}}><HistoryView doc={doc} onReview={(eventId,whichInning,whichHalf)=>{setHistoryOpen(false);setStats(false);setSide(whichHalf==='top'?'away':'home');setInning(whichInning);setSelectedId(eventId);setMenu(null);setScoreOpen(true);}}/></ScrollView></View></Modal>
   <Modal visible={scoreOpen&&!editPlayOpen} animationType="none" onRequestClose={()=>setScoreOpen(false)}><View style={{flex:1,backgroundColor:'#e7f3fb',paddingTop:35}}>
   <View style={{backgroundColor:INK,paddingHorizontal:12,paddingVertical:9}}>
    <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:7}}>
     <Pressable disabled={!current} onPress={()=>{if(!current)return;setScoreOpen(false);setMenu(null);setLanding(null);setPreviewResult(null);const which=side;const slots=(which==='away'?doc.away:doc.home).slots;const ix=slots.findIndex(slot=>slot.appearances.some(a=>a.entryId===current.entryId));if(ix>=0)openPlayerEdit(which,ix+1,current.entryId);}} style={{flex:1,flexDirection:'row',alignItems:'center',gap:5}}><Text numberOfLines={1} style={{color:'white',fontWeight:'900',fontSize:18,flexShrink:1,textDecorationLine:current?'underline':'none'}}>{chosen?`Recorded: ${chosen.notation}`:current?`${current.player.jerseyNumber} ${current.player.name}`:'Scoring square'}</Text>{current?<Ionicons name="create-outline" size={17} color="#fde047"/>:null}</Pressable>
     <Pressable accessibilityLabel="Undo" onPress={()=>{if(menu&&screenUndo.length)undoScreen();else if(menu)previousScoringStep();else void undo();}} style={{padding:6,backgroundColor:'#334155',borderRadius:8}}><Ionicons name="arrow-undo" size={19} color="#fde047"/></Pressable>
     <Pressable accessibilityLabel="Redo" onPress={redoScreen} disabled={!screenRedo.length} style={{padding:6,backgroundColor:'#334155',borderRadius:8,opacity:screenRedo.length?1:.45}}><Ionicons name="arrow-redo" size={19} color="#fde047"/></Pressable>
     <Pressable accessibilityLabel="Close scoring" onPress={()=>{setScoreOpen(false);setMenu(null);setLanding(null);setPreviewResult(null);}} style={{padding:4}}><Ionicons name="close-circle" size={28} color="white"/></Pressable>
    </View>
    <Text style={{color:'#facc15',fontSize:13,fontWeight:'900',marginTop:3}}>INNING {inning} · {side==='away'?'VISITORS':'HOME'}</Text>
   </View>
   <View style={{backgroundColor:'#0f2747',marginHorizontal:10,marginTop:9,borderRadius:9,padding:9}}>
    <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-around'}}><Text style={{color:'#bfdbfe',width:'40%',fontWeight:'900'}}>TEAM</Text>{['R','H','E'].map(x=><Text key={x} style={{color:'#bfdbfe',width:36,textAlign:'center',fontWeight:'900'}}>{x}</Text>)}</View>
    {([{team:doc.away,run:live.awayRuns},{team:doc.home,run:live.homeRuns}]).map(x=><View key={x.team.teamId} style={{flexDirection:'row',justifyContent:'space-around',alignItems:'center',paddingVertical:3}}><Text numberOfLines={1} style={{color:'white',width:'40%',fontWeight:'800'}}>{x.team.teamName}</Text>{[x.run,hitCount(x.team.teamId),errorCount(x.team.teamId)].map((n,i)=><Text key={i} style={{color:'white',width:36,textAlign:'center',fontSize:18,fontWeight:'900'}}>{n}</Text>)}</View>)}
    <Text style={{color:'#fde047',fontWeight:'900',textAlign:'center',marginTop:3}}>INNING {live.inning} · {live.half==='top'?'TOP':'BOTTOM'} · OUTS {live.outs}</Text>
   </View>
   <ScrollView contentContainerStyle={{padding:12,gap:9,alignItems:'stretch'}} keyboardShouldPersistTaps="handled">
    <View style={{alignItems:'center',position:'relative'}}><ScoreSquare large plays={chosen?[chosen]:[]} allEvents={doc.events} onLanding={!chosen&&menu==='inplay'?setLanding:undefined} landing={chosen?undefined:landing} trajectory={trajectory} outsCount={chosen?outAtPlay.get(chosen.id)||0:live.outs} previewResult={chosen?undefined:previewResult==='SAC'&&trajectory==='fly'?'SF':previewResult||undefined} balls={chosen?countAtPlay.get(chosen.id)?.balls||0:live.balls} strikes={chosen?countAtPlay.get(chosen.id)?.strikes||0:live.strikes} rbi={rbis} baseRunners={chosen?[]:baseRunners} onRunnerTap={base=>{if(!active)return;setRunnerBase(base);setRunnerDestination(base as 1|2|3);setRunnerSafe(true);setRunnerChoice(null);setRunnerFielders([]);setMenu('runnerOnly');}} onAbbr={abbr=>{if(chosen){Alert.alert('Recorded play','This play is saved. Historical editing is not yet implemented; use Undo for the most recent event.');return;}const r=abbr==='BT'?'SAC':abbr==='SF'?'SF':abbr==='HP'?'HBP':abbr as PlateAppearanceResult;choose(r);}}/>{!chosen&&showSprayHistory&&!menu&&live.balls===0&&live.strikes===0&&historicalSprays.length>0?<HistoricalSprayOverlay items={historicalSprays} size={350}/>:null}</View>
    <View style={{flexDirection:'row',flexWrap:'wrap',justifyContent:'center',gap:10}}>{([{key:'ball',text:'◯ Ball',color:'#16803c'},{key:'strike',text:'✕ Strike',color:'#c62828'},{key:'foul',text:'Foul',color:'#A47700'},{key:'inplay',text:'In-Play',color:'#16803c'},{key:'out',text:'Out',color:'#c62828'},{key:'other',text:'Misc',color:'#64748b'}] as const).map(a=><Pressable key={a.key} disabled={!active||!!chosen} onPress={()=>{setShowSprayHistory(false);if(a.key==='ball'){void pitch('ball');setMenu(null);}else if(a.key==='strike'){void pitch('calledStrike');}else if(a.key==='foul'){void pitch('foul');setMenu(null);}else if(a.key==='out'){choose('OUT');}else if(a.key==='other'){setMiscOpen(true);}else setMenu(a.key);}} style={{width:'31%',minHeight:68,justifyContent:'center',backgroundColor:a.color,borderRadius:13,paddingVertical:14,alignItems:'center',opacity:!active||!!chosen?.5:1,elevation:2}}><Text style={{fontSize:17,fontWeight:'900',color:'white'}}>{a.text}</Text></Pressable>)}</View>
    {chosen?<View style={{gap:9,alignItems:'center'}}><Text style={{color:INK,textAlign:'center'}}>Saved play · {chosen.result}. Corrections to existing plays are recorded in the audit history.</Text><Pressable disabled={doc.status!=='inProgress'} onPress={openEditSavedPlay} style={[styles.button,{backgroundColor:'#0e5685',padding:14,opacity:doc.status==='inProgress'?1:.5}]}><Text style={styles.white}>Edit Saved Play</Text></Pressable></View>:null}
   </ScrollView>
   {menu&&!chosen?<View style={{position:'absolute',top:0,bottom:0,left:0,right:0,backgroundColor:'#0009',justifyContent:'center',paddingHorizontal:14,paddingVertical:38}}><View style={{backgroundColor:'#f1f9fe',borderRadius:18,maxHeight:'94%',overflow:'hidden',borderWidth:2,borderColor:INK}}>
    <View style={{backgroundColor:INK,padding:14,flexDirection:'row',justifyContent:'space-between',alignItems:'center'}}><Text numberOfLines={1} style={{fontSize:17,fontWeight:'900',color:'white',flex:1}}>{menu==='inplay'?'In-Play Result':menu==='out'?'Out Result':menu==='hitType'?'Hit Type':menu==='fielding'?'Fielding Scenario':menu==='runners'?'Runner Advancement':menu==='runnerOnly'?'Runner Action':menu==='runnerActionOther'?'Other Runner Action':menu==='runnerActionFielding'?'Runner Fielding Scenario':menu==='outOther'?'Other Out Result':menu==='runnerOther'?'Other Advancement':menu==='runnerOut'?'Runner Out — Fielding Scenario':menu==='inplayOther'?'Other Scoring':menu==='strikeout'?'Strikeout': 'Other Scoring'}</Text>{menu==='fielding'?<Pressable accessibilityLabel="Fielding Scenario help" onPress={()=>setFieldingHelpVisible(true)} style={{padding:5}}><Ionicons name="help-circle-outline" size={23} color="white"/></Pressable>:null}<View style={{flexDirection:'row',alignItems:'center',gap:6,marginLeft:5}}><Pressable accessibilityLabel="Undo" onPress={undoScreen} disabled={!screenUndo.length} style={{padding:5,opacity:screenUndo.length?1:.45}}><Ionicons name="arrow-undo" size={20} color="#fde047"/></Pressable><Pressable accessibilityLabel="Redo" onPress={redoScreen} disabled={!screenRedo.length} style={{padding:5,opacity:screenRedo.length?1:.45}}><Ionicons name="arrow-redo" size={20} color="#fde047"/></Pressable><Pressable accessibilityLabel="Close scoring menu" onPress={()=>{setMenu(null);setScreenUndo([]);}}><Ionicons name="close-circle" size={28} color="white"/></Pressable></View></View>
    <ScrollView contentContainerStyle={{padding:14,gap:13,alignItems:'center'}} keyboardShouldPersistTaps="handled">
    {menu==='inplay'?<><Text style={styles.muted}>Select the result of this plate appearance.</Text><View style={{flexDirection:'row',flexWrap:'wrap',justifyContent:'center',gap:9}}>{(menu==='out'?(['OUT','SAC','FC'] as PlateAppearanceResult[]):RESULTS).map(r=><Pressable key={r} style={[styles.chip,{minWidth:'29%',minHeight:54,justifyContent:'center',backgroundColor:'#e1eff9',borderWidth:1,borderColor:RULE}]} onPress={()=>r==='SAC'?openSacrificeChoice('inplay'):r==='HBP'?void recordOtherAward('HBP'):choose(r)}><Text style={[styles.bold,{fontSize:17}]}>{r==='ROE'?'E':r}</Text></Pressable>)}{menu==='out'?<Pressable style={[styles.chip,{minWidth:'29%',minHeight:54,justifyContent:'center',backgroundColor:'#e1eff9'}]} onPress={()=>setMenu('outOther')}><Text style={[styles.bold,{fontSize:17}]}>OTHER</Text></Pressable>:null}{menu==='inplay'?<Pressable style={[styles.chip,{minWidth:'29%',minHeight:54,justifyContent:'center',backgroundColor:'#e1eff9',borderWidth:1,borderColor:RULE}]} onPress={()=>setMenu('inplayOther')}><Text style={[styles.bold,{fontSize:17}]}>OTH</Text></Pressable>:null}</View></>:null}
    {menu==='strikeout'?<><Text style={styles.muted}>Choose the third-strike outcome.</Text>{([{label:'Strikeout Swinging',kind:'swingingStrike',outcome:'swinging'},{label:'Strikeout Looking',kind:'calledStrike',outcome:'looking'},{label:'Dropped Third Strike - Out',kind:'swingingStrike',outcome:'droppedOut'},{label:'Dropped Third Strike - Safe',kind:'swingingStrike',outcome:'droppedSafe'}] as const).map(opt=><Pressable key={opt.outcome} style={[styles.chip,{width:'100%',minHeight:50,justifyContent:'center',alignItems:'center'}]} onPress={()=>void pitch(opt.kind,opt.outcome)}><Text style={[styles.bold,{textAlign:'center',textAlignVertical:'center',includeFontPadding:false}]}>{opt.label}</Text></Pressable>)}</>:null}
    {menu==='inplayOther'?<><Text style={[styles.muted,{textAlign:'center'}]}>Select the special in-play result.</Text><View style={{flexDirection:'row',flexWrap:'wrap',justifyContent:'center',gap:8}}>{([{code:'BB',label:'Walk'},{code:'IBB',label:'Intentional Walk'},{code:'BUNT',label:'Bunt Hit'},{code:'GR2B',label:'Ground Rule Double'},{code:'DP3K',label:'Dropped Third Strike'},{code:'WP3K',label:'Wild Pitch Third Strike'},{code:'COBS',label:'Catcher Obstruction'}] as const).map(item=><Pressable key={item.code} style={[styles.chip,{width:'100%',minHeight:48,justifyContent:'center',backgroundColor:'#e1eff9'}]} onPress={()=>['COBS','BB','IBB','HBP'].includes(item.code)?void recordOtherAward(item.code==='COBS'?'CI':item.code as 'BB'|'IBB'|'HBP'):chooseSpecial(item.code)}><Text style={[styles.bold,{textAlign:'center',fontSize:16}]}>{item.label}</Text></Pressable>)}</View></>:null}
    {menu==='outOther'?<><Text style={[styles.muted,{textAlign:'center'}]}>Select the automatic or special out.</Text><View style={{flexDirection:'row',flexWrap:'wrap',justifyContent:'center',gap:8}}>{([{code:'SACRIFICE',label:'Sacrifice'},{code:"FIELDER'S CHOICE",label:"Fielder's Choice"},{code:'INF',label:'Infield Fly'},{code:'RUN INT',label:'Runner Interference'},{code:'DP3K',label:'Dropped Third Strike'},{code:'LEFT PATH',label:'Outside Base Path'},{code:'HIT BY BALL',label:'Hit by Baseball'},{code:'OUT OF TURN',label:'Out of Turn'},{code:'OUT OF BOX',label:"Out of Batter's Box"},{code:'THROWN BAT',label:'Thrown Bat'},{code:'OTHER',label:'Other Reason'}] as const).map(item=><Pressable key={item.code} style={[styles.chip,{width:'100%',minHeight:48,justifyContent:'center',backgroundColor:'#e2e8f0',borderWidth:1,borderColor:RULE}]} onPress={()=>item.code==='SACRIFICE'?openSacrificeChoice('outOther'):chooseSpecial(item.code,true)}><Text style={[styles.bold,{textAlign:'center',fontSize:16}]}>{item.label}</Text></Pressable>)}</View></>:null}
    {menu==='sacrificeChoice'?<><Text style={[styles.muted,{textAlign:'center'}]}>Choose the sacrifice result, then select Next to draw the ball location on Hit Type.</Text>{([{code:'SACRIFICE FLY',label:'Sacrifice Fly'},{code:'SACRIFICE BUNT',label:'Sacrifice Bunt'}] as const).map(item=><Pressable key={item.code} style={[styles.chip,{width:'100%',minHeight:55,backgroundColor:sacrificeSelection===item.code?INK:'#e2e8f0'}]} onPress={()=>setSacrificeSelection(item.code)}><Text style={{fontWeight:'900',fontSize:16,color:sacrificeSelection===item.code?'white':INK}}>{item.label}</Text></Pressable>)}</>:null}
    {menu==='hitType'?<><Text style={[styles.heading,{textAlign:'center'}]}>In-Play Result: {result==='ROE'?'E':result==='SAC'?'BT':result==='SF'?'SF':result}</Text><Text style={styles.muted}>Choose the hit type and tap the field to mark the ball location.</Text><View style={{flexDirection:'row',justifyContent:'center',gap:6,width:'100%'}}>{(['ground','line','fly'] as const).map(x=><Pressable key={x} disabled={(result==='SAC'||result==='SF')&&(x==='line'||(result==='SAC'&&x==='fly')||(result==='SF'&&x==='ground'))} style={[styles.chip,{flex:1,minHeight:66,paddingHorizontal:3,justifyContent:'center',backgroundColor:(result==='SAC'||result==='SF')&&(x==='line'||(result==='SAC'&&x==='fly')||(result==='SF'&&x==='ground'))?'#cbd5e1':trajectory===x?INK:'#e2e8f0',opacity:(result==='SAC'||result==='SF')&&(x==='line'||(result==='SAC'&&x==='fly')||(result==='SF'&&x==='ground'))?.45:1}]} onPress={()=>{rememberScreen();setTrajectory(x);}}><Text style={{fontWeight:'900',color:trajectory===x?'white':INK,textAlign:'center',fontSize:13,lineHeight:18}}>{x==='ground'?'Ground\nBall':x==='line'?'Line\nDrive':'Fly\nBall'}</Text></Pressable>)}{result==='OUT'?<Pressable style={[styles.chip,{flex:1,minHeight:66,paddingHorizontal:3,justifyContent:'center',backgroundColor:'#e2e8f0',borderWidth:1,borderColor:RULE}]} onPress={()=>setMenu('outOther')}><Text style={{fontWeight:'900',color:INK,textAlign:'center',fontSize:13,lineHeight:18}}>{'Out\nOther'}</Text></Pressable>:null}</View><ScoreSquare compact plays={[]} landing={landing} trajectory={trajectory} previewResult={result==='SAC'&&trajectory==='fly'?'SF':result} onLanding={v=>{rememberScreen();setLanding(v);}}/></>:null}
    {menu==='fielding'?<><Text style={[styles.heading,{textAlign:'center'}]}>{result==='ROE'?'Error: '+(playErrorPosition?'E'+playErrorPosition+' · '+defensePlayer(playErrorPosition):'Select the responsible fielder'):'Fielder(s): '+(fielders.join('–')||'Select Fielders')}</Text><FieldingDiamond sequence={fielders} onSelect={n=>{rememberScreen();if(result==='ROE'){setPlayErrorPosition(n);setFielders([n]);}else setFielders(v=>[...v,n]);}}/></>:null}
    {menu==='runnerOnly'?<><Text style={[styles.heading,{textAlign:'center'}]}>Runner on {runnerBase}B</Text><Text style={[styles.muted,{textAlign:'center'}]}>Select the destination, SAFE or OUT, and the reason. The batter remains at bat.</Text>
    <View style={{flexDirection:'row',justifyContent:'center',gap:6}}>{([1,2,3,4] as const).map(n=><Pressable key={n} style={[styles.chip,{flex:1,minHeight:50,backgroundColor:runnerDestination===n?'#bbf7d0':'#e2e8f0',justifyContent:'center'}]} onPress={()=>setRunnerDestination(n)}><Text style={[styles.bold,{textAlign:'center'}]}>{n===4?'HOME':`${n}B`}</Text></Pressable>)}</View>
    <View style={{flexDirection:'row',gap:8}}>{[true,false].map(v=><Pressable key={String(v)} style={[styles.chip,{flex:1,minHeight:54,justifyContent:'center',alignItems:'center',backgroundColor:runnerSafe===v?(v?'#15803d':'#b91c1c'):(v?'#dcfce7':'#fee2e2'),borderWidth:runnerSafe===v?2:1,borderColor:runnerSafe===v?(v?'#166534':'#991b1b'):'#cbd5e1'}]} onPress={()=>{setRunnerSafe(v);if(!v){setRunnerChoice('OUT');setRunnerFielders([]);setMenu('runnerActionFielding');}}}><Text style={[styles.bold,{textAlign:'center',textAlignVertical:'center',color:runnerSafe===v?'white':v?'#166534':'#991b1b',fontSize:16}]}>{v?'SAFE':'OUT'}</Text></Pressable>)}</View>
    <Text style={[styles.heading,{textAlign:'center'}]}>Runner Action</Text><View style={{flexDirection:'row',flexWrap:'wrap',justifyContent:'center',gap:8}}>{([{label:'Stolen\nBase',code:'SB'},{label:'Caught\nStealing',code:'CS'},{label:'Picked\nOff',code:'PICKED OFF'},{label:'Wild\nPitch',code:'WP'},{label:'Passed\nBall',code:'PB'},{label:'Error',code:'E'},{label:'Pinch\nRunner',code:'PR'},{label:'Courtesy\nRunner',code:'CR'},{label:'Other',code:'OTHER'}] as const).map(a=><Pressable key={a.code} style={[styles.chip,{minWidth:'28%',minHeight:49,justifyContent:'center',backgroundColor:a.code==='CR'?(runnerChoice==='CR'?'#fecaca':'#fee2e2'):runnerChoice===a.code?'#bfdbfe':'#e2e8f0'}]} onPress={()=>void selectedRunnerAction(a.code)}><Text style={[styles.bold,{textAlign:'center',color:a.code==='CR'?'#991b1b':INK}]}>{a.label}</Text></Pressable>)}</View>
    {runnerChoice?<Text style={[styles.muted,{textAlign:'center'}]}>Selected: {runnerChoice}{runnerFielders.length?` (${runnerFielders.join('–')})`:''}</Text>:null}</>:null}
    {menu==='runnerActionOther'?<><Text style={[styles.muted,{textAlign:'center'}]}>Choose the runner movement reason.</Text>{['DEFENSIVE INDIFFERENCE','ON THE THROW','OUT OF PLAY','OBSTRUCTION','BALK'].map(code=><Pressable key={code} style={[styles.chip,{minHeight:48,width:'100%',backgroundColor:runnerChoice===code?'#bfdbfe':'#e2e8f0'}]} onPress={()=>{setRunnerChoice(code);setMenu('runnerOnly');}}><Text style={[styles.bold,{textAlign:'center'}]}>{code}</Text></Pressable>)}</>:null}
    {menu==='runnerActionFielding'?<><Text style={[styles.muted,{textAlign:'center'}]}>{!runnerSafe?'Runner OUT: select fielders involved in order, then Next.':'Tap each defensive position involved, in order.'}</Text><FieldingDiamond sequence={runnerFielders} onSelect={n=>setRunnerFielders(v=>[...v,n])}/><Text style={[styles.heading,{textAlign:'center'}]}>Fielders: {runnerFielders.join('–')||'Select positions'}</Text><Pressable style={styles.chip} onPress={()=>setRunnerFielders(v=>v.slice(0,-1))}><Text style={styles.bold}>Remove Last Fielder</Text></Pressable></>:null}
    {menu==='runners'?<><Text style={[styles.muted,{textAlign:'center'}]}>Choose each runner's destination and reason for advancing.</Text>
    {result==='ROE'&&playErrorPosition?<Text style={[styles.heading,{textAlign:'center',color:'#A47700'}]}>Batter reached on E{playErrorPosition} · {defensePlayer(playErrorPosition)}</Text>:null}
    {advances.map((a,i)=><View key={`${a.playerId}-${i}`} style={{width:'100%',borderWidth:1,borderColor:RULE,borderRadius:10,padding:9,gap:8,backgroundColor:'white'}}>
      <Text style={[styles.heading,{textAlign:'center',fontSize:16}]}>{a.from===0?'BATTER':`${a.from}B RUNNER`}</Text>
      <View style={{flexDirection:'row',flexWrap:'wrap',justifyContent:'center',gap:6}}>{[1,2,3,4].filter(n=>n>a.from||(n===a.from&&a.from>0)).map(n=><Pressable key={n} style={[styles.tiny,{minWidth:68,paddingHorizontal:9,paddingVertical:11,alignItems:'center'},a.to===n&&!a.isOut&&styles.tinyOn]} onPress={()=>setRunner(i,n)}><Text style={[a.to===n&&!a.isOut?styles.white:styles.bold,{fontSize:12}]}>{n===a.from?'Stay':n===4?'Home':`${n}B`}</Text></Pressable>)}<Pressable style={[styles.tiny,{minWidth:68,paddingHorizontal:9,paddingVertical:11,alignItems:'center'},a.isOut&&styles.tinyOut]} onPress={()=>setRunner(i,a.to,!a.isOut)}><Text style={[a.isOut?styles.white:styles.bold,{fontSize:12}]}>OUT</Text></Pressable></View>
      {!a.isOut&&a.to!==a.from&&!(result==='ROE'&&a.from===0)?<View style={{gap:7}}><Text style={[styles.heading,{textAlign:'center',fontSize:14}]}>Advanced By:</Text><View style={{flexDirection:'row',flexWrap:'wrap',justifyContent:'center',columnGap:8,rowGap:8,width:'100%',alignSelf:'center'}}>{([{key:'batter',label:'Batter'},{key:'error',label:'Error'},...(playErrorPosition&&a.from>0?[{key:'same' as const,label:`Same Error E${playErrorPosition}`}]:[]),{key:'throw',label:'The Throw'},{key:'other',label:'Other'}] as const).map(r=><Pressable key={r.key} onPress={()=>setReason(a.playerId,r.key)} style={[styles.chip,{width:'47%',minHeight:42,justifyContent:'center',alignItems:'center',paddingVertical:7,paddingHorizontal:8,backgroundColor:(runnerReasons[a.playerId]||'batter')===r.key?INK:'#e2e8f0'}]}><Text style={{fontWeight:'800',textAlign:'center',fontSize:11,color:(runnerReasons[a.playerId]||'batter')===r.key?'white':INK}}>{r.label}</Text></Pressable>)}</View>{(runnerReasons[a.playerId]==='error'||runnerReasons[a.playerId]==='same')&&runnerErrors[a.playerId]?<Text style={{fontSize:11,color:'#9a3412',fontWeight:'800',textAlign:'center'}}>E{runnerErrors[a.playerId]} · {defensePlayer(runnerErrors[a.playerId])}</Text>:null}</View>:null}
    </View>)}
    <Text style={[styles.heading,{textAlign:'center'}]}>RBI: {autoRbi}</Text>
    </>:null}

    {menu==='runnerOut'&&runnerOutFor?<><Text style={[styles.muted,{textAlign:'center',fontSize:14}]}>How was this runner put out?</Text>
    <View style={{flexDirection:'row',flexWrap:'wrap',justifyContent:'center',gap:7}}>{['Tagged Out','Force Out','Caught Stealing','Picked Off','Double Play','Interference','Other'].map(reason=><Pressable key={reason} style={[styles.chip,{minWidth:'43%',backgroundColor:runnerOutDetails[runnerOutFor]?.reason===reason?'#bfdbfe':'#e2e8f0'}]} onPress={()=>{rememberScreen();setRunnerOutDetails(old=>({...old,[runnerOutFor]:{reason,fielders:reason==='Double Play'?[...fielders]:(old[runnerOutFor]?.fielders||[])}}));if(reason==='Double Play'||reason==='Interference'||reason==='Other'){setRunnerOutFor(null);setMenu('runners');}}}><Text style={[styles.bold,{textAlign:'center'}]}>{reason}</Text></Pressable>)}</View>
    <Text style={[styles.muted,{textAlign:'center'}]}>For a double play, the batter's existing fielding sequence is reused. Do not record the same defensive play twice.</Text>
    {runnerOutDetails[runnerOutFor]?.reason&&['Tagged Out','Force Out','Caught Stealing','Picked Off'].includes(runnerOutDetails[runnerOutFor]?.reason||'')?<>
    <Text style={[styles.heading,{textAlign:'center'}]}>Fielders Involved</Text>
    <Text style={[styles.bold,{textAlign:'center'}]}>Fielder(s) Involved: {runnerOutDetails[runnerOutFor]?.fielders.join('–')||'Select Fielders'}</Text>
    <FieldingDiamond sequence={runnerOutDetails[runnerOutFor]?.fielders||[]} onSelect={n=>{rememberScreen();setRunnerOutDetails(old=>({...old,[runnerOutFor]:{reason:old[runnerOutFor]?.reason||'',fielders:[...(old[runnerOutFor]?.fielders||[]),n]}}));}}/>
    <Pressable style={styles.chip} onPress={()=>{rememberScreen();setRunnerOutDetails(old=>({...old,[runnerOutFor]:{reason:old[runnerOutFor]?.reason||'',fielders:(old[runnerOutFor]?.fielders||[]).slice(0,-1)}}));}}><Text style={styles.bold}>Remove Last Fielder</Text></Pressable>
    </>:null}
    </>:null}
    {menu==='runnerOther'?<><Text style={[styles.muted,{textAlign:'center'}]}>Why did this runner advance?</Text>{['Interference','Obstruction','Defensive Indifference','Wild Pitch','Passed Ball','Balk','Other'].map(reason=><Pressable key={reason} style={[styles.chip,{width:'100%',minHeight:46,backgroundColor:runnerOtherFor&&runnerOtherReasons[runnerOtherFor]===reason?'#bfdbfe':'#e2e8f0'}]} onPress={()=>{rememberScreen();if(runnerOtherFor)setRunnerOtherReasons(v=>({...v,[runnerOtherFor]:reason}));}}><Text style={styles.bold}>{reason}</Text></Pressable>)}</>:null}
    </ScrollView>
    <View style={{flexDirection:'row',gap:10,padding:12,borderTopWidth:1,borderTopColor:RULE,backgroundColor:'white'}}>
      <Pressable style={[styles.button,{flex:1,backgroundColor:'#64748b',minHeight:52,justifyContent:'center'}]} onPress={previousScoringStep}><Text style={[styles.white,{fontSize:17}]}>Back</Text></Pressable>
      <Pressable disabled={busy||menu==='inplayOther'||menu==='outOther'||(menu==='sacrificeChoice'&&!sacrificeSelection)||(menu==='runnerOnly'&&!runnerChoice)||(menu==='runnerOut'&&(!runnerOutFor||!runnerOutDetails[runnerOutFor]?.reason))||(menu==='runnerOther'&&(!runnerOtherFor||!runnerOtherReasons[runnerOtherFor]))} style={[styles.button,{flex:1,minHeight:52,justifyContent:'center',opacity:busy?.5:1}]} onPress={()=>{
        if(menu==='sacrificeChoice'&&sacrificeSelection){chooseSpecial(sacrificeSelection,sacrificeSource==='outOther');}
        else if(menu==='hitType'){if(result==='HR')void record();else if(!['OUT','FC','ROE','SAC','SF','K'].includes(result)&&!live.bases.some(Boolean))void record();else continueScoring(['OUT','FC','ROE','SAC','SF','K'].includes(result)?'fielding':'runners');}
        else if(menu==='fielding'){if(!live.bases.some(Boolean))void record();else continueScoring('runners');}
        else if(menu==='runnerOut'){setRunnerOutFor(null);setMenu('runners');}
        else if(menu==='runners')void record();
        else if(menu==='runnerOther'){setRunnerOtherFor(null);setMenu('runners');}
        else if(menu==='runnerOnly')void saveSelectedRunnerAction();
        else if(menu==='runnerActionFielding'){if(!runnerFielders.length){Alert.alert('Fielding Action','Select the fielder or fielders involved.');return;}if(!runnerSafe&&!runnerChoice)setRunnerChoice('OUT');setMenu('runnerOnly');}
      }}><Text style={[styles.white,{fontSize:17}]}>{menu==='runners'||menu==='runnerOnly'||(menu==='hitType'&&(result==='HR'||(!['OUT','FC','ROE','SAC','SF','K'].includes(result)&&!live.bases.some(Boolean))))||(menu==='fielding'&&!live.bases.some(Boolean))?'Done':'Next'}</Text></Pressable>
    </View></View></View>:null}
  </View></Modal>
   <Modal visible={courtesyInfoVisible} transparent animationType="fade" onRequestClose={()=>setCourtesyInfoVisible(false)}>
    <View style={{flex:1,backgroundColor:'#0009',justifyContent:'center',padding:20}}>
     <View style={{backgroundColor:'white',padding:20,borderRadius:16,gap:12}}>
      <Text style={[styles.heading,{textAlign:'center',fontSize:21}]}>Courtesy Runner</Text>
      <Text style={[styles.muted,{textAlign:'center'}]}>Most recent outs for the runner's team, including earlier innings:</Text>
      <Pressable onPress={()=>{setRunnerCourtesy(recentOutNames[0]||null);setRunnerCourtesyId(recentOutIds[0]||null);}} disabled={!recentOutNames[0]} style={[styles.chip,{backgroundColor:runnerCourtesyId===recentOutIds[0]?'#dbeafe':'#f1f5f9',padding:13}]}><Text style={{color:INK,fontSize:16,fontWeight:'800'}}>Last Out: {recentOutNames[0]||'None recorded'}</Text></Pressable>
      <Pressable onPress={()=>{setRunnerCourtesy(recentOutNames[1]||null);setRunnerCourtesyId(recentOutIds[1]||null);}} disabled={!recentOutNames[1]} style={[styles.chip,{backgroundColor:runnerCourtesyId===recentOutIds[1]?'#dbeafe':'#f1f5f9',padding:13}]}><Text style={{color:INK,fontSize:16,fontWeight:'800'}}>2nd Out: {recentOutNames[1]||'None recorded'}</Text></Pressable>
      <Text style={[styles.muted,{textAlign:'center'}]}>Selected player: {runnerCourtesy||'None'}. This records a Play-by-Play note only. No runner, lineup, score, or statistics are changed.</Text>
      {courtesyError?<Text style={{color:'#b91c1c',fontWeight:'800',textAlign:'center'}}>{courtesyError}</Text>:null}
      <View style={{flexDirection:'row',gap:10,marginTop:4}}>
       <Pressable onPress={()=>{setCourtesyInfoVisible(false);setRunnerCourtesy(null);setRunnerCourtesyId(null);setCourtesyConfirmed(false);}} style={[styles.button,{flex:1,backgroundColor:'#475569',minHeight:48}]}><Text style={styles.white}>Cancel</Text></Pressable>
       <Pressable disabled={!runnerCourtesyId||courtesySaving} onPress={()=>void saveCourtesyRunner()} style={[styles.button,{flex:1,backgroundColor:'#15803d',minHeight:48,opacity:runnerCourtesyId?1:.45}]}><Text style={styles.white}>{courtesySaving?'Saving…':'Confirm'}</Text></Pressable>
      </View>
     </View>
    </View>
   </Modal>
      <Modal visible={swapOpen} transparent animationType="fade" onRequestClose={()=>{if(!swapBusy)setSwapOpen(false);}}><View style={{flex:1,backgroundColor:'#000a',justifyContent:'center',padding:20}}><View style={{backgroundColor:'white',borderRadius:16,padding:20,gap:15}}><Text style={[styles.heading,{fontSize:21,textAlign:'center'}]}>Confirm Official Home / Visitor</Text><Text style={{color:INK,textAlign:'center',fontSize:15,lineHeight:23}}>Visitor: {doc.home.teamName}{'\n'}Home: {doc.away.teamName}</Text><Text style={[styles.muted,{textAlign:'center',fontSize:13,lineHeight:20}]}>This change will be saved for BOTH managers. Each manager keeps their own scorebook. The opponent must reopen Score Game to see the update. Swapping is blocked once either team has started scoring.</Text><View style={{flexDirection:'row',gap:10}}><Pressable disabled={swapBusy} style={[styles.button,{flex:1,backgroundColor:'#64748b'}]} onPress={()=>setSwapOpen(false)}><Text style={styles.white}>Cancel</Text></Pressable><Pressable disabled={swapBusy} style={[styles.button,{flex:1,backgroundColor:'#1d4ed8'}]} onPress={()=>void confirmSwapHomeAway()}><Text style={styles.white}>{swapBusy?'Saving…':'Save Assignment'}</Text></Pressable></View></View></View></Modal>
      <Modal visible={!!confirmAction&&!postgameOpen&&!optionsOpen} transparent animationType="none" onRequestClose={()=>{if(!confirmBusy){setConfirmAction(null);setResetPhrase('');}}}><View style={{flex:1,backgroundColor:'#000b',justifyContent:'center',padding:20}}><View style={{backgroundColor:'white',borderRadius:18,padding:20,gap:14,borderWidth:confirmAction==='reset'?3:2,borderColor:confirmAction==='reset'?'#b91c1c':INK}}><View style={{alignItems:'center',gap:8}}><Ionicons name={confirmAction==='reset'?'warning-outline':confirmAction==='end'?'flag-outline':confirmAction==='start'?'play-circle-outline':'create-outline'} size={48} color={confirmAction==='reset'||confirmAction==='end'?'#b91c1c':INK}/><Text style={[styles.heading,{fontSize:21,textAlign:'center',color:confirmAction==='reset'?'#b91c1c':INK}]}>{confirmAction==='reset'?'WARNING: ALL SCOREBOOK DATA WILL BE ERASED':confirmAction==='end'?'End Game?':confirmAction==='start'?'Start Game?':'Reopen Game for Editing?'}</Text><Text style={[styles.muted,{textAlign:'center',fontSize:14,lineHeight:21}]}>{confirmAction==='reset'?'This permanently clears ALL recorded plays, pitches, innings, runs, outs, substitutions and game statistics from YOUR TEAM’S scorebook for this game. A server archive is retained for recovery by an administrator. The opponent’s scorebook and saved Game Lineup Builder lineups are NOT erased.':confirmAction==='end'?'Open the Postgame Summary to review statistics and pitching decisions before finalizing?':confirmAction==='start'?'Begin scoring this game?':'Reopen this completed game for corrections? This change will be logged locally.'}</Text></View>{confirmAction==='reset'?<View style={{gap:6}}><Text style={{fontWeight:'900',color:'#991b1b',textAlign:'center'}}>Type RESET below to unlock the erase button</Text><TextInput autoCapitalize="characters" autoCorrect={false} value={resetPhrase} onChangeText={setResetPhrase} placeholder="Type RESET" style={[styles.input,{borderWidth:2,borderColor:'#b91c1c',textAlign:'center',fontWeight:'800'}]}/></View>:null}<View style={{flexDirection:'row',gap:10}}><Pressable disabled={confirmBusy} style={[styles.button,{flex:1,backgroundColor:'#64748b',minHeight:56,alignItems:'center',justifyContent:'center'}]} onPress={()=>{setConfirmAction(null);setResetPhrase('');}}><Text style={styles.white}>Cancel</Text></Pressable><Pressable disabled={confirmBusy||(confirmAction==='reset'&&resetPhrase.trim().toUpperCase()!=='RESET')} style={[styles.button,{flex:1,backgroundColor:confirmAction==='reset'||confirmAction==='end'?'#b91c1c':'#15803d',opacity:confirmBusy||(confirmAction==='reset'&&resetPhrase.trim().toUpperCase()!=='RESET')?.35:1,minHeight:56,alignItems:'center',justifyContent:'center'}]} onPress={()=>void confirmGameAction()}><Text style={[styles.white,{textAlign:'center',fontSize:14}]}>{confirmBusy?'Working...':confirmAction==='reset'?'ERASE SCOREBOOK':confirmAction==='end'?'Review Postgame':confirmAction==='start'?'Start Game':'Reopen'}</Text></Pressable></View></View></View></Modal>
      <Modal visible={!!errorFor} transparent animationType="fade" onRequestClose={()=>setErrorFor(null)}><View style={{flex:1,backgroundColor:'#0009',justifyContent:'center',padding:14}}><View style={{backgroundColor:'white',borderRadius:14,padding:12,alignItems:'center',gap:8}}><Text style={styles.heading}>Defensive Error</Text><FieldingDiamond sequence={[]} onSelect={n=>{if(errorFor)setRunnerErrors(v=>({...v,[errorFor]:n}));setErrorFor(null);}}/><Text style={[styles.muted,{textAlign:'center'}]}>Touch the player who made the error.</Text><Pressable style={[styles.chip,{width:'100%'}]} onPress={()=>{setErrorFor(null);}}><Text style={styles.bold}>Cancel</Text></Pressable></View></View></Modal>
 </View>;
}
const styles=StyleSheet.create({screen:{flex:1,backgroundColor:'#e7edf4'},center:{flex:1,justifyContent:'center',alignItems:'center',padding:24},header:{backgroundColor:'#0f2747',paddingTop:48,paddingBottom:14,paddingHorizontal:12,flexDirection:'row',alignItems:'center',gap:9},back:{padding:8},title:{fontSize:19,fontWeight:'900',color:'white'},sub:{fontSize:11,color:'#dbeafe'},headerBtn:{backgroundColor:'#1d4ed8',padding:10,borderRadius:8},content:{padding:12,paddingBottom:70,gap:11},scoreline:{backgroundColor:'white',borderRadius:8,padding:12,gap:5},bold:{fontWeight:'800',color:'#183153'},white:{color:'white',fontWeight:'800'},muted:{fontSize:12,color:'#64748b'},heading:{fontSize:16,fontWeight:'900',color:'#183153'},button:{backgroundColor:'#15803d',borderRadius:8,padding:13,alignItems:'center'},paper:{backgroundColor:'#fffdf4',borderColor:'#c9bea3',borderWidth:1,borderRadius:8,padding:10,gap:9},pager:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'},nav:{backgroundColor:'white',padding:10,borderRadius:7},tabs:{flexDirection:'row',gap:6},tab:{flex:1,padding:11,alignItems:'center',backgroundColor:'white',borderRadius:7},tabActive:{backgroundColor:'#1d4ed8'},gridHeader:{flexDirection:'row',paddingBottom:6,borderBottomWidth:2,borderBottomColor:'#a99b7a'},playerRow:{flexDirection:'row',minHeight:74,borderBottomWidth:1,borderBottomColor:'#d9ceb1',alignItems:'center'},currentRow:{backgroundColor:'#e0efff'},player:{flex:1,fontSize:13,fontWeight:'700',paddingHorizontal:4,color:'#183153'},cell:{width:102,height:73,borderLeftWidth:1,borderColor:'#c9bea3',alignItems:'center',justifyContent:'space-around'},activeCell:{borderWidth:2,borderColor:'#2563eb'},cellLabel:{fontSize:9,color:'#64748b'},miniDiamond:{width:32,height:30,justifyContent:'center',alignItems:'center'},miniText:{fontSize:25,color:'#1e3a8a'},cellResult:{fontSize:11,fontWeight:'800',color:'#183153'},largeCard:{minHeight:190,flexDirection:'row',borderWidth:2,borderColor:'#b8ab8b',backgroundColor:'#fffef7',padding:9},abbreviations:{width:40,justifyContent:'space-around',alignItems:'center'},diamondArea:{flex:1,justifyContent:'center',alignItems:'center',gap:7},bigDiamond:{height:90,justifyContent:'center'},diamondGlyph:{fontSize:83,color:'#1e3a8a',lineHeight:95},count:{fontSize:12,fontWeight:'700'},toolbar:{flexDirection:'row',gap:3},tool:{flex:1,backgroundColor:'white',paddingVertical:13,paddingHorizontal:2,borderRadius:7,alignItems:'center',borderWidth:1,borderColor:'#cbd5e1'},toolActive:{backgroundColor:'#dbeafe',borderColor:'#2563eb'},toolText:{fontSize:11,fontWeight:'900',color:'#183153'},wrap:{flexDirection:'row',flexWrap:'wrap',gap:6},chip:{paddingHorizontal:11,paddingVertical:10,backgroundColor:'#e2e8f0',borderRadius:7,minWidth:42,alignItems:'center',justifyContent:'center',borderWidth:1,borderColor:'#93c5fd'},selected:{backgroundColor:'#1d4ed8'},label:{fontWeight:'800',color:'#334155',marginTop:5},fielder:{backgroundColor:'#dbeafe',padding:10,minWidth:38,alignItems:'center',borderRadius:7},runner:{flexDirection:'row',gap:4,alignItems:'center'},tiny:{padding:9,backgroundColor:'#e2e8f0',borderRadius:6},tinyOn:{backgroundColor:'#15803d'},tinyOut:{backgroundColor:'#b91c1c'},field:{height:160,width:260,alignSelf:'center',backgroundColor:'#e0f0dc',borderWidth:1,borderColor:'#7b9c6d',borderRadius:9,justifyContent:'space-around',alignItems:'center'},fieldText:{fontSize:10,color:'#355a30'},fieldArt:{fontSize:30,color:'#507b4a'},stat:{flexDirection:'row',borderBottomWidth:1,borderBottomColor:'#ddd',paddingVertical:7},input:{backgroundColor:'white',borderColor:'#cbd5e1',borderWidth:1,borderRadius:7,padding:12},warning:{fontSize:11,color:'#92400e',lineHeight:17}});
