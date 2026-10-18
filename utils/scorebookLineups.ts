import { BattingSlot, ScorebookPlayer, TeamLineup, LineupChangeEvent } from './scorebookTypes';
export type ExistingLineupPlayer = ScorebookPlayer & { batting?: boolean; battingOrder?: number | null };
/** Convert the existing /api/game-lineups response to scorebook slots without changing its schema. */
export function importGameLineup(teamId: string, teamName: string, players: ExistingLineupPlayer[]): TeamLineup {
  const batting = players.filter(p => p.batting !== false && Number(p.battingOrder) > 0)
    .sort((a,b) => Number(a.battingOrder) - Number(b.battingOrder));
  const slots: BattingSlot[] = batting.map((p, i) => ({
    slot: Number(p.battingOrder) || i + 1,
    appearances: [{ entryId: `starter:${teamId}:${p.id}:${i}`, player: copyPlayer(p),
      enteredAtEvent: 0, position: p.position, reason: 'starter' }]
  }));
  return { teamId, teamName, slots, bench: players.filter(p => !batting.some(b => b.id === p.id)).map(copyPlayer) };
}
function copyPlayer(p: ExistingLineupPlayer): ScorebookPlayer {
  return { id:p.id, personId:p.personId, name:p.name, jerseyNumber:p.jerseyNumber,
    position:p.position, manual:p.manual, courtesyRunner:(p as any).courtesyRunner };
}
/** Immutable replay: substitution adds a row; late-add creates a new slot. */
export function applyLineupChange(lineup: TeamLineup, event: LineupChangeEvent): TeamLineup {
  if (event.teamId !== lineup.teamId) return lineup;
  const slots = lineup.slots.map(s => ({ ...s, appearances: s.appearances.map(e => ({...e})) }));
  const existing = slots.find(s => s.slot === event.slot);
  if (event.action === 'late-add') {
    if (existing || event.slot !== Math.max(0,...slots.map(s=>s.slot))+1)
      throw new Error('Late additions must create the next batting slot.');
    slots.push({slot:event.slot,appearances:[]});
  } else if (!existing) throw new Error('Substitution requires an existing batting slot.');
  const slot = slots.find(s=>s.slot===event.slot)!;
  const active = slot.appearances.find(e=>e.exitedAtEvent===undefined);
  if (active) active.exitedAtEvent = event.sequence;
  slot.appearances.push({entryId:event.id,player:event.player,enteredAtEvent:event.sequence,
    position:event.position,reason:event.action});
  return {...lineup,slots,bench:lineup.bench.filter(p=>p.id!==event.player.id)};
}
