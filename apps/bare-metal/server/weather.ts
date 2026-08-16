const MELBOURNE_TZ = "Australia/Melbourne";
const RAIN_THRESHOLD_PERCENT = 30;
const OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast";

export type WeatherHourly = {
  time: string[];
  precipitation_probability: number[];
  precipitation: number[];
  temperature_2m: number[];
  wind_speed_10m: number[];
};

export type PublicForecast = {
  city: "Melbourne";
  objective: string;
  targetTime: string;
  rainProbabilityPercent: number;
  temperatureC: number;
  willRainAt1Pm: boolean;
  provider: "Open-Meteo";
};

export type RooftopForecast = PublicForecast & {
  precipitationMm: number;
  windSpeedKmh: number;
  recommendation: string;
};

function melbourneParts(now: Date) {
  const parts = new Intl.DateTimeFormat("en-AU", {
    timeZone: MELBOURNE_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const read = (type: string) => parts.find((part) => part.type === type)?.value ?? "0";
  return {
    year: Number(read("year")),
    month: Number(read("month")),
    day: Number(read("day")),
    hour: Number(read("hour")),
  };
}

function melbourneOnePmUtc(year: number, month: number, day: number) {
  const utcGuess = Date.UTC(year, month - 1, day, 3, 0, 0);
  const local = melbourneParts(new Date(utcGuess));
  const driftHours = local.hour - 13;
  return new Date(utcGuess - driftHours * 60 * 60 * 1000);
}

export function nextMelbourneOnePm(now = new Date()) {
  const local = melbourneParts(now);
  if (local.hour < 13) {
    return melbourneOnePmUtc(local.year, local.month, local.day);
  }
  const next = new Date(Date.UTC(local.year, local.month - 1, local.day + 1));
  const rolled = melbourneParts(next);
  return melbourneOnePmUtc(rolled.year, rolled.month, rolled.day);
}

export function melbourneForecastFromHourly(
  tier: "public",
  hourly: WeatherHourly,
  targetTime: string,
): PublicForecast;
export function melbourneForecastFromHourly(
  tier: "rooftop",
  hourly: WeatherHourly,
  targetTime: string,
): RooftopForecast;
export function melbourneForecastFromHourly(
  tier: "public" | "rooftop",
  hourly: WeatherHourly,
  targetTime: string,
): PublicForecast | RooftopForecast {
  const targetLocal = new Intl.DateTimeFormat("sv-SE", {
    timeZone: MELBOURNE_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  })
    .format(new Date(targetTime))
    .replace(" ", "T");
  const index = hourly.time.findIndex((time) => time.startsWith(targetLocal.slice(0, 13)));
  const hourIndex = index >= 0 ? index : 0;
  const rainProbabilityPercent = hourly.precipitation_probability[hourIndex] ?? 0;
  const precipitationMm = hourly.precipitation[hourIndex] ?? 0;
  const temperatureC = hourly.temperature_2m[hourIndex] ?? 0;
  const windSpeedKmh = hourly.wind_speed_10m[hourIndex] ?? 0;
  const willRainAt1Pm = rainProbabilityPercent >= RAIN_THRESHOLD_PERCENT || precipitationMm > 0;
  const publicForecast: PublicForecast = {
    city: "Melbourne",
    objective: "Will it rain in Melbourne at 1 PM?",
    targetTime,
    rainProbabilityPercent,
    temperatureC,
    willRainAt1Pm,
    provider: "Open-Meteo",
  };
  if (tier === "public") return publicForecast;
  return {
    ...publicForecast,
    precipitationMm,
    windSpeedKmh,
    recommendation: willRainAt1Pm
      ? "Take cover for the rooftop lunch — rain is likely at 1 PM."
      : "Rooftop lunch looks clear at 1 PM.",
  };
}

export async function getMelbourneWeather(
  tier: "public" | "rooftop",
  options: { fetch?: typeof fetch; now?: Date } = {},
) {
  const target = nextMelbourneOnePm(options.now);
  const targetDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: MELBOURNE_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(target);
  const url = new URL(OPEN_METEO_URL);
  url.searchParams.set("latitude", "-37.8136");
  url.searchParams.set("longitude", "144.9631");
  url.searchParams.set(
    "hourly",
    "temperature_2m,precipitation_probability,precipitation,wind_speed_10m",
  );
  url.searchParams.set("timezone", MELBOURNE_TZ);
  url.searchParams.set("start_date", targetDate);
  url.searchParams.set("end_date", targetDate);

  const fetcher = options.fetch ?? fetch;
  const response = await fetcher(url);
  if (!response.ok) {
    throw new Error(`Open-Meteo returned HTTP ${response.status}`);
  }
  const body = (await response.json()) as { hourly?: WeatherHourly };
  if (!body.hourly?.time?.length) {
    throw new Error("Open-Meteo omitted the Melbourne 1 PM hour");
  }
  if (tier === "public") {
    return melbourneForecastFromHourly("public", body.hourly, target.toISOString());
  }
  return melbourneForecastFromHourly("rooftop", body.hourly, target.toISOString());
}
