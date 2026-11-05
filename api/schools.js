const XLSX = require('xlsx');

// FLDOE statewide accountability sheet
const FLDOE_URL = "https://www.fldoe.org/core/fileparse.php/18534/urlt/SchoolGrades24.xlsx";

let cachedSchools = null;

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST');

  const { search = "", filter = "Public Neighborhood", action } = req.query;

  // fetch and parse if cache is empty or if your cron pings action=scrape-sync
  if (!cachedSchools || action === 'scrape-sync') {
    try {
      const response = await fetch(FLDOE_URL, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        }
      });

      if (!response.ok) {
        throw new Error(`FLDOE server status: ${response.status}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

      const parsed = [];
      // Row 5 is where the actual school records start
      for (let i = 5; i < rows.length; i++) {
        const row = rows[i];
        if (!row || !row[2]) continue;

        const district = String(row[0] || '').trim();
        const schoolName = String(row[2] || '').trim();
        const grade = String(row[3] || 'N/A').trim();
        const rawPoints = parseFloat(row[4]) || 50;

        parsed.push({
          id: i,
          name: schoolName,
          district: district,
          type: schoolName.toLowerCase().includes("charter") ? "Charter" :
                schoolName.toLowerCase().includes("magnet") ? "Magnet" : "Public Neighborhood",
          score: parseFloat((rawPoints / 10).toFixed(1)),
          fldoeGrade: grade,
          progress: `${Math.round(rawPoints)}% state points`
        });
      }

      cachedSchools = parsed;

      // if this was just a cron ping, respond with success
      if (action === 'scrape-sync') {
        return res.status(200).json({
          success: true,
          synced: cachedSchools.length,
          timestamp: new Date().toISOString()
        });
      }

    } catch (err) {
      return res.status(500).json({
        error: "Failed to scrape FLDOE: " + err.message
      });
    }
  }

  // search and filter query logic
  const query = search.toLowerCase().trim();
  let results = cachedSchools.filter(s => s.type === filter);

  if (query) {
    results = results.filter(s =>
      s.name.toLowerCase().includes(query) ||
      s.district.toLowerCase().includes(query)
    );
  }

  return res.status(200).json({
    count: results.length,
    filter,
    schools: results
  });
};
