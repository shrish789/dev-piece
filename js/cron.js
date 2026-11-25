const cronFields = [
  ["minute", "cron-minute", "cron-hint-minute"],
  ["hour", "cron-hour", "cron-hint-hour"],
  ["dayOfMonth", "cron-day", "cron-hint-day"],
  ["month", "cron-month", "cron-hint-month"],
  ["dayOfWeek", "cron-weekday", "cron-hint-weekday"]
];
const cronBounds = {
  minute: [0, 59],
  hour: [0, 23],
  dayOfMonth: [1, 31],
  month: [1, 12],
  dayOfWeek: [0, 7]
};
const cronFieldLabels = {
  minute: "Minute",
  hour: "Hour",
  dayOfMonth: "Day of month",
  month: "Month",
  dayOfWeek: "Day of week"
};
const cronAnyHint = {
  minute: "any minute",
  hour: "any hour",
  dayOfMonth: "any day",
  month: "any month",
  dayOfWeek: "any weekday"
};
const cronUnits = {
  minute: ["minute", "minutes"],
  hour: ["hour", "hours"],
  dayOfMonth: ["day", "days"],
  month: ["month", "months"],
  dayOfWeek: ["day of the week", "days of the week"]
};
const cronMonthNames = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12
};
const cronWeekdayNames = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
const cronMonthLabels = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const cronWeekdayLabels = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const cronRunWeekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const cronRunMonths = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const cronAliases = {
  "@yearly": "0 0 1 1 *",
  "@annually": "0 0 1 1 *",
  "@monthly": "0 0 1 * *",
  "@weekly": "0 0 * * 0",
  "@daily": "0 0 * * *",
  "@midnight": "0 0 * * *",
  "@hourly": "0 * * * *"
};
const cronPresets = [
  ["cron-preset-minute", "* * * * *"],
  ["cron-preset-15", "*/15 * * * *"],
  ["cron-preset-hourly", "0 * * * *"],
  ["cron-preset-daily", "0 0 * * *"],
  ["cron-preset-weekdays", "0 9 * * 1-5"],
  ["cron-preset-weekly", "0 0 * * 0"],
  ["cron-preset-monthly", "0 0 1 * *"],
  ["cron-preset-yearly", "0 0 1 1 *"]
];
const cronStorageKey = "cron-expression";
const cronNextCount = 8;
const cronSearchYears = 8;
const cronStepCap = 50000;

const cronInput = document.getElementById("cron-input");
const cronSummary = document.getElementById("cron-summary");
const cronStatus = document.getElementById("cron-status");
const cronNext = document.getElementById("cron-next");
const cronNextEmpty = document.getElementById("cron-next-empty");
const cronNextTitle = document.getElementById("cron-next-title");
const copyCronButton = document.getElementById("copy-cron");

function pad2(value) {
  return String(value).padStart(2, "0");
}

function joinAnd(items) {
  if (items.length <= 1) return items[0] || "";
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

function clock(hour, minute) {
  return `${pad2(hour)}:${pad2(minute)}`;
}

function normalizeSpace(value) {
  return value.trim().replace(/\s+/g, " ");
}

function cronFail(message) {
  throw new Error(message);
}

function namedCronValue(token, kind) {
  const name = token.toLowerCase();
  if (kind === "month") return cronMonthNames[name];
  if (kind === "dayOfWeek") return cronWeekdayNames[name];
  return undefined;
}

function parseCronNumber(token, kind) {
  const named = namedCronValue(token, kind);
  if (named != null) return named;
  if (!/^\d+$/.test(token)) cronFail(`Could not read "${token}"`);
  const value = Number(token);
  const [minimum, maximum] = cronBounds[kind];
  if (value < minimum || value > maximum) {
    cronFail(`must be from ${minimum} to ${maximum}`);
  }
  return value;
}

function parseCronItem(token, kind) {
  const pieces = token.split("/");
  if (pieces.length > 2) cronFail("Use at most one /");
  let step = null;
  const body = pieces[0];
  if (pieces.length === 2) {
    if (!/^[1-9]\d*$/.test(pieces[1])) cronFail("Step must be a positive whole number");
    step = Number(pieces[1]);
  }
  if (body === "*") return { type: "star", step };
  const hyphen = body.indexOf("-");
  if (hyphen > 0) {
    const startToken = body.slice(0, hyphen);
    const endToken = body.slice(hyphen + 1);
    if (!startToken || !endToken || endToken.includes("-")) cronFail(`Could not read "${token}"`);
    const start = parseCronNumber(startToken, kind);
    const end = parseCronNumber(endToken, kind);
    if (start > end) cronFail("Range is backwards");
    return { type: "range", start, end, step };
  }
  if (step != null) cronFail("Put * or a range before /");
  return { type: "value", value: parseCronNumber(body, kind) };
}

function expandCronPart(part, kind) {
  const [minimum, maximum] = cronBounds[kind];
  const push = value => (kind === "dayOfWeek" && value === 7 ? 0 : value);
  if (part.type === "value") return [push(part.value)];
  const step = part.step || 1;
  const start = part.type === "star" ? minimum : part.start;
  const end = part.type === "star" && kind === "dayOfWeek" ? 6 : part.type === "star" ? maximum : part.end;
  const values = [];
  for (let value = start; value <= end; value += step) values.push(push(value));
  return values;
}

function starField(kind) {
  const values = expandCronPart({ type: "star", step: null }, kind);
  return { any: true, parts: [{ type: "star", step: null }], values };
}

function parseCronField(token, kind) {
  try {
    if (token === "") cronFail("needs a value");
    if (token === "?") {
      if (kind !== "dayOfMonth" && kind !== "dayOfWeek") cronFail("? belongs on a day field");
      return starField(kind);
    }
    if (token.includes("#") || /(^|[^A-Za-z])[LW]([^A-Za-z]|$)/.test(token)) {
      cronFail("L, W, and # are outside standard crontab");
    }
    const items = token.split(",");
    if (items.some(item => item === "")) cronFail("Empty list item");
    const parts = items.map(item => parseCronItem(item, kind));
    const values = [...new Set(parts.flatMap(part => expandCronPart(part, kind)))].sort((a, b) => a - b);
    if (values.length === 0) cronFail("matches nothing");
    return {
      any: parts.some(part => part.type === "star" && !part.step),
      parts,
      values
    };
  } catch (error) {
    const label = cronFieldLabels[kind];
    if (error.message.startsWith(label)) throw error;
    cronFail(`${label}: ${error.message}`);
  }
}

function parseCron(expression) {
  const text = normalizeSpace(expression);
  if (text === "") cronFail("Enter a cron expression");
  const lower = text.toLowerCase();
  if (lower.startsWith("@")) {
    if (lower === "@reboot") return { alias: "@reboot", reboot: true, expression: "@reboot", tokens: [], fields: null };
    const expanded = cronAliases[lower];
    if (!expanded) cronFail("Unknown shortcut. Use @hourly, @daily, @weekly, @monthly, @yearly, or @reboot");
    const parsed = parseCron(expanded);
    return { ...parsed, alias: lower, expression: expanded };
  }
  const tokens = text.split(" ");
  if (tokens.length !== 5) cronFail("Use 5 fields: minute hour day month weekday");
  const fields = {};
  cronFields.forEach(([kind], index) => {
    fields[kind] = parseCronField(tokens[index], kind);
  });
  return { alias: null, reboot: false, expression: tokens.join(" "), tokens, fields };
}

function nameFor(kind, value) {
  if (kind === "month") return cronMonthLabels[value - 1];
  if (kind === "dayOfWeek") return cronWeekdayLabels[value === 7 ? 0 : value];
  return String(value);
}

function describePart(part, kind) {
  const [singular, plural] = cronUnits[kind];
  if (part.type === "value") return nameFor(kind, part.value);
  if (part.type === "star") {
    if (!part.step || part.step === 1) return `every ${singular}`;
    return `every ${part.step} ${plural}`;
  }
  if (kind === "dayOfWeek" && part.start === 0 && part.end === 7 && (!part.step || part.step === 1)) {
    return "Sunday through Saturday";
  }
  const start = nameFor(kind, part.start);
  const end = nameFor(kind, part.end);
  if (!part.step || part.step === 1) return `${start} through ${end}`;
  return `every ${part.step} ${plural} from ${start} through ${end}`;
}

function describeField(field, kind) {
  if (field.any) return cronAnyHint[kind];
  if (field.parts.every(part => part.type === "value")) {
    const names = [];
    for (const part of field.parts) {
      const name = nameFor(kind, part.value);
      if (!names.includes(name)) names.push(name);
    }
    return joinAnd(names);
  }
  return field.parts.map(part => describePart(part, kind)).join(", ");
}

function onlyValues(field) {
  if (!field || field.any || field.parts.some(part => part.type !== "value")) return null;
  return field.parts.map(part => part.value);
}

function onlyStep(field) {
  if (!field || field.any || field.parts.length !== 1) return null;
  const part = field.parts[0];
  if (part.type !== "star" || !part.step) return null;
  return part.step;
}

function simpleRange(field) {
  if (!field || field.any || field.parts.length !== 1 || field.parts[0].type !== "range") return null;
  if (field.parts[0].step && field.parts[0].step !== 1) return null;
  return field.parts[0];
}

function everyUnit(step, singular, plural) {
  return step === 1 ? `Every ${singular}` : `Every ${step} ${plural}`;
}

function sortedNumbers(values) {
  return [...values].sort((left, right) => left - right);
}

function describeTime(minute, hour) {
  const minuteValues = onlyValues(minute);
  const hourValues = onlyValues(hour);
  const minuteStep = onlyStep(minute);
  const hourStep = onlyStep(hour);
  const hourRange = simpleRange(hour);

  if (minute.any && hour.any) return "Every minute";
  if (minuteStep && hour.any) return everyUnit(minuteStep, "minute", "minutes");
  if (minuteValues && minuteValues.length === 1 && minuteValues[0] === 0 && hour.any) return "Every hour";
  if (minuteValues && minuteValues.length === 1 && minuteValues[0] === 0 && hourStep) {
    return everyUnit(hourStep, "hour", "hours");
  }
  if (minuteValues && hourValues) {
    const hours = sortedNumbers(hourValues);
    const minutes = sortedNumbers(minuteValues);
    if (hours.length * minutes.length <= 12) {
      const times = [];
      for (const hourValue of hours) {
        for (const minuteValue of minutes) times.push(clock(hourValue, minuteValue));
      }
      return `At ${joinAnd(times)}`;
    }
  }
  if (minuteValues && minuteValues.length === 1 && hourStep) {
    const atMinute = minuteValues[0] === 0 ? "" : ` at minute ${minuteValues[0]}`;
    return `${everyUnit(hourStep, "hour", "hours")}${atMinute}`;
  }
  if (minuteValues && minuteValues.length === 1 && minuteValues[0] === 0 && hourRange) {
    return `Every hour from ${clock(hourRange.start, 0)} through ${clock(hourRange.end, 0)}`;
  }
  if (minuteValues && minuteValues.length === 1 && hourRange) {
    return `At minute ${minuteValues[0]} from ${clock(hourRange.start, 0)} through ${clock(hourRange.end, 0)}`;
  }
  if (minuteStep && hourValues && hourValues.length === 1) {
    return `${everyUnit(minuteStep, "minute", "minutes")} during ${clock(hourValues[0], 0)}`;
  }
  if (minuteStep && hourRange) {
    return `${everyUnit(minuteStep, "minute", "minutes")} from ${clock(hourRange.start, 0)} through ${clock(hourRange.end, 59)}`;
  }
  if (minuteValues && hour.any) {
    const label = minuteValues.length === 1 ? "minute" : "minutes";
    return `At ${label} ${joinAnd(minuteValues.map(String))} of every hour`;
  }
  if (minute.any && hourValues && hourValues.length === 1) {
    return `Every minute during ${clock(hourValues[0], 0)}`;
  }
  if (minute.any) return `Every minute, ${describeField(hour, "hour")}`;
  const hourText = hour.any ? "every hour" : describeField(hour, "hour");
  return `At ${describeField(minute, "minute")}, ${hourText}`;
}

function describeDayOfMonth(field) {
  const values = onlyValues(field);
  if (values && values.length === 1) return `on day ${values[0]} of the month`;
  if (values) return `on days ${joinAnd(values.map(String))} of the month`;
  const range = simpleRange(field);
  if (range) return `on days ${range.start} through ${range.end} of the month`;
  const text = describeField(field, "dayOfMonth");
  if (text.startsWith("every ")) return text;
  return `on ${text} of the month`;
}

function describeMonth(field) {
  const text = describeField(field, "month");
  if (text.startsWith("every ")) return text;
  const range = simpleRange(field);
  if (range) return `from ${nameFor("month", range.start)} through ${nameFor("month", range.end)}`;
  const values = onlyValues(field);
  if (values && values.length === 1) return `only in ${text}`;
  return `in ${text}`;
}

function describeWeekday(field, dayOfMonthIsAny) {
  const text = describeField(field, "dayOfWeek");
  if (text.startsWith("every ")) return dayOfMonthIsAny ? text : `and ${text}`;
  const prefix = dayOfMonthIsAny ? "only on" : "and on";
  return `${prefix} ${text}`;
}

function describeSchedule(fields) {
  const sentence = describeTime(fields.minute, fields.hour);
  const details = [];
  if (!fields.dayOfMonth.any) details.push(describeDayOfMonth(fields.dayOfMonth));
  if (!fields.month.any) details.push(describeMonth(fields.month));
  if (!fields.dayOfWeek.any) details.push(describeWeekday(fields.dayOfWeek, fields.dayOfMonth.any));
  if (details.length === 0 && /^At \d{2}:\d{2}/.test(sentence)) details.push("every day");
  return [sentence, ...details].join(", ");
}

function dayMatches(date, fields) {
  const dayOfMonth = fields.dayOfMonth.values.includes(date.getDate());
  const weekday = fields.dayOfWeek.values.includes(date.getDay());
  if (fields.dayOfMonth.any && fields.dayOfWeek.any) return true;
  if (fields.dayOfMonth.any) return weekday;
  if (fields.dayOfWeek.any) return dayOfMonth;
  // crontab(5): when both day fields are restricted, either match is enough.
  return dayOfMonth || weekday;
}

function nextCronRuns(fields, from, count) {
  const runs = [];
  const cursor = new Date(from.getTime());
  cursor.setSeconds(0, 0);
  if (cursor.getTime() <= from.getTime()) cursor.setMinutes(cursor.getMinutes() + 1);
  const deadline = new Date(cursor.getTime());
  deadline.setFullYear(deadline.getFullYear() + cronSearchYears);
  let steps = 0;
  // ponytail: jumps empty months and days, then stops after 8 years or 50k steps.
  // DST can skip or repeat a local hour; a cron daemon is the upgrade path for zone accuracy.
  while (runs.length < count && cursor < deadline && steps < cronStepCap) {
    steps += 1;
    if (!fields.month.values.includes(cursor.getMonth() + 1)) {
      cursor.setDate(1);
      cursor.setHours(0, 0, 0, 0);
      cursor.setMonth(cursor.getMonth() + 1);
      continue;
    }
    if (!dayMatches(cursor, fields)) {
      cursor.setDate(cursor.getDate() + 1);
      cursor.setHours(0, 0, 0, 0);
      continue;
    }
    if (!fields.hour.values.includes(cursor.getHours())) {
      const hour = fields.hour.values.find(value => value > cursor.getHours());
      if (hour == null) {
        cursor.setDate(cursor.getDate() + 1);
        cursor.setHours(0, 0, 0, 0);
      } else {
        cursor.setHours(hour, 0, 0, 0);
      }
      continue;
    }
    if (!fields.minute.values.includes(cursor.getMinutes())) {
      const minute = fields.minute.values.find(value => value > cursor.getMinutes());
      if (minute == null) cursor.setHours(cursor.getHours() + 1, 0, 0, 0);
      else cursor.setMinutes(minute, 0, 0);
      continue;
    }
    runs.push(new Date(cursor.getTime()));
    cursor.setMinutes(cursor.getMinutes() + 1);
  }
  return runs;
}

function formatCronRun(date) {
  return `${cronRunWeekdays[date.getDay()]} ${pad2(date.getDate())} ${cronRunMonths[date.getMonth()]} ${date.getFullYear()}, ${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

function localZoneLabel() {
  const offset = -new Date().getTimezoneOffset();
  const sign = offset >= 0 ? "+" : "-";
  const absolute = Math.abs(offset);
  return `UTC${sign}${pad2(Math.floor(absolute / 60))}:${pad2(absolute % 60)}`;
}

function setCronStatus(message, isError) {
  cronStatus.textContent = message;
  cronStatus.className = isError ? "status error" : "status";
}

function rememberCron(expression) {
  try {
    localStorage.setItem(cronStorageKey, expression);
  } catch {
    // Explaining still works when the browser refuses storage.
  }
}

function clearCronRuns(message) {
  cronNext.replaceChildren();
  cronNextEmpty.textContent = message;
}

function showCronRuns(runs) {
  clearCronRuns(runs.length ? "" : `No runs in the next ${cronSearchYears} years`);
  for (const run of runs) {
    const item = document.createElement("li");
    item.textContent = formatCronRun(run);
    cronNext.append(item);
  }
}

function showCronHints(fields, tokens) {
  cronFields.forEach(([kind, , hintId], index) => {
    if (!fields) {
      document.getElementById(hintId).textContent = "";
      return;
    }
    const hint = describeField(fields[kind], kind);
    const token = tokens[index] || "";
    document.getElementById(hintId).textContent = hint.toLowerCase() === token.toLowerCase() ? "" : hint;
  });
}

function fillCronFields(tokens) {
  cronFields.forEach(([, inputId], index) => {
    document.getElementById(inputId).value = tokens[index] || "";
  });
}

function highlightCronPreset(expression, expanded) {
  const current = normalizeSpace(expression);
  const schedule = normalizeSpace(expanded || expression);
  for (const [id, preset] of cronPresets) {
    document.getElementById(id).classList.toggle("active", preset === current || preset === schedule);
  }
}

function explainCron(expression, fillFields) {
  const source = expression.trim();
  try {
    const parsed = parseCron(source);
    if (fillFields) fillCronFields(parsed.reboot ? [] : parsed.tokens);
    highlightCronPreset(source, parsed.expression);
    cronInput.setAttribute("aria-invalid", "false");
    copyCronButton.disabled = false;
    if (parsed.reboot) {
      cronSummary.textContent = "Runs when cron restarts";
      showCronHints(null);
      clearCronRuns("No timetable");
      setCronStatus("@reboot has no timetable", false);
      return;
    }
    cronSummary.textContent = describeSchedule(parsed.fields);
    showCronHints(parsed.fields, parsed.tokens);
    showCronRuns(nextCronRuns(parsed.fields, new Date(), cronNextCount));
    setCronStatus(parsed.alias ? `${parsed.alias} is ${parsed.expression}` : "", false);
  } catch (error) {
    const parts = normalizeSpace(source).split(" ");
    if (fillFields && parts.length === cronFields.length && !source.startsWith("@")) fillCronFields(parts);
    highlightCronPreset(source, "");
    cronSummary.textContent = "Can't read that expression";
    showCronHints(null);
    clearCronRuns("");
    cronInput.setAttribute("aria-invalid", "true");
    copyCronButton.disabled = true;
    setCronStatus(error.message, true);
  }
}

function explainCronInput() {
  rememberCron(cronInput.value);
  explainCron(cronInput.value, true);
}

function explainCronFields() {
  const expression = cronFields.map(([, inputId]) => document.getElementById(inputId).value.trim()).join(" ");
  cronInput.value = expression;
  rememberCron(expression);
  explainCron(expression, false);
}

cronNextTitle.textContent = `Next runs · ${localZoneLabel()}`;
cronInput.addEventListener("input", explainCronInput);
copyCronButton.addEventListener("click", () => {
  if (copyCronButton.disabled) return;
  copyToClipboard(copyCronButton, cronInput.value.trim(), cronStatus);
});
for (const [, inputId] of cronFields) {
  const field = document.getElementById(inputId);
  field.addEventListener("input", explainCronFields);
  field.addEventListener("focus", () => {
    if (typeof field.select === "function") field.select();
  });
}
for (const [id, expression] of cronPresets) {
  const button = document.getElementById(id);
  button.dataset.expression = expression;
  button.addEventListener("click", () => {
    cronInput.value = expression;
    explainCronInput();
  });
}

const savedCron = localStorage.getItem(cronStorageKey);
cronInput.value = savedCron && savedCron.trim() ? savedCron : "* * * * *";
explainCron(cronInput.value, true);
