const TELEGRAM_URL = 'https://t.me/s/nejm_njm';
const CORS_HEADERS = { 
    'Access-Control-Allow-Origin': '*', 
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 
    'Access-Control-Allow-Headers': 'Content-Type' 
};

export default {
  async fetch(request, env) {
    // التعامل مع طلبات المتصفح المسبقة
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS });
    
    const url = new URL(request.url);
    const parts = url.pathname.slice(1).split('/');
    
    // إذا فتحت الرابط بدون اسم مشروع
    if (parts.length < 2 || !parts[0] || !parts[1]) {
        return new Response(`
            <body style="background:#0f1020; color:#00d2ff; font-family:monospace; text-align:center; padding:50px;">
                <h1>🚀 محرك نجم v4.0 يعمل بكفاءة!</h1>
                <p>يرجى تمرير معرف المطور واسم المشروع في الرابط.</p>
            </body>
        `, { headers: {"Content-Type": "text/html; charset=utf-8", ...CORS_HEADERS} });
    }

    const userId = decodeURIComponent(parts[0]);
    const projName = decodeURIComponent(parts[1]);

    try {
      // جلب صفحة تليجرام
      const html = await fetch(TELEGRAM_URL, { headers: { 'User-Agent': 'Mozilla/5.0' } }).then(res => res.text());
      
      // فصل الرسائل والبحث من الأحدث للأقدم
      const messages = html.split('<div class="tgme_widget_message_text').reverse();
      let targetMessage = null;

      // رادار البحث عن البصمة المخفية (METADATA)
      for (let msg of messages) {
        if (msg.includes('---METADATA---')) {
          const metaMatch = msg.match(/---METADATA---({[\s\S]*?})---METADATA---/);
          if (metaMatch) {
            try {
                const meta = JSON.parse(decodeHtml(metaMatch[1]));
                if (meta.uid === userId && meta.pid === projName) {
                  targetMessage = msg;
                  break;
                }
            } catch(e) {} // تجاهل أخطاء الفك للرسائل التالفة
          }
        }
      }

      if (!targetMessage) {
          return new Response(`
            <body style="background:#0f1020; color:#ff3366; font-family:monospace; text-align:center; padding:50px;">
                <h1>❌ المشروع [${projName}] غير موجود</h1>
                <p>تأكد من النشر عبر اللوحة وأن القناة عامة.</p>
            </body>
          `, { status: 404, headers: {"Content-Type": "text/html; charset=utf-8", ...CORS_HEADERS} });
      }

      // استخراج الكود والأسرار
      const codeMatch = targetMessage.match(/<code>([\s\S]*?)<\/code>/);
      const varsMatch = targetMessage.match(/🔐 <b>Secrets:<\/b>[\s\S]*?<code>([\s\S]*?)<\/code>/);
      
      if (!codeMatch) throw new Error("لم يتم العثور على كود صالح في الرسالة");

      const cleanCode = decodeHtml(codeMatch[1]);
      let secrets = {};
      if (varsMatch) {
          try { secrets = JSON.parse(decodeHtml(varsMatch[1])); } catch(e) {}
      }

      // تشغيل الكود في بيئة معزولة
      const execute = new Function('env', 'project', 'request', 'Response', 'fetch', `return (async () => { \n${cleanCode}\n })();`);
      const result = await execute(secrets, { user_id: userId, name: projName }, request, Response, fetch);
      
      // إذا كان الكود يرجع استجابة (Response) جاهزة
      if (result instanceof Response) {
          const newHeaders = new Headers(result.headers);
          Object.entries(CORS_HEADERS).forEach(([k, v]) => { if (!newHeaders.has(k)) newHeaders.set(k, v); });
          return new Response(result.body, { status: result.status, headers: newHeaders });
      }
      
      // الرد الافتراضي
      return new Response(result || "تم التنفيذ بنجاح", { headers: {"Content-Type": "text/html; charset=utf-8", ...CORS_HEADERS} });

    } catch (e) {
      return new Response(`
        <body style="background:#0f1020; color:#ffaa00; font-family:monospace; text-align:center; padding:50px;">
            <h2>⚠️ خطأ في المحرك:</h2>
            <p>${e.message}</p>
        </body>
      `, { status: 500, headers: {"Content-Type": "text/html; charset=utf-8", ...CORS_HEADERS} });
    }
  }
};

// وظيفة تنظيف نصوص HTML التي يضيفها تليجرام
function decodeHtml(h) {
  return h.replace(/<[^>]*>/g, '')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&amp;/g, '&')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'");
}
