require("dotenv").config();
const express = require("express");
const path = require("path");
const fs = require("fs");
const { getSheetData, pickColumns } = require("./lib/sheets");
const { summarize, commentOnIssue, getPersonas } = require("./lib/summarizer");

// config.json を毎リクエスト読み直す（設定画面から保存した変更を即反映）
const configPath = path.join(__dirname, "config.json");
function loadConfig() {
  return JSON.parse(fs.readFileSync(configPath, "utf-8"));
}

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// フロント用設定（ai セクションは除外して返す）
app.get("/api/config", (req, res) => {
  const { ai, ...frontConfig } = loadConfig();
  res.json(frontConfig);
});

// 設定画面用（columns + alerts のみ）
app.get("/api/config/full", (req, res) => {
  const config = loadConfig();
  res.json({ columns: config.columns, alerts: config.alerts });
});

// 設定保存（columns + alerts を config.json に書き戻す）
app.post("/api/config", (req, res) => {
  try {
    const current = loadConfig();
    const { columns, alerts } = req.body;
    if (!Array.isArray(columns) || !alerts || !Array.isArray(alerts.rules)) {
      return res.status(400).json({ error: "不正なデータ形式です" });
    }
    current.columns = columns;
    current.alerts = alerts;
    fs.writeFileSync(configPath, JSON.stringify(current, null, 2), "utf-8");
    res.json({ ok: true });
  } catch (err) {
    console.error("Config save error:", err);
    res.status(500).json({ error: "設定の保存に失敗しました" });
  }
});

// スプシから全行取得
app.get("/api/issues", async (req, res) => {
  try {
    const config = loadConfig();
    const data = await getSheetData(config);
    res.json(data);
  } catch (err) {
    console.error("Sheets API error:", err.message);
    res.status(500).json({ error: "スプレッドシートの取得に失敗しました" });
  }
});

app.get("/api/personas", (req, res) => {
  res.json(getPersonas());
});

// AI全体サマリー（フィルタ中ならフロントから課題を受け取る、なければ全件取得）
app.post("/api/summarize", async (req, res) => {
  try {
    const config = loadConfig();
    const persona = req.body.persona || process.env.PERSONA || "dog";
    let issues;
    if (Array.isArray(req.body.issues) && req.body.issues.length > 0) {
      issues = pickColumns(req.body.issues, config);
    } else {
      const allIssues = await getSheetData(config);
      issues = pickColumns(allIssues, config);
    }
    const summary = await summarize(issues, persona, config);
    res.json({ summary, persona });
  } catch (err) {
    console.error("Summarize error:", err);
    res.status(500).json({ error: "要約の生成に失敗しました" });
  }
});

// AI個別コメント（行クリック時に1件の課題にコメント）
app.post("/api/comment", async (req, res) => {
  try {
    const config = loadConfig();
    const persona = req.body.persona || process.env.PERSONA || "dog";
    const issue = req.body.issue;
    if (!issue) return res.status(400).json({ error: "課題データがありません" });
    const picked = pickColumns([issue], config);
    const result = await commentOnIssue(picked[0], persona, config);
    res.json(result);
  } catch (err) {
    console.error("Comment error:", err);
    res.status(500).json({ error: "コメントの生成に失敗しました" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
