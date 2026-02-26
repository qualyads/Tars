export default function SeoContent() {
  return (
    <section className="bg-background-secondary py-16 px-4">
      <div className="max-w-3xl mx-auto">
        <h2 className="text-2xl font-bold text-text-primary mb-6 text-center">
          Clairify™ — เครื่องมือ AI วิเคราะห์เว็บไซต์เพื่อการเติบโต
        </h2>

        <div className="space-y-6 text-text-secondary leading-relaxed">
          <p>
            <strong className="text-text-primary">93% ของ Traffic ออนไลน์เริ่มต้นจาก Google</strong> — ถ้าเว็บไซต์ของคุณไม่ปรากฏในผลค้นหา
            เท่ากับเสียลูกค้าให้คู่แข่งทุกวัน <strong className="text-text-primary">Clairify™</strong> วิเคราะห์เว็บไซต์ <strong className="text-text-primary">45+ จุดสำคัญ ครอบคลุม 6 หมวดหมู่</strong> —
            SEO, Security, Performance, Content, Mobile และ Social — ทั้งหมดภายใน 30 วินาที พร้อมคำแนะนำแก้ไขเป็นภาษาไทย
          </p>

          <h3 className="text-lg font-bold text-text-primary">Clairify ตรวจอะไรบ้าง? — 6 หมวด 45+ จุด</h3>

          <div className="grid md:grid-cols-2 gap-4">
            {[
              { cat: 'SEO พื้นฐาน (25%)', items: 'Title, Meta Description, H1, Heading, Schema, Canonical' },
              { cat: 'เทคนิค SEO (15%)', items: 'Sitemap, Robots.txt, Analytics, GTM, Meta Pixel, URL Quality' },
              { cat: 'ประสิทธิภาพ (20%)', items: 'ขนาดหน้า, ความเร็ว, Compression, Lazy Loading, Third-party Scripts' },
              { cat: 'ความปลอดภัย (15%)', items: 'SSL, HSTS, X-Frame-Options, Mixed Content, CSP' },
              { cat: 'เนื้อหาและรูปภาพ (15%)', items: 'ปริมาณเนื้อหา, Alt Text, Internal Links, CTA, Image Dimensions' },
              { cat: 'Mobile และ Social (10%)', items: 'Viewport, OG Tags, Twitter Card, Favicon, Social Links' },
            ].map(({ cat, items }) => (
              <div key={cat} className="bg-white rounded-[15px] p-4 border border-border-primary">
                <h4 className="font-bold text-text-primary mb-1">{cat}</h4>
                <p className="text-sm">{items}</p>
              </div>
            ))}
          </div>

          <h3 className="text-lg font-bold text-text-primary">ใครควรใช้ Clairify?</h3>
          <ul className="space-y-1 text-sm">
            <li>• เจ้าของธุรกิจที่อยากรู้ว่าเว็บมีปัญหาอะไร ก่อนเสียเงินจ้างทำ SEO</li>
            <li>• นักการตลาดที่ต้อง pitch ลูกค้าด้วยข้อมูลจริง</li>
            <li>• นักพัฒนาเว็บที่อยากเช็คงานก่อนส่งมอบ</li>
            <li>• ใครก็ตามที่อยากให้เว็บติดหน้าแรก Google</li>
          </ul>

          <h3 className="text-lg font-bold text-text-primary">คำถามที่พบบ่อย (FAQ)</h3>

          <div className="space-y-4">
            {[
              {
                q: 'Clairify ตรวจเว็บฟรีจริงไหม?',
                a: 'ฟรี 100% ไม่มีค่าใช้จ่าย ไม่ต้องสมัครสมาชิก แค่ใส่ URL เว็บไซต์ก็ได้ผลวิเคราะห์ทันที ระบบตรวจ 45+ จุดสำคัญ ครอบคลุม 6 หมวด พร้อมคำแนะนำแก้ไขเป็นภาษาไทย',
              },
              {
                q: 'ใช้เวลานานไหม?',
                a: 'ระบบวิเคราะห์เสร็จภายใน 30 วินาที ครอบคลุม SEO, Security, Performance, Content, Mobile และ Social',
              },
              {
                q: 'Clairify เช็คอะไรบ้าง?',
                a: 'วิเคราะห์ 45+ จุด ใน 6 หมวด: SEO พื้นฐาน (Title, Meta, H1, Schema, Canonical), เทคนิค SEO (Sitemap, Robots.txt, Analytics, URL Quality), ประสิทธิภาพ (ความเร็ว, Compression, Lazy Loading), ความปลอดภัย (SSL, HSTS, X-Frame-Options), เนื้อหา (Alt Text, Internal Links, CTA) และ Mobile & Social (OG Tags, Twitter Card)',
              },
              {
                q: 'ข้อมูลเว็บไซต์ปลอดภัยไหม?',
                a: 'ปลอดภัย ระบบวิเคราะห์เฉพาะข้อมูล public ไม่เข้าถึง backend หรือข้อมูลส่วนตัว ผลวิเคราะห์เก็บ 7 วันแล้วลบอัตโนมัติ',
              },
              {
                q: 'คะแนนต่ำ ต้องทำยังไง?',
                a: 'แต่ละข้อที่ไม่ผ่านมีคำแนะนำวิธีแก้ไขภาษาไทย เริ่มจากข้อสีแดง (ต้องแก้) ก่อน แล้วค่อยแก้สีเหลือง (ควรปรับ) หากต้องการความช่วยเหลือ ปรึกษาทีม VisionXBrain ได้ฟรี',
              },
              {
                q: 'วิเคราะห์ได้กี่ครั้ง?',
                a: 'ตรวจได้ 5 ครั้งต่อชั่วโมง เพียงพอสำหรับเช็คเว็บไซต์ตัวเองและคู่แข่ง',
              },
            ].map(({ q, a }) => (
              <details key={q} className="bg-white rounded-[15px] border border-border-primary">
                <summary className="p-4 cursor-pointer font-medium text-text-primary hover:text-brand-primary transition-colors">
                  {q}
                </summary>
                <p className="px-4 pb-4 text-sm leading-relaxed">{a}</p>
              </details>
            ))}
          </div>

          <h3 className="text-lg font-bold text-text-primary mt-8">ต้องการให้ช่วยแก้ปัญหา?</h3>
          <p>
            <a href="https://www.visionxbrain.com/seo-that-we-use-ourselves" className="text-link-primary hover:underline font-medium" target="_blank" rel="noopener">บริการรับทำ SEO</a> จาก VisionXBrain
            ช่วยเว็บไซต์ของคุณติดหน้าแรก Google — ด้วยประสบการณ์จากลูกค้ากว่า 80 ราย ใน 6 ประเทศ
            หรือดูบริการ<a href="https://www.visionxbrain.com/services/website" className="text-link-primary hover:underline font-medium ml-1" target="_blank" rel="noopener">ออกแบบเว็บไซต์</a>ที่เตรียม SEO ให้ตั้งแต่วันแรก
          </p>
        </div>

        <div className="mt-10 text-center text-sm text-text-secondary">
          Clairify™ สร้างโดย <a href="https://visionxbrain.com" className="text-link-primary hover:underline font-medium" target="_blank" rel="noopener">VisionXBrain</a> — Digital Growth Partner
        </div>
      </div>
    </section>
  );
}
