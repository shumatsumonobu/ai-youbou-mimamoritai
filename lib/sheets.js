// Google Sheets API でスプシからデータ取得
const { google } = require("googleapis");
const path = require("path");
const { colByRole } = require("./config-helpers");

const SCOPES = ["https://www.googleapis.com/auth/spreadsheets.readonly"];

// スプシ全行を取得してオブジェクト配列に変換（空行・タイトル空は除外）
async function getSheetData(config) {
  const keyPath = path.resolve(process.env.SHEETS_SERVICE_ACCOUNT_KEY);
  const auth = new google.auth.GoogleAuth({
    keyFile: keyPath,
    scopes: SCOPES,
  });

  const sheets = google.sheets({ version: "v4", auth });
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.SPREADSHEET_ID,
    range: process.env.SHEET_NAME,
  });

  const rows = res.data.values;
  if (!rows || rows.length === 0) return [];

  const headers = rows[0];
  const titleCol = colByRole(config.columns, "title").name;

  return rows.slice(1)
    .filter((row) => row.some((cell) => cell && cell.trim() !== ""))
    .map((row) => {
      const obj = {};
      headers.forEach((h, i) => {
        if (h) obj[h] = row[i] || "";
      });
      return obj;
    })
    .filter((obj) => obj[titleCol] && obj[titleCol].trim() !== "");
}

// AIに送る列だけ抽出（config.ai.sendColumns で指定された role のみ）
function pickColumns(rows, config) {
  const cols = config.columns;
  const sendCols = config.ai.sendColumns.map((role) => colByRole(cols, role).name).filter(Boolean);
  return rows.map((row) => {
    const filtered = {};
    for (const col of sendCols) {
      if (row[col] !== undefined) filtered[col] = row[col];
    }
    return filtered;
  });
}

module.exports = { getSheetData, pickColumns };
