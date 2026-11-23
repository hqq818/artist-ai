export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "只支持 POST 请求" });
  }

  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({
      error: "还没有配置 GEMINI_API_KEY"
    });
  }

  try {
    const { message, image, history = [] } = req.body || {};

    const contents = [];

    for (const item of history.slice(-8)) {
      contents.push({
        role: item.role === "assistant" ? "model" : "user",
        parts: [{ text: String(item.text || "") }]
      });
    }

    const parts = [{
      text: `你是一位专业、耐心、擅长视觉示范的人物绘画导师。
只教授人物和角色绘画，男女角色训练均衡。
用户是初学者，不要只讲抽象理论。
回答时请：
1. 先判断用户当前的问题。
2. 把绘画过程拆成清晰的小步骤。
3. 说明每一步具体画什么、放在哪里、形状和比例如何。
4. 指出常见错误以及如何修改。
5. 给出一个可以立即动手的练习。
6. 语言简洁，鼓励但不要空泛。
如果用户上传了图片，请针对图片中的具体问题批改。
不要假装自己已经在画布上实时作画。

用户的问题：${String(message || "")}`
    }];

    if (image && image.data && image.mimeType) {
      parts.push({
        inline_data: {
          mime_type: image.mimeType,
          data: image.data
        }
      });
    }

    contents.push({
      role: "user",
      parts
    });

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" + apiKey,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          contents,
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 2048
          }
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: data.error?.message || "AI 服务暂时不可用"
      });
    }

    const answer = data.candidates?.[0]?.content?.parts
      ?.map(part => part.text || "")
      .join("\n")
      .trim();

    return res.status(200).json({
      answer: answer || "这次没有生成内容，请再试一次。"
    });

  } catch (error) {
    return res.status(500).json({
      error: "服务器出错：" + error.message
    });
  }
}