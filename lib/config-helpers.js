// role からカラム定義を引く（見つからなければ空オブジェクト）
function colByRole(columns, role) {
  return columns.find((c) => c.role === role) || {};
}

module.exports = { colByRole };
