import { Ionicons } from "@expo/vector-icons";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator, Alert, Modal, Platform, Pressable, ScrollView, StyleSheet,
  Switch, Text, TextInput, View,
} from "react-native";
import DraggableFlatList, { ScaleDecorator } from "react-native-draggable-flatlist";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { API_BASE } from "../utils/appconfig";

const POSITIONS = ["P","C","1B","2B","3B","SS","LF","CF","RF","IF","OF","DH"];

type Player = {
  id: string; personId?: string; name: string; jerseyNumber: string; position: string;
  manual?: boolean; courtesyRunner?: boolean; batting?: boolean; battingOrder?: number | null;
};

export default function GameLineupBuilderScreen() {
  const p = useLocalSearchParams();
  const programId = String(p.programId || "");
  const teamId = String(p.teamId || "");
  const gameId = String(p.gameId || "");
  const opponentTeamId = String(p.opponentTeamId || "");
  const managerPersonId = String(p.managerPersonId || "");
  const teamName = String(p.teamName || "My Team");
  const opponentName = String(p.opponentName || "Opponent");
  const gameDate = String(p.gameDate || "");

  const [players, setPlayers] = useState<Player[]>([]);
  const [battingIds, setBattingIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"mine"|"opponent">("mine");
  const [editing, setEditing] = useState<Player|null>(null);
  const [subTarget, setSubTarget] = useState<Player|null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [newPlayer, setNewPlayer] = useState({ name:"", jerseyNumber:"", position:"" });
  const [positionPickerFor, setPositionPickerFor] = useState<"edit"|"add"|null>(null);
  const [opponentPlayers, setOpponentPlayers] = useState<Player[]>([]);
  const [opponentShared, setOpponentShared] = useState(false);
  const [sharedAt, setSharedAt] = useState("");
  const [canUnshare, setCanUnshare] = useState(false);
  const [gameStartTime, setGameStartTime] = useState<number | null>(null);
  const [opponentSharedAt, setOpponentSharedAt] = useState("");
  const [dirty, setDirty] = useState(false);
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const [dragging, setDragging] = useState(false);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout>|null>(null);

  const batting = useMemo(() => battingIds.map(id => players.find(x=>x.id===id)).filter((x):x is Player=>!!x && x.batting!==false), [players, battingIds]);
  const subs = useMemo(() => players.filter(x=>x.batting===false || !battingIds.includes(x.id)), [players, battingIds]);
  const opponentBatting = opponentPlayers.filter(x=>x.batting!==false).sort((a,b)=>Number(a.battingOrder||999)-Number(b.battingOrder||999));
  const opponentSubs = opponentPlayers.filter(x=>x.batting===false);

  useEffect(()=>{ loadMine(); },[]);
  useEffect(()=>{ if(activeTab==="opponent") loadOpponent(); },[activeTab]);
  useEffect(()=>{
    if(!dirty) return;
    if(autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current=setTimeout(()=>saveLineup(true),2000);
    return ()=>{ if(autoSaveTimer.current) clearTimeout(autoSaveTimer.current); };
  },[dirty, players, battingIds]);

  function markChanged(){ setDirty(true); setStatus("Changes not saved"); }
  function applyLoaded(list: Player[]){
    const ordered=[...list].sort((a,b)=>Number(a.battingOrder||9999)-Number(b.battingOrder||9999));
    setPlayers(ordered);
    setBattingIds(ordered.filter(x=>x.batting!==false).map(x=>x.id));
  }

  async function loadMine(){
    try{
      setLoading(true);
      const r=await fetch(`${API_BASE}/api/game-lineups/${encodeURIComponent(programId)}/${encodeURIComponent(teamId)}/${encodeURIComponent(gameId)}?managerPersonId=${encodeURIComponent(managerPersonId)}`);
      const j=await r.json();
      if(!r.ok||!j?.ok) throw new Error(j?.message||"Lineup could not be loaded.");
      applyLoaded(Array.isArray(j.players)?j.players:[]); setSharedAt(j.sharedAt||""); setCanUnshare(!!j.canUnshare); setGameStartTime(j.gameStartTime?Number(j.gameStartTime):null); setDirty(false);
    }catch(e:any){ Alert.alert("Lineup",e?.message||"Lineup could not be loaded."); }
    finally{ setLoading(false); }
  }

  async function loadOpponent(){
    if(!opponentTeamId){ setOpponentShared(false); setOpponentPlayers([]); return; }
    try{
      const r=await fetch(`${API_BASE}/api/game-lineups/${encodeURIComponent(programId)}/${encodeURIComponent(teamId)}/${encodeURIComponent(gameId)}/opponent/${encodeURIComponent(opponentTeamId)}?managerPersonId=${encodeURIComponent(managerPersonId)}`);
      const j=await r.json();
      if(!r.ok||!j?.ok) throw new Error(j?.message||"Opponent lineup could not be loaded.");
      setOpponentShared(!!j.shared); setOpponentPlayers(Array.isArray(j.players)?j.players:[]); setOpponentSharedAt(j.sharedAt||"");
    }catch(e:any){ Alert.alert("Opponent Lineup",e?.message||"Opponent lineup could not be loaded."); }
  }

  function payloadPlayers(){
    const b=batting.map((x,i)=>({...x,batting:true,battingOrder:i+1}));
    const s=subs.map(x=>({...x,batting:false,battingOrder:null}));
    return [...b,...s];
  }

  async function saveLineup(auto=false){
    if(saving) return false;
    try{
      setSaving(true); if(!auto)setStatus("Saving...");
      const r=await fetch(`${API_BASE}/api/game-lineups/${encodeURIComponent(programId)}/${encodeURIComponent(teamId)}/${encodeURIComponent(gameId)}/save`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({managerPersonId,players:payloadPlayers()})});
      const j=await r.json(); if(!r.ok||!j?.ok)throw new Error(j?.message||"Lineup could not be saved.");
      setDirty(false); setStatus(`${auto?"Auto-saved":"Saved"}: ${new Date().toLocaleTimeString()}`); return true;
    }catch(e:any){ setStatus("Save failed"); if(!auto)Alert.alert("Save Lineup",e?.message||"Lineup could not be saved."); return false; }
    finally{setSaving(false);}
  }

  async function shareLineup(){
    try{
      setSaving(true); setStatus("Sharing...");
      const r=await fetch(`${API_BASE}/api/game-lineups/${encodeURIComponent(programId)}/${encodeURIComponent(teamId)}/${encodeURIComponent(gameId)}/share`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({managerPersonId,players:payloadPlayers()})});
      const j=await r.json(); if(!r.ok||!j?.ok)throw new Error(j?.message||"Lineup could not be shared.");
      setDirty(false); setSharedAt(j.sharedAt||new Date().toISOString()); setCanUnshare(!gameStartTime || Date.now() < gameStartTime); setStatus("Shared with opponent");
      Alert.alert("Lineup Shared",`Your lineup is now visible to ${opponentName}.`);
    }catch(e:any){Alert.alert("Share Lineup",e?.message||"Lineup could not be shared.");}
    finally{setSaving(false);}
  }

  async function unshareLineup(){
    try{
      setSaving(true); setStatus("Unsharing...");
      const r=await fetch(`${API_BASE}/api/game-lineups/${encodeURIComponent(programId)}/${encodeURIComponent(teamId)}/${encodeURIComponent(gameId)}/unshare`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({managerPersonId})});
      const j=await r.json(); if(!r.ok||!j?.ok)throw new Error(j?.message||"Lineup could not be unshared.");
      setSharedAt(""); setCanUnshare(false); setStatus("Lineup is private");
      Alert.alert("Lineup Unshared",`Your lineup is no longer visible to ${opponentName}.`);
    }catch(e:any){Alert.alert("Unshare Lineup",e?.message||"Lineup could not be unshared.");}
    finally{setSaving(false);}
  }

  function toggleBatting(player:Player,value:boolean){
    setPlayers(cur=>cur.map(x=>x.id===player.id?{...x,batting:value}:x));
    setBattingIds(cur=>value?(cur.includes(player.id)?cur:[...cur,player.id]):cur.filter(id=>id!==player.id)); markChanged();
  }
  function toggleCR(player:Player){ setPlayers(cur=>cur.map(x=>x.id===player.id?{...x,courtesyRunner:!x.courtesyRunner}:x)); markChanged(); }
  function saveEdit(){ if(!editing)return; setPlayers(cur=>cur.map(x=>x.id===editing.id?editing:x)); setEditing(null); markChanged(); }
  function doSub(sub:Player){ if(!subTarget)return; setPlayers(cur=>cur.map(x=>x.id===subTarget.id?{...x,batting:false}:x.id===sub.id?{...x,batting:true}:x)); setBattingIds(cur=>cur.map(id=>id===subTarget.id?sub.id:id)); setSubTarget(null); markChanged(); }
  function addPlayer(){
    if(!newPlayer.name.trim()){Alert.alert("Add Player","Player name is required.");return;}
    const id=`manual-${Date.now()}`; const pl:Player={id,name:newPlayer.name.trim(),jerseyNumber:newPlayer.jerseyNumber.trim(),position:newPlayer.position.trim(),manual:true,courtesyRunner:false,batting:false,battingOrder:null};
    setPlayers(cur=>[...cur,pl]); setNewPlayer({name:"",jerseyNumber:"",position:""}); setAddOpen(false); markChanged();
  }

  function playerCard(player:Player, editable:boolean, order?:number, drag?:()=>void, active?:boolean){
    return <View style={[styles.card,active&&styles.dragActive]}>
      <View style={styles.rowTop}>
        <View style={styles.nameWrap}>
          <View style={styles.nameRow}>{order?<View style={styles.order}><Text style={styles.orderText}>{order}</Text></View>:null}<Text style={styles.name}>#{player.jerseyNumber||"—"} {player.name}</Text></View>
          <Text style={styles.meta}>{player.position||"POS"}{player.manual?" • Added Player":""}</Text>
        </View>
        <Pressable onPress={()=>editable&&toggleCR(player)} disabled={!editable} style={[styles.cr,player.courtesyRunner&&styles.crOn]}><Text style={[styles.crText,player.courtesyRunner&&styles.crTextOn]}>CR</Text></Pressable>
      </View>
      {editable?<View style={styles.actions}>
        <View style={styles.battingToggle}><Text style={styles.smallBold}>{player.batting!==false?"Batting":"Not Batting"}</Text><Switch value={player.batting!==false} onValueChange={v=>toggleBatting(player,v)}/></View>
        <Pressable style={styles.editAction} onPress={()=>setEditing({...player})}><Ionicons name="create-outline" size={16} color="#fff"/><Text style={styles.actionText}>Edit</Text></Pressable>
        {order?<Pressable style={styles.subAction} onPress={()=>setSubTarget(player)}><Ionicons name="swap-horizontal" size={16} color="#fff"/><Text style={styles.actionText}>Sub</Text></Pressable>:null}
        {drag?<Pressable onLongPress={drag} delayLongPress={180} pressRetentionOffset={{top:10,bottom:10,left:10,right:10}} style={styles.drag}><Ionicons name="reorder-three" size={22} color="#1e3a8a"/><Text style={styles.dragText}>Hold & Drag</Text></Pressable>:null}
      </View>:<View style={styles.viewOnly}><Text style={styles.viewOnlyText}>View Only</Text></View>}
    </View>;
  }

  if(loading)return <><Stack.Screen options={{headerShown:false}}/><View style={styles.center}><ActivityIndicator size="large"/><Text>Loading game lineup...</Text></View></>;

  return <GestureHandlerRootView style={{flex:1}}><Stack.Screen options={{headerShown:false}}/><View style={styles.screen}>
    <View style={styles.header}><Pressable onPress={()=>router.back()} style={styles.back}><Ionicons name="arrow-back" size={22} color="#fff"/></Pressable><View style={{flex:1}}><Text style={styles.title}>GAME LINEUP</Text><Text style={styles.subtitle}>{teamName} vs {opponentName}{gameDate?` • ${gameDate}`:""}</Text></View></View>
    <View style={styles.tabs}><Pressable style={[styles.tab,activeTab==="mine"&&styles.tabOn]} onPress={()=>setActiveTab("mine")}><Text style={[styles.tabText,activeTab==="mine"&&styles.tabTextOn]}>MY LINEUP</Text></Pressable><Pressable style={[styles.tab,activeTab==="opponent"&&styles.tabOn]} onPress={()=>setActiveTab("opponent")}><Text style={[styles.tabText,activeTab==="opponent"&&styles.tabTextOn]}>OPPONENT</Text></Pressable></View>
    <ScrollView contentContainerStyle={styles.content} scrollEnabled={!dragging} nestedScrollEnabled keyboardShouldPersistTaps="handled" directionalLockEnabled>
      {activeTab==="mine"?<>
        <View style={styles.toolbar}><Pressable style={[styles.topButton,styles.save]} disabled={saving} onPress={()=>saveLineup(false)}><Ionicons name="save-outline" size={18} color="#fff"/><Text style={styles.buttonText}>Save</Text></Pressable><Pressable style={[styles.topButton,styles.share]} disabled={saving} onPress={shareLineup}><Ionicons name="share-social-outline" size={18} color="#fff"/><Text style={styles.buttonText}>Share Lineup</Text></Pressable>{sharedAt&&canUnshare?<Pressable style={[styles.topButton,styles.unshare]} disabled={saving} onPress={unshareLineup}><Ionicons name="eye-off-outline" size={18} color="#fff"/><Text style={styles.buttonText}>Unshare Lineup</Text></Pressable>:null}<Pressable style={[styles.topButton,styles.add]} onPress={()=>setAddOpen(true)}><Ionicons name="person-add-outline" size={18} color="#fff"/><Text style={styles.buttonText}>Add Player</Text></Pressable></View>
        <Text style={styles.status}>{status||"Auto-save after 2 seconds"}{sharedAt?` • Last shared ${new Date(sharedAt).toLocaleTimeString()}`:" • Not shared"}</Text>
        <Text style={styles.section}>Batting Lineup ({batting.length})</Text>
        <DraggableFlatList
          data={batting}
          keyExtractor={x=>x.id}
          scrollEnabled={false}
          activationDistance={6}
          dragItemOverflow
          onDragBegin={()=>setDragging(true)}
          onRelease={()=>setDragging(false)}
          onDragEnd={({data})=>{setDragging(false);setBattingIds(data.map(x=>x.id));markChanged();}}
          renderItem={({item,getIndex,drag,isActive})=><ScaleDecorator activeScale={1.02}>{playerCard(item,true,(getIndex()??0)+1,drag,isActive)}</ScaleDecorator>}
        />
        <Text style={styles.section}>Substitutes ({subs.length})</Text>{subs.length?subs.map(x=><View key={x.id}>{playerCard(x,true)}</View>):<Text style={styles.empty}>No substitutes listed.</Text>}
      </>:<>
        {!opponentShared?<View style={styles.locked}><Ionicons name="eye-off-outline" size={40} color="#64748b"/><Text style={styles.lockedTitle}>Lineup Not Shared Yet</Text><Text style={styles.empty}>{opponentName} has not shared a lineup for this game.</Text><Pressable style={styles.refresh} onPress={loadOpponent}><Text style={styles.refreshText}>Check Again</Text></Pressable></View>:<>
          <Text style={styles.status}>Shared {opponentSharedAt?new Date(opponentSharedAt).toLocaleString():""}</Text><Text style={styles.section}>Batting Lineup ({opponentBatting.length})</Text>{opponentBatting.map((x,i)=><View key={x.id}>{playerCard(x,false,i+1)}</View>)}<Text style={styles.section}>Substitutes ({opponentSubs.length})</Text>{opponentSubs.length?opponentSubs.map(x=><View key={x.id}>{playerCard(x,false)}</View>):<Text style={styles.empty}>No substitutes listed.</Text>}
        </>}
      </>}
    </ScrollView>

    <Modal visible={!!editing} transparent animationType="fade" onRequestClose={()=>setEditing(null)}><View style={styles.overlay}><View style={styles.modal}><Text style={styles.modalTitle}>Edit Player</Text><TextInput style={styles.input} value={editing?.name||""} onChangeText={v=>setEditing(e=>e?{...e,name:v}:e)} placeholder="Player name"/><TextInput style={styles.input} value={editing?.jerseyNumber||""} onChangeText={v=>setEditing(e=>e?{...e,jerseyNumber:v}:e)} placeholder="Jersey number"/><Pressable style={styles.pickerButton} onPress={()=>setPositionPickerFor("edit")}><Text style={[styles.pickerText,!editing?.position&&styles.pickerPlaceholder]}>{editing?.position||"Select position"}</Text><Ionicons name="chevron-down" size={18} color="#475569"/></Pressable><View style={styles.modalButtons}><Pressable style={styles.cancel} onPress={()=>setEditing(null)}><Text>Cancel</Text></Pressable><Pressable style={styles.modalSave} onPress={saveEdit}><Text style={styles.buttonText}>Save</Text></Pressable></View></View></View></Modal>
    <Modal visible={addOpen} transparent animationType="fade" onRequestClose={()=>setAddOpen(false)}><View style={styles.overlay}><View style={styles.modal}><Text style={styles.modalTitle}>Add Player</Text><Text style={styles.help}>Adds a player to this game only.</Text><TextInput style={styles.input} value={newPlayer.name} onChangeText={v=>setNewPlayer(x=>({...x,name:v}))} placeholder="Player name"/><TextInput style={styles.input} value={newPlayer.jerseyNumber} onChangeText={v=>setNewPlayer(x=>({...x,jerseyNumber:v}))} placeholder="Jersey number"/><Pressable style={styles.pickerButton} onPress={()=>setPositionPickerFor("add")}><Text style={[styles.pickerText,!newPlayer.position&&styles.pickerPlaceholder]}>{newPlayer.position||"Select position"}</Text><Ionicons name="chevron-down" size={18} color="#475569"/></Pressable><View style={styles.modalButtons}><Pressable style={styles.cancel} onPress={()=>setAddOpen(false)}><Text>Cancel</Text></Pressable><Pressable style={styles.modalSave} onPress={addPlayer}><Text style={styles.buttonText}>Add Player</Text></Pressable></View></View></View></Modal>
    <Modal visible={!!positionPickerFor} transparent animationType="fade" onRequestClose={()=>setPositionPickerFor(null)}><View style={styles.overlay}><View style={styles.modal}><Text style={styles.modalTitle}>Select Position</Text><View style={styles.positionGrid}>{POSITIONS.map(pos=><Pressable key={pos} style={styles.positionChoice} onPress={()=>{if(positionPickerFor==="edit")setEditing(e=>e?{...e,position:pos}:e);else setNewPlayer(x=>({...x,position:pos}));setPositionPickerFor(null);}}><Text style={styles.positionChoiceText}>{pos}</Text></Pressable>)}</View><Pressable style={styles.cancelWide} onPress={()=>setPositionPickerFor(null)}><Text>Cancel</Text></Pressable></View></View></Modal>
    <Modal visible={!!subTarget} transparent animationType="fade" onRequestClose={()=>setSubTarget(null)}><View style={styles.overlay}><View style={styles.modal}><Text style={styles.modalTitle}>Select Substitute</Text><Text style={styles.help}>Replacing {subTarget?.name}</Text><ScrollView style={{maxHeight:360}}>{subs.filter(x=>x.id!==subTarget?.id).map(x=><Pressable key={x.id} style={styles.subChoice} onPress={()=>doSub(x)}><Text style={styles.subChoiceText}>#{x.jerseyNumber||"—"} {x.name}</Text><Text>{x.position}</Text></Pressable>)}</ScrollView><Pressable style={styles.cancelWide} onPress={()=>setSubTarget(null)}><Text>Cancel</Text></Pressable></View></View></Modal>
  </View></GestureHandlerRootView>;
}

const styles=StyleSheet.create({
  screen:{flex:1,backgroundColor:"#f1f5f9"},center:{flex:1,alignItems:"center",justifyContent:"center",gap:12},header:{backgroundColor:"#0f2747",paddingTop:Platform.OS==="ios"?54:24,paddingHorizontal:16,paddingBottom:16,flexDirection:"row",alignItems:"center",gap:12},back:{width:42,height:42,borderRadius:21,backgroundColor:"#ffffff20",alignItems:"center",justifyContent:"center"},title:{color:"#fff",fontSize:22,fontWeight:"900"},subtitle:{color:"#dbeafe",fontSize:13,marginTop:2},tabs:{flexDirection:"row",backgroundColor:"#fff",borderBottomWidth:1,borderColor:"#cbd5e1"},tab:{flex:1,padding:15,alignItems:"center"},tabOn:{borderBottomWidth:4,borderColor:"#1d4ed8"},tabText:{fontWeight:"800",color:"#64748b"},tabTextOn:{color:"#1d4ed8"},content:{padding:14,paddingBottom:60,maxWidth:900,width:"100%",alignSelf:"center"},toolbar:{flexDirection:"row",flexWrap:"wrap",gap:8},topButton:{width:155,height:42,borderRadius:8,flexDirection:"row",gap:6,alignItems:"center",justifyContent:"center",paddingHorizontal:8},add:{backgroundColor:"#334155"},save:{backgroundColor:"#1d4ed8"},share:{backgroundColor:"#15803d"},unshare:{backgroundColor:"#b91c1c"},buttonText:{color:"#fff",fontWeight:"800"},status:{fontSize:11,color:"#64748b",marginTop:6,marginBottom:3},section:{fontSize:17,fontWeight:"900",color:"#0f2747",marginTop:12,marginBottom:6},card:{backgroundColor:"#fff",borderRadius:9,borderWidth:1,borderColor:"#cbd5e1",paddingHorizontal:10,paddingVertical:8,marginBottom:6},dragActive:{opacity:.8,borderColor:"#1d4ed8",borderWidth:2},rowTop:{flexDirection:"row",alignItems:"center",gap:8},nameWrap:{flex:1},nameRow:{flexDirection:"row",alignItems:"center",gap:8},order:{width:25,height:25,borderRadius:13,backgroundColor:"#0f2747",alignItems:"center",justifyContent:"center"},orderText:{color:"#fff",fontWeight:"900"},name:{fontSize:15,fontWeight:"900",color:"#0f172a",flexShrink:1},meta:{fontSize:12,color:"#64748b",marginTop:2},cr:{width:36,height:36,borderRadius:18,borderWidth:2,borderColor:"#94a3b8",alignItems:"center",justifyContent:"center",backgroundColor:"#fff"},crOn:{backgroundColor:"#dc2626",borderColor:"#991b1b"},crText:{fontWeight:"900",color:"#475569"},crTextOn:{color:"#fff"},actions:{flexDirection:"row",flexWrap:"wrap",alignItems:"center",gap:5,marginTop:6,paddingTop:6,borderTopWidth:1,borderColor:"#e2e8f0"},battingToggle:{flexDirection:"row",alignItems:"center",gap:5,marginRight:"auto"},smallBold:{fontSize:12,fontWeight:"800",color:"#334155"},action:{backgroundColor:"#475569",borderRadius:7,paddingHorizontal:9,paddingVertical:8,flexDirection:"row",alignItems:"center",gap:4},editAction:{backgroundColor:"#15803d",borderRadius:7,paddingHorizontal:8,paddingVertical:6,flexDirection:"row",alignItems:"center",gap:4},subAction:{backgroundColor:"#dc2626",borderRadius:7,paddingHorizontal:8,paddingVertical:6,flexDirection:"row",alignItems:"center",gap:4},actionText:{color:"#fff",fontSize:12,fontWeight:"800"},drag:{borderWidth:1,borderColor:"#93c5fd",backgroundColor:"#eff6ff",borderRadius:7,paddingHorizontal:8,paddingVertical:6,flexDirection:"row",alignItems:"center",gap:3},dragText:{fontSize:11,fontWeight:"800",color:"#1e3a8a"},viewOnly:{alignSelf:"flex-start",marginTop:8,backgroundColor:"#e2e8f0",borderRadius:6,paddingHorizontal:8,paddingVertical:4},viewOnlyText:{fontSize:11,fontWeight:"800",color:"#475569"},empty:{color:"#64748b",fontStyle:"italic",paddingVertical:10},locked:{alignItems:"center",padding:36,backgroundColor:"#fff",borderRadius:12,marginTop:20},lockedTitle:{fontSize:20,fontWeight:"900",color:"#334155",marginTop:10},refresh:{marginTop:14,borderWidth:1,borderColor:"#1d4ed8",borderRadius:7,paddingHorizontal:15,paddingVertical:9},refreshText:{color:"#1d4ed8",fontWeight:"800"},overlay:{flex:1,backgroundColor:"#0008",alignItems:"center",justifyContent:"center",padding:20},modal:{backgroundColor:"#fff",borderRadius:14,padding:18,width:"100%",maxWidth:500},modalTitle:{fontSize:21,fontWeight:"900",color:"#0f2747",marginBottom:6},help:{color:"#64748b",marginBottom:12},input:{borderWidth:1,borderColor:"#cbd5e1",borderRadius:8,paddingHorizontal:12,paddingVertical:11,fontSize:16,marginTop:9},pickerButton:{borderWidth:1,borderColor:"#cbd5e1",borderRadius:8,paddingHorizontal:12,height:46,marginTop:9,flexDirection:"row",alignItems:"center",justifyContent:"space-between",backgroundColor:"#fff"},pickerText:{fontSize:16,color:"#0f172a"},pickerPlaceholder:{color:"#94a3b8"},positionGrid:{flexDirection:"row",flexWrap:"wrap",gap:8,marginTop:10},positionChoice:{width:64,height:44,borderRadius:8,borderWidth:1,borderColor:"#93c5fd",backgroundColor:"#eff6ff",alignItems:"center",justifyContent:"center"},positionChoiceText:{fontSize:16,fontWeight:"900",color:"#1e3a8a"},modalButtons:{flexDirection:"row",justifyContent:"flex-end",gap:9,marginTop:16},cancel:{paddingHorizontal:16,paddingVertical:11,borderRadius:8,backgroundColor:"#e2e8f0"},modalSave:{paddingHorizontal:16,paddingVertical:11,borderRadius:8,backgroundColor:"#1d4ed8"},subChoice:{paddingVertical:12,borderBottomWidth:1,borderColor:"#e2e8f0"},subChoiceText:{fontWeight:"800",fontSize:16},cancelWide:{marginTop:14,backgroundColor:"#e2e8f0",padding:12,borderRadius:8,alignItems:"center"}
});
