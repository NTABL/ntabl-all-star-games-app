import { Ionicons } from "@expo/vector-icons";
import { router, Stack, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { getManagerContext } from "../stores/store";
import { API_BASE } from "../utils/appconfig";

type Stats = { g:number; pa:number; ab:number; h:number; doubles:number; triples:number; hr:number; r:number; rbi:number; bb:number; so:number; hbp:number; sac:number; sb:number; tb:number; avg:number|null; slg:number|null };
type GameStats = {gameId:string;teamId:string;publishedAt:string|null;stats:Stats};
type Player = {playerId:string; name:string; stats:Stats; games?:GameStats[]};
type SortKey = "name" | keyof Stats;
const cols: {key:SortKey;label:string;width:number}[] = [
  {key:"name",label:"PLAYER",width:170},{key:"g",label:"G",width:48},{key:"pa",label:"PA",width:48},
  {key:"ab",label:"AB",width:48},{key:"h",label:"H",width:48},{key:"r",label:"R",width:48},
  {key:"rbi",label:"RBI",width:52},{key:"doubles",label:"2B",width:48},{key:"triples",label:"3B",width:48},
  {key:"hr",label:"HR",width:48},{key:"bb",label:"BB",width:48},{key:"so",label:"SO",width:48},
  {key:"sb",label:"SB",width:48},{key:"avg",label:"AVG",width:65},{key:"slg",label:"SLG",width:65},
];
const str=(v:unknown)=>String(v??"").trim();
const enc=encodeURIComponent;
const fmt=(n:number|null|undefined,rate:boolean)=>n==null?"—":rate?n.toFixed(3).replace(/^0\./,"."):String(n);
export default function Statistics(){
  const p=useLocalSearchParams();
  const programId=str(p.programId),teamId=str(p.teamId),teamName=str(p.teamName),division=str(p.division);
  const [players,setPlayers]=useState<Player[]>([]),[games,setGames]=useState(0);
  const [loading,setLoading]=useState(true),[error,setError]=useState("");
  const [selectedPlayer,setSelectedPlayer]=useState<string|null>(null),[detailTab,setDetailTab]=useState<"season"|"games">("season");
  const [sort,setSort]=useState<SortKey>("avg"),[descending,setDescending]=useState(true);
  const load=useCallback(async()=>{
    setLoading(true);setError("");
    try{
      const manager:any=await getManagerContext();
      if(str(manager?.programId)!==programId||str(manager?.teamId)!==teamId)throw new Error("Your selected team has changed. Return to the dashboard and open Statistics again.");
      const token=str(manager?.authToken);
      if(!token)throw new Error("Please sign out and sign in again to view published statistics.");
      const url=`${API_BASE}/api/scorebook-stats/${enc(programId)}/${enc(teamId)}`;
      const response=await fetch(url,{cache:"no-store",headers:{Authorization:`Bearer ${token}`}});const data=await response.json();
      if(!response.ok||!data.ok)throw new Error(data.message||`Statistics request failed (${response.status}).`);
      setPlayers(Array.isArray(data.players)?data.players:[]);setGames(Number(data.games)||0);
    }catch(e:any){setError(e?.message||"Unable to load statistics.");setPlayers([]);setGames(0);}
    finally{setLoading(false);}
  },[programId,teamId]);
  useFocusEffect(useCallback(()=>{void load();},[load]));
  const sorted=useMemo(()=>[...players].sort((a,b)=>{
    const av=sort==="name"?a.name.toLowerCase():a.stats?.[sort],bv=sort==="name"?b.name.toLowerCase():b.stats?.[sort];
    if(av==null&&bv!=null)return 1;if(bv==null&&av!=null)return -1;
    const result=typeof av==="string"?av.localeCompare(String(bv??"")):Number(av??0)-Number(bv??0);
    return descending?-result:result;
  }),[players,sort,descending]);
  return <View style={s.page}>
    <Stack.Screen options={{title:"Statistics",headerShown:false}}/>
    <ScrollView contentContainerStyle={s.content}>
      <Pressable onPress={()=>router.back()} style={s.back}><Ionicons name="arrow-back" color="#1d4ed8" size={19}/><Text style={s.backText}>Dashboard</Text></Pressable>
      <Text style={s.title}>Statistics Center</Text>
      <Text style={s.sub}>{division||"Selected division"} • {teamName||"Selected team"}</Text>
      <View style={s.notice}><Text style={s.noticeText}>Finalized scorebooks only. Players and managers on this team can view published batting statistics.</Text></View>
      {loading?<ActivityIndicator size="large" color="#1d4ed8" style={{marginTop:30}}/>:error?<View style={s.card}><Text style={s.error}>{error}</Text><Pressable onPress={()=>void load()} style={s.retry}><Text style={s.retryText}>Retry</Text></Pressable></View>:<>
        <View style={s.summary}><Text style={s.summaryText}>{games} finalized game{games===1?"":"s"}</Text><Text style={s.summaryText}>{players.length} player{players.length===1?"":"s"}</Text></View>
        <Text style={s.section}>Batting Statistics</Text>
        {players.length===0?<Text style={s.empty}>No published statistics yet. Finalize a team scorebook to publish a game.</Text>:<ScrollView horizontal showsHorizontalScrollIndicator><View>
          <View style={[s.tableRow,s.tableHead]}>{cols.map(c=><Pressable key={c.key} style={[s.cell,{width:c.width},c.key!=="name"&&{alignItems:"center"}]} onPress={()=>{if(sort===c.key)setDescending(!descending);else{setSort(c.key);setDescending(c.key!=="name");}}}><Text style={s.heading}>{c.label}{sort===c.key?(descending?" ↓":" ↑"):""}</Text></Pressable>)}</View>
          {sorted.map((p,i)=><View key={p.playerId} style={[s.tableRow,i%2===0?s.even:s.odd]}>{cols.map(c=>c.key==="name"?<Pressable key={c.key} onPress={()=>{setSelectedPlayer(p.playerId);setDetailTab("season");}} style={[s.cell,{width:c.width}]}><Text numberOfLines={1} style={s.player}>{p.name}  ›</Text></Pressable>:<View key={c.key} style={[s.cell,{width:c.width}]}><Text numberOfLines={1} style={s.value}>{fmt(p.stats?.[c.key] as number|null,c.key==="avg"||c.key==="slg")}</Text></View>)}</View>)}
        </View></ScrollView>}
        {selectedPlayer&&(()=>{const player=players.find(p=>p.playerId===selectedPlayer);if(!player)return null;const details=detailTab==="season"?[{gameId:"Season Total",stats:player.stats}]:player.games||[];return <View style={s.details}><View style={s.detailHeader}><Text style={s.detailTitle}>{player.name}</Text><Pressable onPress={()=>setSelectedPlayer(null)}><Text style={s.close}>✕ Close</Text></Pressable></View><View style={s.tabs}><Pressable onPress={()=>setDetailTab("season")} style={[s.tab,detailTab==="season"&&s.tabSelected]}><Text style={[s.tabText,detailTab==="season"&&s.tabTextSelected]}>Season Totals</Text></Pressable><Pressable onPress={()=>setDetailTab("games")} style={[s.tab,detailTab==="games"&&s.tabSelected]}><Text style={[s.tabText,detailTab==="games"&&s.tabTextSelected]}>By Game</Text></Pressable></View>{details.length===0?<Text style={s.empty}>No game-by-game details are available yet. The backend statistics module must be deployed first.</Text>:<ScrollView horizontal showsHorizontalScrollIndicator><View><View style={[s.tableRow,s.tableHead]}><Text style={[s.heading,{width:145,padding:9}]}>GAME</Text>{cols.filter(c=>c.key!=="name").map(c=><Text key={c.key} style={[s.heading,{width:c.width,textAlign:"center"}]}>{c.label}</Text>)}</View>{details.map((g,i)=><View key={g.gameId+":"+i} style={[s.tableRow,i%2===0?s.even:s.odd]}><Text style={[s.value,{width:145,textAlign:"left",padding:9}]}>{g.gameId}</Text>{cols.filter(c=>c.key!=="name").map(c=><Text key={c.key} style={[s.value,{width:c.width}]}>{fmt(g.stats?.[c.key] as number|null,c.key==="avg"||c.key==="slg")}</Text>)}</View>)}</View></ScrollView>}</View>;})()}
        <Text style={s.note}>OBP/OPS and pitching are intentionally withheld until their source data and attribution can be validated. Game corrections replace the published snapshot rather than adding a duplicate.</Text>
      </>}
    </ScrollView>
  </View>;
}
const s=StyleSheet.create({details:{backgroundColor:"#fff",borderRadius:12,padding:12,marginTop:18},detailHeader:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",marginBottom:12},detailTitle:{fontSize:19,fontWeight:"800",color:"#111827"},close:{fontSize:13,color:"#1d4ed8",fontWeight:"700"},tabs:{flexDirection:"row",gap:8,marginBottom:14},tab:{borderRadius:8,borderWidth:1,borderColor:"#1d4ed8",padding:10},tabSelected:{backgroundColor:"#1d4ed8"},tabText:{color:"#1d4ed8",fontWeight:"700"},tabTextSelected:{color:"#fff"},page:{flex:1,backgroundColor:"#f3f4f6"},content:{padding:16,paddingBottom:48},back:{flexDirection:"row",alignItems:"center",gap:7,marginBottom:14},backText:{color:"#1d4ed8",fontWeight:"700"},title:{fontSize:25,fontWeight:"800",color:"#111827"},sub:{fontSize:14,color:"#4b5563",marginTop:5,marginBottom:14},notice:{backgroundColor:"#fef3c7",padding:12,borderRadius:10,marginBottom:14},noticeText:{color:"#92400e",fontSize:13,lineHeight:19},card:{backgroundColor:"#fff",padding:18,borderRadius:12},error:{color:"#b91c1c",lineHeight:22},retry:{backgroundColor:"#1d4ed8",padding:10,borderRadius:8,marginTop:15,alignSelf:"flex-start"},retryText:{color:"#fff",fontWeight:"700"},summary:{flexDirection:"row",justifyContent:"space-between",padding:14,backgroundColor:"#fff",borderRadius:12,marginBottom:16},summaryText:{fontWeight:"700",color:"#1f2937"},section:{fontSize:18,fontWeight:"800",color:"#111827",marginBottom:10},empty:{padding:20,backgroundColor:"#fff",borderRadius:10,color:"#6b7280"},tableRow:{flexDirection:"row",alignItems:"center",minHeight:44},tableHead:{backgroundColor:"#1f4e9e"},cell:{paddingHorizontal:8,paddingVertical:11},heading:{fontSize:11,fontWeight:"800",color:"#fff"},player:{fontSize:12,fontWeight:"700",color:"#1d4ed8"},value:{fontSize:12,color:"#111827",textAlign:"center"},even:{backgroundColor:"#fff"},odd:{backgroundColor:"#e5e7eb"},note:{fontSize:12,color:"#6b7280",lineHeight:19,marginTop:18}});
