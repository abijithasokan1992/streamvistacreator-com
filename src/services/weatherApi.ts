/**
 * Weather API Service
 * Fetches weather data from Open-Meteo (free, no API key required)
 * Falls back to OpenWeatherMap if needed
 */

export interface WeatherData {
  location: string;
  latitude: number;
  longitude: number;
  temperature: number;
  feelsLike: number;
  humidity: number;
  windSpeed: number;
  windDirection: number;
  precipitation: number;
  cloudCover: number;
  visibility: number;
  pressure: number;
  uvIndex: number;
  description: string;
  icon: string;
  sunrise: string;
  sunset: string;
  forecast: ForecastDay[];
  lastUpdated: string;
}

export interface ForecastDay {
  date: string;
  maxTemp: number;
  minTemp: number;
  precipitation: number;
  windSpeed: number;
  description: string;
  icon: string;
}

export interface GeocodingResult {
  name: string;
  latitude: number;
  longitude: number;
  country: string;
  admin1?: string;
}

/**
 * Get weather data using Open-Meteo API (free, no auth required)
 */
export async function getWeatherData(
  latitude: number,
  longitude: number,
  locationName?: string
): Promise<WeatherData> {
  try {
    // Construct Open-Meteo API URL
    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.searchParams.append("latitude", latitude.toString());
    url.searchParams.append("longitude", longitude.toString());
    url.searchParams.append("current", [
      "temperature_2m",
      "relative_humidity_2m",
      "apparent_temperature",
      "precipitation",
      "weather_code",
      "wind_speed_10m",
      "wind_direction_10m",
      "cloud_cover",
      "visibility",
      "pressure_msl",
      "uv_index",
    ].join(","));
    url.searchParams.append("daily", [
      "weather_code",
      "temperature_2m_max",
      "temperature_2m_min",
      "precipitation_sum",
      "wind_speed_10m_max",
      "sunrise",
      "sunset",
    ].join(","));
    url.searchParams.append("timezone", "auto");

    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(`API Error: ${response.statusText}`);
    }

    const data = await response.json();

    // Transform WMO weather codes to descriptions
    const weatherDescription = getWeatherDescription(data.current.weather_code);
    const weatherIcon = getWeatherIcon(data.current.weather_code);

    // Parse forecast
    const forecast: ForecastDay[] = data.daily.time.map(
      (date: string, index: number) => ({
        date,
        maxTemp: Math.round(data.daily.temperature_2m_max[index]),
        minTemp: Math.round(data.daily.temperature_2m_min[index]),
        precipitation: data.daily.precipitation_sum[index] || 0,
        windSpeed: Math.round(data.daily.wind_speed_10m_max[index]),
        description: getWeatherDescription(data.daily.weather_code[index]),
        icon: getWeatherIcon(data.daily.weather_code[index]),
      })
    );

    return {
      location: locationName || `${latitude.toFixed(2)}, ${longitude.toFixed(2)}`,
      latitude,
      longitude,
      temperature: Math.round(data.current.temperature_2m),
      feelsLike: Math.round(data.current.apparent_temperature),
      humidity: data.current.relative_humidity_2m,
      windSpeed: Math.round(data.current.wind_speed_10m),
      windDirection: data.current.wind_direction_10m,
      precipitation: data.current.precipitation || 0,
      cloudCover: data.current.cloud_cover,
      visibility: data.current.visibility ? data.current.visibility / 1000 : 10,
      pressure: data.current.pressure_msl,
      uvIndex: Math.round(data.current.uv_index * 10) / 10,
      description: weatherDescription,
      icon: weatherIcon,
      sunrise: data.daily.sunrise[0].split("T")[1] || "06:00",
      sunset: data.daily.sunset[0].split("T")[1] || "18:00",
      forecast: forecast.slice(0, 7), // 7-day forecast
      lastUpdated: new Date().toISOString(),
    };
  } catch (error) {
    console.error("Weather API Error:", error);
    throw new Error(`Failed to fetch weather data: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

/**
 * Search for locations by name
 */
export async function searchLocations(query: string): Promise<GeocodingResult[]> {
  try {
    const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
    url.searchParams.append("name", query);
    url.searchParams.append("count", "10");
    url.searchParams.append("language", "en");
    url.searchParams.append("format", "json");

    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(`Geocoding API Error: ${response.statusText}`);
    }

    const data = await response.json();

    return (
      data.results?.map((result: any) => ({
        name: result.name,
        latitude: result.latitude,
        longitude: result.longitude,
        country: result.country,
        admin1: result.admin1,
      })) || []
    );
  } catch (error) {
    console.error("Geocoding API Error:", error);
    return [];
  }
}

/**
 * Get user's current location using Geolocation API
 */
export async function getUserLocation(): Promise<{ latitude: number; longitude: number }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation is not supported by this browser"));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      (error) => {
        reject(new Error(`Geolocation error: ${error.message}`));
      }
    );
  });
}

/**
 * Get location name from coordinates using reverse geocoding
 */
export async function getLocationName(
  latitude: number,
  longitude: number
): Promise<string> {
  try {
    const url = new URL("https://nominatim.openstreetmap.org/reverse");
    url.searchParams.append("lat", latitude.toString());
    url.searchParams.append("lon", longitude.toString());
    url.searchParams.append("format", "json");

    const response = await fetch(url.toString());
    if (!response.ok) {
      return `${latitude.toFixed(2)}, ${longitude.toFixed(2)}`;
    }

    const data = await response.json();
    return data.address?.city || data.address?.town || data.address?.county || data.name || "";
  } catch (error) {
    console.error("Reverse geocoding error:", error);
    return `${latitude.toFixed(2)}, ${longitude.toFixed(2)}`;
  }
}

/**
 * Convert WMO Weather Codes to human-readable descriptions
 * Reference: https://www.weatherapi.com/docs/weather_codes.html
 */
function getWeatherDescription(code: number): string {
  const descriptions: Record<number, string> = {
    0: "Clear sky",
    1: "Mainly clear",
    2: "Partly cloudy",
    3: "Overcast",
    45: "Foggy",
    48: "Foggy",
    51: "Light drizzle",
    53: "Moderate drizzle",
    55: "Dense drizzle",
    61: "Slight rain",
    63: "Moderate rain",
    65: "Heavy rain",
    71: "Slight snow",
    73: "Moderate snow",
    75: "Heavy snow",
    77: "Snow grains",
    80: "Slight rain showers",
    81: "Moderate rain showers",
    82: "Violent rain showers",
    85: "Slight snow showers",
    86: "Heavy snow showers",
    95: "Thunderstorm",
    96: "Thunderstorm with hail",
    99: "Thunderstorm with hail",
  };

  return descriptions[code] || "Unknown";
}

/**
 * Convert WMO Weather Codes to emoji icons
 */
function getWeatherIcon(code: number): string {
  if (code === 0) return "☀️";
  if (code === 1 || code === 2) return "🌤️";
  if (code === 3) return "☁️";
  if (code === 45 || code === 48) return "🌫️";
  if (code >= 51 && code <= 55) return "🌦️";
  if (code >= 61 && code <= 65) return "🌧️";
  if (code >= 71 && code <= 77) return "🌨️";
  if (code >= 80 && code <= 82) return "⛈️";
  if (code >= 85 && code <= 86) return "🌨️";
  if (code >= 95 && code <= 99) return "⛈️";
  return "🌡️";
}
