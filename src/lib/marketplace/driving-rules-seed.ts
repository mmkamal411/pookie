// Verified GA/FL driving-rules snapshot — mirrors PENDING-MIGRATIONS.md
// Unit P3 (P3.1/P3.2) row-for-row. Source: GA DDS Parent Teen Driving Guide
// 2024–2025 (dds.georgia.gov) and FLHSMV teen licensing pages, verified
// 2026-10-12. The /api/v1/marketplace/driving/rules route serves this ONLY
// when the real `driving_rules` table is not yet applied (migration freeze);
// the database wins whenever it exists. BACKLOG R-007: every rule carries
// its verification date, shown in the UI.

export interface DrivingRule {
  state_code: string;
  rule_code: string;
  category: "permit" | "supervised_hours" | "provisional" | "full_license";
  title: string;
  summary_md: string;
  min_age_years: number | null;
  source_name: string;
  source_url: string;
  rules_verified_at: string;
  from_snapshot: boolean;
}

export const DRIVING_RULES_SNAPSHOT: DrivingRule[] = [
  {
    state_code: "GA",
    rule_code: "permit.min_age",
    category: "permit",
    title: "Learner's permit (Class CP) at 15",
    summary_md:
      "At 15 you can apply for a Class CP instructional permit. You must pass a vision exam and a knowledge exam. The fee is $10. A parent, guardian, or driver-training instructor must sign the application.",
    min_age_years: 15,
    source_name: "GA DDS — Parent Teen Driving Guide 2024–2025",
    source_url: "https://dds.georgia.gov/media/12841/download",
    rules_verified_at: "2026-10-12",
    from_snapshot: true,
  },
  {
    state_code: "GA",
    rule_code: "permit.supervision",
    category: "permit",
    title: "Permit driving: supervised, no late nights",
    summary_md:
      "With a permit you may only drive with a licensed driver age 21+ in the front seat. No driving from 12:00 midnight to 5:00 AM — no exceptions.",
    min_age_years: 15,
    source_name: "GA DDS — Parent Teen Driving Guide 2024–2025",
    source_url: "https://dds.georgia.gov/media/12841/download",
    rules_verified_at: "2026-10-12",
    from_snapshot: true,
  },
  {
    state_code: "GA",
    rule_code: "hours.joshuas_law",
    category: "supervised_hours",
    title: "Joshua's Law: 30 hours class + 40 hours driving",
    summary_md:
      "Before your Class D test you must finish a 30-hour driver education course and log 40 hours of supervised driving, with at least 6 hours at night.",
    min_age_years: null,
    source_name: "GA DDS — Parent Teen Driving Guide 2024–2025",
    source_url: "https://dds.georgia.gov/media/12841/download",
    rules_verified_at: "2026-10-12",
    from_snapshot: true,
  },
  {
    state_code: "GA",
    rule_code: "provisional.eligibility",
    category: "provisional",
    title: "Class D provisional license at 16",
    summary_md:
      "At 16, after holding your permit for 1 year and a day with no major violations, and finishing Joshua's Law, you can take the road test for a Class D provisional license.",
    min_age_years: 16,
    source_name: "GA DDS — Parent Teen Driving Guide 2024–2025",
    source_url: "https://dds.georgia.gov/media/12841/download",
    rules_verified_at: "2026-10-12",
    from_snapshot: true,
  },
  {
    state_code: "GA",
    rule_code: "provisional.night",
    category: "provisional",
    title: "Class D: no driving midnight–5 AM",
    summary_md:
      "Class D holders may not drive between midnight and 5:00 AM. The trip purpose does not matter — no work or school exception.",
    min_age_years: 16,
    source_name: "GA TADRA summary (citing GA licensing code)",
    source_url: "https://www.georgiacriminaldefense.com/blog/curfew-16-year-olds/",
    rules_verified_at: "2026-10-12",
    from_snapshot: true,
  },
  {
    state_code: "GA",
    rule_code: "provisional.passengers",
    category: "provisional",
    title: "Class D: passenger limits phase in",
    summary_md:
      "First 6 months: immediate family passengers only. Months 7–12: at most 1 non-family passenger under 21. After 12 months: at most 3 non-family passengers under 21.",
    min_age_years: 16,
    source_name: "GA TADRA summary (citing GA licensing code)",
    source_url: "https://www.georgiacriminaldefense.com/blog/curfew-16-year-olds/",
    rules_verified_at: "2026-10-12",
    from_snapshot: true,
  },
  {
    state_code: "GA",
    rule_code: "full.class_c",
    category: "full_license",
    title: "Full Class C license at 18",
    summary_md:
      "At 18 you can get an unrestricted Class C license, as long as your Class D is not suspended and you have gone 12 months without a disqualifying conviction.",
    min_age_years: 18,
    source_name: "GA DDS — Parent Teen Driving Guide 2024–2025",
    source_url: "https://dds.georgia.gov/media/12841/download",
    rules_verified_at: "2026-10-12",
    from_snapshot: true,
  },
  {
    state_code: "FL",
    rule_code: "permit.min_age",
    category: "permit",
    title: "Learner's license at 15",
    summary_md:
      "At 15 you can get a learner's license after a traffic law and substance abuse course and vision and hearing tests. A parent or guardian must sign if you are under 18.",
    min_age_years: 15,
    source_name: "FLHSMV — Licensing Requirements for Teens",
    source_url:
      "https://flhsmv.gov/driver-licenses-id-cards/licensing-requirements-teens-graduated-driver-license-laws-driving-curfews/",
    rules_verified_at: "2026-10-12",
    from_snapshot: true,
  },
  {
    state_code: "FL",
    rule_code: "permit.supervision",
    category: "permit",
    title: "Learner's: 21+ supervisor, daylight only at first",
    summary_md:
      "Always drive with a licensed driver age 21+ in the front seat. The first 3 months: daylight hours only. After that: until 10 PM. Hold the permit at least 12 months.",
    min_age_years: 15,
    source_name: "FLHSMV — Licensing Requirements for Teens",
    source_url:
      "https://flhsmv.gov/driver-licenses-id-cards/licensing-requirements-teens-graduated-driver-license-laws-driving-curfews/",
    rules_verified_at: "2026-10-12",
    from_snapshot: true,
  },
  {
    state_code: "FL",
    rule_code: "hours.supervised",
    category: "supervised_hours",
    title: "50 hours supervised, 10 at night",
    summary_md:
      "Before your Class E test you must log 50 hours of supervised driving, with at least 10 hours at night, certified by a parent or guardian. No traffic convictions on the permit.",
    min_age_years: null,
    source_name: "FLHSMV — Licensing Requirements for Teens",
    source_url:
      "https://flhsmv.gov/driver-licenses-id-cards/licensing-requirements-teens-graduated-driver-license-laws-driving-curfews/",
    rules_verified_at: "2026-10-12",
    from_snapshot: true,
  },
  {
    state_code: "FL",
    rule_code: "provisional.age16",
    category: "provisional",
    title: "Class E at 16: 6 AM–11 PM",
    summary_md:
      "At 16, driving is allowed only between 6 AM and 11 PM, unless driving to or from work or with a licensed driver age 21+.",
    min_age_years: 16,
    source_name: "FLHSMV — Licensing Requirements for Teens",
    source_url:
      "https://flhsmv.gov/driver-licenses-id-cards/licensing-requirements-teens-graduated-driver-license-laws-driving-curfews/",
    rules_verified_at: "2026-10-12",
    from_snapshot: true,
  },
  {
    state_code: "FL",
    rule_code: "provisional.age17",
    category: "provisional",
    title: "Class E at 17: 5 AM–1 AM",
    summary_md:
      "At 17, driving is allowed only between 5 AM and 1 AM, unless driving to or from work or with a licensed driver age 21+.",
    min_age_years: 17,
    source_name: "FLHSMV — Licensing Requirements for Teens",
    source_url:
      "https://flhsmv.gov/driver-licenses-id-cards/licensing-requirements-teens-graduated-driver-license-laws-driving-curfews/",
    rules_verified_at: "2026-10-12",
    from_snapshot: true,
  },
  {
    state_code: "FL",
    rule_code: "full.unrestricted",
    category: "full_license",
    title: "Full license at 18",
    summary_md: "At 18 the Class E license is fully privileged: no time restrictions.",
    min_age_years: 18,
    source_name: "FLHSMV — Licensing Requirements for Teens",
    source_url:
      "https://flhsmv.gov/driver-licenses-id-cards/licensing-requirements-teens-graduated-driver-license-laws-driving-curfews/",
    rules_verified_at: "2026-10-12",
    from_snapshot: true,
  },
];

/** Supervised-hour targets per state (minutes), from the same verified sources. */
export const DRIVING_HOUR_TARGETS: Record<string, { total: number; night: number }> = {
  GA: { total: 40 * 60, night: 6 * 60 },
  FL: { total: 50 * 60, night: 10 * 60 },
};
