/** NTABL printable scorecard. HTML/CSS-only diamonds avoid Android SVG print instability.
 * Drop-in replacement for Phase 78; preserves the public export signature.
 */
export function buildTraditionalScorebookHtml(doc:any, battingStats:(pid:string,teamId:string)=>any, decisions:{win?:string;loss?:string;save?:string}):string {
 const esc=(v:any)=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'} as any)[c]);
 const events:any[]=Array.isArray(doc.events)?doc.events:[];
 const pa=events.filter(e=>e.kind==='plateAppearance'&&e.specialResult!=='SKIP_BATTER');
 const maxInn=Math.max(1,...pa.map(e=>Number(e.inning)||1));
 const playerList=[doc.away,doc.home].flatMap((t:any)=>(t?.slots||[]).flatMap((s:any)=>s.appearances||[]));
 const playerName=(id:any)=>playerList.find((p:any)=>p.player?.id===id)?.player?.name||'';
 const isHit=(e:any)=>['1B','2B','3B','HR'].includes(e.result);
 const scoreEvents=events.filter(e=>e.kind==='plateAppearance'||e.kind==='runner');
 const teamRuns=(id:string,inning?:number)=>scoreEvents.filter(e=>e.battingTeamId===id&&(inning===undefined||Number(e.inning)===inning)).reduce((n,e)=>n+(Number(e.runsOnPlay)||0),0)+(inning===undefined?((doc as any).scoreAdjustments||[]).reduce((n:number,a:any)=>n+(Number(id===doc.awayTeamId?a.away:a.home)||0),0):0);
 const hitCount=(id:string,inning?:number)=>pa.filter(e=>e.battingTeamId===id&&(inning===undefined||Number(e.inning)===inning)&&isHit(e)).length;
 const runnerHistory=(pid:string,seq:number)=>events.filter(e=>Number(e.sequence)>=seq).flatMap(e=>e.runners||[]).filter((r:any)=>r.playerId===pid);
 const readableReason=(v:any)=>String(v||'').replace(/([a-z])([A-Z])/g,'$1 $2').replace(/[_-]/g,' ').trim();
 const scoredNames=(e:any)=>Array.from(new Set((e.runners||[]).filter((r:any)=>Number(r.to)===4&&!r.isOut).map((r:any)=>playerName(r.playerId)||r.playerName||'').filter(Boolean)));
 const playDetails=(e:any)=>{
  const parts:string[]=[];
  const scorers=scoredNames(e);
  if(scorers.length)parts.push(`${scorers.join(', ')} Scored`);
  const errorPositions=new Set<string>();
  if(e.errorPosition)errorPositions.add(String(e.errorPosition));
  (e.runnerDetails||[]).forEach((r:any)=>{if(r.errorPosition)errorPositions.add(String(r.errorPosition));});
  if(e.result==='ROE'&&!errorPositions.size)parts.push('Reached on error');
  errorPositions.forEach(p=>parts.push(`Error E${p}`));
  if(e.kind==='runner'){
   const a=String(e.action||'').toUpperCase();
   if(a==='SB'||a==='STOLEN_BASE'||a==='STOLENBASE')parts.push('Stolen base');
   else if(a==='CS')parts.push('Caught stealing');
   else if(a==='WP')parts.push('Wild pitch');
   else if(a==='PB')parts.push('Passed ball');
   else if(a==='BK')parts.push('Balk');
   else if(a==='PO')parts.push('Pickoff');
   else if(a&&a!=='E')parts.push(readableReason(e.action));
  }
  (e.runnerDetails||[]).forEach((r:any)=>{
   if(r.isOut){const who=playerName(r.playerId);const fs=(r.outFielders||[]).join('-');parts.push(`${who||'Runner'} Out${fs?' ('+fs+')':''}`);}
   else if(r.reason&&r.reason!=='batter'&&r.reason!=='same'&&r.reason!=='error')parts.push(`${playerName(r.playerId)||'Runner'}: ${readableReason(r.reason)}`);
   if(r.otherReason)parts.push(String(r.otherReason));
  });
  const fielders=(e.fielders||e.spray?.fielders||[]).join('-');
  if(fielders&&!(String(e.notation||'').includes(fielders)))parts.push(`Fielding: ${fielders}`);
  if(e.notes)parts.push(String(e.notes));
  return Array.from(new Set(parts)).join(' · ');
 };
 const outNumber=(e:any)=>{
  if(e.outNumber!==undefined&&e.outNumber!==null)return Number(e.outNumber);
  if(e.outsAfter!==undefined&&e.outsAfter!==null)return Number(e.outsAfter);
  const prior=events.filter(x=>Number(x.sequence)<=Number(e.sequence)&&x.half===e.half&&Number(x.inning)===Number(e.inning)&&x.battingTeamId===e.battingTeamId);
  const n=prior.reduce((total,x)=>total+(Number(x.outsOnPlay)||0),0);
  return n>0&&n<=3?n:null;
 };
 // Mirror the app's recorded pitch-count rules for each completed plate appearance.
 const countAtPlay=new Map<any,{balls:number;strikes:number}>();
 let countedBalls=0,countedStrikes=0;
 for(const event of events){
  if(event.kind==='pitch'){
   if(event.pitch==='ball')countedBalls=Math.min(4,countedBalls+1);
   if(['calledStrike','swingingStrike','foulBunt'].includes(event.pitch))countedStrikes=Math.min(3,countedStrikes+1);
   if(event.pitch==='foul'&&countedStrikes<2)countedStrikes++;
  }else if(event.kind==='plateAppearance'){
   countAtPlay.set(event.id,{balls:countedBalls,strikes:countedStrikes});
   countedBalls=0;countedStrikes=0;
  }
 }
 const pitchDots=(e:any)=>{
  const count=countAtPlay.get(e.id)||{balls:0,strikes:0};
  return `<span class="pitchdots" aria-label="${count.balls} balls, ${count.strikes} strikes"><span class="dotrow">${Array.from({length:3},(_,i)=>`<i class="dot ${i<count.balls?'ball':''}"></i>`).join('')}</span><span class="dotrow">${Array.from({length:2},(_,i)=>`<i class="dot ${i<count.strikes?'strike':''}"></i>`).join('')}</span></span>`;
 };
 const renderCell=(e:any)=>{
  const seq=Number(e.sequence)||0;
  const advances=runnerHistory(e.playerId,seq);
  // Circle an out only when THIS recorded play makes an out, not when this runner is retired later.
   const runnerOutEvent=events.find(x=>Number(x.sequence)>=seq&&(x.kind==='plateAppearance'||x.kind==='runner')&&(x.runners||[]).some((r:any)=>r.playerId===e.playerId&&r.isOut));
   const runnerOutAdvance=runnerOutEvent?.runners?.find((r:any)=>r.playerId===e.playerId&&r.isOut);
   const runnerOutNumber=runnerOutEvent?Math.min(3,events.filter(x=>(x.kind==='plateAppearance'||x.kind==='runner')&&x.inning===runnerOutEvent.inning&&x.half===runnerOutEvent.half&&x.battingTeamId===runnerOutEvent.battingTeamId&&Number(x.sequence)<Number(runnerOutEvent.sequence)).reduce((n,x)=>n+(Number(x.outsOnPlay)||0),0)+1):0;
   const batterOut=!!(e.runners||[]).some((r:any)=>r.playerId===e.playerId&&r.isOut);
   const batterOutNumber=batterOut?outNumber(e):0;
   const out=!!(batterOut||runnerOutAdvance);
  const scored=advances.some((r:any)=>Number(r.to)===4&&!r.isOut);
  const maxBase=Math.max(0,...advances.filter((r:any)=>!r.isOut).map((r:any)=>Number(r.to)||0));
  const first=e.runners?.find((r:any)=>r.playerId===e.playerId);
  const atLeast=Math.max(maxBase,first&&!first.isOut?Number(first.to)||0:0);
  const runnerMarks=events.filter(x=>x.kind==='runner'&&Number(x.sequence)>=seq&&((x.runners||[]).some((r:any)=>r.playerId===e.playerId)||(x.runnerDetails||[]).some((r:any)=>r.playerId===e.playerId))).map(x=>String(x.action||'').toUpperCase()).filter(x=>['SB','STOLEN_BASE','STOLENBASE','CS','CAUGHT_STEALING'].includes(x)).map(x=>x.startsWith('S')?'SB':'CS');
  const runnerMarkText=Array.from(new Set(runnerMarks)).join('/');
  const notation=String(e.notation||e.result||'');
  const fielderSequence=Array.isArray(e.fielders)?e.fielders.join('-'):(Array.isArray(e.spray?.fielders)?e.spray.fielders.join('-'):'');
  // Use the same scorekeeping abbreviations as the on-screen scoring workflow.
  // Preserve explicit multi-fielder sequences and double-play notations.
  const trajectory=String(e.trajectory||'').toLowerCase();
  const outNotation=e.result==='OUT'&&fielderSequence&&!/^(DP|F\d|L\d|P\d)/i.test(notation)
   ?(trajectory==='fly'?`F${fielderSequence}`:trajectory==='line'?`L${fielderSequence}`:trajectory==='pop'?`P${fielderSequence}`:fielderSequence)
   :notation;
  const title=fielderSequence&&!outNotation.includes(fielderSequence)&&['OUT','FC','SAC','SF'].includes(e.result)?`${outNotation==='OUT'?'':outNotation+' '}${fielderSequence}`:outNotation;
  const color=out||['K','OUT','SAC','SF'].includes(e.result)?'red':e.result==='ROE'?'amber':'green';
  const track=`${atLeast>=1?' b1':''}${atLeast>=2?' b2':''}${atLeast>=3?' b3':''}${atLeast>=4?' b4':''}`;
  const result=e.result==='K'&&e.strikeoutLooking?'ꓘ':e.result;
  const leftLabels=['1B','2B','3B','HR'];
  const rightLabels=['BB','HBP','BT','SF','FC'];
  const circleResult=(label:string)=>label===String(result)||(label==='BT'&&e.result==='SAC'&&trajectory!=='fly')||(label==='BB'&&e.result==='IBB');
  const resultColumns=`<div class="resultcol left">${leftLabels.map(label=>`<span class="resultlabel ${circleResult(label)?'selected':''}">${label}</span>`).join('')}</div><div class="resultcol right">${rightLabels.map(label=>`<span class="resultlabel ${circleResult(label)?'selected':''}">${label}</span>`).join('')}</div>`;
  const error=e.result==='ROE'?'E':(e.runnerDetails||[]).filter((r:any)=>r.errorPosition).map((r:any)=>`E${r.errorPosition}`).join(' ');
  const rbi=Number(e.rbis)||0;
  const spray=e.spray?.landing;
  // Draw the spray as a short CSS segment, never an SVG (Android print compatibility).
  const sprayX=spray?Math.max(0,Math.min(1,Number(spray.x)||0)):0;
  const sprayY=spray?Math.max(0,Math.min(1,Number(spray.y)||0)):0;
  const dx=(sprayX-.5)*40,dy=-9-sprayY*14;
  const sprayLength=Math.sqrt(dx*dx+dy*dy);
  const sprayAngle=Math.atan2(dy,dx)*180/Math.PI;
  const sprayLine=spray?`<i class="sprayline" style="width:${sprayLength.toFixed(2)}px;transform:rotate(${sprayAngle.toFixed(1)}deg)"></i><i class="spraypoint" style="left:calc(50% + ${dx.toFixed(2)}px);top:calc(54% + ${dy.toFixed(2)}px)"></i>`:'';
  const stopMark=atLeast>0&&atLeast<4&&!scored&&!runnerOutAdvance?`<i class="stopmark stop${atLeast}"></i>`:'';
  const cutdown=runnerOutAdvance&&Number(runnerOutAdvance.from)>0&&Number(runnerOutAdvance.from)<4?`<i class="cutdown cutdown${Number(runnerOutAdvance.from)}"><i></i></i>`:'';
  const runnerLabel=runnerMarkText?`<span class="runnermark">${esc(runnerMarkText)}</span>`:'';
  return `<div class="play ${color}">${resultColumns}<div class="fieldlines"><i class="foul foulleft"></i><i class="foul foulright"></i></div><div class="diamond ${scored?'scored':''}${track}"><i class="side side1"></i><i class="side side2"></i><i class="side side3"></i><i class="side side4"></i>${cutdown}</div>${runnerLabel}${sprayLine}<span class="notation">${esc(['1B','2B','3B','HR','BB','IBB','HBP','FC','SF'].includes(String(result))?'':title)}</span>${rbi?`<span class="rbimark">${rbi} RBI</span>`:''}${pitchDots(e)}${out?`<span class="outmark">${batterOutNumber||runnerOutNumber||'O'}</span>`:''}${error?`<span class="errornote">${esc(error)}</span>`:''}</div>`;
 };
 // Allocate a distinct column for each pass through the batting order in an inning.
 // The next inning must never be displaced into a continuation of the previous one.
 type InningColumn={inning:number;pass:number};
 const inningColumns=(team:any):InningColumn[]=>{
  const slots=team.slots||[];
  const cols:InningColumn[]=[];
  for(let inning=1;inning<=Math.max(9,maxInn);inning++){
   const maxPass=Math.max(1,...slots.map((slot:any)=>{
    const ids=new Set((slot.appearances||[]).map((a:any)=>a.player?.id));
    return pa.filter(e=>e.battingTeamId===team.teamId&&Number(e.inning)===inning&&ids.has(e.playerId)).length;
   }));
   for(let pass=0;pass<maxPass;pass++)cols.push({inning,pass});
  }
  return cols;
 };
 // Traditional paper-scorebook layout: always print nine fixed-width inning
 // boxes per sheet, including unused innings. Batting-around passes get their
 // own boxes and shift later innings to the right; continuation pages are also
 // padded to nine boxes rather than stretching the final column.
 const PAGE_COLUMNS=9;
 const chunks=(cols:InningColumn[])=>Array.from({length:Math.ceil(cols.length/PAGE_COLUMNS)},(_,i)=>{
  const page=cols.slice(i*PAGE_COLUMNS,(i+1)*PAGE_COLUMNS);
  while(page.length<PAGE_COLUMNS)page.push({inning:0,pass:0});
  return page;
 });
 const teamPage=(team:any,cols:InningColumn[],pageNo:number)=>{
  const slots=team.slots||[];
  const rows=slots.map((slot:any,index:number)=>{
   const appearances=slot.appearances||[];
   const current=appearances[appearances.length-1];
   const playerIds=new Set(appearances.map((a:any)=>a.player?.id));
   const entries=pa.filter(e=>e.battingTeamId===team.teamId&&playerIds.has(e.playerId));
   const nameLines=appearances.map((a:any,j:number)=>`<div class="person ${j?'replacement':''}">${esc(a.player?.jerseyNumber||'')} ${esc(a.player?.name||'')}${j?'<span class="subtag">SUB</span>':''}</div>`).join('');
   const cells=cols.map(({inning,pass})=>{
    const plays=entries.filter(e=>Number(e.inning)===inning);
    const play=plays[pass];
    const inningPAs=pa.filter(e=>e.battingTeamId===team.teamId&&Number(e.inning)===inning);
    const last=inningPAs[inningPAs.length-1];
    const inningEvents=events.filter(e=>e.battingTeamId===team.teamId&&Number(e.inning)===inning&&(e.kind==='plateAppearance'||e.kind==='runner'));
    const ended=inningEvents.reduce((n,e)=>n+(Number(e.outsOnPlay)||0),0)>=3;
    const isFinal=!!play&&!!last&&play.id===last.id&&ended;
    return `<td class="scorecell ${isFinal?'inning-end':''}">${play?renderCell(play):'<div class="empty"><div class="emptydiamond"></div><span class="pitchdots"><span class="dotrow"><i class="dot"></i><i class="dot"></i><i class="dot"></i></span><span class="dotrow"><i class="dot"></i><i class="dot"></i></span></span></div>'}</td>`;
   }).join('');
   return `<tr><td class="order">${index+1}</td><td class="name">${nameLines}</td><td class="pos">${esc(current?.position||'—')}</td><td class="entered">${esc(appearances[0]?.enteredAtEvent===0?'1':appearances[0]?.enteredAtEvent??'')}</td>${cells}</tr>`;
  }).join('');
  const foot=cols.map(({inning,pass})=>`<td>${inning>0&&pass===0?`${teamRuns(team.teamId,inning)} / ${hitCount(team.teamId,inning)}`:'—'}</td>`).join('');
  return `<section class="sheet"><div class="game">${esc(doc.away.teamName)} at ${esc(doc.home.teamName)} <span>NTABL · ${doc.status==='final'?'FINAL':'IN PROGRESS'}</span></div><div class="heading"><div class="team">${esc(team.teamName)}</div><div class="summary"><div>RUNS <strong>${teamRuns(team.teamId)}</strong></div><div>HITS <strong>${hitCount(team.teamId)}</strong></div></div></div><table class="book"><colgroup><col style="width:3%"><col style="width:14%"><col style="width:3%"><col style="width:3%">${cols.map(()=>`<col style="width:${77/PAGE_COLUMNS}%">`).join('')}</colgroup><thead><tr><th>#</th><th>PLAYER</th><th>POS</th><th>INN</th>${cols.map(({inning})=>`<th>${inning||''}</th>`).join('')}</tr></thead><tbody>${rows}</tbody><tfoot><tr><th colspan="4">RUNS / HITS</th>${foot}</tr></tfoot></table><div class="footer">NTABL SCOREBOOK · ${esc(team.teamName)} · ${pageNo>1?'CONTINUED · ':''}Owner: ${esc(doc.ownerTeamId===doc.awayTeamId?doc.away.teamName:doc.home.teamName)}</div></section>`;
 };
 const sheets=[doc.away,doc.home].flatMap((t:any)=>chunks(inningColumns(t)).map((cols,i)=>teamPage(t,cols,i+1)));
 const named=(id?:string)=>id?playerName(id)||'Unidentified':'Not selected';
 const decisionRows=events.filter(e=>['plateAppearance','runner','lineupChange'].includes(e.kind)).map(e=>{
  const rbi=e.kind==='plateAppearance'&&Number.isFinite(Number(e.rbis))?Number(e.rbis):null;
  const outs=Number(e.outsOnPlay)||0;
  const play=String(e.notation||e.result||e.action||'');
  const details=playDetails(e);
  return `<tr><td class="inning">${esc(e.half==='bottom'?'B':'T')}${esc(e.inning||'')}</td><td>${esc(e.battingTeamId===doc.awayTeamId?doc.away.teamName:doc.home.teamName)}</td><td>${esc(playerName(e.playerId)||e.player?.name||'')}</td><td class="playcode">${esc(play)}${outs?` <span class="outcircle">${esc(outNumber(e)||outs)}</span>`:''}</td><td class="rbi">${rbi===null?'—':rbi}</td><td class="detailtext">${esc(details)}</td></tr>`;
 }).join('');
 const decisionSheet=`<section class="sheet report"><div class="game">NTABL · POSTGAME REPORT</div><h2>${esc(doc.away.teamName)} at ${esc(doc.home.teamName)}</h2><div class="decision"><div>Winning Pitcher<strong>${esc(named(decisions.win))}</strong></div><div>Losing Pitcher<strong>${esc(named(decisions.loss))}</strong></div><div>Save<strong>${esc(named(decisions.save))}</strong></div></div><h3>Game Play-by-Play</h3><table class="history"><colgroup><col style="width:8%"><col style="width:19%"><col style="width:19%"><col style="width:11%"><col style="width:6%"><col style="width:37%"></colgroup><thead><tr><th>INNING</th><th>TEAM</th><th>PLAYER</th><th>PLAY</th><th>RBI</th><th>DETAILS</th></tr></thead><tbody>${decisionRows}</tbody></table><p class="footnote">Play details and RBI totals reflect recorded scoring events. Pitcher-by-pitcher totals are omitted unless reliable pitcher attribution is available.</p></section>`;
 return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>NTABL Scorebook</title><style>
 @page{size:landscape;margin:6mm}*{box-sizing:border-box}html,body{margin:0;padding:0;color:#222;font-family:Arial,Helvetica,sans-serif;font-size:9px} .sheet{page-break-after:always;break-after:page;width:100%;padding:1mm 0}.sheet:last-child{page-break-after:auto;break-after:auto}.game{font-size:9px;margin-bottom:4px;color:#343434}.game span{float:right}.heading{display:flex;align-items:stretch;border:1px solid #0e5685;border-bottom:0;height:39px}.team{font-size:19px;font-weight:700;flex:1;padding:8px}.summary{display:flex}.summary>div{width:53px;border-left:1px solid #444;text-align:center;font-size:9px;padding:3px}.summary strong{display:block;font-size:20px}.book{width:100%;table-layout:fixed;border-collapse:collapse;border:1px solid #444}.book th,.book td{border:1px solid #a2c4d7;padding:0;vertical-align:top}.book thead th{height:20px;text-align:center;font-size:9px;background:#0e5685;color:#fff;border-color:#0e5685}.book tbody tr{height:55px;break-inside:avoid}.book .order,.book .pos,.book .entered{text-align:center;padding-top:5px}.book .name{padding:4px;font-size:9px;color:#0b507c;font-weight:600}.person{line-height:13px}.subtag{font-size:7px;color:#777;margin-left:3px}.scorecell{position:relative;height:55px;overflow:hidden;border-left:2px solid #0e5685!important}.play,.empty{position:relative;height:55px;width:100%;min-width:0;overflow:hidden}.play+.play{border-top:1px dashed #aaa}.play:has(+.play){height:27px}.play:has(+.play) .pitchdots{transform:scale(.65);transform-origin:bottom left}.play:has(+.play) .diamond{transform:translate(-50%,-46%) scale(.55)}.notation{position:absolute;top:2px;left:2px;right:2px;text-align:center;font-size:10px;font-weight:700;z-index:2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.red .notation{color:#d32932}.green .notation{color:#218442}.amber .notation{color:#b67808}.diamond,.emptydiamond{position:absolute;width:29px;height:29px;top:51%;left:50%;transform:translate(-50%,-42%) rotate(45deg);border:1px dotted #bfc4c8}.diamond .side{position:absolute;display:block;background:#2359dc}.side1{width:0;height:0;right:-2px;top:-2px}.side2{width:0;height:0;bottom:-2px;right:-2px}.side3{width:0;height:0;bottom:-2px;left:-2px}.side4{width:0;height:0;top:-2px;left:-2px}.b1 .side1,.b2 .side1,.b3 .side1,.b4 .side1{width:3px;height:100%}.b2 .side2,.b3 .side2,.b4 .side2{height:3px;width:100%}.b3 .side3,.b4 .side3{width:3px;height:100%}.b4 .side4{height:3px;width:100%}.scored{background:rgba(39,88,217,.12)}.pitchdots{position:absolute;bottom:3px;left:3px;display:flex;flex-direction:column;gap:2px;z-index:3}.dotrow{display:flex;gap:2px}.dot{display:block;width:6px;height:6px;border:1px solid #0e5685;border-radius:50%;background:#fff}.dot.ball{background:#289c55;border-color:#16763b}.dot.strike{background:#d43b40;border-color:#ad222b}.outcome{position:absolute;bottom:2px;right:3px;color:#14783b;font-size:8px;font-weight:bold}.outmark{position:absolute;top:2px;right:2px;color:#d32932;font-size:8px;font-weight:bold;width:13px;height:13px;line-height:11px;text-align:center;border:1px solid #d32932;border-radius:50%}.extra{position:absolute;bottom:2px;left:2px;color:#946c0b;font-size:7px}.book tfoot th,.book tfoot td{height:20px;text-align:center;padding-top:4px;background:#f6f6f6}.footer{font-size:8px;color:#777;margin-top:6px}.report h2{font-size:20px}.report h3{font-size:13px}.decision{display:flex;gap:12px;margin:12px 0}.decision>div{flex:1;border:1px solid #777;padding:10px}.decision strong{display:block;margin-top:5px;font-size:14px}.history{width:100%;border-collapse:collapse}.history th,.history td{border:1px solid #aaa;padding:4px;text-align:left}.history th{background:#edf1f4;color:#283a47;font-weight:700;letter-spacing:.2px}.history tbody tr:nth-child(even){background:#fafbfc}.history .inning,.history .rbi{text-align:center;white-space:nowrap}.history .playcode{white-space:nowrap;font-weight:700}.history .detailtext{line-height:1.4}.outcircle{display:inline-block;border:1.4px solid #c32930;color:#c32930;border-radius:50%;width:14px;height:14px;text-align:center;line-height:11px;font-size:9px;margin-left:4px}.history tr{break-inside:avoid}.footnote{font-size:9px;color:#666}@media screen{body{background:#e6e6e6;padding:14px}.sheet{background:#fff;padding:12px;margin:0 auto 15px;max-width:1200px;min-height:650px}}

 /* End-of-inning underline and substitution separator, matching the on-screen scorebook. */
  .scorecell.inning-end{border-bottom:4px solid #111!important}
  .person.replacement{border-left:4px solid #111;padding-left:3px;margin-left:-3px}
  /* Scorebook-square geometry mirrors the native 600x600 drawing using print-safe CSS. */
 .play{isolation:isolate}.fieldlines{position:absolute;inset:0;pointer-events:none;overflow:hidden}
 .foul{position:absolute;top:14px;height:39px;border-left:1px solid #b8b8b8;transform-origin:bottom center;opacity:.9}
 .foulleft{left:50%;transform:rotate(-43deg)}.foulright{left:50%;transform:rotate(43deg)}
 .fence{position:absolute;top:7px;left:18%;width:64%;height:15px;border-top:1.4px dashed #64748b;border-radius:55% 55% 0 0}
 .infieldarc{position:absolute;top:22px;left:31%;width:38%;height:10px;border-top:1px dashed #9abf91;border-radius:60% 60% 0 0}
 .diamond{width:24px;height:24px;top:54%;left:50%;transform:translate(-50%,-35%) rotate(45deg);border:1px solid #b8b8b8;background:rgba(241,247,236,.4)}
 .diamond.scored{background:rgba(33,132,66,.2)}
 .notation{top:24px;left:22%;right:22%;font-size:10px;line-height:11px;color:#173b57;z-index:4;text-shadow:0 0 2px white}
 .red .notation{color:#d32932}.amber .notation{color:#b67808}
 .pitchdots{bottom:3px;left:3px;gap:2px}.dotrow{gap:2px}.dot{width:5px;height:5px}
 .outmark{top:auto;bottom:3px;right:3px}.outcome{top:2px;bottom:auto;right:2px;font-size:7px}
 .rbimark{position:absolute;left:50%;top:41px;transform:translateX(-50%);font-size:7px;white-space:nowrap;font-weight:700;color:#126b48;z-index:5;background:rgba(255,255,255,.85);padding:0 1px}
 .errornote{position:absolute;top:2px;left:2px;font-size:7px;color:#a47700;font-weight:bold}
 .sprayline{position:absolute;left:50%;top:54%;height:0;border-top:1.4px solid #218442;transform-origin:left center;z-index:3}
 .red .sprayline{border-color:#d32932}.amber .sprayline{border-color:#b67808}
 .spraypoint{position:absolute;width:3px;height:3px;margin:-1.5px 0 0 -1.5px;border-radius:50%;background:#218442;z-index:3}
 .red .spraypoint{background:#d32932}.amber .spraypoint{background:#b67808}
 .play:has(+.play) .diamond{transform:translate(-50%,-35%) rotate(45deg) scale(.55)}
 .play:has(+.play) .rbimark{top:18px;font-size:6px}.play:has(+.play) .notation{top:10px;font-size:7px}
 .play:has(+.play) .fieldlines{display:none}
 /* Screen-style result columns: print-safe circles with matching left/right positions. */
 .resultcol{position:absolute;top:3px;z-index:7;display:flex;flex-direction:column;align-items:center;gap:1px;font-size:7px;line-height:9px;font-weight:800;color:#0e5685}
 .resultcol.left{left:2px}.resultcol.right{right:2px}
 .resultlabel{display:block;min-width:13px;height:10px;text-align:center;white-space:nowrap;border:1px solid transparent;border-radius:10px}
 .resultlabel.selected{border-color:#238447;color:#176e3b;background:#f1fff4}
 .notation{left:23%;right:23%;top:23px;white-space:normal;overflow:visible;font-size:9px}
 .rbimark{top:32px;left:50%;transform:translateX(-50%);background:#ffffffd9;border-radius:2px;font-size:6px}
 .fence{border-top-style:dashed;opacity:.65}
 .play:has(+.play) .resultcol{font-size:5px;line-height:6px;gap:0;top:1px}
 .play:has(+.play) .resultlabel{height:6px;min-width:10px}

 /* Print layout refinement: allocate 10% more width to inning boxes by reducing
    the unused player-name / position / entry column widths. Keep row heights fixed
    so an 11-player scorebook still fits a landscape sheet. */
 .book .name{font-size:8px;padding:3px;overflow-wrap:anywhere}
 .book .pos,.book .entered{font-size:8px}
 .scorecell{border-left-width:1.5px!important}
 .resultcol{font-size:6.1px;line-height:8px;gap:0;top:3px}
 .resultlabel{min-width:12px;height:9px;border-width:1px}
 .resultcol.left{left:2px}.resultcol.right{right:2px}
 .diamond{width:21px;height:21px;top:52%;left:50%;transform:translate(-50%,-38%) rotate(45deg)}
 .emptydiamond{width:21px;height:21px;top:52%;transform:translate(-50%,-38%) rotate(45deg)}
 .notation{top:22px;left:25%;right:25%;font-size:7.2px;line-height:8px;white-space:nowrap;overflow:visible;text-overflow:clip;text-shadow:0 0 2px white}
 .rbimark{top:38px;font-size:5.5px;line-height:7px;max-width:38px;overflow:hidden;text-overflow:clip;padding:0 1px;white-space:nowrap;z-index:6}
 .pitchdots{bottom:2px;left:3px;gap:1px}.dotrow{gap:1.5px}.dot{width:5px;height:5px}
 .outmark{bottom:2px;right:3px;width:11px;height:11px;line-height:9px;font-size:7px}
 .foul{top:16px;height:30px;opacity:.6}
 .sprayline{z-index:3}
 .errornote{top:1px;left:18px;font-size:6px}
 .play:has(+.play) .resultcol{font-size:4.3px;line-height:5px}
 .play:has(+.play) .resultlabel{height:5px;min-width:8px}
 .play:has(+.play) .rbimark{top:19px;font-size:4.5px}
 .play:has(+.play) .notation{top:10px;font-size:6px}
 /* Keep the bottom-right out number clear of FC and the other result labels.
    Five abbreviations occupy only the upper 37px; the final 15px belongs to outs. */
 .resultcol{top:2px;font-size:5.9px;line-height:7px;gap:0}
 .resultlabel{height:7px;line-height:7px;min-width:12px;padding:0 1px}
 .outmark{top:auto;bottom:2px;right:4px;width:12px;height:12px;line-height:10px;font-size:7px;z-index:9;background:#fff}
 .play:has(+.play) .resultcol{top:0;font-size:4px;line-height:4px}
 .play:has(+.play) .resultlabel{height:4px;line-height:4px;min-width:8px;padding:0}
 .play:has(+.play) .outmark{bottom:1px;right:2px;width:8px;height:8px;line-height:6px;font-size:5px}
 /* Give circled scoring abbreviations a little breathing room around the letters.
    Keep their columns compact so the bottom-right out marker remains clear. */
 .resultlabel{min-width:14px;height:8px;line-height:7px;padding:0 2px}
 .resultlabel.selected{border-color:transparent;box-shadow:0 0 0 1px #238447;border-radius:12px}
 .play:has(+.play) .resultlabel{min-width:9px;height:4px;line-height:4px;padding:0 1px}
 /* Final FC/out clearance: preserve the wider selected circles but keep all
    five result labels above the bottom-right out marker. */
 .resultcol{top:1px}
 .resultlabel{height:7px;line-height:6.5px}
 .outmark{bottom:1px;right:3px}

 /* Diamond rotates 45 degrees. In its local coordinates:
    home = bottom-right, first = top-right, second = top-left, third = bottom-left.
    The cutdown starts AT the last safe base and ends halfway to the next base. */
 .cutdown{position:absolute;display:block;background:#222;z-index:6;transform:none}
 .cutdown>i{position:absolute;display:block;background:#222}
 /* First to second: top edge, right to left; cap across midpoint. */
 .cutdown1{top:-2px;right:-2px;width:50%;height:2.5px}
 .cutdown1>i{left:-1px;top:-5px;width:2.5px;height:12px}
 /* Second to third: left edge, top to bottom; cap across midpoint. */
 .cutdown2{top:-2px;left:-2px;width:2.5px;height:50%}
 .cutdown2>i{left:-5px;bottom:-1px;width:12px;height:2.5px}
 /* Third to home: bottom edge, left to right; cap across midpoint. */
 .cutdown3{bottom:-2px;left:-2px;width:50%;height:2.5px}
 .cutdown3>i{right:-1px;top:-5px;width:2.5px;height:12px}
 .runnermark{position:absolute;top:27%;left:50%;transform:translateX(-50%);font-size:8px;font-weight:800;color:#0e5685;z-index:5;background:rgba(255,255,255,.75);padding:0 1px;white-space:nowrap}

/* Preserve pitch count fills when printing to PDF. */
html,body,.pitchdots .dot{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}
.pitchdots .dot.ball{background-color:#289c55!important;border-color:#16763b!important;box-shadow:inset 0 0 0 6px #289c55!important}
.pitchdots .dot.strike{background-color:#d43b40!important;border-color:#ad222b!important;box-shadow:inset 0 0 0 6px #d43b40!important}
.pitchdots .dot:not(.ball):not(.strike){background-color:#fff!important;box-shadow:none!important}
</style></head><body>${sheets.join('')}${decisionSheet}</body></html>`;
}
