/**
 * Flex Builder - Flex Message Templates จาก OpenClaw Pattern
 *
 * Features:
 * - Info Card (title + body + footer)
 * - List Card (numbered items)
 * - Image Card (hero image)
 * - Carousel (multiple bubbles)
 * - Button/Confirm templates
 *
 * @module flex-builder
 */

import { LINE_LIMITS } from './line-core.js';

// ============================================================
// Color Constants
// ============================================================

export const COLORS = {
  primary: '#1DB446',
  secondary: '#555555',
  accent: '#0066FF',
  success: '#00C853',
  warning: '#FF9800',
  error: '#F44336',
  info: '#2196F3',
  light: '#AAAAAA',
  dark: '#333333',
  background: '#FFFFFF',
  backgroundAlt: '#F5F5F5',
};

// ============================================================
// Flex Bubble Builders
// ============================================================

/**
 * Create an info card bubble
 * @param {object} options
 * @param {string} options.title - Card title
 * @param {string} options.body - Main content
 * @param {string} options.footer - Footer text (optional)
 * @param {string} options.color - Accent color (optional)
 * @returns {object} Flex Bubble
 */
export function createInfoCard(options) {
  const { title, body, footer, color = COLORS.primary } = options;

  const contents = [];

  // Header with accent bar
  contents.push({
    type: 'box',
    layout: 'horizontal',
    contents: [
      {
        type: 'box',
        layout: 'vertical',
        contents: [],
        width: '4px',
        height: '100%',
        backgroundColor: color,
      },
      {
        type: 'text',
        text: title,
        weight: 'bold',
        size: 'lg',
        margin: 'md',
        wrap: true,
      },
    ],
  });

  // Body
  contents.push({
    type: 'text',
    text: body,
    size: 'sm',
    color: COLORS.secondary,
    wrap: true,
    margin: 'md',
  });

  // Footer
  if (footer) {
    contents.push({
      type: 'separator',
      margin: 'lg',
    });
    contents.push({
      type: 'text',
      text: footer,
      size: 'xs',
      color: COLORS.light,
      margin: 'md',
    });
  }

  return {
    type: 'bubble',
    body: {
      type: 'box',
      layout: 'vertical',
      contents,
      paddingAll: '16px',
    },
  };
}

/**
 * Create a list card bubble
 * @param {object} options
 * @param {string} options.title - Card title
 * @param {string[]} options.items - List items (max 8)
 * @param {string} options.color - Accent color (optional)
 * @returns {object} Flex Bubble
 */
export function createListCard(options) {
  const { title, items, color = COLORS.primary } = options;

  const listItems = items
    .slice(0, LINE_LIMITS.MAX_FLEX_LIST_ITEMS)
    .map((item, index) => ({
      type: 'box',
      layout: 'horizontal',
      contents: [
        {
          type: 'text',
          text: `${index + 1}.`,
          size: 'sm',
          color,
          flex: 0,
        },
        {
          type: 'text',
          text: item,
          size: 'sm',
          color: COLORS.secondary,
          wrap: true,
          margin: 'sm',
          flex: 1,
        },
      ],
      margin: index === 0 ? 'none' : 'sm',
    }));

  return {
    type: 'bubble',
    body: {
      type: 'box',
      layout: 'vertical',
      contents: [
        {
          type: 'text',
          text: title,
          weight: 'bold',
          size: 'lg',
          color: COLORS.dark,
        },
        {
          type: 'separator',
          margin: 'md',
        },
        {
          type: 'box',
          layout: 'vertical',
          contents: listItems,
          margin: 'md',
        },
      ],
      paddingAll: '16px',
    },
  };
}

/**
 * Create an image card bubble
 * @param {object} options
 * @param {string} options.title - Card title
 * @param {string} options.imageUrl - Hero image URL
 * @param {string} options.body - Description (optional)
 * @param {string} options.footer - Footer text (optional)
 * @returns {object} Flex Bubble
 */
export function createImageCard(options) {
  const { title, imageUrl, body, footer } = options;

  const bodyContents = [
    {
      type: 'text',
      text: title,
      weight: 'bold',
      size: 'lg',
      wrap: true,
    },
  ];

  if (body) {
    bodyContents.push({
      type: 'text',
      text: body,
      size: 'sm',
      color: COLORS.secondary,
      wrap: true,
      margin: 'md',
    });
  }

  if (footer) {
    bodyContents.push({
      type: 'text',
      text: footer,
      size: 'xs',
      color: COLORS.light,
      margin: 'md',
    });
  }

  return {
    type: 'bubble',
    hero: {
      type: 'image',
      url: imageUrl,
      size: 'full',
      aspectRatio: '16:9',
      aspectMode: 'cover',
    },
    body: {
      type: 'box',
      layout: 'vertical',
      contents: bodyContents,
      paddingAll: '16px',
    },
  };
}

/**
 * Create a key-value card bubble
 * @param {object} options
 * @param {string} options.title - Card title
 * @param {Array<{key: string, value: string}>} options.pairs - Key-value pairs
 * @returns {object} Flex Bubble
 */
export function createKeyValueCard(options) {
  const { title, pairs } = options;

  const kvContents = pairs.map((pair, index) => ({
    type: 'box',
    layout: 'horizontal',
    contents: [
      {
        type: 'text',
        text: pair.key,
        size: 'sm',
        color: COLORS.light,
        flex: 2,
      },
      {
        type: 'text',
        text: pair.value,
        size: 'sm',
        color: COLORS.dark,
        flex: 3,
        wrap: true,
      },
    ],
    margin: index === 0 ? 'none' : 'sm',
  }));

  return {
    type: 'bubble',
    body: {
      type: 'box',
      layout: 'vertical',
      contents: [
        {
          type: 'text',
          text: title,
          weight: 'bold',
          size: 'lg',
          color: COLORS.dark,
        },
        {
          type: 'separator',
          margin: 'md',
        },
        {
          type: 'box',
          layout: 'vertical',
          contents: kvContents,
          margin: 'md',
        },
      ],
      paddingAll: '16px',
    },
  };
}

/**
 * Create a status card bubble
 * @param {object} options
 * @param {string} options.title - Card title
 * @param {string} options.status - Status text
 * @param {'success'|'warning'|'error'|'info'} options.type - Status type
 * @param {string} options.details - Additional details (optional)
 * @returns {object} Flex Bubble
 */
export function createStatusCard(options) {
  const { title, status, type = 'info', details } = options;

  const statusColors = {
    success: COLORS.success,
    warning: COLORS.warning,
    error: COLORS.error,
    info: COLORS.info,
  };

  const statusIcons = {
    success: '✓',
    warning: '⚠',
    error: '✕',
    info: 'ℹ',
  };

  const color = statusColors[type] || COLORS.info;
  const icon = statusIcons[type] || 'ℹ';

  const contents = [
    {
      type: 'text',
      text: title,
      weight: 'bold',
      size: 'lg',
    },
    {
      type: 'box',
      layout: 'horizontal',
      contents: [
        {
          type: 'text',
          text: icon,
          size: 'xl',
          color,
          flex: 0,
        },
        {
          type: 'text',
          text: status,
          size: 'md',
          weight: 'bold',
          color,
          margin: 'md',
          flex: 1,
        },
      ],
      margin: 'lg',
    },
  ];

  if (details) {
    contents.push({
      type: 'text',
      text: details,
      size: 'sm',
      color: COLORS.secondary,
      wrap: true,
      margin: 'md',
    });
  }

  return {
    type: 'bubble',
    body: {
      type: 'box',
      layout: 'vertical',
      contents,
      paddingAll: '16px',
    },
  };
}

// ============================================================
// Carousel Builder
// ============================================================

/**
 * Create a carousel from multiple bubbles
 * @param {object[]} bubbles - Array of Flex Bubbles (max 10)
 * @returns {object} Flex Carousel
 */
export function createCarousel(bubbles) {
  return {
    type: 'carousel',
    contents: bubbles.slice(0, LINE_LIMITS.MAX_FLEX_CAROUSEL),
  };
}

// ============================================================
// Button Templates
// ============================================================

/**
 * Create a button box
 * @param {object} options
 * @param {string} options.label - Button label
 * @param {'message'|'uri'|'postback'} options.type - Action type
 * @param {string} options.data - Action data (text, URL, or postback data)
 * @param {string} options.color - Button color (optional)
 * @returns {object} Flex Box with button
 */
export function createButton(options) {
  const { label, type = 'message', data, color = COLORS.primary } = options;

  let action;
  switch (type) {
    case 'uri':
      action = {
        type: 'uri',
        label,
        uri: data,
      };
      break;
    case 'postback':
      action = {
        type: 'postback',
        label,
        data,
        displayText: label,
      };
      break;
    default:
      action = {
        type: 'message',
        label,
        text: data || label,
      };
  }

  return {
    type: 'button',
    action,
    style: 'primary',
    color,
    height: 'sm',
  };
}

/**
 * Create a card with buttons
 * @param {object} options
 * @param {string} options.title - Card title
 * @param {string} options.body - Card body
 * @param {Array<{label, type, data}>} options.buttons - Buttons (max 4)
 * @returns {object} Flex Bubble
 */
export function createButtonCard(options) {
  const { title, body, buttons = [] } = options;

  const buttonContents = buttons.slice(0, 4).map(btn => createButton(btn));

  return {
    type: 'bubble',
    body: {
      type: 'box',
      layout: 'vertical',
      contents: [
        {
          type: 'text',
          text: title,
          weight: 'bold',
          size: 'lg',
        },
        {
          type: 'text',
          text: body,
          size: 'sm',
          color: COLORS.secondary,
          wrap: true,
          margin: 'md',
        },
      ],
      paddingAll: '16px',
    },
    footer: {
      type: 'box',
      layout: 'vertical',
      contents: buttonContents,
      spacing: 'sm',
      paddingAll: '16px',
    },
  };
}

/**
 * Create a confirm card (Yes/No dialog)
 * @param {object} options
 * @param {string} options.text - Question text
 * @param {string} options.confirmLabel - Confirm button label
 * @param {string} options.confirmData - Confirm action data
 * @param {string} options.cancelLabel - Cancel button label
 * @param {string} options.cancelData - Cancel action data
 * @returns {object} Flex Bubble
 */
export function createConfirmCard(options) {
  const {
    text,
    confirmLabel = 'ใช่',
    confirmData = 'confirm:yes',
    cancelLabel = 'ไม่',
    cancelData = 'confirm:no',
  } = options;

  return {
    type: 'bubble',
    body: {
      type: 'box',
      layout: 'vertical',
      contents: [
        {
          type: 'text',
          text,
          size: 'md',
          wrap: true,
        },
      ],
      paddingAll: '16px',
    },
    footer: {
      type: 'box',
      layout: 'horizontal',
      contents: [
        {
          type: 'button',
          action: {
            type: 'postback',
            label: cancelLabel,
            data: cancelData,
            displayText: cancelLabel,
          },
          style: 'secondary',
          height: 'sm',
          flex: 1,
        },
        {
          type: 'button',
          action: {
            type: 'postback',
            label: confirmLabel,
            data: confirmData,
            displayText: confirmLabel,
          },
          style: 'primary',
          color: COLORS.primary,
          height: 'sm',
          flex: 1,
          margin: 'sm',
        },
      ],
      paddingAll: '16px',
    },
  };
}

// ============================================================
// Flex Message Wrapper
// ============================================================

/**
 * Wrap bubble/carousel in Flex message
 * @param {object} contents - Bubble or Carousel
 * @param {string} altText - Alternative text for notifications
 * @returns {object} LINE Flex Message
 */
export function wrapFlexMessage(contents, altText = 'Flex Message') {
  return {
    type: 'flex',
    altText,
    contents,
  };
}

// ============================================================
// Hotel-Specific Templates
// ============================================================

/**
 * Create a hotel booking card
 * @param {object} booking
 * @returns {object} Flex Bubble
 */
export function createBookingCard(booking) {
  const {
    guestName,
    roomName,
    checkIn,
    checkOut,
    nights,
    totalPrice,
    status,
  } = booking;

  return createKeyValueCard({
    title: `📋 ${guestName}`,
    pairs: [
      { key: 'ห้อง', value: roomName },
      { key: 'Check-in', value: checkIn },
      { key: 'Check-out', value: checkOut },
      { key: 'จำนวนคืน', value: `${nights} คืน` },
      { key: 'ราคารวม', value: `฿${totalPrice.toLocaleString()}` },
      { key: 'สถานะ', value: status },
    ],
  });
}

/**
 * Create occupancy status card
 * @param {object} data
 * @returns {object} Flex Bubble
 */
export function createOccupancyCard(data) {
  const { occupied, total, percentage, date } = data;

  return {
    type: 'bubble',
    body: {
      type: 'box',
      layout: 'vertical',
      contents: [
        {
          type: 'text',
          text: '🏨 Occupancy',
          weight: 'bold',
          size: 'lg',
        },
        {
          type: 'text',
          text: date,
          size: 'xs',
          color: COLORS.light,
        },
        {
          type: 'box',
          layout: 'vertical',
          contents: [
            {
              type: 'text',
              text: `${percentage}%`,
              size: '3xl',
              weight: 'bold',
              color: percentage >= 80 ? COLORS.success : percentage >= 50 ? COLORS.warning : COLORS.error,
              align: 'center',
            },
            {
              type: 'text',
              text: `${occupied}/${total} ห้อง`,
              size: 'sm',
              color: COLORS.secondary,
              align: 'center',
            },
          ],
          margin: 'xl',
        },
      ],
      paddingAll: '16px',
    },
  };
}

// ============================================================
// Exports
// ============================================================

export default {
  // Colors
  COLORS,

  // Card builders
  createInfoCard,
  createListCard,
  createImageCard,
  createKeyValueCard,
  createStatusCard,

  // Carousel
  createCarousel,

  // Buttons
  createButton,
  createButtonCard,
  createConfirmCard,

  // Wrapper
  wrapFlexMessage,

  // Hotel templates
  createBookingCard,
  createOccupancyCard,
};
