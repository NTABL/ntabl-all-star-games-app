/** NTABL league-only scorebook domain types. No All-Star dependencies. */
export type TeamSide = 'home' | 'away';
export type HalfInning = 'top' | 'bottom';
export type BallOutcome = 'hit' | 'error' | 'out';
export type HitType = '1B' | '2B' | '3B' | 'HR';
export type PlateAppearanceResult = HitType | 'BB' | 'IBB' | 'HBP' | 'K' | 'OUT' | 'FC' | 'ROE' | 'CI' | 'SAC' | 'SF';
export type ScorebookPlayer = {
  id: string; personId?: string; name: string; jerseyNumber: string;
  position: string; manual?: boolean; courtesyRunner?: boolean;
};
/** Each slot can contain several successive players. Never replace or delete the earlier occupant. */
export type BattingSlot = { slot: number; appearances: LineupEntry[] };
export type LineupEntry = {
  entryId: string; player: ScorebookPlayer; enteredAtEvent: number;
  exitedAtEvent?: number; position: string; reason: 'starter' | 'substitution' | 'late-add' | 'reentry';
};
export type TeamLineup = { teamId: string; teamName: string; slots: BattingSlot[]; bench: ScorebookPlayer[] };
/** Coordinates are normalized to a field view: x=0 left foul line, x=1 right foul line; y=0 home, y=1 deep outfield. */
export type SprayPoint = { x: number; y: number };
export type SprayData = {
  outcome: BallOutcome; landing: SprayPoint; path?: SprayPoint[];
  fielders: number[]; // ordered defensive positions, e.g. [6,4,3] or [6,5,4,1]
};
export type RunnerAdvance = {
  playerId: string; from: 0 | 1 | 2 | 3; to: 1 | 2 | 3 | 4;
  isOut?: boolean; rbiCredited?: boolean; earned?: boolean;
};
export type PlateAppearanceEvent = {
  kind: 'plateAppearance'; id: string; sequence: number; at: string;
  half: HalfInning; inning: number; battingTeamId: string;
  playerId: string; lineupEntryId: string; battingSlot: number;
  result: PlateAppearanceResult; notation: string;
  spray?: SprayData; runners: RunnerAdvance[];
  outsOnPlay: number; runsOnPlay: number; rbis: number;
  strikeoutLooking?: boolean; notes?: string;
};
export type LineupChangeEvent = {
  kind: 'lineupChange'; id: string; sequence: number; at: string;
  teamId: string; slot: number; player: ScorebookPlayer;
  action: 'substitution' | 'late-add' | 'reentry'; position: string;
};
export type ScorebookEvent = PlateAppearanceEvent | LineupChangeEvent;
export type ScorebookDocument = {
  schemaVersion: 1; programId: string; gameId: string; ownerTeamId: string;
  homeTeamId: string; awayTeamId: string; home: TeamLineup; away: TeamLineup;
  createdAt: string; updatedAt: string; events: ScorebookEvent[];
  status: 'draft' | 'inProgress' | 'final';
};
/** The primary storage key deliberately includes ownerTeamId, isolating each team's scoring decisions. */
export function scorebookKey(programId: string, gameId: string, ownerTeamId: string): string {
  return ['ntabl-scorebook-v1', programId, gameId, ownerTeamId].map(encodeURIComponent).join(':');
}
