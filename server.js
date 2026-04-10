const express = require('express');
const axios = require('axios');
const cors = require('cors');
const Joi = require('joi');

const app = express();
app.use(cors());
app.use(express.json());

// API key auth middleware
app.use((req, res, next) => {
  if (req.path === '/health') return next();
  const key = req.headers['x-api-key'];
  if (process.env.API_KEY && (!key || key !== process.env.API_KEY)) {
    return res.status(401).json({ success: false, error: 'Invalid or missing API key' });
  }
  next();
});

// Input validation schema
const jobTitleSchema = Joi.string().required().min(3).max(100);

// OpenAI API endpoint
const openAiApiEndpoint = 'https://api.openai.com/v1/completions';
const openAiApiKey = process.env.OPENAI_API_KEY;

app.get('/job-details', async (req, res) => {
  try {
    const { jobTitle } = req.query;

    // Validate input
    const { error } = jobTitleSchema.validate(jobTitle);
    if (error) {
      return res.status(400).json({ success: false, error: 'Invalid job title', message: error.details[0].message });
    }

    // Check for OpenAI API key
    if (!openAiApiKey) {
      return res.status(503).json({ success: false, error: 'OpenAI API key is missing', message: 'Please provide an OpenAI API key' });
    }

    // Generate prompt
    const prompt = `What is the salary range, required skills, and a short job description for a ${jobTitle} job? Provide a JSON response.`;

    // Make request to OpenAI API
    const response = await axios.post(openAiApiEndpoint, {
      prompt,
      model: 'text-davinci-002',
      max_tokens: 2048,
      n: 1,
      stop: null,
      temperature: 0.7,
    }, {
      headers: {
        'Authorization': `Bearer ${openAiApiKey}`,
        'Content-Type': 'application/json',
      },
    });

    // Extract data from response
    const data = response.data.choices[0].text;
    try {
      const jobData = JSON.parse(data);
      return res.json({ success: true, data: jobData });
    } catch (error) {
      return res.status(500).json({ success: false, error: 'Failed to parse response', message: 'Internal server error' });
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, error: 'Internal server error', message: 'Please try again later' });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  return res.json({ success: true, data: 'API is healthy' });
});

// 404 handler
app.use((req, res) => {
  return res.status(404).json({ success: false, error: 'Not found', message: 'Endpoint not found' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error(err);
  return res.status(500).json({ success: false, error: 'Internal server error', message: 'Please try again later' });
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});