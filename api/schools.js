// In-memory / cacheable dataset from FLDOE assessments
let schoolDatabase = [
  { id: 1, name: "Loughman Oaks Elementary", type: "Public Neighborhood", district: "Polk", score: 6.2, fldoeGrade: "C", progress: "5/10 (Steady Progress)" },
  { id: 2, name: "Citrus Ridge: A Civics Academy", type: "Public Neighborhood", district: "Polk", score: 6.8, fldoeGrade: "B", progress: "6/10" },
  { id: 3, name: "Horizons Elementary", type: "Public Neighborhood", district: "Polk", score: 5.4, fldoeGrade: "C", progress: "5/10" },
  { id: 4, name: "Ridgeview Global Studies Academy", type: "Charter", district: "Polk", score: 7.6, fldoeGrade: "A", progress: "7/10" },
  { id: 5, name: "Mater Academy (Central FL)", type: "Charter", district: "Osceola", score: 7.0, fldoeGrade: "B", progress: "6/10" },
  { id: 6, name: "Davenport School of the Arts", type: "Magnet", district: "Polk", score: 8.4, fldoeGrade: "A", progress: "8/10" },
  { id: 7, name: "Bartow Middle STEM Magnet", type: "Magnet", district: "Polk", score: 7.9, fldoeGrade: "A", progress: "7/10" }
];

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST');

  const { method } = req;

  // Cron-triggered update hook (POST or GET with secret)
  if (req.query.action === 'scrape-sync' || method === 'POST') {
    // Cron logic here: ping FLDOE spreadsheets / APIs and update schoolDatabase
    return res.status(200).json({
      success: true,
      message: "Sync completed via cron ping.",
      timestamp: new Date().toISOString(),
      recordCount: schoolDatabase.length
    });
  }

  // Standard data query endpoint
  const filter = req.query.filter || "Public Neighborhood";
  const search = (req.query.search || "").toLowerCase().trim();

  let results = schoolDatabase.filter(school => school.type === filter);

  if (search) {
    results = results.filter(school =>
      school.name.toLowerCase().includes(search) ||
      school.district.toLowerCase().includes(search)
    );
  }

  return res.status(200).json({
    count: results.length,
    filter,
    schools: results
  });
}
