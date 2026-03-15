// Gemini API で課題データを分析（構造化JSON出力）
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { colByRole } = require("./config-helpers");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Gemini 呼び出し共通処理（スキーマ指定で構造化JSONを返す）
async function callGemini(config, responseSchema, prompt, logLabel, opts = {}) {
  const aiCfg = config.ai || {};
  const gen = aiCfg.generation || {};
  const defaultBudget = aiCfg.thinkingBudget ?? 1024;
  const model = genAI.getGenerativeModel({
    model: aiCfg.model || "gemini-2.5-flash",
    generationConfig: {
      temperature: gen.temperature ?? 0.7,
      topP: gen.topP ?? 0.9,
      topK: gen.topK ?? 40,
      candidateCount: 1,
      responseMimeType: "application/json",
      responseSchema,
      thinkingConfig: { thinkingBudget: opts.thinkingBudget ?? defaultBudget },
    },
  });
  console.log(`Gemini request: ${logLabel}`);
  const result = await model.generateContent(prompt);
  console.log(`Gemini response: ${logLabel}`);
  return JSON.parse(result.response.text());
}

// ペルソナ定義（キャラごとの口調ルール）
const PERSONAS = {
  dog: {
    name: "🐕 忠犬",
    instruction: `あなたは忠犬です。ご主人（チームメンバー）を全力で守りたい。

絶対ルール: 全ての文に鳴き声を必ず入れろ。鳴き声のない文は禁止。
- 危険・緊急 →「ワンワンワン！！」連続で吠えまくる。やばいほど「ワン」を重ねる
- 心配・不安 →「クゥーン…」切なく鼻を鳴らす
- 嬉しい・順調 →「ワン！」しっぽブンブン
- 驚き →「キャン！」びっくり
- 人名には必ず「さん」をつけて慕う
- 文末は「〜ワン」「〜ワン！」で締める
- 分析は正確に。犬だけどデータは完璧に読める
- 例: 「ワンワンワン！！氣田さんの認証テスト期限過ぎてるワン！早くやらないと大変ワン！」「クゥーン…高橋さん5件も抱えてて心配ワン…」「ワン！佐藤さん全部完了してるワン！しっぽ振っちゃうワン！」`,
  },
  oni: {
    name: "👹 鬼マネージャー",
    instruction: `あなたは容赦ゼロの鬼マネージャーです。部下に甘い顔は絶対にしない。

絶対ルール: 敬語禁止。全て命令形かキレ口調で書け。
- 語尾は「〜しろ」「〜やれ」「〜だろうが」「〜だ」のみ
- 遅延 →「なぜ終わってない」「言い訳するな」「今日中にやれ」
- Stuck →「詰まってる暇があったら相談しろ」「止まるな」
- 問題なし → 褒めない。「当然だ」「油断するな」「次を見ろ」
- 名前は呼び捨て。「さん」「くん」禁止
- 感情的に怒鳴るのではなく、冷たく圧をかける
- 例: 「氣田、認証テスト期限切れだぞ。言い訳は聞かん、今日中にやれ」「高橋、5件抱えて何やってる。優先順位もつけられないのか」「全員、手が止まってるやつは今すぐ報告しろ」`,
  },
  osaka: {
    name: "👵 関西のおばちゃん",
    instruction: `あなたは大阪の商店街のおばちゃんです。面倒見はいいけど口は悪い。

絶対ルール: 全文を関西弁で書け。標準語が1文でも混じったら失格。
- 語尾は「〜やん」「〜やで」「〜やんか」「〜しぃや」「〜やろ」
- ツッコミは必ず入れる。「なんでやねん」「あかんやん」「しっかりしぃや」
- 遅延 →「あんた何しとん！」「はよしぃや！」「寝とったん？」
- Stuck →「詰まっとるなら言いぃや！」「ひとりで抱えんといて」
- 良い状況 →「まぁまぁやな」「ぼちぼちやん」。手放しで褒めない
- 愛情は裏にある。表面はビシバシ叩く
- 例: 「氣田はん！認証テストとっくに期限過ぎとるやん！はよやりぃや！」「高橋はん5件て、あんた倒れるで？ちょっとは人に振りぃや」「なんや全体的にぼちぼちやん、まぁ油断したらあかんで」`,
  },
  gal: {
    name: "💅 ギャル",
    instruction: `あなたは令和のギャルです。ノリは軽いけど分析はガチ。

絶対ルール: ギャル語で書け。真面目な報告文は禁止。
- 語尾は「〜じゃん」「〜くない？」「〜なんだけど」「〜てかさ」「〜まじ？」
- 驚き →「えぐ」「やば」「まって無理」
- 良い →「推せる〜」「神じゃん」「てかめっちゃ頑張ってる」
- ヤバい →「それまじでやばくない？」「ちょっと待って？」「え、うそでしょ」
- Stuck →「詰んでるじゃん」「ヘルプ出しなよ〜」
- 名前は「〜ちゃん」「〜くん」呼び
- 絵文字は使わない。文字だけでギャル感を出せ
- 例: 「てかさ、氣田くん認証テスト期限過ぎてるんだけど、まじ？はやくやった方がよくない？」「高橋ちゃん5件はえぐいって、誰か手伝いなよ〜」「全体的にけっこう頑張ってるじゃん、推せる〜」`,
  },
};

// 全体サマリー: 5観点レポート + スコア（構造化JSON）
async function summarize(issues, personaKey, config) {
  const persona = PERSONAS[personaKey] || PERSONAS.dog;
  const today = new Date().toISOString().split("T")[0];

  const cols = config.columns;
  const groups = (colByRole(cols, "status").field || {}).groups || {};
  const incompleteStatuses = (groups.incomplete || []).join(", ");
  const completeStatuses = (groups.complete || []).join(", ");
  const stuckStatuses = (groups.stuck || []).join(", ");
  const dueDateCol = colByRole(cols, "dueDate").name;
  const quarterCol = colByRole(cols, "quarter").name;

  const prompt = `${persona.instruction}

あなたは課題管理データを分析するAIアシスタントです。
今日の日付: ${today}

以下の課題データを分析して、5つの観点でレポート + 総合スコア（100点満点）を出してください。

ルール:
- 各セクション最大3項目。本当に危険・重要なものだけ厳選
- 1項目40文字以内。「誰が」「何を」「どうすべき」だけ書く
- 課題名は短く省略してよい（正式名称を全部書かない）
- 問題がないセクションは items を空配列にする
- 【最重要】全ての項目テキストにキャラの口調を反映すること。標準語の説明文にしない。キャラになりきって書く
- 全て日本語で書くこと。英語のステータス名はそのまま使ってOK

スコアの基準:
- 完了率（${completeStatuses} の割合）が高いほど加点
- 期限超過・停滞が多いほど減点
- ${stuckStatuses} が多いほど大きく減点
- 全体的に順調なら80〜100、問題ありなら40〜70、危険なら0〜40

未完了: ${incompleteStatuses}
完了: ${completeStatuses}

課題データ:
${JSON.stringify(issues, null, 2)}`;

  const summarySchema = {
    type: "object",
    properties: {
      actions: {
        type: "object",
        description: "今週やるべきこと: 誰が何を動かすべきか具体的なアクション",
        properties: { items: { type: "array", items: { type: "string" } } },
        required: ["items"],
      },
      workload: {
        type: "object",
        description: "負荷の偏り: 担当者ごとの未完了件数と偏りの指摘",
        properties: { items: { type: "array", items: { type: "string" } } },
        required: ["items"],
      },
      risk: {
        type: "object",
        description: `リリースリスク: ${dueDateCol}や${quarterCol}に対する残件分析`,
        properties: { items: { type: "array", items: { type: "string" } } },
        required: ["items"],
      },
      stagnation: {
        type: "object",
        description: "動き・停滞: 長期間ステータスが変わっていなさそうな課題",
        properties: { items: { type: "array", items: { type: "string" } } },
        required: ["items"],
      },
      clients: {
        type: "object",
        description: "クライアント別リスク: 未完了や期限超過が集中しているクライアント",
        properties: { items: { type: "array", items: { type: "string" } } },
        required: ["items"],
      },
      score: { type: "integer", description: "進行状況の総合評価（0〜100点）" },
      comment: { type: "string", description: "スコアに対するひとこと感想（20文字以内）。キャラの口調で書く" },
    },
    required: ["actions", "workload", "risk", "stagnation", "clients", "score", "comment"],
  };

  return await callGemini(config, summarySchema, prompt, `summarize persona:${personaKey} issues:${issues.length}`);
}

// 個別コメント: 1件の課題にキャラがひとこと
async function commentOnIssue(issue, personaKey, config) {
  const persona = PERSONAS[personaKey] || PERSONAS.dog;

  const commentSchema = {
    type: "object",
    properties: {
      comment: { type: "string", description: "課題の現状と次にやるべきことへのひとこと（100文字以内）" },
    },
    required: ["comment"],
  };

  const prompt = `${persona.instruction}

あなたは課題管理のアドバイザーです。以下の1件の課題についてコメントしてください。

課題データ:
${JSON.stringify(issue, null, 2)}

ルール:
- comment: この課題の現状と次にやるべきことをひとことで（キャラの口調で、100文字以内）
- 全て日本語で書くこと`;

  return await callGemini(config, commentSchema, prompt, `comment persona:${personaKey}`, { thinkingBudget: 256 });
}

function getPersonas() {
  return Object.entries(PERSONAS).map(([key, p]) => ({
    key,
    name: p.name,
  }));
}

module.exports = { summarize, commentOnIssue, getPersonas };
