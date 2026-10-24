(() => {
  "use strict";

  const MIN_UNITS = 16;

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [
    ...root.querySelectorAll(selector),
  ];
  const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

  const reducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;

  const state = {
    details: null, // details ng students ba
    result: null, // last computed result
  };

  const toastEl = $("#toast");
  let toastTimer;

  function toast(message) {
    toastEl.textContent = message;
    toastEl.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove("is-visible"), 3400);
  }

  let msgCounter = 0;

  function setError(input, message) {
    const field = input.closest(".field");
    const msg = field && $(".field__msg", field);
    input.setAttribute("aria-invalid", "true");
    if (msg) {
      if (!msg.id) msg.id = `field-msg-${++msgCounter}`;
      msg.textContent = message;
      input.setAttribute("aria-describedby", msg.id);
    }
  }

  function clearError(input) {
    input.removeAttribute("aria-invalid");
    input.removeAttribute("aria-describedby");
    const field = input.closest(".field");
    const msg = field && $(".field__msg", field);
    if (msg) msg.textContent = "";
  }

  function clearForm(form) {
    $$("[aria-invalid]", form).forEach(clearError);
  }

  function focusFirstInvalid(root) {
    const el = $('[aria-invalid="true"]', root);
    if (el) el.focus();
  }

  document.addEventListener("input", (e) => {
    if (e.target.matches('[aria-invalid="true"]')) clearError(e.target);
    if (e.target.closest(".subject")) $("#subjects-msg").textContent = "";
  });
  document.addEventListener("change", (e) => {
    if (e.target.matches('[aria-invalid="true"]')) clearError(e.target);
  });

  function checkRequired(input, message) {
    if (!input.value.trim()) {
      setError(input, message);
      return false;
    }
    clearError(input);
    return true;
  }

  const app = $("#app");
  const screens = $$(".screen");
  let current = null;

  screens.forEach((s) => {
    s.inert = true;
  });

  const onEnter = {
    subjects() {
      $("#subjects-msg").textContent = "";
      if (!$$(".subject").length) addSubject();
      updateSummary();
    },
  };

  function go(id, { dir = 1 } = {}) {
    const next = $(`.screen[data-screen="${id}"]`);
    if (!next || next === current) return;

    if (onEnter[id]) onEnter[id]();

    next.style.setProperty("--from", `${dir * 16}px`);

    const leaving = current;
    next.inert = false;
    next.classList.add("is-active");
    window.scrollTo(0, 0);

    if (leaving) {
      leaving.classList.remove("is-active");
      leaving.inert = true;
    }

    current = next;
    app.dataset.screen = id;

    const target = $("[data-focus]", next);
    if (target && id !== "loading") {
      setTimeout(() => target.focus({ preventScroll: true }), 60);
    }
  }

  document.addEventListener("click", (e) => {
    const trigger = e.target.closest("[data-go]");
    if (!trigger) return;
    go(trigger.dataset.go, { dir: trigger.dataset.dir === "back" ? -1 : 1 });
  });

  const detailsForm = $("#detailsForm");
  detailsForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const last = $("#last-name");
    const first = $("#first-name");
    const year = $("#year-level");

    const lastOk = checkRequired(last, "Enter your last name.");
    const firstOk = checkRequired(first, "Enter your first name.");
    let yearOk = true;
    if (!year.value) {
      setError(year, "Choose your year level.");
      yearOk = false;
    } else clearError(year);

    if (!lastOk || !firstOk || !yearOk) {
      focusFirstInvalid(detailsForm);
      return;
    }

    state.details = {
      last: last.value.trim(),
      first: first.value.trim(),
      mi: $("#middle-initial").value.trim().replace(/\.$/, ""),
      suffix: $("#suffix").value.trim(),
      year: year.value,
      program: $("#program").value,
    };
    go("subjects");
  });

  const list = $("#subject-list");
  const template = $("#subject-template");

  function addSubject(focus = false) {
    const card = template.content.firstElementChild.cloneNode(true);
    list.append(card);
    refreshCards();
    updateSummary();
    if (focus) $("input", card).focus();
  }

  function refreshCards() {
    const cards = $$(".subject", list);
    cards.forEach((card, i) => {
      card.setAttribute("aria-label", `Subject ${i + 1}`);
      $(".subject__remove", card).disabled = cards.length === 1;
    });
  }

  function readSubjects() {
    return $$(".subject", list).map((card) => {
      const field = (name) => $(`[data-field="${name}"]`, card);
      return {
        card,
        els: {
          course: field("course"),
          units: field("units"),
          grade: field("grade"),
          professor: field("professor"),
        },
        course: field("course").value.trim().toUpperCase(),
        units: Number(field("units").value) || 0,
        grade: parseFloat(field("grade").value) || 0,
        professor: field("professor").value.trim(),
      };
    });
  }

  function weightedAverage(rows) {
    const graded = rows.filter((r) => r.units > 0 && r.grade > 0);
    const units = graded.reduce((sum, r) => sum + r.units, 0);
    if (!units) return null;
    return round2(
      graded.reduce((sum, r) => sum + r.units * r.grade, 0) / units,
    );
  }

  function updateSummary() {
    const rows = readSubjects();
    const gwa = weightedAverage(rows);
    $("#total-units").textContent = rows.reduce((sum, r) => sum + r.units, 0);
    $("#running-gwa").textContent = gwa === null ? "—" : gwa.toFixed(2);
  }

  $("#add-subject").addEventListener("click", () => {
    addSubject(true);
    requestAnimationFrame(() => {
      window.scrollTo({
        top: document.documentElement.scrollHeight,
        behavior: reducedMotion ? "auto" : "smooth",
      });
    });
  });

  list.addEventListener("input", updateSummary);
  list.addEventListener("change", updateSummary);
  list.addEventListener("click", (e) => {
    const remove = e.target.closest(".subject__remove");
    if (!remove) return;
    remove.closest(".subject").remove();
    refreshCards();
    updateSummary();
    $("#add-subject").focus();
  });

  $("#compute").addEventListener("click", () => {
    const rows = readSubjects();
    const msg = $("#subjects-msg");
    let firstInvalid = null;

    rows.forEach((row) => {
      Object.entries(row.els).forEach(([name, el]) => {
        if (!row[name]) {
          el.setAttribute("aria-invalid", "true");
          firstInvalid = firstInvalid || el;
        } else {
          el.removeAttribute("aria-invalid");
        }
      });
    });

    if (firstInvalid) {
      msg.textContent =
        "Fill in every field in each subject. The empty ones are highlighted.";
      firstInvalid.focus();
      return;
    }
    msg.textContent = "";

    const totalUnits = rows.reduce((sum, r) => sum + r.units, 0);
    const gwa = weightedAverage(rows);
    const failing = rows.find((r) => r.grade >= 2.0);

    let status;
    let reason;
    if (failing) {
      status = "no";
      reason = `${failing.course} has a grade of ${failing.grade.toFixed(2)}. A grade of 2.00 or higher in any subject is not eligible.`;
    } else if (totalUnits < MIN_UNITS) {
      status = "no";
      reason = `You have ${totalUnits} units. You need at least ${MIN_UNITS} units to be a candidate.`;
    } else if (gwa <= 1.25) {
      status = "pl";
    } else if (gwa <= 1.5) {
      status = "dl";
    } else {
      status = "no";
      reason =
        "Your GWA is above 1.50, which is outside the Dean’s List range.";
    }

    state.result = { rows, gwa, totalUnits, status, reason };
    renderResult();
    go("result");
  });

  function renderResult() {
    const { gwa, status, reason } = state.result;
    const badge = $("#result-badge");

    $("#result-gwa").textContent = gwa.toFixed(2);
    badge.className = `badge badge--${status}`;

    if (status === "pl") {
      badge.textContent = "President’s List candidate";
      $("#result-msg").textContent = "Nice. Your GWA is within 1.00 to 1.25.";
    } else if (status === "dl") {
      badge.textContent = "Dean’s List candidate";
      $("#result-msg").textContent = "Nice. Your GWA is within 1.26 to 1.50.";
    } else {
      badge.textContent = "Not eligible this time";
      $("#result-msg").textContent = reason;
    }

    $("#result-eligible").hidden = status === "no";
    $("#result-ineligible").hidden = status !== "no";
  }

  function letterName() {
    const d = state.details;
    const last = d.suffix ? `${d.last} ${d.suffix}` : d.last;
    return `${last}, ${d.first}${d.mi ? ` ${d.mi}.` : ""}`;
  }

  function letterYear() {
    const d = state.details;
    return `${d.year.replace(/\s*year$/i, "")} Year- ${d.program}`;
  }

  function buildLetter() {
    const { rows, gwa, totalUnits } = state.result;
    const money = (n) => n.toFixed(2);
    const totalEquivalent = rows.reduce((sum, r) => sum + r.units * r.grade, 0);

    $("#lt-rows").replaceChildren(
      ...rows.map((r) => {
        const tr = document.createElement("tr");
        [
          r.course,
          String(r.units),
          money(r.grade),
          money(r.units * r.grade),
          r.professor,
        ].forEach((text) => {
          const td = document.createElement("td");
          td.textContent = text;
          tr.append(td);
        });
        return tr;
      }),
    );

    $("#lt-total-units").textContent = totalUnits;
    $("#lt-total-eq").textContent = money(totalEquivalent);
    $("#lt-calc-eq").textContent = money(totalEquivalent);
    $("#lt-calc-units").textContent = totalUnits;
    $("#lt-calc-gwa").textContent = money(gwa);
    $("#lt-name").textContent = letterName();
    $("#lt-year").textContent = letterYear();
  }

  $("#download-pdf").addEventListener("click", () => {
    buildLetter();
    const previousTitle = document.title;
    document.title = `Application Letter - ${state.details.last}`;
    window.addEventListener(
      "afterprint",
      () => {
        document.title = previousTitle;
      },
      { once: true },
    );
    toast("In the print window, choose “Save as PDF”.");
    window.print();
  });

  $("#sign-out").addEventListener("click", () => {
    state.details = null;
    state.result = null;
    $$(".subject", list).forEach((card) => card.remove());
    detailsForm.reset();
    clearForm(detailsForm);
    go("info", { dir: -1 });
    toast("Started over.");
  });

  go("loading");
  setTimeout(() => go("info"), reducedMotion ? 1200 : 2400);
})();
