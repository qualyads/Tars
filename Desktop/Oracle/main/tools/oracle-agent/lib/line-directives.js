/**
 * LINE Rich Directives - Based on OpenClaw Pattern
 *
 * Parse special directives in AI responses and convert to LINE rich messages.
 *
 * Supported Directives:
 * - [[quick_replies: Option1, Option2, Option3]]
 * - [[confirm: Question? | Yes | No]]
 * - [[buttons: Title | Description | Btn1:action1, Btn2:action2]]
 * - [[location: Name | Address | lat | lng]]
 *
 * Tables and code blocks are auto-converted to Flex messages.
 */

// =============================================================================
// DIRECTIVE PATTERNS
// =============================================================================

const PATTERNS = {
  quickReplies: /\[\[quick_replies:\s*([^\]]+)\]\]/gi,
  confirm: /\[\[confirm:\s*([^|]+)\|([^|]+)\|([^\]]+)\]\]/gi,
  buttons: /\[\[buttons:\s*([^|]+)\|([^|]+)\|([^\]]+)\]\]/gi,
  location: /\[\[location:\s*([^|]+)\|([^|]+)\|([^|]+)\|([^\]]+)\]\]/gi,
};

// =============================================================================
// PARSERS
// =============================================================================

/**
 * Parse quick replies directive
 * [[quick_replies: ใช่, ไม่, ไม่แน่ใจ]]
 */
function parseQuickReplies(text) {
  const matches = [...text.matchAll(PATTERNS.quickReplies)];
  if (matches.length === 0) return null;

  const lastMatch = matches[matches.length - 1];
  const options = lastMatch[1].split(',').map(o => o.trim()).filter(Boolean);

  return {
    items: options.slice(0, 13).map(option => ({  // LINE limit: 13 items
      type: 'action',
      action: {
        type: 'message',
        label: option.slice(0, 20),  // LINE limit: 20 chars
        text: option
      }
    }))
  };
}

/**
 * Parse confirm directive
 * [[confirm: ยืนยันการจองไหม? | ใช่ | ไม่]]
 */
function parseConfirm(text) {
  const matches = [...text.matchAll(PATTERNS.confirm)];
  if (matches.length === 0) return null;

  const lastMatch = matches[matches.length - 1];
  const question = lastMatch[1].trim();
  const yesText = lastMatch[2].trim();
  const noText = lastMatch[3].trim();

  return {
    type: 'template',
    altText: question,
    template: {
      type: 'confirm',
      text: question.slice(0, 240),  // LINE limit
      actions: [
        {
          type: 'message',
          label: yesText.slice(0, 20),
          text: yesText
        },
        {
          type: 'message',
          label: noText.slice(0, 20),
          text: noText
        }
      ]
    }
  };
}

/**
 * Parse buttons directive
 * [[buttons: เมนูหลัก | เลือกสิ่งที่ต้องการ | จองห้อง:book, ราคา:price, ติดต่อ:contact]]
 */
function parseButtons(text) {
  const matches = [...text.matchAll(PATTERNS.buttons)];
  if (matches.length === 0) return null;

  const lastMatch = matches[matches.length - 1];
  const title = lastMatch[1].trim();
  const description = lastMatch[2].trim();
  const buttonsStr = lastMatch[3].trim();

  const actions = buttonsStr.split(',').map(btn => {
    const [label, action] = btn.split(':').map(s => s.trim());
    const actionData = action || label;

    // Determine action type
    if (actionData.startsWith('http')) {
      return {
        type: 'uri',
        label: label.slice(0, 20),
        uri: actionData
      };
    } else if (actionData.includes('=')) {
      return {
        type: 'postback',
        label: label.slice(0, 20),
        data: actionData
      };
    } else {
      return {
        type: 'message',
        label: label.slice(0, 20),
        text: actionData
      };
    }
  }).slice(0, 4);  // LINE limit: 4 buttons

  return {
    type: 'template',
    altText: title,
    template: {
      type: 'buttons',
      title: title.slice(0, 40),
      text: description.slice(0, 60),
      actions
    }
  };
}

/**
 * Parse location directive
 * [[location: The Arch Casa | 123 Main St, Pai | 19.3592 | 98.4400]]
 */
function parseLocation(text) {
  const matches = [...text.matchAll(PATTERNS.location)];
  if (matches.length === 0) return null;

  const lastMatch = matches[matches.length - 1];

  return {
    type: 'location',
    title: lastMatch[1].trim().slice(0, 100),
    address: lastMatch[2].trim().slice(0, 100),
    latitude: parseFloat(lastMatch[3].trim()),
    longitude: parseFloat(lastMatch[4].trim())
  };
}

// =============================================================================
// TABLE TO FLEX CONVERTER
// =============================================================================

/**
 * Detect markdown table in text
 */
function detectTable(text) {
  const tableRegex = /\|(.+)\|\n\|[-:\s|]+\|\n((?:\|.+\|\n?)+)/g;
  return [...text.matchAll(tableRegex)];
}

/**
 * Convert markdown table to Flex message
 */
function tableToFlex(tableMatch) {
  const headerLine = tableMatch[1];
  const bodyLines = tableMatch[2].trim().split('\n');

  const headers = headerLine.split('|').map(h => h.trim()).filter(Boolean);
  const rows = bodyLines.map(line =>
    line.split('|').map(c => c.trim()).filter(Boolean)
  );

  return {
    type: 'flex',
    altText: 'Table',
    contents: {
      type: 'bubble',
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          // Header row
          {
            type: 'box',
            layout: 'horizontal',
            contents: headers.map(h => ({
              type: 'text',
              text: h,
              weight: 'bold',
              size: 'sm',
              flex: 1
            }))
          },
          { type: 'separator', margin: 'md' },
          // Data rows
          ...rows.map(row => ({
            type: 'box',
            layout: 'horizontal',
            margin: 'sm',
            contents: row.map(cell => ({
              type: 'text',
              text: cell,
              size: 'sm',
              flex: 1,
              wrap: true
            }))
          }))
        ]
      }
    }
  };
}

// =============================================================================
// MAIN PROCESSOR
// =============================================================================

/**
 * Process text and extract all LINE message components
 */
function processDirectives(text) {
  const result = {
    text: text,
    messages: [],
    quickReply: null
  };

  // Extract quick replies (goes on last message)
  const quickReplies = parseQuickReplies(text);
  if (quickReplies) {
    result.quickReply = quickReplies;
    result.text = result.text.replace(PATTERNS.quickReplies, '').trim();
  }

  // Extract confirm dialogs
  const confirm = parseConfirm(text);
  if (confirm) {
    result.messages.push(confirm);
    result.text = result.text.replace(PATTERNS.confirm, '').trim();
  }

  // Extract button templates
  const buttons = parseButtons(text);
  if (buttons) {
    result.messages.push(buttons);
    result.text = result.text.replace(PATTERNS.buttons, '').trim();
  }

  // Extract location
  const location = parseLocation(text);
  if (location) {
    result.messages.push(location);
    result.text = result.text.replace(PATTERNS.location, '').trim();
  }

  // Convert tables to Flex
  const tables = detectTable(text);
  for (const table of tables) {
    result.messages.push(tableToFlex(table));
    result.text = result.text.replace(table[0], '').trim();
  }

  return result;
}

/**
 * Build LINE messages array from processed result
 */
function buildLineMessages(processed) {
  const messages = [];

  // Add text message if there's remaining text
  if (processed.text && processed.text.trim()) {
    const textMessage = {
      type: 'text',
      text: processed.text.slice(0, 5000)  // LINE limit
    };

    // Add quick reply to last text message
    if (processed.quickReply && processed.messages.length === 0) {
      textMessage.quickReply = processed.quickReply;
    }

    messages.push(textMessage);
  }

  // Add rich messages
  for (let i = 0; i < processed.messages.length; i++) {
    const msg = processed.messages[i];

    // Add quick reply to last message
    if (i === processed.messages.length - 1 && processed.quickReply) {
      msg.quickReply = processed.quickReply;
    }

    messages.push(msg);
  }

  // If no messages but has quick reply, create empty holder
  if (messages.length === 0 && processed.quickReply) {
    messages.push({
      type: 'text',
      text: 'เลือกตัวเลือก:',
      quickReply: processed.quickReply
    });
  }

  return messages.slice(0, 5);  // LINE limit: 5 messages per push
}

/**
 * Process AI response and return LINE messages
 */
function processForLine(text) {
  const processed = processDirectives(text);
  return buildLineMessages(processed);
}

// =============================================================================
// EXPORTS
// =============================================================================

export {
  processDirectives,
  buildLineMessages,
  processForLine,
  parseQuickReplies,
  parseConfirm,
  parseButtons,
  parseLocation,
  tableToFlex,
  detectTable,
  PATTERNS
};

export default {
  processForLine,
  processDirectives
};
