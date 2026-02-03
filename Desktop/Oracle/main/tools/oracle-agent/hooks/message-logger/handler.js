/**
 * Message Logger Hook
 * บันทึก log ทุกข้อความที่เข้ามาและออกไป
 */

export default async function handler(event) {
  const { type, action, context, timestamp } = event;
  const time = timestamp.toISOString();

  if (action === 'receive') {
    console.log(`[MSG-LOG] ${time} ← RECEIVE`);
    console.log(`  From: ${context.userId || 'unknown'}`);
    console.log(`  Channel: ${context.channel || 'unknown'}`);
    console.log(`  Text: ${context.text?.slice(0, 100) || '(no text)'}...`);
  } else if (action === 'send') {
    console.log(`[MSG-LOG] ${time} → SEND`);
    console.log(`  To: ${context.userId || 'unknown'}`);
    console.log(`  Channel: ${context.channel || 'unknown'}`);
    console.log(`  Text: ${context.text?.slice(0, 100) || '(no text)'}...`);
  }

  // Push message back (optional)
  event.messages.push('Message logged');
}
