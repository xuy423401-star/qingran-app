import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SILICONFLOW_API_KEY = Deno.env.get("SILICONFLOW_API_KEY") ?? "";
const SILICONFLOW_URL = "https://api.siliconflow.cn/v1/chat/completions";

// Primary model - may require balance
const PRIMARY_MODEL = "Qwen/Qwen3-VL-8B-Instruct";
// Fallback models ordered by preference (free tier models)
const FALLBACK_MODELS = [
  "Qwen/Qwen2.5-VL-7B-Instruct",
  "Pro/Qwen/Qwen2-VL-7B-Instruct",
];

const SYSTEM_PROMPT = `你是一名专业的营养师。用户会上传一张食物照片，请识别照片中所有的食物。
对于每种食物，请提供：
1. food: 食物中文名称
2. weightGrams: 估算克数
3. calories: 估算热量(kcal)

以 JSON 数组格式返回，不要包含任何 markdown 标记。示例：
[{"food":"米饭","weightGrams":150,"calories":174},{"food":"鸡胸肉","weightGrams":100,"calories":165}]

如果无法识别照片中的食物，返回空数组 []。`;

async function tryRecognize(imageBase64: string, model: string): Promise<{ items: any[]; error?: string }> {
  const response = await fetch(SILICONFLOW_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SILICONFLOW_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            { type: "image_url", image_url: { url: imageBase64 } },
            { type: "text", text: "请识别这张食物照片并返回食物清单" },
          ],
        },
      ],
      max_tokens: 1024,
      temperature: 0.3,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    const errMsg = data?.message || `HTTP ${response.status}`;
    console.error(`SiliconFlow [${model}] error:`, errMsg);
    return { items: [], error: errMsg };
  }

  const content = data?.choices?.[0]?.message?.content ?? "[]";
  let foods = [];
  try {
    foods = JSON.parse(content);
  } catch {
    const match = content.match(/\[[\s\S]*\]/);
    if (match) {
      try { foods = JSON.parse(match[0]); } catch { foods = []; }
    }
  }

  const items = Array.isArray(foods) ? foods.map((f: any) => ({
    name: f.food || f.name || "未知食物",
    calories: typeof f.calories === "number" ? f.calories : 0,
    weightGrams: typeof f.weightGrams === "number" ? f.weightGrams : undefined,
  })) : [];

  return { items };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey",
      },
    });
  }

  try {
    const { imageBase64 } = await req.json();

    if (!imageBase64) {
      return new Response(
        JSON.stringify({ error: "缺少 imageBase64 字段", items: [] }),
        { status: 400, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
      );
    }

    if (!SILICONFLOW_API_KEY) {
      return new Response(
        JSON.stringify({ error: "Edge Function 未配置 API Key", items: [] }),
        { status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
      );
    }

    // Try primary model first
    let result = await tryRecognize(imageBase64, PRIMARY_MODEL);

    // If primary fails with balance/error, try fallback models
    if (result.error) {
      for (const fallbackModel of FALLBACK_MODELS) {
        console.log(`Trying fallback model: ${fallbackModel}`);
        result = await tryRecognize(imageBase64, fallbackModel);
        if (!result.error) break;
      }
    }

    if (result.error) {
      const isBalanceError = result.error.toLowerCase().includes("balance") ||
        result.error.toLowerCase().includes("insufficient");
      const userMsg = isBalanceError
        ? "AI 识别暂时不可用：SiliconFlow 账户余额不足，请充值或更换 API Key。您可以使用「手动添加食物」功能继续记录。"
        : "AI 识别调用失败: " + result.error;

      return new Response(
        JSON.stringify({ error: userMsg, items: [] }),
        { status: 502, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
      );
    }

    return new Response(
      JSON.stringify({ items: result.items }),
      { headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
    );
  } catch (err) {
    console.error("Food recognition error:", err);
    return new Response(
      JSON.stringify({ error: "Edge Function 内部异常: " + String(err), items: [] }),
      { status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
    );
  }
});
