const sqlInput = document.getElementById("sql-input");
const sqlOutput = document.getElementById("sql-output");
const sqlStatus = document.getElementById("sql-status");
const copySqlButton = document.getElementById("copy-sql");
const sqlDialect = document.getElementById("sql-dialect");
const savedDialect = localStorage.getItem("sql-dialect");
if (savedDialect && [...sqlDialect.options].some((option) => option.value === savedDialect)) {
  sqlDialect.value = savedDialect;
}

function setSqlStatus(message, isError) {
  sqlStatus.textContent = message;
  sqlStatus.className = isError ? "status error" : "status";
}

function updateSqlCopy() {
  copySqlButton.disabled = sqlOutput.value === "";
}

function formatSql() {
  if (sqlInput.value.trim() === "") {
    sqlOutput.value = "";
    setSqlStatus("", false);
    updateSqlCopy();
    return;
  }
  try {
    sqlOutput.value = sqlFormatter.format(sqlInput.value, {
      language: sqlDialect.value,
      keywordCase: "upper"
    });
    setSqlStatus("Formatted", false);
  } catch (error) {
    setSqlStatus(error.message, true);
  }
  updateSqlCopy();
}

document.getElementById("format-sql").addEventListener("click", formatSql);
copySqlButton.addEventListener("click", () => copyToClipboard(copySqlButton, sqlOutput.value, sqlStatus));
sqlDialect.addEventListener("change", () => {
  localStorage.setItem("sql-dialect", sqlDialect.value);
  if (sqlOutput.value) formatSql();
});
