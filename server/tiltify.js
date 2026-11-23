import { campaign, tiltifyCampaign } from "./campaign.js";

let cache = { at: 0, value: null };

function money(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n) : null;
}

function fallback(reason) {
  return {
    goal: campaign.goal,
    raised: campaign.raised,
    source: "fallback",
    reason,
    donations: [],
  };
}

async function getJson(url, token) {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    signal: AbortSignal.timeout(4000),
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Tiltify ${res.status}`);
  return res.json();
}

async function findCampaign(token) {
  const userUrl = `https://v5api.tiltify.com/api/public/campaigns/by/slugs/${tiltifyCampaign.user}/${tiltifyCampaign.slug}`;
  const user = await getJson(userUrl, token);
  if (user?.data?.id) return user.data;
  const teamUrl = `https://v5api.tiltify.com/api/public/team_campaigns/by/slugs/${tiltifyCampaign.user}/${tiltifyCampaign.slug}`;
  const team = await getJson(teamUrl, token);
  return team?.data || null;
}

export async function liveFundraiser(token) {
  if (!token) return fallback("TILTIFY_TOKEN is not set");
  if (cache.value && Date.now() - cache.at < 20000) return cache.value;
  try {
    const found = await findCampaign(token);
    if (!found?.id) return fallback("Tiltify campaign was not found");
    const raised = money(found.total_amount_raised?.value ?? found.amount_raised?.value);
    const goal = money(found.goal?.value) || campaign.goal;
    let donations = [];
    try {
      const listed = await getJson(`https://v5api.tiltify.com/api/public/campaigns/${found.id}/donations?limit=20`, token);
      donations = (listed?.data || []).map((row) => ({
        id: String(row.id || ""),
        name: String(row.donor_name || "Someone"),
        amount: money(row.amount?.value) || 0,
      })).filter((row) => row.id);
    } catch {
      donations = [];
    }
    const value = {
      goal: goal || campaign.goal,
      raised: raised == null ? campaign.raised : raised,
      source: "tiltify",
      reason: "",
      donations,
    };
    cache = { at: Date.now(), value };
    return value;
  } catch (err) {
    return fallback(err.message || "Tiltify request failed");
  }
}
