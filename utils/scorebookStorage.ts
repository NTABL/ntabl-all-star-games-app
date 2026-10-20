import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { API_BASE } from './appconfig';
import { ScorebookV2Document, scorebookKey } from './scorebookTypes';

// Expo Go development remains local. Production web MUST save to Render.
const remote = Platform.OS === 'web' && !__DEV__;
const pending = new Map<string, Promise<void>>();
const revisions = new Map<string, number>();
const managerIds = new Map<string, string>();
const blocked = new Set<string>();
const storageKey = (programId:string, gameId:string, ownerTeamId:string) =>
  `${__DEV__ ? 'ntabl-scorebook-TEST:' : 'ntabl-scorebook-LIVE:'}${scorebookKey(programId, gameId, ownerTeamId)}`;
const endpoint = (programId:string, gameId:string, ownerTeamId:string) =>
  `${API_BASE}/api/scorebooks/${encodeURIComponent(programId)}/${encodeURIComponent(ownerTeamId)}/${encodeURIComponent(gameId)}`;

export async function loadScorebook(programId:string, gameId:string, ownerTeamId:string, managerPersonId?:string):Promise<ScorebookV2Document|null> {
  const key = storageKey(programId, gameId, ownerTeamId);
  await pending.get(key)?.catch(()=>{});
  if (remote) {
    if (!managerPersonId) throw new Error('Manager identity required for live Scorebook.');
    managerIds.set(key, managerPersonId);
    const response = await fetch(`${endpoint(programId,gameId,ownerTeamId)}?managerPersonId=${encodeURIComponent(managerPersonId)}`, {cache:'no-store'});
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error(data.message || 'Could not load live Scorebook.');
    revisions.set(key, data.revision || 0);
    blocked.delete(key);
    const doc = data.document as ScorebookV2Document|null;
    if (doc && (doc.schemaVersion !== 1 || doc.programId !== programId || doc.gameId !== gameId || doc.ownerTeamId !== ownerTeamId)) throw new Error('Live Scorebook identity mismatch.');
    if (doc) await AsyncStorage.setItem(key, JSON.stringify(doc)).catch(()=>{});
    return doc;
  }
  const value = await AsyncStorage.getItem(key);
  if (!value) return null;
  const doc = JSON.parse(value) as ScorebookV2Document;
  if (doc.schemaVersion !== 1 || doc.programId !== programId || doc.gameId !== gameId || doc.ownerTeamId !== ownerTeamId) throw new Error('Scorebook identity/version mismatch.');
  return doc;
}

export function saveScorebook(doc:ScorebookV2Document):Promise<void> {
  const key = storageKey(doc.programId, doc.gameId, doc.ownerTeamId);
  if (blocked.has(key)) return Promise.reject(new Error('Live Scorebook save stopped after a conflict or network failure. Reopen Score Game to reload from the server.'));
  const serialized = JSON.stringify({...doc, updatedAt:new Date().toISOString()});
  const prior = pending.get(key) || Promise.resolve();
  const write = prior.then(async()=>{
    if (blocked.has(key)) throw new Error('Live Scorebook saving is paused. Reopen Score Game.');
    if (remote) {
      const managerPersonId = managerIds.get(key);
      if (!managerPersonId) throw new Error('Manager identity not initialized for live Scorebook.');
      let response:Response;
      try {
        response = await fetch(endpoint(doc.programId,doc.gameId,doc.ownerTeamId), {
          method:'POST', headers:{'Content-Type':'application/json'},
          body:JSON.stringify({managerPersonId,expectedRevision:revisions.get(key) ?? 0,document:JSON.parse(serialized)})
        });
      } catch(e) { blocked.add(key); throw new Error('Network save failed. Do not continue scoring; reopen Score Game once connected.'); }
      const data = await response.json().catch(()=>({}));
      if (!response.ok || !data.ok) { blocked.add(key); throw new Error(data.message || 'Server rejected Scorebook save. Reopen Score Game before scoring further.'); }
      revisions.set(key,data.revision);
    }
    await AsyncStorage.setItem(key,serialized).catch(e=>{if(!remote)throw e;});
  });
  // Do not silently ignore a failed remote write: all later writes must fail until reload.
  pending.set(key,write);
  void write.finally(()=>{if(pending.get(key)===write)pending.delete(key);}).catch(()=>{});
  return write;
}

export async function clearTestScorebook(programId:string,gameId:string,ownerTeamId:string):Promise<void> {
  if (!__DEV__) throw new Error('Test reset is unavailable in production.');
  const key=storageKey(programId,gameId,ownerTeamId);
  await pending.get(key)?.catch(()=>{});
  await AsyncStorage.removeItem(key);
}

/** Reset only the active manager's team-owned scorebook, retaining a server archive. */
export async function resetGameScorebook(programId:string,gameId:string,ownerTeamId:string,managerPersonId:string):Promise<void>{
  const key=storageKey(programId,gameId,ownerTeamId);
  await pending.get(key); // never reset while an older write is in flight
  if(remote){
    const response=await fetch(`${endpoint(programId,gameId,ownerTeamId)}/reset`,{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({managerPersonId,expectedRevision:revisions.get(key) ?? 0})
    });
    const data=await response.json().catch(()=>({}));
    if(!response.ok||!data.ok)throw new Error(data.message||'Reset was not accepted. Reopen Score Game.');
    revisions.set(key,data.revision);
    blocked.delete(key);
  }
  await AsyncStorage.removeItem(key);
}
