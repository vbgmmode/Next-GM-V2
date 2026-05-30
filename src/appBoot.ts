export type AppBootRequest =
  | { type: "title" }
  | { type: "new-career" }
  | { type: "load-career"; saveId: string };
