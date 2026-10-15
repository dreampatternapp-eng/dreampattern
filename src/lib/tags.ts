// Local, private tag suggestions: no network call needed while capturing.
const THEMES: Record<string, string[]> = {
  flying: ['fly', 'flying', 'flew', 'float', 'soar'],
  falling: ['fall', 'falling', 'fell', 'drop'],
  water: ['water', 'ocean', 'sea', 'river', 'lake', 'flood', 'swim', 'rain', 'wave'],
  chase: ['chase', 'chased', 'chasing', 'running from', 'hunted'],
  teeth: ['teeth', 'tooth'],
  school: ['school', 'class', 'exam', 'test', 'teacher', 'college'],
  work: ['work', 'office', 'boss', 'coworker', 'meeting', 'job'],
  family: ['mom', 'mother', 'dad', 'father', 'sister', 'brother', 'grandma', 'grandpa', 'family'],
  house: ['house', 'home', 'room', 'door', 'hallway', 'basement', 'attic'],
  animals: ['dog', 'cat', 'snake', 'spider', 'bird', 'horse', 'wolf', 'bear', 'animal'],
  travel: ['car', 'drive', 'driving', 'train', 'plane', 'airport', 'bus', 'road'],
  lost: ['lost', 'can\'t find', 'searching', 'looking for'],
  late: ['late', 'missed', 'miss the'],
  death: ['death', 'died', 'dead', 'funeral', 'dying'],
  romance: ['kiss', 'date', 'wedding', 'boyfriend', 'girlfriend', 'husband', 'wife', 'crush', 'ex '],
  nightmare: ['scared', 'terrified', 'monster', 'scream', 'nightmare'],
};

export function suggestTags(text: string, existing: string[], already: string[]): string[] {
  const t = ` ${text.toLowerCase()} `;
  const out = new Set<string>();
  for (const [tag, words] of Object.entries(THEMES)) {
    if (words.some((w) => t.includes(w))) out.add(tag);
  }
  for (const tag of existing) {
    if (t.includes(tag.toLowerCase())) out.add(tag);
  }
  already.forEach((a) => out.delete(a));
  return [...out].slice(0, 6);
}
