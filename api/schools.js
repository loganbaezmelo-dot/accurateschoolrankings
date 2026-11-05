import * as XLSX from 'xlsx';

// In-memory cache for demo/fast reads
let cachedSchools = [];

// Direct link to FLDOE annual school accountability data
const FLDOE_EXCEL_URL = "https://www.fldoe.org/core/fileparse.php/18534/urlt/SchoolGrades26.xlsx";

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST');

  const { method, query } = req;

  // The actual live scrape trigger for your cronjob
  if (query.action === 'scrape-sync' || method === 'POST') {
    try {
      // 1. Actually download the raw FLDOE spreadsheet
      const response = await fetch(FLDOE_EXCEL_URL);
      if (!response.ok) throw new Error("Could not download FLDOE dataset");

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // 2. Parse the Excel workbook
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const rawRows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

      // 3. Map sheet columns to clean objects
      // (Row 0-4 are state headers; data rows usually start at index 5)
      const parsed = [];
      for (let i = 5; i < rawRows.length; i++) {
        const row = rawRows[i];
        if (!row || !row[2]) continue; // skip blank rows

        const districtName = String(row[0] || '').trim();
        const schoolName = String(row[2] || '').trim();
        const grade2026 = String(row[3] || 'N/A').trim();
        const percentPoints = parseFloat(row[4]) || 50;

        // Convert state grade percentage to a fair 1-10 rating scale
        const ratingOutOf10 = (percentPoints / 10).toFixed(1);

        parsed.push({
          id: i,
          name: schoolName,
          type: schoolName.toLowerCase().includes("charter") ? "Charter" : 
                schoolName.toLowerCase().includes("magnet") ? "Magnet" : "Public Neighborhood",
          district: districtName,
          score: parseFloat(ratingOutOf10),
          fldoeGrade: grade2026,
          progress: `${Math.round(percentPoints)}% total points`
        });
      }

      cachedSchools = parsed;

      return res.status(200).json({
        success: true,
        message: "Successfully scraped real FLDOE records",
        totalSchools: cachedSchools.length,
        timestamp: new Date().toISOString()
      });

    } catch (err) {
      return res.status(500).json({ error: "Failed to scrape FLDOE: " + err.message });
    }
  }

  // Normal frontend search queries
  const filter = query.filter || "Public Neighborhood";
  const search = (query.search || "").toLowerCase().trim();

  const sourceData = cachedSchools.length > 0 ? cachedSchools : [
    { id: 1, name: "Loughman Oaks Elementary", type: "Public Neighborhood", district: "Polk", score: 6.2, fldoeGrade: "C", progress: "5/10 (Steady Progress)" },
    { id: 2, name: "Davenport School of the Arts", type: "Magnet", district: "Polk", score: 8.4, fldoeGrade: "A", progress: "8/10" }
  ];

  let results = sourceData.filter(s => s.type === filter);

  if (search) {
    results = results.filter(s => 
      s.name.toLowerCase().includes(search) || 
      s.district.toLowerCase().includes(search)
    );
  }

  return res.status(200).json({
    count: results.length,
    filter,
    schools: results
  });
}
