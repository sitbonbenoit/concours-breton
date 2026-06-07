// netlify/functions/db.js
const BASE_ID = "app5qyxyWAo0MokQX";
const TABLES = {
  users:       "tblTB0xraNfJdj5p1",
  matches:     "tbl946eY5aFdF0H6z",
  bets:        "tblWzmfPHVWXFreHy",
  groups:      "tbllvGiL3xciZXg7P",
  bonus:       "tblTels3dxb0KCXng",
  redemptions: "tblDPnZRYu5QnDGLS",
  config:      "tblxMEdkuqAqKk3ua",
};

const AT_URL = `https://api.airtable.com/v0/${BASE_ID}`;

async function atFetch(path, options = {}) {
  const res = await fetch(`${AT_URL}${path}`, {
    ...options,
    headers: {
      "Authorization": `Bearer ${process.env.AIRTABLE_API_KEY}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const text = await res.text();
  try { return JSON.parse(text); } catch { return { error: text }; }
}

async function getAll(table) {
  const records = [];
  let offset = null;
  do {
    const url = `/${table}?pageSize=100${offset ? `&offset=${offset}` : ""}`;
    const data = await atFetch(url);
    if (data.error) { console.error("Airtable error:", data.error); break; }
    if (data.records) records.push(...data.records);
    offset = data.offset || null;
  } while (offset);
  return records;
}

async function upsert(table, keyField, keyValue, fields) {
  const encoded = encodeURIComponent(`{${keyField}} = "${keyValue}"`);
  const data = await atFetch(`/${table}?filterByFormula=${encoded}`);
  if (data.records && data.records.length > 0) {
    return atFetch(`/${table}/${data.records[0].id}`, {
      method: "PATCH",
      body: JSON.stringify({ fields }),
    });
  } else {
    return atFetch(`/${table}`, {
      method: "POST",
      body: JSON.stringify({ fields }),
    });
  }
}

async function deleteRecord(table, keyField, keyValue) {
  const encoded = encodeURIComponent(`{${keyField}} = "${keyValue}"`);
  const data = await atFetch(`/${table}?filterByFormula=${encoded}`);
  if (data.records && data.records.length > 0) {
    await atFetch(`/${table}/${data.records[0].id}`, { method: "DELETE" });
  }
}

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  console.log("DB function called, body:", event.body?.slice(0, 200));

  try {
    const body = JSON.parse(event.body || "{}");
    const { action, table, key, value, keyField, keyValue } = body;

    console.log("Action:", action, "Table:", table);

    if (action === "loadAll") {
      console.log("Loading all data from Airtable...");
      const [users, matches, bets, groups, bonus, redemptions, config] = await Promise.all([
        getAll(TABLES.users),
        getAll(TABLES.matches),
        getAll(TABLES.bets),
        getAll(TABLES.groups),
        getAll(TABLES.bonus),
        getAll(TABLES.redemptions),
        getAll(TABLES.config),
      ]);

      const parseRecords = (records, primaryField) =>
        Object.fromEntries(
          records
            .filter(r => r.fields[primaryField] && r.fields.data)
            .map(r => { 
              try { return [r.fields[primaryField], JSON.parse(r.fields.data)]; }
              catch { return [r.fields[primaryField], {}]; }
            })
        );

      const configObj = Object.fromEntries(
        config.filter(r => r.fields.key).map(r => [r.fields.key, r.fields.value])
      );

      const result = {
        users:       parseRecords(users, "uid"),
        matches:     parseRecords(matches, "mid"),
        bets:        parseRecords(bets, "uid"),
        groups:      parseRecords(groups, "gid"),
        bonus:       parseRecords(bonus, "bid"),
        redemptions: parseRecords(redemptions, "rid"),
        config:      configObj,
      };

      console.log("Loaded:", Object.keys(result.users).length, "users,", Object.keys(result.matches).length, "matches");
      return { statusCode: 200, headers, body: JSON.stringify(result) };
    }

    if (action === "save") {
      const tableId = TABLES[table];
      if (!tableId) throw new Error(`Table inconnue: ${table}`);
      console.log("Saving to", table, "key:", keyValue);
      await upsert(tableId, keyField, keyValue, {
        [keyField]: String(keyValue),
        data: JSON.stringify(value),
      });
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
    }

    if (action === "delete") {
      const tableId = TABLES[table];
      if (!tableId) throw new Error(`Table inconnue: ${table}`);
      await deleteRecord(tableId, keyField, keyValue);
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
    }

    if (action === "saveConfig") {
      console.log("Saving config:", key, "=", value);
      await upsert(TABLES.config, "key", key, { key, value: String(value) });
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
    }

    return { statusCode: 400, headers, body: JSON.stringify({ error: "Action inconnue: " + action }) };

  } catch (err) {
    console.error("DB Error:", err.message, err.stack);
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
