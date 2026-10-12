// Solar math — sunrise/sunset for a coarse lat/lon + date (NOAA solar
// algorithm, simplified). Powers the W29 90-minute sunset warning. This is
// real astronomical math on the ZIP centroid — not a weather-service guess,
// and never precise GPS (the input is already coarse).

function toRad(d: number): number {
  return (d * Math.PI) / 180;
}
function toDeg(r: number): number {
  return (r * 180) / Math.PI;
}

/** Minutes since local midnight of sunrise/sunset for lat/lon on `date` (UTC). */
export function sunTimes(lat: number, lon: number, date: Date): { sunrise: number; sunset: number } | null {
  const start = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  const dayOfYear = Math.floor((start - Date.UTC(date.getUTCFullYear(), 0, 0)) / 86400000);
  const lngHour = lon / 15;
  const calc = (isSunrise: boolean) => {
    const t = dayOfYear + (isSunrise ? 6 - lngHour : 18 - lngHour) / 24;
    const M = 0.9856 * t - 3.289;
    let L = M + 1.916 * Math.sin(toRad(M)) + 0.02 * Math.sin(toRad(2 * M)) + 282.634;
    L = ((L % 360) + 360) % 360;
    let RA = toDeg(Math.atan(0.91764 * Math.tan(toRad(L))));
    RA = ((RA % 360) + 360) % 360;
    RA += Math.floor(L / 90) * 90 - Math.floor(RA / 90) * 90;
    RA /= 15;
    const sinDec = 0.39782 * Math.sin(toRad(L));
    const cosDec = Math.cos(Math.asin(sinDec));
    const cosH =
      (Math.cos(toRad(90.833)) - sinDec * Math.sin(toRad(lat))) / (cosDec * Math.cos(toRad(lat)));
    if (cosH > 1 || cosH < -1) return null; // polar day/night
    const H = isSunrise ? 360 - toDeg(Math.acos(cosH)) : toDeg(Math.acos(cosH));
    const T = H / 15 + RA - 0.06571 * t - 6.622;
    let UT = T - lngHour;
    UT = ((UT % 24) + 24) % 24;
    // Convert UTC minutes to the *viewer's* local minutes for display.
    const localOffsetMin = -date.getTimezoneOffset();
    return ((UT * 60 + localOffsetMin) % 1440 + 1440) % 1440;
  };
  const sunrise = calc(true);
  const sunset = calc(false);
  if (sunrise == null || sunset == null) return null;
  return { sunrise, sunset };
}

export function minutesToClock(mins: number): string {
  const h24 = Math.floor(mins / 60) % 24;
  const m = Math.floor(mins % 60);
  const ampm = h24 >= 12 ? "PM" : "AM";
  const h = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h}:${String(m).padStart(2, "0")} ${ampm}`;
}
