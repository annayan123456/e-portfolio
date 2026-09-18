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

  // ---------- To-Do mini app (Projects page) ----------
  var todoForm = document.getElementById("todoForm");

  if (todoForm) {
    (function () {
      "use strict";

      var STORAGE_KEY = "jieqi.todos.v1";

      var todoInput = document.getElementById("todoInput");
      var todoDate  = document.getElementById("todoDate");
      var todoList  = document.getElementById("todoList");
      var todoEmpty = document.getElementById("todoEmpty");
      var todoCount = document.getElementById("todoCount");
      var emojiRow  = document.getElementById("todoEmojis");
      var prioRow   = document.getElementById("todoPriority");

      var EMOJI_CHOICES = ["📝", "📚", "🎯", "💼", "🏃", "🎵", "✈️", "🧠"];
      var PRIORITY_WEIGHT = { high: 0, medium: 1, low: 2 };

      // Currently selected picker values (defaults match the active buttons in HTML)
      var selectedEmoji = "📝";
      var selectedPriority = "medium";

      /* ----- Date helpers (local time, never UTC) ----- */
      function toISODate(d) {
        var m = String(d.getMonth() + 1).padStart(2, "0");
        var day = String(d.getDate()).padStart(2, "0");
        return d.getFullYear() + "-" + m + "-" + day;
      }

      function parseISODate(iso) {
        var p = iso.split("-");
        return new Date(+p[0], +p[1] - 1, +p[2]);
      }

      function dayDiff(iso) {
        var ms = parseISODate(iso).getTime() - parseISODate(toISODate(new Date())).getTime();
        return Math.round(ms / 86400000);
      }

      function dateLabel(iso) {
        var diff = dayDiff(iso);
        if (diff === 0) return "Today";
        if (diff === 1) return "Tomorrow";
        if (diff === -1) return "Yesterday";
        return parseISODate(iso).toLocaleDateString(undefined, {
          weekday: "short", month: "short", day: "numeric"
        });
      }

      /* ----- Persistence (fault-tolerant: bad storage/data never crashes) ----- */
      function loadTodos() {
        try {
          var raw = localStorage.getItem(STORAGE_KEY);
          if (!raw) return [];
          var data = JSON.parse(raw);
          if (!Array.isArray(data)) return [];
          return data
            .filter(function (t) {
              return t &&
                typeof t.id === "string" &&
                typeof t.text === "string" && t.text.trim() !== "" &&
                typeof t.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(t.date) &&
                typeof t.completed === "boolean";
            })
            // Normalize fields added after v1 (older saved tasks get safe defaults)
            .map(function (t) {
              return {
                id: t.id,
                text: t.text,
                date: t.date,
                completed: t.completed,
                createdAt: typeof t.createdAt === "number" ? t.createdAt : 0,
                emoji: EMOJI_CHOICES.indexOf(t.emoji) !== -1 ? t.emoji : "",
                priority: (t.priority === "high" || t.priority === "low") ? t.priority : "medium"
              };
            });
        } catch (err) {
          return [];
        }
      }

      function saveTodos() {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
        } catch (err) { /* storage full/blocked — app still works this session */ }
      }

      var todos = loadTodos();

      function uid() {
        return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
      }

      /* ----- Render ----- */
      function render() {
        todoList.innerHTML = "";
        var frag = document.createDocumentFragment();

        todos.forEach(function (t) {
          var li = document.createElement("li");
          li.className = "todo-item" + (t.completed ? " done" : "");
          li.dataset.id = t.id;

          var check = document.createElement("input");
          check.type = "checkbox";
          check.className = "todo-check";
          check.checked = t.completed;
          check.setAttribute("aria-label", t.completed ? "Mark as not done" : "Mark as done");

          var emoji = null;
          if (t.emoji) {
            emoji = document.createElement("span");
            emoji.className = "todo-emoji";
            emoji.textContent = t.emoji;
            emoji.setAttribute("aria-hidden", "true");
          }

          var text = document.createElement("span");
          text.className = "todo-text";
          text.textContent = t.text;   // textContent = safe, no HTML injection
          text.title = "Click to edit — Enter saves, Esc cancels";

          var prio = document.createElement("span");
          prio.className = "todo-prio prio-" + t.priority;
          prio.textContent = t.priority.charAt(0).toUpperCase() + t.priority.slice(1);

          var chip = document.createElement("span");
          var diff = dayDiff(t.date);
          chip.className = "todo-date" +
            (diff === 0 ? " is-today" : "") +
            (diff < 0 && !t.completed ? " is-overdue" : "");
          chip.textContent = dateLabel(t.date);

          var del = document.createElement("button");
          del.type = "button";
          del.className = "todo-del";
          del.setAttribute("aria-label", "Delete task: " + t.text);
          del.textContent = "\u00D7"; // ×

          li.appendChild(check);
          if (emoji) li.appendChild(emoji);
          li.appendChild(text);
          li.appendChild(prio);
          li.appendChild(chip);
          li.appendChild(del);
          frag.appendChild(li);
        });

        todoList.appendChild(frag);
        todoEmpty.style.display = todos.length ? "none" : "block";

        var doneCount = todos.filter(function (t) { return t.completed; }).length;
        if (todos.length === 0) {
          todoCount.textContent = "No tasks yet";
        } else {
          todoCount.textContent = doneCount + " of " + todos.length + " tasks completed";
        }
      }

      /* ----- Add ----- */
      todoForm.addEventListener("submit", function (e) {
        e.preventDefault();
        var text = todoInput.value.trim();
        var date = todoDate.value;

        if (!text) { todoInput.focus(); return; }
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { todoDate.focus(); return; }

        todos.push({
          id: uid(),
          text: text.slice(0, 120),
          date: date,
          completed: false,
          createdAt: Date.now(),
          emoji: selectedEmoji,
          priority: selectedPriority
        });

        // Earliest date first; on the same date high → medium → low, then oldest first
        todos.sort(function (a, b) {
          if (a.date !== b.date) return a.date < b.date ? -1 : 1;
          var w = PRIORITY_WEIGHT[a.priority] - PRIORITY_WEIGHT[b.priority];
          return w !== 0 ? w : a.createdAt - b.createdAt;
        });

        saveTodos();
        render();
        todoInput.value = "";
        resetPickers();
        todoInput.focus();
      });

      /* ----- Emoji / priority pickers ----- */
      function markActive(row, activeBtn) {
        row.querySelectorAll("button").forEach(function (b) {
          var on = b === activeBtn;
          b.classList.toggle("is-active", on);
          b.setAttribute("aria-checked", on ? "true" : "false");
        });
      }

      function resetPickers() {
        selectedEmoji = "📝";
        selectedPriority = "medium";
        markActive(emojiRow, emojiRow.querySelector('[data-emoji="📝"]'));
        markActive(prioRow, prioRow.querySelector('[data-priority="medium"]'));
      }

      emojiRow.addEventListener("click", function (e) {
        var btn = e.target.closest(".emoji-opt");
        if (!btn) return;
        selectedEmoji = btn.dataset.emoji;
        markActive(emojiRow, btn);
      });

      prioRow.addEventListener("click", function (e) {
        var btn = e.target.closest(".prio-opt");
        if (!btn) return;
        selectedPriority = btn.dataset.priority;
        markActive(prioRow, btn);
      });

      /* ----- Inline edit: click text → input; Enter saves, Esc/blur ends ----- */
      function findTodo(id) {
        for (var i = 0; i < todos.length; i++) {
          if (todos[i].id === id) return todos[i];
        }
        return null;
      }

      todoList.addEventListener("click", function (e) {
        var textEl = e.target.closest(".todo-text");
        if (!textEl) return;                       // only task text starts editing
        if (todoList.querySelector(".todo-edit")) return;  // one editor at a time

        var item = textEl.closest(".todo-item");
        var todo = findTodo(item.dataset.id);
        if (!todo) return;

        var input = document.createElement("input");
        input.type = "text";
        input.className = "todo-edit";
        input.value = todo.text;
        input.maxLength = 120;
        input.setAttribute("aria-label", "Edit task text");

        textEl.hidden = true;
        item.insertBefore(input, textEl.nextSibling);
        input.focus();
        input.select();

        var finished = false;
        function finish(save) {
          if (finished) return;          // guard: blur + key can both fire
          finished = true;
          var val = input.value.trim();
          if (save && val) {
            todo.text = val.slice(0, 120);
            saveTodos();
          }
          render();                       // empty value or Esc → keep original
        }

        input.addEventListener("keydown", function (e) {
          if (e.key === "Enter") { e.preventDefault(); finish(true); }
          else if (e.key === "Escape") { e.preventDefault(); finish(false); }
        });
        input.addEventListener("blur", function () { finish(true); });
      });

      /* ----- Toggle done (event delegation) ----- */
      todoList.addEventListener("change", function (e) {
        if (!e.target.classList.contains("todo-check")) return;
        var item = e.target.closest(".todo-item");
        var todo = todos.filter(function (t) { return t.id === item.dataset.id; })[0];
        if (todo) {
          todo.completed = e.target.checked;
          saveTodos();
          render();
        }
      });

      /* ----- Delete (fade out once, then remove) ----- */
      todoList.addEventListener("click", function (e) {
        var delBtn = e.target.closest(".todo-del");
        if (!delBtn) return;

        var item = delBtn.closest(".todo-item");
        var id = item.dataset.id;
        if (item.classList.contains("removing")) return;  // guard double-fire
        item.classList.add("removing");

        setTimeout(function () {
          todos = todos.filter(function (t) { return t.id !== id; });
          saveTodos();
          render();
        }, 180);
      });

      // Start with today selected in the calendar
      todoDate.value = toISODate(new Date());
      render();
    })();
  }
})();
