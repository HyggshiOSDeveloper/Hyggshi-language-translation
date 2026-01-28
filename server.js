// server.js - Deploy this to cloudflare
// npm install express cors @google/generative-ai dotenv

const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize Gemini API
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Language name mapping
const languageNames = {
    'es': 'Spanish',
    'fr': 'French',
    'de': 'German',
    'ja': 'Japanese',
    'zh': 'Chinese',
    'ko': 'Korean',
    'it': 'Italian',
    'pt': 'Portuguese',
    'ru': 'Russian',
    'ar': 'Arabic'
};

// Translation endpoint
app.post('/translate', async (req, res) => {
    try {
        const { text, targetLanguage } = req.body;

        // Validation
        if (!text || !targetLanguage) {
            return res.status(400).json({ 
                error: 'Missing required fields: text and targetLanguage' 
            });
        }

        if (text.length > 1000) {
            return res.status(400).json({ 
                error: 'Text too long (max 1000 characters)' 
            });
        }

        const targetLangName = languageNames[targetLanguage] || targetLanguage;

        // Get Gemini model
        const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });

        // Create translation prompt
        const prompt = `Translate the following text to ${targetLangName}. Only provide the translation, no explanations or additional text:

${text}`;

        // Generate translation
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const translation = response.text().trim();

        // Return translation
        res.json({ 
            translation: translation,
            sourceText: text,
            targetLanguage: targetLangName
        });

    } catch (error) {
        console.error('Translation error:', error);
        res.status(500).json({ 
            error: 'Translation failed',
            details: error.message 
        });
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok', message: 'Translation service is running' });
});

// Root endpoint
app.get('/', (req, res) => {
    res.json({ 
        service: 'Roblox Translation API',
        version: '1.0.0',
        endpoints: {
            translate: 'POST /translate',
            health: 'GET /health'
        }
    });
});

app.listen(PORT, () => {
    console.log(`Translation server running on port ${PORT}`);
    console.log(`Gemini API configured: ${!!process.env.GEMINI_API_KEY}`);
});
