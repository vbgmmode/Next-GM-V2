export type Morale = "happy" | "neutral" | "angry";
export type Role = "ace" | "main" | "upper" | "mid" | "prospect" | "tag";

export type WrestlerPortrait = {
  skin: string;
  hair: string;
  gear: string;
};

export type RosterMember = {
  id: string;
  rank: number;
  name: string;
  role: Role;
  style: string;
  pop: number;
  stamina: number;
  morale: Morale;
  overall: number;
  contract: string;
  cost: string;
  portrait: WrestlerPortrait;
  selected?: boolean;
};

export type Champion = {
  id: string;
  title: string;
  name: string;
  portrait: WrestlerPortrait;
};

export type Goal = {
  label: string;
  current: number;
  total: number;
  complete?: boolean;
};

export type Rivalry = {
  leftId: string;
  leftName: string;
  rightId: string;
  rightName: string;
  intensity: number;
};

export type ShowCardEntry = {
  match: string;
  stipulation: string;
};

export type DraftPoolEntry = {
  name: string;
  style: string;
};

export type Alert = {
  tone: "red" | "amber" | "gold";
  icon: "injury" | "contract" | "scout" | "power";
  message: string;
};

export const headerStats = {
  season: 2,
  week: 24,
  date: "Monday, June 9, 2025",
  budget: "$3,842,750",
  fans: "2,154,300",
  ranking: "#1 Worldwide",
  nextShow: "RAW",
  location: "New Orleans, LA",
};

export const brandStatus = {
  rating: 92,
  fans: "1,127,800",
  budget: "$2,117,500",
  weeklyProfit: "+$246,000",
};

const portrait = (
  skin: string,
  hair: string,
  gear: string,
): WrestlerPortrait => ({ skin, hair, gear });

export const wrestlerPortraits: Record<string, WrestlerPortrait> = {
  cody: portrait("#c89b74", "#080808", "#e01622"),
  roman: portrait("#b9845f", "#1a1a1a", "#171b20"),
  rhea: portrait("#c4956a", "#0a0a0a", "#e01622"),
  becky: portrait("#d4a574", "#8b4513", "#e01622"),
  gunther: portrait("#c4a07a", "#2a1810", "#333"),
  seth: portrait("#c89b74", "#1a1a1a", "#e01622"),
  newday: portrait("#b9845f", "#080808", "#d4af37"),
  jey: portrait("#c4956a", "#1a1a1a", "#005bff"),
  bron: portrait("#c89b74", "#080808", "#e01622"),
  io: portrait("#d4a574", "#1a1a1a", "#e01622"),
  alex: portrait("#c4956a", "#2a1810", "#333"),
  jordynne: portrait("#c89b74", "#080808", "#e01622"),
  joe: portrait("#b9845f", "#1a1a1a", "#333"),
  mjf: portrait("#c4956a", "#080808", "#e01622"),
  dragon: portrait("#d4a574", "#1a1a1a", "#005bff"),
};

export const roster: RosterMember[] = [
  { id: "cody", rank: 1, name: "Cody Rhodes", role: "ace", style: "Showman", pop: 95, stamina: 84, morale: "happy", overall: 94, contract: "22W", cost: "$128K", portrait: wrestlerPortraits.cody, selected: true },
  { id: "roman", rank: 2, name: "Roman Reigns", role: "ace", style: "Powerhouse", pop: 93, stamina: 72, morale: "neutral", overall: 92, contract: "18W", cost: "$122K", portrait: wrestlerPortraits.roman },
  { id: "rhea", rank: 3, name: "Rhea Ripley", role: "main", style: "Bruiser", pop: 91, stamina: 79, morale: "happy", overall: 91, contract: "16W", cost: "$118K", portrait: wrestlerPortraits.rhea },
  { id: "becky", rank: 4, name: "Becky Lynch", role: "main", style: "Striker", pop: 88, stamina: 66, morale: "neutral", overall: 88, contract: "9W", cost: "$96K", portrait: wrestlerPortraits.becky },
  { id: "gunther", rank: 5, name: "Gunther", role: "upper", style: "Powerhouse", pop: 87, stamina: 58, morale: "angry", overall: 87, contract: "7W", cost: "$92K", portrait: wrestlerPortraits.gunther },
  { id: "seth", rank: 6, name: "Seth Rollins", role: "upper", style: "Technician", pop: 86, stamina: 88, morale: "happy", overall: 86, contract: "14W", cost: "$84K", portrait: wrestlerPortraits.seth },
  { id: "newday", rank: 7, name: "The New Day", role: "tag", style: "Showman", pop: 85, stamina: 61, morale: "neutral", overall: 85, contract: "11W", cost: "$76K", portrait: wrestlerPortraits.newday },
  { id: "jey", rank: 8, name: "Jey Uso", role: "mid", style: "High Flyer", pop: 84, stamina: 74, morale: "happy", overall: 84, contract: "20W", cost: "$72K", portrait: wrestlerPortraits.jey },
  { id: "bron", rank: 9, name: "Bron Breakker", role: "mid", style: "Powerhouse", pop: 83, stamina: 49, morale: "angry", overall: 83, contract: "5W", cost: "$68K", portrait: wrestlerPortraits.bron },
  { id: "io", rank: 10, name: "Io Shirai", role: "prospect", style: "Cruiser", pop: 82, stamina: 91, morale: "happy", overall: 82, contract: "26W", cost: "$54K", portrait: wrestlerPortraits.io },
];

export const champions: Champion[] = [
  { id: "cody", title: "World Champion", name: "Cody Rhodes", portrait: wrestlerPortraits.cody },
  { id: "rhea", title: "Women's World Champion", name: "Rhea Ripley", portrait: wrestlerPortraits.rhea },
  { id: "newday", title: "Tag Team Champions", name: "The New Day", portrait: wrestlerPortraits.newday },
  { id: "gunther", title: "National Champion", name: "Gunther", portrait: wrestlerPortraits.gunther },
  { id: "jey", title: "Intercontinental Champion", name: "Jey Uso", portrait: wrestlerPortraits.jey },
];

export const goals: Goal[] = [
  { label: "Book 4 or more 4+ star matches", current: 3, total: 4 },
  { label: "Sign 2 top tier free agents", current: 1, total: 2 },
  { label: "Increase show ratings to 2.0M", current: 1, total: 1, complete: true },
  { label: "Win 2 more rivalries", current: 1, total: 2 },
];

export const rivalries: Rivalry[] = [
  { leftId: "cody", leftName: "Rhodes", rightId: "roman", rightName: "Reigns", intensity: 90 },
  { leftId: "seth", leftName: "Rollins", rightId: "bron", rightName: "Breakker", intensity: 75 },
  { leftId: "rhea", leftName: "Ripley", rightId: "becky", rightName: "Lynch", intensity: 80 },
];

export const showCard: ShowCardEntry[] = [
  { match: "Cody Rhodes vs Roman Reigns", stipulation: "World Championship" },
  { match: "Rhea Ripley vs Becky Lynch", stipulation: "Singles Match" },
  { match: "Seth Rollins vs Bron Breakker", stipulation: "Steel Cage Match" },
  { match: "Gunther vs Jey Uso", stipulation: "Singles Match" },
  { match: "The New Day vs Street Profits", stipulation: "Tag Team Match" },
  { match: "Io Shirai vs Open Challenge", stipulation: "Open Challenge" },
];

export const alerts: Alert[] = [
  { tone: "red", icon: "injury", message: "3 superstars are injured" },
  { tone: "amber", icon: "contract", message: "Contract expiring soon" },
  { tone: "gold", icon: "scout", message: "Scouting report available" },
  { tone: "gold", icon: "power", message: "Power card available" },
];

export const draftPool: DraftPoolEntry[] = [
  { name: "Alex Shelley", style: "Specialist" },
  { name: "Jordynne Grace", style: "Powerhouse" },
  { name: "Joe Hendry", style: "Technician" },
  { name: "MJF", style: "Showman" },
  { name: "Dragon Lee", style: "High Flyer" },
];

export const styleLegend = [
  "Powerhouse",
  "Technician",
  "Showman",
  "Striker",
  "Bruiser",
  "Cruiser",
  "High Flyer",
  "Specialist",
];

export const navTabs = [
  "Home",
  "Book Show",
  "Show Logistics",
  "Manage Roster",
  "Power Cards",
  "Season",
  "Finances",
  "GM Office",
  "Options",
];

export const tickerItems = [
  { tone: "green" as const, text: "Rhea Ripley's morale has increased" },
  { tone: "red" as const, text: "Injury update: Bron Breakker (2 weeks)" },
  { tone: "gold" as const, text: "RAW roster morale +3% this week" },
];
