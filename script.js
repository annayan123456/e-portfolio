/* Shared scripts for the personal website */

(function () {
  "use strict";

  // ---------- Mobile nav toggle ----------
  var toggle = document.querySelector(".nav-toggle");
  var links = document.querySelector(".nav-links");

  if (toggle && links) {
    toggle.addEventListener("click", function () {
      var isOpen = links.classList.toggle("open");
      toggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
    });

    // Close the menu when a link is tapped (nice on phones)
    links.querySelectorAll("a").forEach(function (a) {
      a.addEventListener("click", function () {
        links.classList.remove("open");
        toggle.setAttribute("aria-expanded", "false");
      });
    });
  }

  // ---------- Contact form (demo) ----------
  var form = document.getElementById("contactForm");
  var success = document.getElementById("formSuccess");

  if (form && success) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();

      // Basic friendly validation
      var name = form.querySelector("#name");
      var email = form.querySelector("#email");
      var message = form.querySelector("#message");

      if (!name.value.trim() || !email.value.trim() || !message.value.trim()) {
        alert("Please fill in your name, email, and a message so I can write back. 🙂");
        return;
      }

      // Very lightweight email check
      var emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim());
      if (!emailOk) {
        alert("That email looks a little off — could you double-check it?");
        return;
      }

      // Demo only: no real backend, just show the friendly success state
      success.classList.add("show");
      form.reset();
      success.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }

  // ---------- To-Do app (Projects page) ----------
  var todoForm = document.getElementById("todoForm");

  if (todoForm) {
    var STORAGE_KEY = "jieqi-todo-v1";

    var taskInput   = document.getElementById("todoInput");
    var dateBtn     = document.getElementById("dateBtn");
    var dateBtnText = document.getElementById("dateBtnText");
    var calWrap     = document.getElementById("todoCalendarWrap");
    var calPop      = document.getElementById("calendarPop");
    var calTitle    = document.getElementById("calTitle");
    var calDays     = document.getElementById("calDays");
    var calPrev     = document.getElementById("calPrev");
    var calNext     = document.getElementById("calNext");
    var pickWrap    = document.getElementById("todoPickWrap");
    var pickBtn     = document.getElementById("pickBtn");
    var pickBtnIcon = document.getElementById("pickBtnIcon");
    var pickBtnText = document.getElementById("pickBtnText");
    var pickPop     = document.getElementById("pickPop");
    var pickChips   = pickPop.querySelectorAll(".pick-chip");
    var taskList    = document.getElementById("todoList");
    var emptyMsg    = document.getElementById("todoEmpty");
    var loadingMsg  = document.getElementById("todoLoading");
    var statusBar   = document.getElementById("todoStatus");
    var addBtn      = todoForm.querySelector(".todo-add");

    var MONTHS = ["January", "February", "March", "April", "May", "June",
                  "July", "August", "September", "October", "November", "December"];
    var DAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    var DAY_MS = 86400000;

    // ----- Marks (priority or emoji) -----
    var PRIORITIES = {
      low:    { label: "Low",    icon: "\uD83D\uDFE2" },
      medium: { label: "Medium", icon: "\uD83D\uDFE1" },
      high:   { label: "High",   icon: "\uD83D\uDD34" }
    };
    var EMOJI_CHOICES = [
      "\uD83D\uDCCC", // 📌
      "\uD83D\uDED2", // 🛒
      "\uD83D\uDCDE", // 📞
      "\uD83D\uDCA1", // 💡
      "\uD83C\uDFC3", // 🏃
      "\uD83D\uDCDA", // 📚
      "\u2708\uFE0F", // ✈️
      "\uD83C\uDF89"  // 🎉
    ];
    var DEFAULT_MARK = { type: "priority", value: "medium" };

    function normalizeMark(mark) {
      if (mark && mark.type === "emoji" && EMOJI_CHOICES.indexOf(mark.value) !== -1) {
        return { type: "emoji", value: mark.value };
      }
      if (mark && mark.type === "priority" && PRIORITIES.hasOwnProperty(mark.value)) {
        return { type: "priority", value: mark.value };
      }
      return { type: DEFAULT_MARK.type, value: DEFAULT_MARK.value };
    }

    function pad(n) { return n < 10 ? "0" + n : "" + n; }

    function stripTime(d) {
      return new Date(d.getFullYear(), d.getMonth(), d.getDate());
    }

    function dateToKey(d) {
      return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
    }

    function keyToDate(key) {
      var p = key.split("-");
      return new Date(+p[0], +p[1] - 1, +p[2]);
    }

    function friendlyDate(key) {
      var d = stripTime(keyToDate(key));
      var today = stripTime(new Date());
      var diff = Math.round((d.getTime() - today.getTime()) / DAY_MS);
      if (diff === 0)  { return "Today"; }
      if (diff === 1)  { return "Tomorrow"; }
      if (diff === -1) { return "Yesterday"; }
      return DAYS_SHORT[d.getDay()] + ", " + MONTHS[d.getMonth()].slice(0, 3) + " " + d.getDate();
    }

    // ----- Supabase backend -----
    // Direct project URL (works on networks that don't block *.supabase.co).
    var SUPABASE_DIRECT_URL = "https://nnaadsuruwctzlfbluhx.supabase.co";
    // On networks that reset connections to *.supabase.co, route through the
    // Vercel proxy: set this to its deployed URL, e.g. "https://my-proxy.vercel.app".
    var SUPABASE_PROXY_URL = "";
    var SUPABASE_URL = SUPABASE_PROXY_URL || SUPABASE_DIRECT_URL;
    var SUPABASE_KEY = "sb_publishable_BItByiTcFtnGN3g02JOGeg_49tD7IqU";

    // Actual Supabase table schema:
    // todos(id int identity, task text, is_complete bool, date date,
    //       emoji text, priority text, created_at timestamptz)
    var sb = (window.supabase && window.supabase.createClient)
      ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY)
      : null;

    // cloudMode flips to false only if the initial load fails — the app then
    // runs entirely on localStorage so an outage never blocks the UI.
    var cloudMode = !!sb;

    // Row (database columns) <-> Task (app model) mapping.
    // The app's "mark" is split across two DB columns:
    //   emoji non-empty -> mark {type:'emoji', value:emoji}
    //   otherwise       -> mark {type:'priority', value:priority}
    function rowToTask(row) {
      var mark;
      if (row.emoji) {
        mark = { type: "emoji", value: row.emoji };
      } else {
        mark = normalizeMark(row.priority
          ? { type: "priority", value: row.priority }
          : null);
      }
      return {
        id: String(row.id),
        text: row.task || "",
        date: row.date || dateToKey(new Date()),
        mark: mark,
        done: !!row.is_complete
      };
    }

    function taskToRow(task) {
      var isEmoji = task.mark && task.mark.type === "emoji";
      return {
        task: task.text,
        is_complete: !!task.done,
        date: task.date,
        emoji: isEmoji ? task.mark.value : "",
        priority: isEmoji ? "medium" : task.mark.value
      };
    }

    function patchToRow(patch) {
      var rowPatch = {};
      if (patch.text !== undefined) { rowPatch.task = patch.text; }
      if (patch.done !== undefined) { rowPatch.is_complete = !!patch.done; }
      return rowPatch;
    }

    // ----- State (local fallback storage) -----
    var tasks = [];

    function loadLocalTasks() {
      try {
        var saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
        if (Array.isArray(saved)) {
          tasks = saved.filter(function (t) {
            return t && typeof t.text === "string" && typeof t.date === "string";
          }).map(function (t) {
            t.mark = normalizeMark(t.mark);
            return t;
          });
        }
      } catch (err) {
        tasks = [];
      }
    }

    function saveTasks() {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
      } catch (err) { /* storage unavailable — app still works for this visit */ }
    }

    // ----- Status banner -----
    var statusTimer = null;
    function showStatus(type, message, sticky) {
      statusBar.className = "todo-status is-" + type;
      statusBar.textContent = message;
      statusBar.hidden = false;
      if (statusTimer) { clearTimeout(statusTimer); }
      if (!sticky) {
        statusTimer = setTimeout(function () { statusBar.hidden = true; }, 3500);
      }
    }

    // ----- Cloud data operations -----
    async function cloudLoad() {
      var res = await sb.from("todos")
        .select("*")
        .order("created_at", { ascending: true });
      if (res.error) { throw res.error; }
      tasks = (res.data || []).map(rowToTask);
    }

    async function cloudAdd(task) {
      var res = await sb.from("todos")
        .insert(taskToRow(task))
        .select("*");
      if (res.error) { throw res.error; }
      return rowToTask(res.data[0]);
    }

    async function cloudUpdate(id, patch) {
      var res = await sb.from("todos").update(patchToRow(patch)).eq("id", id);
      if (res.error) { throw res.error; }
    }

    async function cloudDelete(id) {
      var res = await sb.from("todos").delete().eq("id", id);
      if (res.error) { throw res.error; }
    }

    var selectedKey = dateToKey(new Date());
    var selectedMark = { type: DEFAULT_MARK.type, value: DEFAULT_MARK.value };
    var viewMonth = new Date(); // any date inside the month currently shown

    // ----- Calendar -----
    function openCalendar() {
      calPop.hidden = false;
      dateBtn.setAttribute("aria-expanded", "true");
    }

    function closeCalendar() {
      calPop.hidden = true;
      dateBtn.setAttribute("aria-expanded", "false");
    }

    function renderCalendar() {
      var year = viewMonth.getFullYear();
      var month = viewMonth.getMonth();

      calTitle.textContent = MONTHS[month] + " " + year;
      calDays.innerHTML = "";

      var firstWeekday = new Date(year, month, 1).getDay();
      var daysInMonth = new Date(year, month + 1, 0).getDate();
      var todayKey = dateToKey(new Date());

      var blank;
      for (var b = 0; b < firstWeekday; b++) {
        blank = document.createElement("span");
        blank.className = "cal-day blank";
        calDays.appendChild(blank);
      }

      for (var day = 1; day <= daysInMonth; day++) {
        (function (d) {
          var btn = document.createElement("button");
          btn.type = "button";
          btn.className = "cal-day";
          btn.textContent = d;

          var key = dateToKey(new Date(year, month, d));
          if (key === todayKey)     { btn.classList.add("is-today"); }
          if (key === selectedKey)  { btn.classList.add("is-selected"); }
          btn.setAttribute("aria-label", friendlyDate(key) + " (" + MONTHS[month] + " " + d + ")");

          btn.addEventListener("click", function () {
            selectedKey = key;
            dateBtnText.textContent = friendlyDate(key);
            closeCalendar();
            renderCalendar();
            taskInput.focus();
          });

          calDays.appendChild(btn);
        })(day);
      }
    }

    dateBtn.addEventListener("click", function () {
      if (calPop.hidden) {
        closePicker();
        viewMonth = keyToDate(selectedKey);
        renderCalendar();
        openCalendar();
      } else {
        closeCalendar();
      }
    });

    calPrev.addEventListener("click", function () {
      viewMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1);
      renderCalendar();
    });

    calNext.addEventListener("click", function () {
      viewMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1);
      renderCalendar();
    });

    // ----- Mark picker -----
    function openPicker() {
      pickPop.hidden = false;
      pickBtn.setAttribute("aria-expanded", "true");
    }

    function closePicker() {
      pickPop.hidden = true;
      pickBtn.setAttribute("aria-expanded", "false");
    }

    function syncPickerUI() {
      // Trigger button shows the current choice
      if (selectedMark.type === "emoji") {
        pickBtnIcon.textContent = selectedMark.value;
        pickBtnText.textContent = "Emoji";
      } else {
        var p = PRIORITIES[selectedMark.value];
        pickBtnIcon.textContent = p.icon;
        pickBtnText.textContent = p.label;
      }

      // Highlight the matching chip
      pickChips.forEach(function (chip) {
        var match = chip.dataset.mark === selectedMark.type &&
                    chip.dataset.value === selectedMark.value;
        chip.classList.toggle("is-selected", match);
      });
    }

    pickBtn.addEventListener("click", function () {
      if (pickPop.hidden) {
        closeCalendar();
        syncPickerUI();
        openPicker();
      } else {
        closePicker();
      }
    });

    pickChips.forEach(function (chip) {
      chip.addEventListener("click", function () {
        selectedMark = normalizeMark({ type: chip.dataset.mark, value: chip.dataset.value });
        syncPickerUI();
        closePicker();
        taskInput.focus();
      });
    });

    // Close on outside tap / Escape (nice on phones)
    document.addEventListener("click", function (e) {
      if (!calPop.hidden && !calWrap.contains(e.target)) { closeCalendar(); }
      if (!pickPop.hidden && !pickWrap.contains(e.target)) { closePicker(); }
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") { closeCalendar(); closePicker(); }
    });

    // ----- Task list -----
    function renderTasks() {
      taskList.innerHTML = "";

      tasks.forEach(function (task) {
        var mark = normalizeMark(task.mark);
        task.mark = mark;

        var li = document.createElement("li");
        li.className = "todo-item" +
                       (task.done ? " is-done" : "") +
                       (mark.type === "priority" && mark.value === "high" ? " priority-high" : "");
        li.dataset.id = task.id;

        var checkLabel = document.createElement("label");
        checkLabel.className = "todo-check";

        var checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = !!task.done;
        checkbox.setAttribute("aria-label", "Mark \"" + task.text + "\" as done");

        var checkBox = document.createElement("span");
        checkBox.className = "check-box";
        checkBox.setAttribute("aria-hidden", "true");

        checkLabel.appendChild(checkbox);
        checkLabel.appendChild(checkBox);

        var body = document.createElement("div");
        body.className = "todo-body";

        var text = document.createElement("span");
        text.className = "todo-text";
        text.textContent = task.text;
        text.title = "Click to edit — Enter saves, Esc cancels";
        text.addEventListener("click", function () {
          startEdit(li, task);
        });

        var meta = document.createElement("div");
        meta.className = "todo-meta";

        var badge = document.createElement("span");
        if (mark.type === "emoji") {
          badge.className = "todo-badge is-emoji";
          badge.textContent = mark.value;
          badge.setAttribute("aria-label", "Emoji mark");
        } else {
          var pri = PRIORITIES[mark.value];
          badge.className = "todo-badge p-" + mark.value;
          badge.textContent = pri.icon + " " + pri.label;
          badge.setAttribute("aria-label", mark.value + " priority");
        }

        var date = document.createElement("span");
        date.className = "todo-date";
        date.textContent = "\uD83D\uDDD3\uFE0F " + friendlyDate(task.date);

        meta.appendChild(badge);
        meta.appendChild(date);

        body.appendChild(text);
        body.appendChild(meta);

        var del = document.createElement("button");
        del.type = "button";
        del.className = "todo-del";
        del.innerHTML = "&times;";
        del.setAttribute("aria-label", "Delete \"" + task.text + "\"");

        li.appendChild(checkLabel);
        li.appendChild(body);
        li.appendChild(del);
        taskList.appendChild(li);
      });

      emptyMsg.hidden = tasks.length > 0;
      loadingMsg.hidden = true;
    }

    // ----- Inline editing -----
    function startEdit(item, task) {
      var span = item.querySelector(".todo-text");
      if (!span || item.querySelector(".todo-edit-input")) { return; }

      var input = document.createElement("input");
      input.type = "text";
      input.className = "todo-edit-input";
      input.value = task.text;
      input.maxLength = 140;
      input.setAttribute("aria-label", "Edit task text — press Enter to save, Escape to cancel");

      span.replaceWith(input);
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);

      var finished = false;
      var cancelled = false;

      async function finish(save) {
        if (finished) { return; }
        finished = true;

        var value = input.value.trim();
        if (save && value && value !== task.text) {
          task.text = value;
          renderTasks();
          try {
            if (cloudMode) {
              await cloudUpdate(task.id, { text: value });
            } else {
              saveTasks();
            }
          } catch (err) {
            showStatus("error", "Couldn't save the edit to the cloud — it'll refresh back on reload.");
          }
        } else {
          renderTasks();
        }
      }

      input.addEventListener("keydown", function (e) {
        if (e.key === "Enter") {
          e.preventDefault();
          finish(true);
        } else if (e.key === "Escape") {
          e.preventDefault();
          cancelled = true;
          finish(false);
        }
      });

      // Clicking away commits a non-empty edit; an empty edit reverts
      input.addEventListener("blur", function () {
        finish(!cancelled);
      });
    }

    taskList.addEventListener("change", function (e) {
      if (e.target.matches('input[type="checkbox"]')) {
        var item = e.target.closest(".todo-item");
        var task = tasks.filter(function (t) { return t.id === item.dataset.id; })[0];
        if (!task) { return; }

        task.done = e.target.checked;
        renderTasks(); // optimistic

        if (cloudMode) {
          cloudUpdate(task.id, { done: task.done }).catch(function () {
            showStatus("error", "Couldn't sync the checkbox to the cloud.");
          });
        } else {
          saveTasks();
        }
      }
    });

    taskList.addEventListener("click", function (e) {
      var delBtn = e.target.closest(".todo-del");
      if (!delBtn) { return; }
      var item = delBtn.closest(".todo-item");
      var id = item.dataset.id;

      if (cloudMode) {
        delBtn.disabled = true; // prevent double-clicks while the request flies
        cloudDelete(id).then(function () {
          tasks = tasks.filter(function (t) { return t.id !== id; });
          renderTasks();
        }).catch(function () {
          delBtn.disabled = false;
          showStatus("error", "Couldn't delete that task from the cloud — please try again.");
        });
      } else {
        tasks = tasks.filter(function (t) { return t.id !== id; });
        saveTasks();
        renderTasks();
      }
    });

    // ----- Add -----
    todoForm.addEventListener("submit", async function (e) {
      e.preventDefault();

      var value = taskInput.value.trim();
      if (!value) {
        taskInput.classList.add("invalid");
        taskInput.focus();
        return;
      }

      var draft = {
        text: value,
        date: selectedKey,
        mark: { type: selectedMark.type, value: selectedMark.value },
        done: false
      };

      if (cloudMode) {
        // Save to the database first, then show the row the server returns
        addBtn.disabled = true;
        var originalLabel = addBtn.textContent;
        addBtn.textContent = "Adding…";
        try {
          var saved = await cloudAdd(draft);
          tasks.push(saved);
          taskInput.value = "";
          taskInput.classList.remove("invalid");
          renderTasks();
          taskInput.focus();
        } catch (err) {
          showStatus("error", friendlyDbError(err, "add"));
        } finally {
          addBtn.disabled = false;
          addBtn.textContent = originalLabel;
        }
      } else {
        draft.id = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
        tasks.push(draft);
        taskInput.value = "";
        taskInput.classList.remove("invalid");
        saveTasks();
        renderTasks();
        taskInput.focus();
      }
    });

    function friendlyDbError(err, action) {
      var sentence;
      if (action === "add") {
        sentence = "Couldn't add this task to the cloud.";
      } else if (action === "load") {
        sentence = "Couldn't load your tasks from the cloud.";
      } else {
        sentence = "Couldn't save this change to the cloud.";
      }

      var msg = (err && err.message) || "";
      var code = (err && err.code) || "";
      var combined = msg + " " + code;

      // Connection-level failure: DNS/TCP/TLS never completed (e.g. a network
      // that resets TLS to *.supabase.co). Browsers surface this as a bare
      // fetch failure with no HTTP status.
      if (/Failed to fetch|Load failed|NetworkError|ERR_NETWORK|fetch failed|Connection reset/i.test(combined)) {
        return "Can't reach Supabase — this network appears to block *.supabase.co (connection reset). Tasks are saved in this browser for now; switch networks/VPN to sync.";
      }

      var hint = "";
      if (err && (code === "42P01" || /relation .* does not exist/i.test(msg))) {
        hint = " The \"todos\" table doesn't exist yet — run the setup SQL in Supabase.";
      } else if (/JWT|apikey|Unauthorized/i.test(combined)) {
        hint = " Supabase rejected the publishable key or the RLS policy.";
      }
      return sentence + hint;
    }

    taskInput.addEventListener("input", function () {
      taskInput.classList.remove("invalid");
    });

    // ----- Init -----
    renderCalendar();
    syncPickerUI();

    (async function init() {
      if (!sb) {
        cloudMode = false;
        loadLocalTasks();
        renderTasks();
        showStatus("warn", "Supabase didn't load (offline?) — using this browser's local tasks.", true);
        return;
      }

      try {
        await cloudLoad(); // ordered by created_at, oldest first
        renderTasks();
      } catch (err) {
        cloudMode = false;
        loadLocalTasks();
        renderTasks();
        showStatus("error", friendlyDbError(err, "load") +
          " Showing local tasks for now.", true);
      }
    })();
  }
})();
