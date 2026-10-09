const sqlInput = document.getElementById("sql-input");
const sqlOutput = document.getElementById("sql-output");
const sqlStatus = document.getElementById("sql-status");
const sqlDialect = document.getElementById("sql-dialect");
const savedDialect = localStorage.getItem("sql-dialect");
if (savedDialect && [...sqlDialect.options].some((option) => option.value === savedDialect)) {
  sqlDialect.value = savedDialect;
}

function setSqlStatus(message, isError) {
  sqlStatus.textContent = message;
  sqlStatus.className = isError ? "status error" : "status";
}

function formatSql() {
  if (sqlInput.value.trim() === "") {
    sqlOutput.value = "";
    setSqlStatus("", false);
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
}

document.getElementById("format-sql").addEventListener("click", formatSql);
sqlDialect.addEventListener("change", () => {
  localStorage.setItem("sql-dialect", sqlDialect.value);
  if (sqlOutput.value) formatSql();
});
