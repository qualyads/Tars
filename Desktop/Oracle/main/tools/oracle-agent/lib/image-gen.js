/**
 * Image Generation - kie.ai + ImgBB Integration
 *
 * Features:
 * - Generate images using kie.ai (flux-2, nano-banana-pro)
 * - Upload to ImgBB for hosting
 * - Support text-to-image and image-to-image
 */

import https from 'https';
import http from 'http';

// ============================================================
// Configuration
// ============================================================

const KIE_API_KEY = process.env.KIE_API_KEY;
const IMGBB_API_KEY = process.env.IMGBB_API_KEY;

const KIE_BASE_URL = 'https://api.kie.ai';
const IMGBB_UPLOAD_URL = 'https://api.imgbb.com/1/upload';

// ============================================================
// kie.ai Image Generation
// ============================================================

/**
 * Create image generation task
 * @param {string} prompt - Text prompt for image generation
 * @param {object} options - Additional options
 * @returns {Promise<object>} Task info with taskId
 */
async function createTask(prompt, options = {}) {
  const {
    model = 'nano-banana-pro', // or 'flux-2/pro-image-to-image'
    width = 1024,
    height = 1024,
    imageUrl = null // For image-to-image
  } = options;

  const payload = {
    model,
    prompt,
    width,
    height
  };

  if (imageUrl) {
    payload.imageUrl = imageUrl;
  }

  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(payload);

    const reqOptions = {
      hostname: 'api.kie.ai',
      path: '/api/v1/jobs/createTask',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${KIE_API_KEY}`,
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(reqOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          if (result.taskId) {
            console.log(`[IMAGE-GEN] Task created: ${result.taskId}`);
            resolve(result);
          } else {
            reject(new Error(result.message || 'Failed to create task'));
          }
        } catch (e) {
          reject(new Error(`Parse error: ${e.message}`));
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

/**
 * Check task status
 * @param {string} taskId - Task ID from createTask
 * @returns {Promise<object>} Task status with imageUrl when complete
 */
async function checkTaskStatus(taskId) {
  return new Promise((resolve, reject) => {
    const reqOptions = {
      hostname: 'api.kie.ai',
      path: `/api/v1/jobs/recordInfo?taskId=${taskId}`,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${KIE_API_KEY}`
      }
    };

    const req = https.request(reqOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          resolve(result);
        } catch (e) {
          reject(new Error(`Parse error: ${e.message}`));
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

/**
 * Wait for task completion
 * @param {string} taskId - Task ID
 * @param {number} maxWait - Max wait time in ms (default 60s)
 * @param {number} pollInterval - Poll interval in ms (default 2s)
 * @returns {Promise<string>} Generated image URL
 */
async function waitForCompletion(taskId, maxWait = 60000, pollInterval = 2000) {
  const startTime = Date.now();

  while (Date.now() - startTime < maxWait) {
    const status = await checkTaskStatus(taskId);

    if (status.status === 'completed' && status.imageUrl) {
      console.log(`[IMAGE-GEN] Task ${taskId} completed`);
      return status.imageUrl;
    }

    if (status.status === 'failed') {
      throw new Error(status.error || 'Image generation failed');
    }

    // Wait before next poll
    await new Promise(r => setTimeout(r, pollInterval));
  }

  throw new Error('Image generation timeout');
}

/**
 * Generate image (full flow)
 * @param {string} prompt - Text prompt
 * @param {object} options - Options
 * @returns {Promise<string>} Generated image URL
 */
async function generateImage(prompt, options = {}) {
  console.log(`[IMAGE-GEN] Generating: "${prompt.substring(0, 50)}..."`);

  const task = await createTask(prompt, options);
  const imageUrl = await waitForCompletion(task.taskId);

  return imageUrl;
}

// ============================================================
// ImgBB Upload
// ============================================================

/**
 * Upload image to ImgBB
 * @param {string} imageUrl - URL of image to upload
 * @returns {Promise<string>} ImgBB hosted URL
 */
async function uploadToImgBB(imageUrl) {
  return new Promise((resolve, reject) => {
    const formData = `key=${IMGBB_API_KEY}&image=${encodeURIComponent(imageUrl)}`;

    const reqOptions = {
      hostname: 'api.imgbb.com',
      path: '/1/upload',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(formData)
      }
    };

    const req = https.request(reqOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          if (result.success && result.data?.url) {
            console.log(`[IMGBB] Uploaded: ${result.data.url}`);
            resolve(result.data.url);
          } else {
            reject(new Error(result.error?.message || 'Upload failed'));
          }
        } catch (e) {
          reject(new Error(`Parse error: ${e.message}`));
        }
      });
    });

    req.on('error', reject);
    req.write(formData);
    req.end();
  });
}

// ============================================================
// High-level API
// ============================================================

/**
 * Generate and host image
 * @param {string} prompt - Text prompt
 * @param {object} options - Options
 * @returns {Promise<object>} { originalUrl, hostedUrl }
 */
async function generate(prompt, options = {}) {
  try {
    const originalUrl = await generateImage(prompt, options);

    // Optionally upload to ImgBB for permanent hosting
    let hostedUrl = originalUrl;
    if (options.uploadToImgBB !== false) {
      try {
        hostedUrl = await uploadToImgBB(originalUrl);
      } catch (uploadError) {
        console.error('[IMAGE-GEN] ImgBB upload failed:', uploadError.message);
        // Continue with original URL
      }
    }

    return {
      success: true,
      originalUrl,
      hostedUrl,
      prompt
    };
  } catch (error) {
    console.error('[IMAGE-GEN] Error:', error.message);
    return {
      success: false,
      error: error.message,
      prompt
    };
  }
}

/**
 * Check if message requests image generation
 * @param {string} message - User message
 * @returns {boolean}
 */
function isImageRequest(message) {
  const lower = message.toLowerCase();
  const keywords = [
    'gen รูป', 'สร้างรูป', 'ทำรูป', 'generate image', 'create image',
    'gen ภาพ', 'สร้างภาพ', 'วาดรูป', 'วาดภาพ', 'draw',
    'gen picture', 'make image', 'ขอรูป', 'อยากได้รูป'
  ];
  return keywords.some(kw => lower.includes(kw));
}

/**
 * Extract prompt from image request
 * @param {string} message - User message
 * @returns {string} Extracted prompt
 */
function extractPrompt(message) {
  // Remove common prefixes
  let prompt = message
    .replace(/gen\s*รูป/gi, '')
    .replace(/สร้างรูป/gi, '')
    .replace(/ทำรูป/gi, '')
    .replace(/generate\s*image/gi, '')
    .replace(/create\s*image/gi, '')
    .replace(/gen\s*ภาพ/gi, '')
    .replace(/สร้างภาพ/gi, '')
    .replace(/วาดรูป/gi, '')
    .replace(/วาดภาพ/gi, '')
    .replace(/draw/gi, '')
    .replace(/ขอรูป/gi, '')
    .replace(/อยากได้รูป/gi, '')
    .replace(/มาหน่อย/gi, '')
    .replace(/ให้หน่อย/gi, '')
    .replace(/ให้ที/gi, '')
    .trim();

  // Default prompt if empty
  if (!prompt) {
    prompt = 'beautiful landscape, high quality, professional photography';
  }

  return prompt;
}

// ============================================================
// Exports
// ============================================================

export {
  createTask,
  checkTaskStatus,
  waitForCompletion,
  generateImage,
  uploadToImgBB,
  generate,
  isImageRequest,
  extractPrompt
};

export default {
  createTask,
  checkTaskStatus,
  waitForCompletion,
  generateImage,
  uploadToImgBB,
  generate,
  isImageRequest,
  extractPrompt
};
