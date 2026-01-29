import { GoogleGenerativeAI } from '@google/generative-ai';

const languageNames = {
  'es': 'Spanish', 'fr': 'French', 'de': 'German', 'ja': 'Japanese',
  'zh': 'Chinese', 'ko': 'Korean', 'it': 'Italian', 'pt': 'Portuguese',
  'ru': 'Russian', 'ar': 'Arabic', 'vi': 'Vietnamese', 'th': 'Thai',
  'nl': 'Dutch', 'pl': 'Polish', 'tr': 'Turkish', 'sv': 'Swedish',
  'no': 'Norwegian', 'da': 'Danish', 'fi': 'Finnish', 'hi': 'Hindi'
};

export default {
  async fetch(request, env) {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);

    // Health check with detailed diagnostics
    if (url.pathname === '/health') {
      const apiKeyExists = !!env.GEMINI_API_KEY;
      const apiKeyLength = apiKeyExists ? env.GEMINI_API_KEY.length : 0;
      
      return new Response(JSON.stringify({ 
        status: 'ok',
        message: 'Translation service is running',
        apiKeyConfigured: apiKeyExists,
        apiKeyLength: apiKeyLength, // Shows key length without revealing it
        timestamp: new Date().toISOString(),
        workerVersion: '2.0-debug'
      }), { 
        headers: { 'Content-Type': 'application/json', ...corsHeaders } 
      });
    }

    // Root endpoint
    if (url.pathname === '/') {
      return new Response(JSON.stringify({ 
        service: 'Roblox Translation API',
        version: '2.0-debug',
        endpoints: { 
          translate: 'POST /translate', 
          health: 'GET /health' 
        }
      }), { 
        headers: { 'Content-Type': 'application/json', ...corsHeaders } 
      });
    }

    // Translation endpoint with extensive error handling
    if (url.pathname === '/translate' && request.method === 'POST') {
      const startTime = Date.now();
      
      try {
        // Step 1: Check API key
        if (!env.GEMINI_API_KEY) {
          console.error('❌ [CRITICAL] GEMINI_API_KEY environment variable is not set');
          console.error('Fix: npx wrangler secret put GEMINI_API_KEY');
          
          return new Response(JSON.stringify({ 
            error: 'Server configuration error',
            details: 'GEMINI_API_KEY is not set. Please configure the API key.',
            solution: 'Run: npx wrangler secret put GEMINI_API_KEY',
            errorCode: 'API_KEY_MISSING'
          }), { 
            status: 500,
            headers: { 'Content-Type': 'application/json', ...corsHeaders } 
          });
        }

        console.log('✅ API key is configured');

        // Step 2: Parse request body
        let body;
        try {
          body = await request.json();
          console.log('✅ Request body parsed');
        } catch (parseError) {
          console.error('❌ Failed to parse JSON:', parseError.message);
          return new Response(JSON.stringify({ 
            error: 'Invalid JSON',
            details: parseError.message,
            errorCode: 'JSON_PARSE_ERROR'
          }), { 
            status: 400,
            headers: { 'Content-Type': 'application/json', ...corsHeaders } 
          });
        }

        const { text, targetLanguage } = body;

        // Step 3: Validate input
        if (!text || !targetLanguage) {
          console.error('❌ Missing required fields');
          return new Response(JSON.stringify({ 
            error: 'Missing required fields',
            details: 'Both "text" and "targetLanguage" are required',
            errorCode: 'MISSING_FIELDS'
          }), { 
            status: 400,
            headers: { 'Content-Type': 'application/json', ...corsHeaders } 
          });
        }

        if (text.length > 1000) {
          console.error('❌ Text too long:', text.length);
          return new Response(JSON.stringify({ 
            error: 'Text too long',
            details: `Text length: ${text.length}, Max: 1000 characters`,
            errorCode: 'TEXT_TOO_LONG'
          }), { 
            status: 400,
            headers: { 'Content-Type': 'application/json', ...corsHeaders } 
          });
        }

        const targetLangName = languageNames[targetLanguage] || targetLanguage;
        console.log(`🔄 Translation request: "${text.substring(0, 50)}..." -> ${targetLangName}`);

        // Step 4: Initialize Gemini
        let genAI, model;
        try {
          genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);
          console.log('✅ GoogleGenerativeAI initialized');
          
          model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
          console.log('✅ Model loaded: gemini-1.5-flash');
        } catch (initError) {
          console.error('❌ Failed to initialize Gemini:', initError.message);
          
          // Check if it's an API key error
          if (initError.message.includes('API key') || initError.message.includes('api_key')) {
            return new Response(JSON.stringify({ 
              error: 'Invalid API key',
              details: 'The Gemini API key appears to be invalid. Please check it.',
              solution: 'Get a new key from https://makersuite.google.com/app/apikey',
              errorCode: 'INVALID_API_KEY'
            }), { 
              status: 500,
              headers: { 'Content-Type': 'application/json', ...corsHeaders } 
            });
          }
          
          throw initError;
        }

        // Step 5: Generate translation
        const prompt = `Translate the following text to ${targetLangName}. Only provide the translation, no explanations or additional text:\n${text}`;
        
        let result, response, translation;
        try {
          console.log('🤖 Calling Gemini API...');
          result = await model.generateContent(prompt);
          console.log('✅ Gemini API responded');
          
          response = await result.response;
          translation = response.text().trim();
          console.log(`✅ Translation completed: "${translation.substring(0, 50)}..."`);
        } catch (geminiError) {
          console.error('❌ Gemini API error:', geminiError.message);
          
          // Parse specific Gemini errors
          if (geminiError.message.includes('quota') || geminiError.message.includes('rate')) {
            return new Response(JSON.stringify({ 
              error: 'API quota exceeded',
              details: 'Gemini API rate limit reached. Please wait a moment.',
              errorCode: 'QUOTA_EXCEEDED'
            }), { 
              status: 429,
              headers: { 'Content-Type': 'application/json', ...corsHeaders } 
            });
          }
          
          if (geminiError.message.includes('API key')) {
            return new Response(JSON.stringify({ 
              error: 'Invalid API key',
              details: geminiError.message,
              errorCode: 'INVALID_API_KEY'
            }), { 
              status: 500,
              headers: { 'Content-Type': 'application/json', ...corsHeaders } 
            });
          }
          
          throw geminiError;
        }

        const processingTime = Date.now() - startTime;
        console.log(`✅ Total processing time: ${processingTime}ms`);

        // Step 6: Return success response
        return new Response(JSON.stringify({
          translation: translation,
          sourceText: text,
          targetLanguage: targetLangName,
          processingTime: processingTime
        }), { 
          headers: { 'Content-Type': 'application/json', ...corsHeaders } 
        });

      } catch (error) {
        const processingTime = Date.now() - startTime;
        console.error('❌ Unexpected error:', error.message);
        console.error('Stack:', error.stack);
        
        return new Response(JSON.stringify({ 
          error: 'Translation failed',
          details: error.message,
          errorType: error.constructor.name,
          processingTime: processingTime,
          timestamp: new Date().toISOString(),
          errorCode: 'UNKNOWN_ERROR'
        }), { 
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders } 
        });
      }
    }

    // 404 for unknown routes
    return new Response(JSON.stringify({ 
      error: 'Not found',
      path: url.pathname,
      errorCode: 'NOT_FOUND'
    }), { 
      status: 404,
      headers: { 'Content-Type': 'application/json', ...corsHeaders } 
    });
  }
};
