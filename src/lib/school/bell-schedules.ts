// Walton High School bell schedules — curated from cobbk12.org/walton.
// Title Case. Daily + WEB Day variants (WEB = shortened periods with A–E
// enrichment blocks in the afternoon).

export interface BellRow {
  period: string;
  start: string;
  end: string;
}

export const WALTON_DAILY: BellRow[] = [
  { period: "0 Period", start: "7:10", end: "8:13" },
  { period: "1st", start: "8:20", end: "9:13" },
  { period: "HR", start: "9:20", end: "9:30" },
  { period: "2nd", start: "9:37", end: "10:30" },
  { period: "3rd", start: "10:37", end: "11:30" },
  { period: "4th", start: "11:37", end: "12:30" },
  { period: "5th", start: "12:37", end: "1:30" },
  { period: "6th", start: "1:37", end: "2:30" },
  { period: "7th", start: "2:37", end: "3:30" },
];

export const WALTON_WEB: BellRow[] = [
  { period: "1st", start: "8:20", end: "8:49" },
  { period: "HR", start: "8:56", end: "9:05" },
  { period: "2nd", start: "9:12", end: "9:40" },
  { period: "3rd", start: "9:47", end: "10:15" },
  { period: "4th", start: "10:22", end: "10:50" },
  { period: "5th", start: "10:57", end: "11:25" },
  { period: "6th", start: "11:32", end: "12:00" },
  { period: "7th", start: "12:07", end: "12:35" },
  { period: "Q Block", start: "12:35", end: "12:55" },
  { period: "A", start: "1:00", end: "1:25" },
  { period: "B", start: "1:30", end: "1:55" },
  { period: "C", start: "2:00", end: "2:25" },
  { period: "D", start: "2:30", end: "2:55" },
  { period: "E", start: "3:00", end: "3:25" },
];

export const BELL_SCHEDULE_SOURCE = "https://www.cobbk12.org/walton/bell-schedule";
