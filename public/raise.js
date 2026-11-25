(function () {
  var amount = document.getElementById("raised-amount");
  var fill = document.getElementById("raised-fill");
  var meter = document.getElementById("raised-meter");
  var goalLabel = document.getElementById("raised-goal");
  if (!amount || !fill) return;

  function money(n) {
    return "$" + Math.round(n || 0).toLocaleString("en-US");
  }

  async function pull() {
    var raised = 0;
    var goal = 10000;
    try {
      var res = await fetch("/api/live/goal", { cache: "no-store" });
      if (!res.ok) throw new Error("goal");
      var data = await res.json();
      raised = Math.max(0, Math.round(Number(data.raised) || 0));
      goal = Math.max(1, Math.round(Number(data.goal) || 10000));
    } catch (err) {
      raised = 0;
      goal = 10000;
    }
    var pct = Math.min(100, Math.round((raised / goal) * 100));
    amount.textContent = money(raised);
    fill.style.width = pct + "%";
    if (goalLabel) goalLabel.textContent = money(goal);
    if (meter) {
      meter.setAttribute("aria-valuenow", String(raised));
      meter.setAttribute("aria-valuemax", String(goal));
      meter.setAttribute("aria-label", money(raised) + " of " + money(goal) + " raised for freeCodeCamp");
    }
  }

  pull();
  setInterval(pull, 15000);
})();
