-- Add OpenRouter model selection column to chatbot_settings
-- Admin can configure comma-separated list of OpenRouter models
-- These models are tried in order; if all fail, Groq is used as final fallback
ALTER TABLE chatbot_settings ADD COLUMN IF NOT EXISTS openrouter_models TEXT DEFAULT 'google/gemini-2.5-flash,meta-llama/llama-3-8b-instruct';
