import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from "@aws-sdk/client-secrets-manager";

/**
 * Fetch Google Maps API key from AWS Secrets Manager
 */
async function getGoogleApiKey() {
  const client = new SecretsManagerClient({ region: process.env.AWS_REGION });

  const command = new GetSecretValueCommand({
    SecretId: `Geocoding-${process.env.STAGE}`,
  });

  const response = await client.send(command);

  if (!response.SecretString) {
    throw new Error("Google API key not found in Secrets Manager");
  }

  /**
   * If secret is stored as plain text:
   *   "AIzaXXXX"
   *
   * If stored as JSON:
   *   { "API_KEY": "AIzaXXXX" }
   */
  try {
    const parsed = JSON.parse(response.SecretString);
    return parsed.API_KEY;
  } catch {
    return response.SecretString;
  }
}

/**
 * Fetch latitude & longitude for a given address
 * @param {Object} address
 * @param {string} address.street
 * @param {string} address.city
 * @param {string} address.zipcode
 * @returns {Promise<{ lat: number, lng: number }>}
 */
export async function getCoordinates(address: {
  street: string | undefined;
  city: string | undefined;
  state: string | undefined;
  zipCode: string | undefined;
}): Promise<{ latitude: number; longitude: number }> {
  console.info("Getting coordinates for address:", address);

  const { street, city, state, zipCode } = address;

  if (!street || !city || !state || !zipCode) {
    console.error("Invalid address:", address);
    throw new Error("Invalid address: street, city, and zipcode are required.");
  }

  console.info("Fetching Google API key");

  const apiKey = await getGoogleApiKey();

  const encodedAddress = encodeURIComponent(
    `${street}, ${city}, ${state}, ${zipCode}`
  );

  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedAddress}&key=${apiKey}`;

  const response = await fetch(url);

  console.info("Google Maps API response:", response);

  const data = await response.json();

  if (data.status !== "OK" || !data.results?.length) {
    console.error("Geocoding failed:", data);

    throw new Error(`Geocoding failed: ${data.status}`);
  }

  const { lat, lng } = data.results[0].geometry.location;

  console.info("Coordinates:", { latitude: lat, longitude: lng });

  return { latitude: lat, longitude: lng };
}
