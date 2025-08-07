// Import the axios HTTP client library to make API requests
const axios = require('axios');

// Load environment variables from a .env file (for your API keys)
require('dotenv').config();

// Load your API keys from environment variables
const FOURSQUARE_API_KEY = process.env.FOURSQUARE_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

/**
 * ================================
 * Function: processUserInput
 * ================================
 * This function takes the raw user input (free text)
 * and sends it to the Gemini API to convert it to a structured JSON object.
 * Example: "I want 2 days in Paris, relaxed pace" --> { categories, location, duration, pace, budget }
 */
async function processUserInput(userInput) {
  try {
    // Make a POST request to Gemini API with your prompt
    const response = await axios.post(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent',
      {
        contents: [{
          parts: [{
            text: `Return ONLY a JSON object (no backticks, no markdown) for this trip request: "${userInput}". 
            Format: {
              "categories": [], 
              "location": "city name",
              "duration": number,
              "pace": "low/medium/high pace",
              "budget": "low/medium/high"
            }`
          }]
        }]
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'X-goog-api-key': GEMINI_API_KEY
        }
      }
    );

    // Extract the generated text from the API response
    let generatedText = response.data.candidates[0].content.parts[0].text;

    // Clean up any formatting Gemini might add (like ```json)
    generatedText = generatedText
      .replace(/```json/g, '') // Remove ```json if present
      .replace(/```/g, '')     // Remove any other ```
      .replace(/\n/g, '')      // Remove newlines
      .trim();                 // Trim spaces

    // Extract the JSON object from the response text
    const start = generatedText.indexOf('{');
    const end = generatedText.lastIndexOf('}') + 1;
    const jsonStr = generatedText.slice(start, end);

    // Parse the JSON string into a real JS object and return it
    return JSON.parse(jsonStr);

  } catch (error) {
    console.error('Gemini API Error:', error.message);

    // If something goes wrong, return a fallback example
    return {
      categories: ["food", "culture", "nature"],
      location: "Montreal",
      duration: 3,
      pace: "high",
      budget: "high"
    };
  }
}

/**
 * ================================
 * Function: searchPlaces
 * ================================
 * This calls the Foursquare Places API with search parameters.
 * Example: search for "coffee shops" near "Paris".
 */
async function searchPlaces(params) {
  try {
    const response = await axios.get(
      'https://places-api.foursquare.com/places/search',
      {
        headers: {
          'X-Places-Api-Version': '2025-06-17',
          'Accept': 'application/json',
          'Authorization': `Bearer ${FOURSQUARE_API_KEY}`
        },
        params // your query params (e.g. query, near, radius)
      }
    );

    // Return the list of places found
    return response.data.results;

  } catch (error) {
    console.error('Foursquare API Error:', error.message);
    throw error;
  }
}

/**
 * ================================
 * Function: generateTrip
 * ================================
 * This is the main function.
 * 1. Takes the user's text input.
 * 2. Converts it to structured preferences using Gemini.
 * 3. Calls Foursquare for each category.
 * 4. Builds a daily itinerary.
 */
async function generateTrip(userInput) {
  try {
    // Step 1: Use Gemini to process the user input
    const tripPreferences = await processUserInput(userInput);
    

    // Step 2: For each category, search for places
    const placesPromises = tripPreferences.categories.map(category => 
      searchPlaces({
        query: category,               // e.g. "food", "culture"
        near: tripPreferences.location, // e.g. "Montreal"
        limit: 5,                      // get up to 5 places
        sort: 'RATING'                 // optional: sort by rating
      })
    );

    // Wait for all category searches to finish
    const placesResults = await Promise.all(placesPromises);

    // Step 3: Build an itinerary for each day
    // Loop for the number of days
    const itinerary = Array.from({ length: tripPreferences.duration }, (_, i) => ({
      day: i + 1,
      places: placesResults.map(categoryPlaces => 
        // Pick 1 place per category for this day
        categoryPlaces[i % categoryPlaces.length]
      ).filter(Boolean) // Filter out undefined
    }));

    // Return the whole trip plan
    return {
      preferences: tripPreferences,
      itinerary
    };

  } catch (error) {
    console.error('Error generating trip:', error);
    throw error;
  }
}

/**
 * ================================
 * Function: test
 * ================================
 * This function just tests the flow end-to-end with an example input.
 */
async function test() {
  try {
    const trip = await generateTrip(
      "I want to spend 2 days in Bordeaux exploring food and culture. I am solo travelling and generally prefer a relaxed pace and a medium budget trip."
    );
    console.log(JSON.stringify(trip, null, 2));
  } catch (error) {
    console.error('Test Error:', error.message);
  }
}

// Run the test when you run `node thisfile.


// Run test
test();

module.exports = { generateTrip, processUserInput, searchPlaces };