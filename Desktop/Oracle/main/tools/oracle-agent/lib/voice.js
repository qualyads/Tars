/**
 * Voice Module
 * Text-to-Speech (TTS) and Speech-to-Text (STT)
 *
 * Providers:
 * - TTS: OpenAI, ElevenLabs, Edge (free)
 * - STT: OpenAI Whisper
 */

import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import https from 'https';

const require = createRequire(import.meta.url);
const config = require('../config.json');

/**
 * TTS Providers
 */
const TTS_PROVIDERS = {
  OPENAI: 'openai',
  ELEVENLABS: 'elevenlabs',
  EDGE: 'edge'
};

/**
 * OpenAI TTS Voices
 */
const OPENAI_VOICES = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'];

/**
 * Default config
 */
const DEFAULT_CONFIG = {
  ttsProvider: TTS_PROVIDERS.OPENAI,
  ttsVoice: 'nova',
  ttsModel: 'tts-1',
  sttModel: 'whisper-1',
  maxTextLength: 4096,
  outputDir: './data/voice'
};

class VoiceManager {
  constructor(voiceConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config.voice, ...voiceConfig };

    // Ensure output directory exists
    if (!fs.existsSync(this.config.outputDir)) {
      fs.mkdirSync(this.config.outputDir, { recursive: true });
    }
  }

  /**
   * Text-to-Speech: Convert text to audio
   * @param {string} text - Text to convert
   * @param {object} options - TTS options
   * @returns {Promise<object>} { audioPath, duration, provider }
   */
  async textToSpeech(text, options = {}) {
    const provider = options.provider || this.config.ttsProvider;

    // Truncate if too long
    const truncatedText = text.length > this.config.maxTextLength
      ? text.substring(0, this.config.maxTextLength - 3) + '...'
      : text;

    switch (provider) {
      case TTS_PROVIDERS.OPENAI:
        return this._openaiTTS(truncatedText, options);
      case TTS_PROVIDERS.ELEVENLABS:
        return this._elevenlabsTTS(truncatedText, options);
      default:
        throw new Error(`Unknown TTS provider: ${provider}`);
    }
  }

  /**
   * Speech-to-Text: Convert audio to text
   * @param {string|Buffer} audio - Audio file path or buffer
   * @param {object} options - STT options
   * @returns {Promise<object>} { text, language, duration }
   */
  async speechToText(audio, options = {}) {
    return this._openaiSTT(audio, options);
  }

  /**
   * OpenAI TTS implementation
   */
  async _openaiTTS(text, options = {}) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    const voice = options.voice || this.config.ttsVoice;
    const model = options.model || this.config.ttsModel;

    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        input: text,
        voice,
        response_format: 'mp3'
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI TTS error: ${error}`);
    }

    // Save to file
    const audioBuffer = Buffer.from(await response.arrayBuffer());
    const filename = `tts_${Date.now()}.mp3`;
    const audioPath = path.join(this.config.outputDir, filename);

    fs.writeFileSync(audioPath, audioBuffer);

    return {
      audioPath,
      audioBuffer,
      provider: TTS_PROVIDERS.OPENAI,
      voice,
      textLength: text.length
    };
  }

  /**
   * ElevenLabs TTS implementation
   */
  async _elevenlabsTTS(text, options = {}) {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      throw new Error('ELEVENLABS_API_KEY not configured');
    }

    const voiceId = options.voiceId || config.voice?.elevenlabsVoiceId || 'EXAVITQu4vr4xnSDxMaL'; // Default: Bella

    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_monolingual_v1',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75
        }
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`ElevenLabs TTS error: ${error}`);
    }

    // Save to file
    const audioBuffer = Buffer.from(await response.arrayBuffer());
    const filename = `tts_${Date.now()}.mp3`;
    const audioPath = path.join(this.config.outputDir, filename);

    fs.writeFileSync(audioPath, audioBuffer);

    return {
      audioPath,
      audioBuffer,
      provider: TTS_PROVIDERS.ELEVENLABS,
      voiceId,
      textLength: text.length
    };
  }

  /**
   * OpenAI Whisper STT implementation
   */
  async _openaiSTT(audio, options = {}) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    // Handle audio input
    let audioBuffer;
    let filename = 'audio.mp3';

    if (typeof audio === 'string') {
      // File path
      audioBuffer = fs.readFileSync(audio);
      filename = path.basename(audio);
    } else if (Buffer.isBuffer(audio)) {
      audioBuffer = audio;
    } else {
      throw new Error('Audio must be a file path or Buffer');
    }

    // Create form data
    const FormData = (await import('form-data')).default;
    const form = new FormData();
    form.append('file', audioBuffer, { filename });
    form.append('model', options.model || this.config.sttModel);

    if (options.language) {
      form.append('language', options.language);
    }

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        ...form.getHeaders()
      },
      body: form
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI STT error: ${error}`);
    }

    const result = await response.json();

    return {
      text: result.text,
      language: result.language || options.language,
      provider: 'openai-whisper'
    };
  }

  /**
   * Summarize long text before TTS (for cost saving)
   * @param {string} text - Long text
   * @param {number} maxLength - Max length for TTS
   * @returns {string} Summarized text
   */
  summarizeForTTS(text, maxLength = 500) {
    if (text.length <= maxLength) {
      return text;
    }

    // Simple truncation with ellipsis
    // In production, could use Claude to summarize
    return text.substring(0, maxLength - 3) + '...';
  }

  /**
   * Check if voice is enabled
   */
  isEnabled() {
    return config.voice?.enabled || false;
  }

  /**
   * Get available voices
   */
  getAvailableVoices() {
    return {
      openai: OPENAI_VOICES,
      elevenlabs: 'See ElevenLabs dashboard for voice IDs'
    };
  }

  /**
   * Get status
   */
  getStatus() {
    return {
      enabled: this.isEnabled(),
      ttsProvider: this.config.ttsProvider,
      ttsVoice: this.config.ttsVoice,
      sttModel: this.config.sttModel,
      outputDir: this.config.outputDir,
      hasOpenAIKey: !!process.env.OPENAI_API_KEY,
      hasElevenLabsKey: !!process.env.ELEVENLABS_API_KEY
    };
  }
}

// Singleton
const voiceManager = new VoiceManager();

export default voiceManager;
export { VoiceManager, TTS_PROVIDERS, OPENAI_VOICES };
