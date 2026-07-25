import { Ionicons } from "@expo/vector-icons";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { adminFetch, API_BASE } from "../utils/appconfig";
import { modalStyles } from "../utils/modalStyles";

type Item = { id:string; time:string; title:string; icon:string; location:string; details:string; announcerScript:string };
type Game = { id:string; gameNumber:number; title:string; shortTitle:string; divisionIds:string[]; accentColor:string; eastDugout:string; westDugout:string; announcerNotes:string; items:Item[]; updatedAt?:string };

export default function AnnouncerItineraryScreen(){
 const {gameId}=useLocalSearchParams<{gameId?:string}>();
 const [game,setGame]=useState<Game|null>(null);
 const [loading,setLoading]=useState(true);
 const [saving,setSaving]=useState(false);
 const [syncing,setSyncing]=useState(false);
 const [cloning,setCloning]=useState(false);
 const [modal,setModal]=useState({visible:false,type:"success",title:"",message:""});

 useEffect(()=>{load();},[gameId]);

 function show(type:string,title:string,message:string){setModal({visible:true,type,title,message});}

 async function load(){
  try{
   setLoading(true);
   const r=await adminFetch(`${API_BASE}/api/admin/announcer-schedules/${gameId}`);
   const j=await r.json();
   if(!r.ok||!j?.ok)throw new Error(j?.message||"Could not load announcer itinerary.");
   setGame(j.game);
  }catch(e:any){
   show("error","Load Failed",e?.message||"Could not load announcer itinerary.");
  }finally{
   setLoading(false);
  }
 }

 function updateItem(id:string,patch:Partial<Item>){
  setGame(g=>g?{...g,items:g.items.map(i=>i.id===id?{...i,...patch}:i)}:g);
 }

 async function save(){
  if(!game)return;
  try{
   setSaving(true);
   const r=await adminFetch(`${API_BASE}/api/admin/announcer-schedules/${game.id}`,{
    method:"POST",
    body:JSON.stringify({game})
   });
   const j=await r.json();
   if(!r.ok||!j?.ok)throw new Error(j?.message||"Could not save announcer itinerary.");
   setGame(j.game);
   show("success","Announcer Itinerary Saved","The PA notes and scripts were saved independently of Game Schedules.");
  }catch(e:any){
   show("error","Save Failed",e?.message||"Could not save announcer itinerary.");
  }finally{
   setSaving(false);
  }
 }

 async function sync(){
  if(!game)return;
  try{
   setSyncing(true);
   const r=await adminFetch(`${API_BASE}/api/admin/announcer-schedules/${game.id}/sync`,{method:"POST"});
   const j=await r.json();
   if(!r.ok||!j?.ok)throw new Error(j?.message||"Could not refresh from Game Schedules.");
   setGame(j.game);
   show("success","Schedule Refreshed","New schedule items were added and existing announcer scripts were preserved.");
  }catch(e:any){
   show("error","Refresh Failed",e?.message||"Could not refresh from Game Schedules.");
  }finally{
   setSyncing(false);
  }
 }

 async function cloneToOtherGames(){
  if(!game)return;
  try{
   setCloning(true);
   const r=await adminFetch(`${API_BASE}/api/admin/announcer-schedules/${game.id}/clone`,{
    method:"POST",
    body:JSON.stringify({
     items:game.items.map(item=>({announcerScript:item.announcerScript||""}))
    })
   });
   const j=await r.json();
   if(!r.ok||!j?.ok)throw new Error(j?.message||"Could not clone the announcer scripts to the other games.");
   show("success","Scripts Cloned",j.message||"The Announcer Script text was cloned to the other games.");
  }catch(e:any){
   show("error","Clone Failed",e?.message||"Could not clone the announcer scripts to the other games.");
  }finally{
   setCloning(false);
  }
 }

 return <>
  <Stack.Screen options={{headerShown:false}}/>
  <View style={styles.screen}>
   <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
    <View style={styles.topRow}>
     <Pressable style={styles.back} onPress={()=>router.back()}>
      <Ionicons name="arrow-back" size={18} color="#fff"/>
      <Text style={styles.buttonText}>Configure Announcer</Text>
     </Pressable>
     <Pressable style={styles.sync} onPress={sync} disabled={syncing}>
      {syncing?<ActivityIndicator color="#fff" size="small"/>:<Ionicons name="refresh" size={18} color="#fff"/>}
      <Text style={styles.buttonText}>{syncing?"Refreshing...":"Refresh From Schedule"}</Text>
     </Pressable>
    </View>

    {loading||!game?
     <View style={styles.loading}>
      <ActivityIndicator size="large" color="#1d4ed8"/>
      <Text style={styles.muted}>Loading announcer itinerary...</Text>
     </View>
    :<>
     <View style={[styles.hero,{borderTopColor:game.accentColor||"#1d4ed8"}]}>
      <Image source={require("../assets/All-Star Logo.png")} style={styles.logo} resizeMode="contain"/>
      <Text style={styles.badge}>GAME {game.gameNumber}</Text>
      <Text style={styles.title}>{game.title}</Text>
      <Text style={styles.subtitle}>Editable PA Run of Show</Text>
     </View>

     <View style={styles.card}>
      <Text style={styles.sectionTitle}>Announcer Notes</Text>
      <Text style={styles.help}>Freeform notes shown above the itinerary for this game.</Text>
      <TextInput style={styles.notes} multiline value={game.announcerNotes||""} onChangeText={v=>setGame({...game,announcerNotes:v})} placeholder="Enter game-specific announcements, sponsor notes, pronunciation reminders, or other PA information..." textAlignVertical="top"/>
     </View>

     <Text style={styles.runTitle}>Announcer Information</Text>

     {game.items.map((item,index)=><View key={item.id} style={styles.card}>
      <View style={styles.itemHeader}>
       <View style={[styles.number,{backgroundColor:game.accentColor||"#1d4ed8"}]}>
        <Text style={styles.numberText}>{index+1}</Text>
       </View>
       <View style={{flex:1}}>
        <Text style={styles.itemTime}>{item.time||"Time TBD"}</Text>
        <Text style={styles.itemTitle}>{item.title||`Show Item ${index+1}`}</Text>
       </View>
      </View>
      <Text style={styles.label}>Location</Text>
      <TextInput style={styles.input} value={item.location} onChangeText={v=>updateItem(item.id,{location:v})}/>
      <Text style={styles.label}>Schedule Details</Text>
      <TextInput style={styles.details} multiline value={item.details} onChangeText={v=>updateItem(item.id,{details:v})} textAlignVertical="top"/>
      <Text style={styles.label}>Announcer Script</Text>
      <TextInput style={styles.script} multiline value={item.announcerScript||""} onChangeText={v=>updateItem(item.id,{announcerScript:v})} placeholder="Enter the exact script the announcer should read over the PA..." textAlignVertical="top"/>
     </View>)}

     <Pressable style={styles.save} onPress={save} disabled={saving||cloning}>
      {saving?<ActivityIndicator color="#fff"/>:<>
       <Ionicons name="save" size={19} color="#fff"/>
       <Text style={styles.saveText}>Save Announcer Itinerary</Text>
      </>}
     </Pressable>

     <Pressable style={styles.clone} onPress={cloneToOtherGames} disabled={saving||cloning}>
      {cloning?<ActivityIndicator color="#fff"/>:<>
       <Ionicons name="copy" size={19} color="#fff"/>
       <Text style={styles.saveText}>Clone to Other Games</Text>
      </>}
     </Pressable>
    </>}
   </ScrollView>
  </View>

  <Modal visible={modal.visible} transparent animationType="fade">
   <View style={modalStyles.overlay}>
    <View style={modalStyles.card}>
     <View style={styles.modalIconWrap}>
      <Ionicons name={modal.type==="error"?"alert-circle":"checkmark-circle"} size={54} color={modal.type==="error"?"#c62828":"#15803d"}/>
     </View>
     <Text style={styles.modalTitle}>{modal.title}</Text>
     <Text style={styles.modalBody}>{modal.message}</Text>
     <Pressable style={styles.ok} onPress={()=>setModal({...modal,visible:false})}>
      <Text style={styles.buttonText}>OK</Text>
     </Pressable>
    </View>
   </View>
  </Modal>
 </>;
}

const styles=StyleSheet.create({
 screen:{flex:1,backgroundColor:"#eef2f7"},
 container:{padding:20,paddingTop:50,paddingBottom:70},
 topRow:{flexDirection:"row",justifyContent:"space-between",gap:8,marginBottom:12},
 back:{backgroundColor:"#1d4ed8",borderRadius:9,paddingVertical:10,paddingHorizontal:12,flexDirection:"row",alignItems:"center",gap:6},
 sync:{backgroundColor:"#15803d",borderRadius:9,paddingVertical:10,paddingHorizontal:12,flexDirection:"row",alignItems:"center",gap:6},
 buttonText:{color:"#fff",fontWeight:"900"},
 loading:{backgroundColor:"#fff",borderRadius:20,padding:30,alignItems:"center"},
 muted:{color:"#6b7280",fontWeight:"700",marginTop:10},
 hero:{backgroundColor:"#fff",borderRadius:20,borderTopWidth:8,padding:18,alignItems:"center",marginBottom:16},
 logo:{width:120,height:120},
 badge:{color:"#c62828",fontWeight:"900",fontSize:13},
 title:{color:"#1f4e9e",fontWeight:"900",fontSize:25,textAlign:"center",marginTop:4},
 subtitle:{color:"#6b7280",fontWeight:"700",marginTop:3},
 card:{backgroundColor:"#fff",borderRadius:18,padding:16,marginBottom:14,shadowColor:"#000",shadowOpacity:.06,shadowRadius:8,elevation:4},
 sectionTitle:{color:"#1f4e9e",fontWeight:"900",fontSize:20},
 help:{color:"#6b7280",fontSize:12,fontWeight:"700",marginVertical:5},
 notes:{minHeight:150,borderWidth:1,borderColor:"#cbd5e1",borderRadius:12,padding:12,fontSize:15,color:"#111827",backgroundColor:"#f8fafc"},
 runTitle:{color:"#1f4e9e",fontWeight:"900",fontSize:22,textAlign:"center",marginVertical:8},
 itemHeader:{flexDirection:"row",alignItems:"center",marginBottom:12},
 number:{width:38,height:38,borderRadius:19,alignItems:"center",justifyContent:"center",marginRight:10},
 numberText:{color:"#fff",fontWeight:"900"},
 itemTime:{color:"#c62828",fontWeight:"900",fontSize:14},
 itemTitle:{color:"#111827",fontWeight:"900",fontSize:18},
 label:{color:"#374151",fontSize:12,fontWeight:"900",marginTop:8,marginBottom:4,textTransform:"uppercase"},
 input:{borderWidth:1,borderColor:"#cbd5e1",borderRadius:10,padding:10,color:"#111827"},
 details:{minHeight:80,borderWidth:1,borderColor:"#cbd5e1",borderRadius:10,padding:10,color:"#111827",backgroundColor:"#f8fafc"},
 script:{minHeight:150,borderWidth:2,borderColor:"#7c3aed",borderRadius:12,padding:12,color:"#111827",fontSize:16,backgroundColor:"#faf5ff"},
 save:{backgroundColor:"#15803d",borderRadius:14,padding:16,alignItems:"center",justifyContent:"center",flexDirection:"row",gap:8,marginTop:4},
 clone:{backgroundColor:"#1d4ed8",borderRadius:14,padding:16,alignItems:"center",justifyContent:"center",flexDirection:"row",gap:8,marginTop:10},
 saveText:{color:"#fff",fontWeight:"900",fontSize:16},
 modalIconWrap:{width:"100%",alignItems:"center",justifyContent:"center"},
 modalTitle:{color:"#1f4e9e",fontWeight:"900",fontSize:22,textAlign:"center",marginTop:8},
 modalBody:{color:"#4b5563",fontWeight:"700",textAlign:"center",marginVertical:10},
 ok:{backgroundColor:"#1d4ed8",borderRadius:10,paddingVertical:11,paddingHorizontal:28}
});
