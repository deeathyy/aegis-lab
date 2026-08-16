const API_ROOT = 'https://api.opendota.com/api';
const HERO_IDS = [1, 2, 5, 14, 26, 74];
const COMPLETE_EXCEPTIONS = new Set([
  'blink', 'travel_boots', 'tranquil_boots', 'arcane_boots', 'ultimate_scepter', 'moon_shard', 'aghanims_shard',
  'diffusal_blade', 'maelstrom', 'orchid', 'basher', 'vanguard', 'mekansm', 'dragon_lance', 'echo_sabre',
  'witch_blade', 'phylactery', 'rod_of_atos', 'veil_of_discord', 'aether_lens',
]);
const PHASE_TIMINGS = { early_game_items: 12, mid_game_items: 23, late_game_items: 37 };

const [constants, heroes] = await Promise.all([
  fetch(`${API_ROOT}/constants/items`).then((response) => response.json()),
  fetch(`${API_ROOT}/constants/heroes`).then((response) => response.json()),
]);
const entries = Object.entries(constants).filter(([, item]) => item?.id);
const usedAsComponent = new Set(entries.flatMap(([, item]) => item.components || []));
const itemsById = new Map(entries.map(([key, item]) => [String(item.id), { ...item, key }]));
for (const key of ['pers', 'soul_booster', 'yasha', 'sange', 'kaya']) {
  if (!usedAsComponent.has(key) || COMPLETE_EXCEPTIONS.has(key)) {
    throw new Error(`${key}: expected a recipe component, but it is classified as complete`);
  }
}

function analyze(popularity) {
  const rows = new Map();
  for (const [phase, timing] of Object.entries(PHASE_TIMINGS)) {
    for (const [id, rawCount] of Object.entries(popularity[phase] || {})) {
      const item = itemsById.get(id);
      if (!item?.img) continue;
      const count = Number(rawCount || 0);
      const row = rows.get(id) || {
        id: Number(id),
        key: item.key,
        name: item.dname,
        count: 0,
        weightedTiming: 0,
        phaseCounts: {},
        complete: !usedAsComponent.has(item.key) || COMPLETE_EXCEPTIONS.has(item.key),
      };
      row.count += count;
      row.weightedTiming += count * timing;
      row.phaseCounts[phase] = count;
      rows.set(id, row);
    }
  }
  const analyzed = [...rows.values()].map((row) => ({ ...row, timing: row.weightedTiming / row.count }));
  const overviewItems = analyzed.filter((item) => {
    const constant = itemsById.get(String(item.id));
    return item.complete && (Number(constant?.cost || 0) >= 1200 || /boots|treads/i.test(item.name));
  });
  const rankedCore = overviewItems
    .filter((item) => !/vanguard|pipe of insight|lotus orb|linken's sphere|aeon disk|crimson guard/i.test(item.name))
    .sort((a, b) => ((b.phaseCounts.early_game_items || 0) + (b.phaseCounts.mid_game_items || 0)) - ((a.phaseCounts.early_game_items || 0) + (a.phaseCounts.mid_game_items || 0)))
  const selectedCore = [];
  let hasFootwear = false;
  for (const item of rankedCore) {
    const footwear = /boots|treads/i.test(item.name);
    if (footwear && hasFootwear) continue;
    selectedCore.push(item);
    hasFootwear ||= footwear;
    if (selectedCore.length === 5) break;
  }
  const core = selectedCore.sort((a, b) => {
      const order = (item) => item.timing
        - (/boots|treads/i.test(item.name) ? 1.5 : 0)
        - (/hand of midas|battle fury|maelstrom|radiance/i.test(item.name) ? 1 : 0)
        - (/blink dagger/i.test(item.name) ? .75 : 0)
        + (/aghanim's shard/i.test(item.name) ? 1 : 0);
      return order(a) - order(b) || b.count - a.count;
    });
  const coreIds = new Set(core.map((item) => item.id));
  const situational = overviewItems
    .filter((item) => !coreIds.has(item.id) && (item.phaseCounts.mid_game_items || 0) + (item.phaseCounts.late_game_items || 0) > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);
  return { core, situational };
}

for (const heroId of HERO_IDS) {
  const popularity = await fetch(`${API_ROOT}/heroes/${heroId}/itemPopularity`).then((response) => response.json());
  const { core, situational } = analyze(popularity);
  if ([...core, ...situational].some((item) => !item.complete)) {
    throw new Error(`Hero ${heroId}: an intermediate component reached overview`);
  }
  if (core.filter((item) => /boots|treads/i.test(item.name)).length > 1) {
    throw new Error(`Hero ${heroId}: duplicate footwear reached core build`);
  }
  const hero = heroes[String(heroId)];
  console.log(`\n${hero?.localized_name || heroId}`);
  console.log(`  core: ${core.map((item) => `${item.name} (${item.timing.toFixed(1)}m)`).join(' -> ')}`);
  console.log(`  alternatives: ${situational.map((item) => item.name).join(', ')}`);
}
