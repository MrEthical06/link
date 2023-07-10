const express = require('express');
const axios = require('axios');

const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());

app.use(express.json());



const port = process.env.PORT || 8080;
const BASE_URL = process.env.BASE_URL;
const API_URL = process.env.API_URL;
const META_URL = process.env.META_URL;

const https = require('https');
const fs = require('fs');

// Load SSL certificate files
  
  const sslOptions = {
    key: fs.readFileSync('privkey.pem'),      // Path to your private key file
    cert: fs.readFileSync('fullchain.pem'), // Path to your certificate file
  };

  const server = https.createServer(sslOptions, app);

app.get('/anime/epnum/:source/:anilistId', async (req, res) => {
    try {
        const startTime = new Date(); // Track the start time
      const { source, anilistId } = req.params;
  
      // Make the first API request to fetch the episodes and URLs
      const firstUrl = `${BASE_URL}/anime/ep/${source}/${anilistId}`;
      const { data: firstResponse } = await axios.get(firstUrl);
  
      // Extract the episodes from the first response
      const { episodes } = firstResponse;
  
      // Create an array of episode titles
      const episodeTitles = episodes.map((episode) => ({
        id: episode.id,
        title: episode.title || null,
        number: episode.number,
      }));
  
      // Create the response object with the episode titles and count
      const response = {
        source,
        epcount: episodes.length,
        episodes: episodeTitles,
      };
  
      const endTime = new Date(); // Track the end time
      const totalTime = endTime - startTime; // Calculate the total time taken in milliseconds
  
      console.log(`Route completed in ${totalTime}ms`); // Log the total time taken
      // Send the response
      res.json(response);
    } catch (error) {
      console.error('Error:', error.message);
      res.status(500).json({ error: 'An error occurred' });
    }
  });
  
app.get('/anime/ep/:anilistId', async (req, res) => {
  try {
    const startTime = new Date(); // Track the start time
    const { anilistId } = req.params;

    // Make the first API request to ${META_URL}anime/:anilistId
    const metaUrl = `${META_URL}anime/${anilistId}`;
    const { data: metaResponse } = await axios.get(metaUrl);

    // Extract the required IDs from the metaResponse
    const { gogoanimeId, zoroId, Marin, animepahe } = metaResponse;

    // Create an array of parallel API requests
    const apiRequests = [
      axios.get(`${API_URL}anime/animepahe/info/${animepahe}`),
      axios.get(`${API_URL}anime/gogoanime/info/${gogoanimeId}`).catch(() => null),
      axios.get(`${API_URL}anime/zoro/info/${zoroId}`).catch(() => null),
      axios.get(`${API_URL}anime/marin/info/${Marin}`).catch(() => null),
    ];

    // Execute the parallel API requests
    const apiResponses = await Promise.allSettled(apiRequests);

    // Extract the id and episodes from the successful responses
    const animepaheResponse = apiResponses[0].status === 'fulfilled' ? { id: animepahe, episodes: apiResponses[0].value.data?.episodes || [] } : null;
    const gogoanimeResponse = apiResponses[1]?.status === 'fulfilled' ? { id: gogoanimeId, episodes: apiResponses[1].value?.data?.episodes || [] } : null;
    const zoroResponse = apiResponses[2]?.status === 'fulfilled' ? { id: zoroId, episodes: apiResponses[2].value?.data?.episodes || [] } : null;
    const marinResponse = apiResponses[3]?.status === 'fulfilled' ? { id: Marin, episodes: apiResponses[3].value?.data?.episodes || [] } : null;

    const endTime = new Date(); // Track the end time
    const totalTime = endTime - startTime; // Calculate the total time taken in milliseconds

    console.log(`Route completed in ${totalTime}ms`); // Log the total time taken
    // Send the extracted responses
    res.json({
      animepahe: animepaheResponse,
      gogoanime: gogoanimeResponse,
      zoro: zoroResponse,
      marin: marinResponse,
    });
  } catch (error) {
    console.error('Error:', error.message);
    res.status(500).json({ error: 'An error occurred' });
  }
});

// Anime Episode Source Route
app.get('/anime/ep/:source/:anilistId', async (req, res) => {
    try {
        const startTime = new Date(); // Track the start time
      const { source, anilistId } = req.params;
  
      // Make the first API request to fetch the episodes and URLs
      const metaUrl = `${META_URL}anime/${anilistId}`;
      const { data: metaResponse } = await axios.get(metaUrl);
  
      // Extract the episodes from the metaResponse based on the requested source
      let sourceEpisodes = null;
      if (source === 'animepahe') {
        const { animepahe } = metaResponse;
        const { data: animepaheResponse } = await axios.get(`${API_URL}anime/animepahe/info/${animepahe}`);
        sourceEpisodes = animepaheResponse?.episodes || [];
      } else if (source === 'gogoanime' || source === 'gogo') {
        const { gogoanimeId } = metaResponse;
        const { data: gogoanimeResponse } = await axios.get(`${API_URL}anime/gogoanime/info/${gogoanimeId}`);
        sourceEpisodes = gogoanimeResponse?.episodes || [];
      } else if (source === 'zoro') {
        const { zoroId } = metaResponse;
        const { data: zoroResponse } = await axios.get(`${API_URL}anime/zoro/info/${zoroId}`);
        sourceEpisodes = zoroResponse?.episodes || [];
      } else if (source === 'marin') {
        const { Marin } = metaResponse;
        const { data: marinResponse } = await axios.get(`${API_URL}anime/marin/info/${Marin}`);
        sourceEpisodes = marinResponse?.episodes || [];
      }
  
      const endTime = new Date(); // Track the end time
      const totalTime = endTime - startTime; // Calculate the total time taken in milliseconds
  
      console.log(`Route completed in ${totalTime}ms`); // Log the total time taken
      // Send the source episodes
      res.json({ episodes: sourceEpisodes });
    } catch (error) {
      console.error('Error:', error.message);
      res.status(500).json({ error: 'An error occurred' });
    }
  });
  

app.get('/anime/link/:anilistId', async (req, res) => {
    try {
      const { anilistId } = req.params;
  
      const startTime = new Date(); // Track the start time
  
      // Make the first API request to fetch the episodes and URLs
      const firstUrl = `${BASE_URL}/anime/ep/${anilistId}`;
      const { data: firstResponse } = await axios.get(firstUrl);
  
      // Extract the episodes from the first response
      const { animepahe, gogoanime, zoro, marin } = firstResponse;
  
      // Function to fetch the episode links using the episode IDs
      const fetchEpisodeLink = async (source, marinId, episodeId, episodeNumber) => {
        try {
          let url;
          if (source === 'marin') {
            url = `${API_URL}anime/marin/watch/${episodeId}`;
          } else {
            url = `${API_URL}anime/${source}/watch/${episodeId}`;
          }
          const { data: episodeResponse } = await axios.get(url);
  
          let link;
          if (source === 'marin') {
            link = episodeResponse.sources;
          } else {
            link = episodeResponse.sources;
          }
  
          return { link, number: episodeNumber };
        } catch (error) {
          console.error(`Error fetching episode link from ${source}:`, error.message);
          return { link: null, number: episodeNumber, error: true };
        }
      };
  
      // Create an object to hold the responses for each source
      const responseObj = {
        animepahe: {},
        gogoanime: {},
        zoro: {},
        marin: {},
      };
  
      // Fetch episode links for animepahe episodes
      responseObj.animepahe = await Promise.all(
        animepahe?.episodes.map(async (episode) => {
          const episodeLink = await fetchEpisodeLink('animepahe', '', episode.id, episode.number);
          return { id: episode.id, number: episode.number, link: episodeLink };
        }) || []
      );
  
      // Fetch episode links for gogoanime episodes
      responseObj.gogoanime = await Promise.all(
        gogoanime?.episodes.map(async (episode) => {
          const episodeLink = await fetchEpisodeLink('gogoanime', '', episode.id, episode.number);
          return { id: episode.id, number: episode.number, link: episodeLink };
        }) || []
      );
  
      // Fetch episode links for zoro episodes
      responseObj.zoro = await Promise.all(
        zoro?.episodes.map(async (episode) => {
          const episodeLink = await fetchEpisodeLink('zoro', '', episode.id, episode.number);
          return { id: episode.id, number: episode.number, link: episodeLink };
        }) || []
      );
  
      // Fetch episode links for marin episodes
      responseObj.marin = await Promise.all(
        marin?.episodes.map(async (episode) => {
          const episodeLink = await fetchEpisodeLink('marin', marin.id, episode.id, episode.number);
          return { id: episode.id, number: episode.number, link: episodeLink };
        }) || []
      );
  
      const endTime = new Date(); // Track the end time
      const totalTime = endTime - startTime; // Calculate the total time taken in milliseconds
  
      console.log(`Route completed in ${totalTime}ms`); // Log the total time taken
  
      // Send the response object
      res.json(responseObj);
    } catch (error) {
      console.error('Error:', error.message);
      res.status(500).json({ error: 'An error occurred' });
    }
  });
  
  // Anime Link Source Routes
  app.get('/anime/link/:source/:anilistId', async (req, res) => {
    try {
        
      const startTime = new Date(); // Track the start time
      const { source, anilistId } = req.params;
  
      // Make the first API request to fetch the episodes and URLs
      const firstUrl = `${BASE_URL}/anime/ep/${source}/${anilistId}`;
      const { data: firstResponse } = await axios.get(firstUrl);
      // Extract the episodes from the first response
      const { episodes } = firstResponse;
  
      // Fetch the source for each episode individually
      const episodePromises = episodes.map(async (episode) => {
        try {
          const episodeUrl = `${API_URL}anime/${source}/watch/${episode.id}`;
          console.log(episode.id)
          const { data: episodeResponse } = await axios.get(episodeUrl);
          const link = episodeResponse || null;
          return { source: source,id: episode.id, number: episode.number, link };
        } catch (error) {
          console.error(`Error fetching episode link for episode ${episode.number} from ${source}:`, error.message);
          return {id: episode.id, number: episode.number, source: source, link: null, error: true };
        }
      });
  
      // Wait for all the episode promises to resolve
      const episodeResults = await Promise.all(episodePromises);
  
      
      const endTime = new Date(); // Track the end time
      const totalTime = endTime - startTime; // Calculate the total time taken in milliseconds
  
      console.log(`Route completed in ${totalTime}ms`); // Log the total time taken
      // Send the response
      res.json(episodeResults);
    } catch (error) {
      console.error('Error:', error.message);
      res.status(500).json({ error: error.message });
    }
  });
  

  app.get('/anime/link/:source/:anilistId/:number', async (req, res) => {
    try {
        const startTime = new Date(); // Track the start time
      const { source, anilistId, number } = req.params;
  
      // Make the first API request to fetch the episodes and URLs
      const firstUrl = `${BASE_URL}/anime/ep/${source}/${anilistId}`;
      const { data: firstResponse } = await axios.get(firstUrl);
  
      // Extract the episodes from the first response
      const { episodes } = firstResponse;
  
      // Find the episode with the specified number
      const targetEpisode = episodes.find((episode) => episode.number === Number(number));
  
      if (!targetEpisode) {
        res.status(404).json({ error: 'Episode not found' });
        return;
      }
  
      // Fetch the source for the target episode
      const episodeUrl = `${API_URL}anime/${source}/watch/${targetEpisode.id}`;
      const { data: episodeResponse } = await axios.get(episodeUrl);
      const link = episodeResponse || null;
  
      // Create the response object with the episode source
      const response = { source, episode: { id: targetEpisode.id, number: targetEpisode.number, link } };
  
      const endTime = new Date(); // Track the end time
      const totalTime = endTime - startTime; // Calculate the total time taken in milliseconds
  
      console.log(`Route completed in ${totalTime}ms`); // Log the total time taken
      // Send the response
      res.json(response);
    } catch (error) {
      console.error('Error:', error.message);
      res.status(500).json({ error: 'An error occurred' });
    }
  });
  

server.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
