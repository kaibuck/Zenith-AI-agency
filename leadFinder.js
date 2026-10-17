const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

// Finds local businesses with Google Places API (New) Text Search.
// e.g. query "HVAC contractor", location "Atlanta, GA"
const PLACES_URL = 'https://places.googleapis.com/v1/places:searchText';
const FIELDS = [
  'places.id',
  'places.displayName',
  'places.nationalPhoneNumber',
  'places.internationalPhoneNumber',
  'places.formattedAddress',
  'places.websiteUri',
  'places.rating',
  'places.userRatingCount',
  'places.businessStatus',
  'nextPageToken'
].join(',');

async function searchPlaces({ query, location, maxResults = 20 }) {
  const textQuery = location ? `${query} in ${location}` : query;
  const results = [];
  let pageToken;

  do {
    const response = await axios.post(
      PLACES_URL,
      { textQuery, pageSize: 20, pageToken },
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': process.env.GOOGLE_PLACES_API_KEY,
          'X-Goog-FieldMask': FIELDS
        }
      }
    );
    results.push(...(response.data.places || []));
    pageToken = response.data.nextPageToken;
  } while (pageToken && results.length < maxResults);

  return results.slice(0, maxResults);
}

async function findLeads({ query, location, maxResults }) {
  const places = await searchPlaces({ query, location, maxResults });
  return places
    .filter((p) => p.businessStatus !== 'CLOSED_PERMANENTLY' && (p.internationalPhoneNumber || p.nationalPhoneNumber))
    .map((p) => ({
      id: uuidv4(),
      placeId: p.id,
      businessName: p.displayName?.text,
      phone: p.internationalPhoneNumber || p.nationalPhoneNumber,
      address: p.formattedAddress,
      website: p.websiteUri || null,
      rating: p.rating || null,
      reviewCount: p.userRatingCount || 0,
      niche: query,
      location: location || null
    }));
}

module.exports = { findLeads };
