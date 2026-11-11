const yearSelect = document.querySelector("#yearSelect");
const groupSelect = document.querySelector("#groupSelect");
const showButton = document.querySelector("#showButton");
const scheduleSection = document.querySelector("#scheduleSection");
const scheduleTitle = document.querySelector("#scheduleTitle");
const scheduleMeta = document.querySelector("#scheduleMeta");
const blockCount = document.querySelector("#blockCount");
const dayTabs = document.querySelector("#dayTabs");
const scheduleRows = document.querySelector("#scheduleRows");
const searchInput = document.querySelector("#searchInput");
const emptyState = document.querySelector("#emptyState");
const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const periodTimes = ["8:00 AM", "8:50 AM", "9:40 AM", "10:30 AM", "11:20 AM", "12:10 PM", "1:00 PM", "1:50 PM", "2:40 PM", "3:30 PM", "4:20 PM", "5:10 PM", "6:00 PM", "6:50 PM"];
let schedules = [];
let selectedSchedule = null;
let selectedGroup = null;
let selectedDay = "Monday";

function niceYear(value) {
  return value === "PG" ? "Postgraduate" : `Year ${value}`;
}

function fillYears() {
  const years = [...new Set(schedules.map((schedule) => schedule.year))];
  const order = ["1", "2", "3", "4", "PG"];
  yearSelect.innerHTML = order.filter((year) => years.includes(year)).map((year) => `<option value="${year}">${niceYear(year)}</option>`).join("");
  yearSelect.value = years.includes("1") ? "1" : years[0];
  fillGroups();
}

function fillGroups() {
  const year = yearSelect.value;
  const options = schedules.filter((schedule) => schedule.year === year).flatMap((schedule) => {
    if (schedule.groups?.length) return schedule.groups.map((group) => ({ schedule, group, value: `${schedule.id}::${group.code}`, label: group.code }));
    return [{ schedule, group: null, value: `${schedule.id}::ALL`, label: "All postgraduate programs" }];
  });
  groupSelect.innerHTML = options.map((option) => `<option value="${escapeHTML(option.value)}">${escapeHTML(option.label)}</option>`).join("");
  groupSelect.disabled = options.length < 2;
  const first = options[0];
  selectedSchedule = first?.schedule || null;
  selectedGroup = first?.group || null;
}

const courseCode = /\b[A-Z]{2,5}\d{2,3}[A-Z]\b/;

function overlaps(item, range) {
  return Array.isArray(range) && range.length === 2 && item.startCol <= range[1] && item.endCol >= range[0];
}

function groupRanges(group) {
  return [group?.tutorialRange, group?.practicalRange].filter((range) => Array.isArray(range) && range.length === 2);
}

function activitiesForEntry(entry) {
  if (!selectedGroup) return entry.items.map((item) => item.text);
  const ranges = groupRanges(selectedGroup);
  const parent = selectedGroup.parentRange;
  const activityItems = entry.items.filter((item) => courseCode.test(item.text));
  const activities = [];
  for (const item of activityItems) {
    const isShared = Array.isArray(parent) && item.startCol <= parent[0] && item.endCol >= parent[1];
    const ownRange = ranges.find((range) => overlaps(item, range));
    if (!isShared && !ownRange) continue;
    const range = isShared ? parent : ownRange;
    const detail = entry.items.filter((cell) => overlaps(cell, range)).map((cell) => cell.text);
    const text = [...new Set(detail)].join(" · ");
    if (text && !activities.includes(text)) activities.push(text);
  }
  return activities;
}

function continuationForEntry(entry) {
  if (!selectedGroup) return [];
  const ranges = groupRanges(selectedGroup);
  const cells = entry.items.filter((item) => ranges.some((range) => overlaps(item, range)));
  if (!cells.some((item) => /\bLAB\b/i.test(item.text))) return [];
  return [...new Set(cells.map((item) => item.text))];
}

function eventsForDay(day) {
  const entries = selectedSchedule.entries.filter((entry) => entry.day === day).sort((a, b) => a.period - b.period);
  const events = [];
  for (const entry of entries) {
    const activities = activitiesForEntry(entry);
    if (activities.length) {
      events.push({ period: entry.period, endPeriod: entry.period, time: entry.time, items: activities });
      continue;
    }
    const continuation = continuationForEntry(entry);
    const previous = events.at(-1);
    if (continuation.length && previous && previous.endPeriod === entry.period - 1) {
      previous.items = [...new Set([...previous.items, ...continuation])];
      previous.endPeriod = entry.period;
    }
  }
  return events;
}

function renderTabs() {
  dayTabs.innerHTML = days.map((day) => `<button class="day-tab${day === selectedDay ? " active" : ""}" type="button" role="tab" aria-selected="${day === selectedDay}" data-day="${day}">${day.slice(0, 3)}</button>`).join("");
  dayTabs.querySelectorAll(".day-tab").forEach((tab) => tab.addEventListener("click", () => {
    selectedDay = tab.dataset.day;
    renderTabs();
    renderRows();
  }));
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
}

function renderRows() {
  if (!selectedSchedule) return;
  const query = searchInput.value.trim().toLocaleLowerCase();
  const entries = eventsForDay(selectedDay)
    .filter((entry) => !query || entry.items.some((item) => item.toLocaleLowerCase().includes(query)));

  scheduleRows.innerHTML = entries.map((entry) => {
    const items = entry.items.filter((item) => !query || item.toLocaleLowerCase().includes(query));
    const chips = items.map((item) => `<span class="class-chip">${escapeHTML(item)}</span>`).join("");
    const endTime = periodTimes[entry.endPeriod];
    const timeLabel = entry.endPeriod > entry.period && endTime ? `${entry.time} – ${endTime}` : entry.time;
    const periodLabel = entry.endPeriod > entry.period ? `P${entry.period.toString().padStart(2, "0")}–${entry.endPeriod.toString().padStart(2, "0")}` : `P${entry.period.toString().padStart(2, "0")}`;
    return `<tr><td class="time-cell">${escapeHTML(timeLabel)}<span>${escapeHTML(selectedDay)}</span></td><td><div class="class-list">${chips}</div></td><td class="period-cell">${periodLabel}</td></tr>`;
  }).join("");
  emptyState.hidden = entries.length > 0;
  scheduleRows.closest("table").hidden = entries.length === 0;
}

function showSchedule() {
  const [scheduleId, groupCode] = groupSelect.value.split("::");
  selectedSchedule = schedules.find((schedule) => schedule.id === scheduleId) || selectedSchedule;
  selectedGroup = (selectedSchedule?.groups || []).find((group) => group.code === groupCode) || null;
  if (!selectedSchedule) return;
  selectedDay = "Monday";
  searchInput.value = "";
  const groupLabel = selectedGroup ? `<span>· ${escapeHTML(selectedGroup.code)}</span>` : "<span>· All PG programs</span>";
  scheduleTitle.innerHTML = `${niceYear(selectedSchedule.year)} ${groupLabel}`;
  scheduleMeta.textContent = `July–December 2026 · ${selectedSchedule.sourceSheet}`;
  blockCount.textContent = days.reduce((total, day) => total + eventsForDay(day).length, 0);
  renderTabs();
  renderRows();
  scheduleSection.hidden = false;
  scheduleSection.scrollIntoView({ behavior: "smooth", block: "start" });
}

yearSelect.addEventListener("change", fillGroups);
showButton.addEventListener("click", showSchedule);
groupSelect.addEventListener("change", () => {
  const [scheduleId, groupCode] = groupSelect.value.split("::");
  selectedSchedule = schedules.find((schedule) => schedule.id === scheduleId) || selectedSchedule;
  selectedGroup = (selectedSchedule?.groups || []).find((group) => group.code === groupCode) || null;
});
searchInput.addEventListener("input", renderRows);
document.querySelector("#backToTop").addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
document.addEventListener("keydown", (event) => {
  if (event.key === "/" && !["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement.tagName)) {
    event.preventDefault();
    searchInput.focus();
  }
  if (event.key === "Enter" && document.activeElement === groupSelect) showSchedule();
});

if (window.TIMETABLE_DATA?.sheets) {
  schedules = window.TIMETABLE_DATA.sheets;
  fillYears();
} else {
  document.querySelector("#choose-heading").textContent = "Timetables could not be loaded";
  showButton.disabled = true;
  showButton.textContent = "Reload the page";
}
