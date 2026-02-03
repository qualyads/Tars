/**
 * Hello World Plugin - ตัวอย่าง Plugin สำหรับ Oracle
 *
 * แสดงวิธีใช้งาน:
 * - registerHook - ดัก event ต่างๆ
 * - registerCommand - สร้าง command ใหม่
 * - registerTool - สร้าง tool ให้ AI ใช้
 */

export function register(api) {
  api.log.info('กำลังโหลด Hello World Plugin...');

  // ลงทะเบียน Hook: ทำงานทุกครั้งที่มีข้อความเข้ามา
  api.registerHook('before_message', async (event, ctx) => {
    api.log.debug(`ข้อความเข้า: ${event.body?.slice(0, 50)}...`);

    // ตรวจจับคำทักทาย
    if (event.body?.includes('สวัสดี') || event.body?.toLowerCase().includes('hello')) {
      return {
        ...event,
        greeting_detected: true,
      };
    }
  });

  // ลงทะเบียน Command: /hello
  api.registerCommand({
    name: 'hello',
    description: 'ทดสอบ plugin system',
    handler: async ({ args }) => {
      const name = args || 'World';
      return {
        text: `สวัสดี ${name}! 👋\n\nPlugin system ทำงานปกติ`,
      };
    },
  });

  // ลงทะเบียน Hook: บันทึก log หลังส่งข้อความ
  api.registerHook('after_reply', async (event, ctx) => {
    api.log.debug(`ส่งข้อความแล้ว: ${event.text?.slice(0, 50)}...`);
  });

  api.log.info('โหลด Hello World Plugin สำเร็จ!');
}

export default { register };
