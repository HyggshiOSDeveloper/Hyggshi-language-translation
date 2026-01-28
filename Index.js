import { GoogleGenerativeAI } from '@google/generative-ai';

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
  'ar': 'Arabic',
  'vi': 'Vietnamese',
  'th': 'Thai',
  'nl': 'Dutch',
  'pl': 'Polish',
  'tr': 'Turkish',
  'sv': 'Swedish',
  'no': 'Norwegian',
  'da': 'Danish',
  'fi': 'Finnish',
  'hi': 'Hindi'
};

export default {
  async fetch(request, env) {
    // Handle CORS
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    // Handle preflight requests
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);

    // Root endpoint
    if (url.pathname === '/') {
      return new Response(
        JSON.stringify({ 
          service: 'Roblox Translation API',
          version: '1.0.0',
          endpoints: {
            translate: 'POST /translate',
            health: 'GET /health'
          }
        }),
        { 
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders 
          } 
        }
      );
    }

    // Health check endpoint
    if (url.pathname === '/health') {
      return new Response(
        JSON.stringify({ 
          status: 'ok', 
          message: 'Translation service is running'
        }),
        { 
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders 
          } 
        }
      );
    }

    // Translation endpoint
    if (url.pathname === '/translate' && request.method === 'POST') {
      try {
        const body = await request.json();
        const { text, targetLanguage } = body;

        // Validation
        if (!text || !targetLanguage) {
          return new Response(
            JSON.stringify({ 
              error: 'Missing required fields: text and targetLanguage' 
            }),
            { 
              status: 400,
              headers: { 
                'Content-Type': 'application/json',
                ...corsHeaders 
              } 
            }
          );
        }

        if (text.length > 1000) {
          return new Response(
            JSON.stringify({ 
              error: 'Text too long (max 1000 characters)' 
            }),
            { 
              status: 400,
              headers: { 
                'Content-Type': 'application/json',
                ...corsHeaders 
              } 
            }
          );
        }

        const targetLangName = languageNames[targetLanguage] || targetLanguage;

        // Initialize Gemini AI
        const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

        // Create translation prompt
        const prompt = `Translate the following text to ${targetLangName}. Only provide the translation, no explanations or additional text:\n${text}`;

        // Generate translation
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const translation = response.text().trim();

        // Return translation
        return new Response(
          JSON.stringify({
            translation: translation,
            sourceText: text,
            targetLanguage: targetLangName
          }),
          { 
            headers: { 
              'Content-Type': 'application/json',
              ...corsHeaders 
            } 
          }
        );

      } catch (error) {
        console.error('Translation error:', error);
        return new Response(
          JSON.stringify({ 
            error: 'Translation failed', 
            details: error.message 
          }),
          { 
            status: 500,
            headers: { 
              'Content-Type': 'application/json',
              ...corsHeaders 
            } 
          }
        );
      }
    }

    // 404 for unknown routes
    return new Response(
      JSON.stringify({ error: 'Not found' }),
      { 
        status: 404,
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders 
        } 
      }
    );
  }
};
