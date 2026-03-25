const DEMO_STORE_TARGET_COUNT = 2359;

const LEGACY_DEMO_STORE_IDS = Object.freeze([
  "STORE_42",
  "STORE_17",
  "STORE_08",
  "STORE_21",
  "STORE_33",
  "STORE_55",
  "STORE_64",
  "STORE_71",
  "STORE_88",
  "STORE_95"
]);

const BASE_SCREEN_CONFIGS = Object.freeze({
  entrance: Object.freeze({
    screenType: "Horizontal Screen",
    screenSize: "1920x1080",
    templateId: "fullscreen-banner",
    refreshInterval: 30000
  }),
  electronics: Object.freeze({
    screenType: "Vertical Screen",
    screenSize: "1080x1920",
    templateId: "fullscreen-hero",
    refreshInterval: 26000
  }),
  whitegoods: Object.freeze({
    screenType: "Horizontal Screen",
    screenSize: "1920x1080",
    templateId: "carousel-banner",
    refreshInterval: 14000
  }),
  aisle: Object.freeze({
    screenType: "Shelf Edge",
    screenSize: "1280x720",
    templateId: "shelf-spotlight",
    refreshInterval: 12000
  }),
  checkout: Object.freeze({
    screenType: "Kiosk",
    screenSize: "1080x1920",
    templateId: "kiosk-interactive",
    refreshInterval: 15000
  })
});

const STORE_ARCHETYPES = Object.freeze({
  flagship: Object.freeze({
    id: "flagship",
    stockBase: 148,
    inventoryScale: 1.4,
    trafficScale: 1.34,
    categoryBias: Object.freeze({
      electronics: 1.26,
      whitegoods: 1.18,
      aisle: 1.06,
      foodcourt: 1.18,
      general: 1.12
    }),
    screenConfigs: Object.freeze({
      entrance: { ...BASE_SCREEN_CONFIGS.entrance, screenType: "Vertical Screen", screenSize: "1080x1920", templateId: "fullscreen-hero", refreshInterval: 24000 },
      electronics: { ...BASE_SCREEN_CONFIGS.electronics, refreshInterval: 22000 },
      whitegoods: { ...BASE_SCREEN_CONFIGS.whitegoods, refreshInterval: 10000 },
      aisle: { ...BASE_SCREEN_CONFIGS.aisle, screenType: "Endcap", screenSize: "1080x1920", refreshInterval: 10000 },
      checkout: { ...BASE_SCREEN_CONFIGS.checkout, refreshInterval: 12000 }
    })
  }),
  metro: Object.freeze({
    id: "metro",
    stockBase: 126,
    inventoryScale: 1.22,
    trafficScale: 1.2,
    categoryBias: Object.freeze({
      electronics: 1.18,
      whitegoods: 1.08,
      aisle: 1.02,
      foodcourt: 1.08,
      general: 1.06
    }),
    screenConfigs: Object.freeze({
      entrance: { ...BASE_SCREEN_CONFIGS.entrance, refreshInterval: 26000 },
      electronics: { ...BASE_SCREEN_CONFIGS.electronics, refreshInterval: 24000 },
      whitegoods: { ...BASE_SCREEN_CONFIGS.whitegoods, refreshInterval: 12000 },
      aisle: { ...BASE_SCREEN_CONFIGS.aisle, refreshInterval: 11000 },
      checkout: { ...BASE_SCREEN_CONFIGS.checkout, refreshInterval: 14000 }
    })
  }),
  suburban: Object.freeze({
    id: "suburban",
    stockBase: 104,
    inventoryScale: 1.06,
    trafficScale: 1.02,
    categoryBias: Object.freeze({
      electronics: 1.02,
      whitegoods: 1.12,
      aisle: 1.08,
      foodcourt: 0.92,
      general: 1.0
    }),
    screenConfigs: Object.freeze({
      entrance: { ...BASE_SCREEN_CONFIGS.entrance, screenSize: "1600x900", refreshInterval: 28000 },
      electronics: { ...BASE_SCREEN_CONFIGS.electronics, screenSize: "1200x1920", refreshInterval: 26000 },
      whitegoods: { ...BASE_SCREEN_CONFIGS.whitegoods, refreshInterval: 14000 },
      aisle: { ...BASE_SCREEN_CONFIGS.aisle, refreshInterval: 12000 },
      checkout: { ...BASE_SCREEN_CONFIGS.checkout, refreshInterval: 15000 }
    })
  }),
  regional: Object.freeze({
    id: "regional",
    stockBase: 88,
    inventoryScale: 0.94,
    trafficScale: 0.9,
    categoryBias: Object.freeze({
      electronics: 0.94,
      whitegoods: 1.06,
      aisle: 1.12,
      foodcourt: 0.82,
      general: 0.98
    }),
    screenConfigs: Object.freeze({
      entrance: { ...BASE_SCREEN_CONFIGS.entrance, screenSize: "1600x900", refreshInterval: 30000 },
      electronics: { ...BASE_SCREEN_CONFIGS.electronics, screenType: "Horizontal Screen", screenSize: "1920x1080", templateId: "fullscreen-banner", refreshInterval: 26000 },
      whitegoods: { ...BASE_SCREEN_CONFIGS.whitegoods, screenSize: "1600x900", refreshInterval: 16000 },
      aisle: { ...BASE_SCREEN_CONFIGS.aisle, screenType: "Endcap", screenSize: "1080x1920", refreshInterval: 12000 },
      checkout: { ...BASE_SCREEN_CONFIGS.checkout, refreshInterval: 16000 }
    })
  }),
  compact: Object.freeze({
    id: "compact",
    stockBase: 72,
    inventoryScale: 0.82,
    trafficScale: 0.8,
    categoryBias: Object.freeze({
      electronics: 0.9,
      whitegoods: 0.92,
      aisle: 1.08,
      foodcourt: 0.72,
      general: 0.94
    }),
    screenConfigs: Object.freeze({
      entrance: { ...BASE_SCREEN_CONFIGS.entrance, screenSize: "1366x768", refreshInterval: 32000 },
      electronics: { ...BASE_SCREEN_CONFIGS.electronics, screenType: "Horizontal Screen", screenSize: "1600x900", templateId: "fullscreen-banner", refreshInterval: 28000 },
      whitegoods: { ...BASE_SCREEN_CONFIGS.whitegoods, screenSize: "1366x768", templateId: "fullscreen-banner", refreshInterval: 18000 },
      aisle: { ...BASE_SCREEN_CONFIGS.aisle, screenSize: "1024x600", refreshInterval: 13000 },
      checkout: { ...BASE_SCREEN_CONFIGS.checkout, screenType: "Horizontal Screen", screenSize: "1920x1080", templateId: "fullscreen-banner", refreshInterval: 17000 }
    })
  })
});

const AREA_PREFIXES = Object.freeze([
  "North",
  "South",
  "East",
  "West",
  "Central",
  "Upper",
  "Lower",
  "Northwest",
  "Northeast",
  "Southwest",
  "Southeast",
  "Inner",
  "Outer"
]);

const AREA_SUFFIXES = Object.freeze([
  "Heights",
  "Ridge",
  "Park",
  "Commons",
  "Crossing",
  "Village",
  "Town Center",
  "Parkway",
  "Landing",
  "Gateway",
  "Harbor",
  "Crest",
  "Station",
  "Plaza",
  "Junction",
  "Galleria",
  "Marketplace",
  "Mills",
  "Creek",
  "Meadow",
  "Valley",
  "Pointe",
  "Lakes",
  "Square",
  "Vista",
  "Gardens",
  "Corners",
  "Center",
  "District",
  "Exchange"
]);

function market(region, countryCode, country, state, metro, marketCode, weight, preferredAreas, tier) {
  return Object.freeze({
    region,
    countryCode,
    country,
    state,
    metro,
    marketCode,
    weight,
    tier,
    preferredAreas: Object.freeze(preferredAreas)
  });
}

const MARKET_DEFINITIONS = Object.freeze([
  market("Southeast", "US", "United States", "GA", "Atlanta", "ATL", 30, ["Buckhead", "Midtown", "Sandy Springs", "Marietta", "Roswell", "Alpharetta"], "flagship"),
  market("Southwest", "US", "United States", "AZ", "Phoenix", "PHX", 30, ["Scottsdale", "Tempe", "Mesa", "Chandler", "Glendale", "Deer Valley"], "flagship"),
  market("South Central", "US", "United States", "TX", "Dallas", "DAL", 30, ["Plano", "Frisco", "Irving", "Arlington", "Addison", "Mesquite"], "flagship"),
  market("South Central", "US", "United States", "TX", "Houston", "HOU", 30, ["Katy", "Sugar Land", "The Woodlands", "Pearland", "Cypress", "Pasadena"], "flagship"),
  market("West Coast", "US", "United States", "CA", "Los Angeles", "LAX", 30, ["Burbank", "Pasadena", "Torrance", "Inglewood", "Glendale", "Culver City"], "flagship"),
  market("Northeast", "US", "United States", "NY", "New York City", "NYC", 30, ["Queens", "Brooklyn", "Bronx", "Harlem", "Chelsea", "Upper East Side"], "flagship"),
  market("Midwest", "US", "United States", "IL", "Chicago", "CHI", 30, ["Naperville", "Schaumburg", "Evanston", "Oak Brook", "Skokie", "Lincoln Park"], "flagship"),
  market("Mid-Atlantic", "US", "United States", "DC", "Washington", "WAS", 30, ["Georgetown", "Silver Spring", "Arlington", "Alexandria", "Tysons", "Capitol Hill"], "flagship"),
  market("Southeast", "US", "United States", "FL", "Miami", "MIA", 30, ["Doral", "Hialeah", "Kendall", "Aventura", "Coral Gables", "Homestead"], "flagship"),
  market("Northeast", "US", "United States", "MA", "Boston", "BOS", 30, ["Cambridge", "Somerville", "Quincy", "Waltham", "Newton", "Back Bay"], "flagship"),
  market("West Coast", "US", "United States", "WA", "Seattle", "SEA", 30, ["Bellevue", "Kirkland", "Renton", "Tacoma", "Lynnwood", "South Lake Union"], "flagship"),
  market("Southwest", "US", "United States", "NV", "Las Vegas", "LAS", 30, ["Summerlin", "Henderson", "Paradise", "Spring Valley", "North Las Vegas", "Centennial"], "flagship"),
  market("West Coast", "US", "United States", "CA", "San Francisco Bay", "SFO", 30, ["Oakland", "San Mateo", "Daly City", "Walnut Creek", "Fremont", "Palo Alto"], "flagship"),
  market("West Coast", "US", "United States", "CA", "San Diego", "SAN", 30, ["La Jolla", "Chula Vista", "Carlsbad", "Mira Mesa", "Escondido", "El Cajon"], "flagship"),
  market("Mountain", "US", "United States", "CO", "Denver", "DEN", 30, ["Aurora", "Lakewood", "Littleton", "Thornton", "Arvada", "Centennial"], "flagship"),
  market("South Central", "US", "United States", "TX", "Austin", "AUS", 30, ["Round Rock", "Cedar Park", "Pflugerville", "South Lamar", "Bee Cave", "Georgetown"], "flagship"),
  market("South Central", "US", "United States", "TX", "San Antonio", "SAT", 30, ["Stone Oak", "Alamo Ranch", "New Braunfels", "Live Oak", "Leon Valley", "Medical Center"], "flagship"),
  market("Southeast", "US", "United States", "FL", "Orlando", "ORL", 30, ["Winter Park", "Kissimmee", "Lake Nona", "Altamonte Springs", "Apopka", "Celebration"], "flagship"),
  market("Midwest", "US", "United States", "MI", "Detroit", "DET", 30, ["Troy", "Novi", "Dearborn", "Southfield", "Livonia", "Ann Arbor"], "flagship"),
  market("Northeast", "US", "United States", "PA", "Philadelphia", "PHL", 30, ["King of Prussia", "Cherry Hill", "Bensalem", "Conshohocken", "South Philly", "Northeast Philly"], "flagship"),

  market("West Coast", "US", "United States", "CA", "Sacramento", "SMF", 24, ["Roseville", "Elk Grove", "Folsom", "Natomas", "Rancho Cordova"], "major"),
  market("Mountain", "US", "United States", "UT", "Salt Lake City", "SLC", 24, ["Sandy", "Draper", "West Jordan", "Murray", "Bountiful"], "major"),
  market("West Coast", "US", "United States", "OR", "Portland", "PDX", 24, ["Beaverton", "Gresham", "Hillsboro", "Lake Oswego", "Vancouver"], "major"),
  market("Southeast", "US", "United States", "NC", "Charlotte", "CLT", 24, ["Ballantyne", "Matthews", "Huntersville", "Concord", "South End"], "major"),
  market("Southeast", "US", "United States", "NC", "Raleigh", "RDU", 24, ["Cary", "Durham", "Apex", "Wake Forest", "Morrisville"], "major"),
  market("Southeast", "US", "United States", "TN", "Nashville", "BNA", 24, ["Brentwood", "Franklin", "Hermitage", "Murfreesboro", "Cool Springs"], "major"),
  market("Southeast", "US", "United States", "FL", "Tampa", "TPA", 24, ["St. Petersburg", "Brandon", "Clearwater", "Carrollwood", "Wesley Chapel"], "major"),
  market("Southeast", "US", "United States", "FL", "Jacksonville", "JAX", 24, ["Southside", "Orange Park", "Mandarin", "St. Johns", "Arlington"], "major"),
  market("Midwest", "US", "United States", "MN", "Minneapolis", "MSP", 24, ["Bloomington", "Maple Grove", "Eden Prairie", "Woodbury", "St. Paul"], "major"),
  market("Midwest", "US", "United States", "OH", "Columbus", "CMH", 24, ["Dublin", "Westerville", "Polaris", "Hilliard", "Grove City"], "major"),
  market("Midwest", "US", "United States", "OH", "Cincinnati", "CVG", 24, ["Blue Ash", "Mason", "Florence", "West Chester", "Norwood"], "major"),
  market("Midwest", "US", "United States", "IN", "Indianapolis", "IND", 24, ["Carmel", "Fishers", "Greenwood", "Avon", "Castleton"], "major"),
  market("Mid-Atlantic", "US", "United States", "MD", "Baltimore", "BWI", 24, ["Towson", "Columbia", "Glen Burnie", "Owings Mills", "Catonsville"], "major"),
  market("Southwest", "US", "United States", "NM", "Albuquerque", "ABQ", 24, ["Uptown", "Rio Rancho", "North Valley", "West Mesa", "South Valley"], "major"),
  market("West Coast", "US", "United States", "CA", "San Jose", "SJC", 24, ["Sunnyvale", "Santa Clara", "Cupertino", "Milpitas", "Campbell"], "major"),
  market("South Central", "US", "United States", "LA", "New Orleans", "MSY", 24, ["Metairie", "Kenner", "Harvey", "Gretna", "Elmwood"], "major"),
  market("Southwest", "US", "United States", "TX", "El Paso", "ELP", 24, ["Eastside", "Westside", "Northeast", "Mission Valley", "Socorro"], "major"),
  market("Midwest", "US", "United States", "MO", "Kansas City", "MCI", 24, ["Overland Park", "Olathe", "Lee's Summit", "Northland", "Lenexa"], "major"),
  market("Midwest", "US", "United States", "MO", "St. Louis", "STL", 24, ["Chesterfield", "Florissant", "Creve Coeur", "Arnold", "South County"], "major"),
  market("West Coast", "US", "United States", "CA", "Inland Empire", "IEP", 24, ["Ontario", "Riverside", "Corona", "Rancho Cucamonga", "Moreno Valley"], "major"),

  market("Mountain", "US", "United States", "AZ", "Tucson", "TUS", 18, ["Oro Valley", "Marana", "Catalina Foothills", "Midvale Park", "Rita Ranch"], "regional"),
  market("Mountain", "US", "United States", "ID", "Boise", "BOI", 18, ["Meridian", "Nampa", "Eagle", "Downtown", "Garden City"], "regional"),
  market("Mountain", "US", "United States", "MT", "Billings", "BIL", 18, ["Heights", "West End", "Shiloh", "Lockwood", "Southgate"], "regional"),
  market("Midwest", "US", "United States", "WI", "Milwaukee", "MKE", 18, ["Brookfield", "Wauwatosa", "Oak Creek", "Greenfield", "Menomonee Falls"], "regional"),
  market("Midwest", "US", "United States", "WI", "Madison", "MSN", 18, ["Middleton", "Sun Prairie", "Fitchburg", "Monona", "Verona"], "regional"),
  market("Midwest", "US", "United States", "IA", "Des Moines", "DSM", 18, ["West Des Moines", "Ankeny", "Clive", "Urbandale", "Johnston"], "regional"),
  market("Midwest", "US", "United States", "NE", "Omaha", "OMA", 18, ["Papillion", "La Vista", "Bellevue", "West Dodge", "Council Bluffs"], "regional"),
  market("Midwest", "US", "United States", "OK", "Oklahoma City", "OKC", 18, ["Edmond", "Norman", "Moore", "Yukon", "Midwest City"], "regional"),
  market("South Central", "US", "United States", "OK", "Tulsa", "TUL", 18, ["Broken Arrow", "Owasso", "Jenks", "Bixby", "Midtown"], "regional"),
  market("Southeast", "US", "United States", "AL", "Birmingham", "BHM", 18, ["Hoover", "Trussville", "Homewood", "Vestavia Hills", "Pelham"], "regional"),
  market("Southeast", "US", "United States", "LA", "Baton Rouge", "BTR", 18, ["Denham Springs", "Central", "Perkins Rowe", "Zachary", "Prairieville"], "regional"),
  market("Southeast", "US", "United States", "LA", "Lafayette", "LFT", 18, ["Carencro", "Scott", "Youngsville", "Broussard", "River Ranch"], "regional"),
  market("Southeast", "US", "United States", "MS", "Jackson", "JAN", 18, ["Ridgeland", "Madison", "Pearl", "Flowood", "Clinton"], "regional"),
  market("Southeast", "US", "United States", "SC", "Charleston", "CHS", 18, ["Mount Pleasant", "North Charleston", "Summerville", "Goose Creek", "West Ashley"], "regional"),
  market("Southeast", "US", "United States", "SC", "Greenville", "GSP", 18, ["Simpsonville", "Mauldin", "Spartanburg", "Easley", "Greer"], "regional"),
  market("Southeast", "US", "United States", "GA", "Savannah", "SAV", 18, ["Pooler", "Richmond Hill", "Southside", "Georgetown", "Garden City"], "regional"),
  market("Mid-Atlantic", "US", "United States", "VA", "Richmond", "RIC", 18, ["Short Pump", "Midlothian", "Mechanicsville", "Chester", "Glen Allen"], "regional"),
  market("Mid-Atlantic", "US", "United States", "VA", "Norfolk", "ORF", 18, ["Virginia Beach", "Chesapeake", "Suffolk", "Portsmouth", "Ghent"], "regional"),
  market("Midwest", "US", "United States", "OH", "Cleveland", "CLE", 18, ["Strongsville", "Parma", "Beachwood", "Mentor", "Westlake"], "regional"),
  market("Midwest", "US", "United States", "OH", "Toledo", "TOL", 18, ["Perrysburg", "Maumee", "Sylvania", "Oregon", "Rossford"], "regional"),
  market("Midwest", "US", "United States", "KY", "Louisville", "SDF", 12, ["St. Matthews", "Middletown", "Jeffersontown", "Okolona", "Prospect"], "secondary"),
  market("Midwest", "US", "United States", "KY", "Lexington", "LEX", 12, ["Hamburg", "Nicholasville", "Beaumont", "Georgetown", "Richmond Road"], "secondary"),
  market("Mid-Atlantic", "US", "United States", "PA", "Pittsburgh", "PIT", 12, ["Cranberry", "Monroeville", "Robinson", "Bethel Park", "South Hills"], "secondary"),
  market("Mid-Atlantic", "US", "United States", "PA", "Harrisburg", "HAR", 12, ["Hershey", "Camp Hill", "Mechanicsburg", "Carlisle", "Linglestown"], "secondary"),
  market("Northeast", "US", "United States", "CT", "Hartford", "BDL", 12, ["West Hartford", "Newington", "Manchester", "Southington", "Enfield"], "secondary"),
  market("Northeast", "US", "United States", "RI", "Providence", "PVD", 12, ["Warwick", "Cranston", "Pawtucket", "East Providence", "Seekonk"], "secondary"),
  market("Northeast", "US", "United States", "NH", "Manchester", "MHT", 12, ["Nashua", "Bedford", "Merrimack", "Hooksett", "Londonderry"], "secondary"),
  market("Northeast", "US", "United States", "ME", "Portland", "PWM", 12, ["South Portland", "Westbrook", "Scarborough", "Falmouth", "Saco"], "secondary"),
  market("West Coast", "US", "United States", "CA", "Fresno", "FAT", 12, ["Clovis", "Madera", "North Growth Area", "Sunnyside", "West Shaw"], "secondary"),
  market("West Coast", "US", "United States", "CA", "Bakersfield", "BFL", 12, ["Rosedale", "Seven Oaks", "Southwest", "Oildale", "Northwest"], "secondary"),
  market("West Coast", "US", "United States", "CA", "Orange County", "SNA", 12, ["Irvine", "Anaheim", "Tustin", "Fullerton", "Mission Viejo"], "secondary"),
  market("West Coast", "US", "United States", "WA", "Spokane", "GEG", 12, ["North Hill", "Spokane Valley", "Airway Heights", "South Hill", "Liberty Lake"], "secondary"),
  market("Mountain", "US", "United States", "CO", "Colorado Springs", "COS", 12, ["Briargate", "Fountain", "Powers", "Security", "Northgate"], "secondary"),
  market("Mountain", "US", "United States", "CO", "Fort Collins", "FNL", 12, ["Loveland", "Timnath", "Harmony", "Windsor", "Old Town"], "secondary"),
  market("Mountain", "US", "United States", "UT", "Provo", "PVU", 12, ["Orem", "Lehi", "American Fork", "Spanish Fork", "Springville"], "secondary"),
  market("Mountain", "US", "United States", "NV", "Reno", "RNO", 12, ["Sparks", "South Meadows", "Damonte Ranch", "North Valleys", "Carson"], "secondary"),
  market("Southwest", "US", "United States", "TX", "Lubbock", "LBB", 12, ["North Loop", "South Plains", "Wolfforth", "Tech Terrace", "Slide Road"], "secondary"),
  market("Southwest", "US", "United States", "TX", "McAllen", "MFE", 12, ["Edinburg", "Mission", "Pharr", "North 10th", "Sharyland"], "secondary"),
  market("Southwest", "US", "United States", "TX", "Corpus Christi", "CRP", 12, ["Calallen", "Southside", "Flour Bluff", "Portland", "Annaville"], "secondary"),
  market("Southeast", "US", "United States", "TN", "Knoxville", "TYS", 12, ["Farragut", "Powell", "Turkey Creek", "Oak Ridge", "Alcoa"], "secondary"),

  market("Canada", "CA", "Canada", "ON", "Toronto", "YYZ", 22, ["Etobicoke", "Scarborough", "North York", "Mississauga", "Vaughan"], "major"),
  market("Canada", "CA", "Canada", "QC", "Montreal", "YUL", 22, ["Laval", "West Island", "Longueuil", "Brossard", "Saint-Laurent"], "major"),
  market("Canada", "CA", "Canada", "BC", "Vancouver", "YVR", 22, ["Burnaby", "Richmond", "Surrey", "Langley", "Coquitlam"], "major"),
  market("Canada", "CA", "Canada", "AB", "Calgary", "YYC", 18, ["Airdrie", "Signal Hill", "Seton", "Macleod", "Sunridge"], "regional"),
  market("Canada", "CA", "Canada", "AB", "Edmonton", "YEG", 18, ["Sherwood Park", "St. Albert", "Windermere", "Mill Woods", "Westmount"], "regional"),
  market("Canada", "CA", "Canada", "ON", "Ottawa", "YOW", 18, ["Kanata", "Orleans", "Barrhaven", "Nepean", "Gloucester"], "regional"),
  market("Mexico", "MX", "Mexico", "CMX", "Mexico City", "MEX", 22, ["Polanco", "Coyoacan", "Santa Fe", "Lindavista", "Tlalpan"], "major"),
  market("Mexico", "MX", "Mexico", "JAL", "Guadalajara", "GDL", 18, ["Zapopan", "Tlaquepaque", "Providencia", "Chapalita", "Tlajomulco"], "regional"),
  market("Mexico", "MX", "Mexico", "NLE", "Monterrey", "MTY", 18, ["San Pedro", "Apodaca", "Guadalupe", "Santa Catarina", "Cumbres"], "regional"),
  market("Mexico", "MX", "Mexico", "BCN", "Tijuana", "TIJ", 12, ["Zona Rio", "Otay", "Playas", "La Mesa", "Rosarito"], "secondary"),

  market("Southeast", "US", "United States", "FL", "Fort Lauderdale", "FLL", 12, ["Pembroke Pines", "Plantation", "Sunrise", "Coral Springs", "Pompano"], "secondary"),
  market("Southeast", "US", "United States", "FL", "West Palm Beach", "PBI", 12, ["Boca Raton", "Delray Beach", "Jupiter", "Boynton Beach", "Lake Worth"], "secondary"),
  market("Southeast", "US", "United States", "AR", "Little Rock", "LIT", 12, ["North Little Rock", "Conway", "Bryant", "Maumelle", "West Markham"], "secondary"),
  market("South Central", "US", "United States", "KS", "Wichita", "ICT", 12, ["Eastborough", "Derby", "Andover", "Maize", "Westlink"], "secondary"),
  market("Midwest", "US", "United States", "ND", "Fargo", "FAR", 12, ["West Acres", "Moorhead", "South University", "Horace", "North Broadway"], "secondary"),
  market("Midwest", "US", "United States", "SD", "Sioux Falls", "FSD", 12, ["Tea", "Brandon", "Sertoma", "East 10th", "West 41st"], "secondary"),
  market("Mountain", "US", "United States", "WY", "Cheyenne", "CYS", 12, ["South Greeley", "Dell Range", "Frontier", "North College", "Pershing"], "secondary"),
  market("Mountain", "US", "United States", "NM", "Santa Fe", "SAF", 12, ["Rancho Viejo", "Agua Fria", "Zafarano", "Cerrillos", "St. Michael's"], "secondary"),
  market("West Coast", "US", "United States", "CA", "San Bernardino", "SBD", 12, ["Redlands", "Highland", "Rialto", "Fontana", "Loma Linda"], "secondary"),
  market("West Coast", "US", "United States", "CA", "Monterey Bay", "MRY", 12, ["Salinas", "Seaside", "Marina", "Watsonville", "Carmel"], "secondary")
]);

function slugify(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toUpperCase();
}

function titleCaseWords(value) {
  return String(value || "")
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function buildGenericAreaPool(marketName) {
  const cityToken = titleCaseWords(String(marketName || "").split(/\s+/)[0] || marketName || "Metro");
  const pool = [];
  for (const prefix of AREA_PREFIXES) {
    pool.push(prefix);
    for (const suffix of AREA_SUFFIXES) {
      pool.push(`${prefix} ${suffix}`);
    }
  }
  for (const suffix of AREA_SUFFIXES) {
    pool.push(suffix);
    pool.push(`${cityToken} ${suffix}`);
  }
  return pool;
}

function buildTradeAreas(marketDefinition, count) {
  const areas = [];
  const seen = new Set();
  const addArea = (value) => {
    const normalized = String(value || "").trim().replace(/\s+/g, " ");
    if (!normalized) {
      return;
    }
    const key = normalized.toLowerCase();
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    areas.push(normalized);
  };

  for (const preferred of marketDefinition.preferredAreas) {
    addArea(preferred);
  }

  for (const generated of buildGenericAreaPool(marketDefinition.metro)) {
    if (areas.length >= count) {
      break;
    }
    addArea(generated);
  }

  let overflowIndex = 1;
  while (areas.length < count) {
    addArea(`Trade Area ${overflowIndex}`);
    overflowIndex += 1;
  }

  return areas.slice(0, count);
}

function buildMarketAllocations() {
  const totalWeight = MARKET_DEFINITIONS.reduce((sum, marketDefinition) => sum + marketDefinition.weight, 0);
  const minimumStores = 8;
  const allocations = MARKET_DEFINITIONS.map((marketDefinition, index) => {
    const exact = (marketDefinition.weight / totalWeight) * DEMO_STORE_TARGET_COUNT;
    const count = Math.max(minimumStores, Math.floor(exact));
    return {
      index,
      marketDefinition,
      exact,
      remainder: exact - Math.floor(exact),
      count
    };
  });

  let diff = DEMO_STORE_TARGET_COUNT - allocations.reduce((sum, entry) => sum + entry.count, 0);

  if (diff > 0) {
    const priority = [...allocations].sort(
      (left, right) =>
        right.remainder - left.remainder ||
        right.marketDefinition.weight - left.marketDefinition.weight ||
        left.marketDefinition.metro.localeCompare(right.marketDefinition.metro)
    );
    let cursor = 0;
    while (diff > 0) {
      priority[cursor % priority.length].count += 1;
      diff -= 1;
      cursor += 1;
    }
  }

  if (diff < 0) {
    const priority = [...allocations].sort(
      (left, right) =>
        left.remainder - right.remainder ||
        left.marketDefinition.weight - right.marketDefinition.weight ||
        left.marketDefinition.metro.localeCompare(right.marketDefinition.metro)
    );
    let cursor = 0;
    while (diff < 0 && cursor < priority.length * 4) {
      const entry = priority[cursor % priority.length];
      if (entry.count > minimumStores) {
        entry.count -= 1;
        diff += 1;
      }
      cursor += 1;
    }
  }

  return allocations;
}

function pickArchetypeId(tier, marketIndex, storeIndex, storeCount) {
  if (tier === "flagship") {
    if (storeIndex === 0) {
      return "flagship";
    }
    const cycle = ["metro", "flagship", "suburban", "metro", "regional"];
    return cycle[(marketIndex + storeIndex) % cycle.length];
  }
  if (tier === "major") {
    const cycle = storeIndex < 2 ? ["metro", "flagship"] : ["metro", "suburban", "metro", "regional", "compact"];
    return cycle[(marketIndex + storeIndex + storeCount) % cycle.length];
  }
  if (tier === "regional") {
    const cycle = ["suburban", "regional", "metro", "compact", "suburban"];
    return cycle[(marketIndex * 2 + storeIndex) % cycle.length];
  }
  const cycle = ["compact", "regional", "suburban", "compact", "regional"];
  return cycle[(marketIndex + storeIndex * 3) % cycle.length];
}

function buildCategoryBias(archetype, marketIndex, storeIndex) {
  const wave = ((marketIndex * 5 + storeIndex * 3) % 11) - 5;
  const electronicsDelta = ((marketIndex + storeIndex) % 7) * 0.015 - 0.045;
  const whitegoodsDelta = ((marketIndex * 2 + storeIndex) % 7) * 0.014 - 0.042;
  const aisleDelta = ((marketIndex + storeIndex * 2) % 7) * 0.013 - 0.039;
  const foodcourtDelta = wave * 0.01;
  const categoryBias = {};

  for (const [key, value] of Object.entries(archetype.categoryBias)) {
    let delta = 0;
    if (key === "electronics") {
      delta = electronicsDelta;
    } else if (key === "whitegoods") {
      delta = whitegoodsDelta;
    } else if (key === "aisle") {
      delta = aisleDelta;
    } else if (key === "foodcourt") {
      delta = foodcourtDelta;
    } else {
      delta = (electronicsDelta + whitegoodsDelta + aisleDelta) / 3;
    }
    categoryBias[key] = Number(Math.max(0.72, Math.min(1.42, value + delta)).toFixed(2));
  }

  return categoryBias;
}

function buildScreenConfigs(archetype, marketIndex, storeIndex) {
  const refreshShift = ((marketIndex + storeIndex) % 4) * 1000;
  const configs = {};

  for (const [placementKey, baseConfig] of Object.entries(archetype.screenConfigs)) {
    configs[placementKey] = {
      ...baseConfig,
      refreshInterval: Math.max(9000, Number(baseConfig.refreshInterval || 30000) + refreshShift)
    };
  }

  return configs;
}

function buildStoreId(marketDefinition, tradeArea, storeNumber) {
  return [
    marketDefinition.countryCode,
    marketDefinition.state,
    marketDefinition.marketCode,
    slugify(tradeArea).slice(0, 18),
    storeNumber
  ]
    .filter(Boolean)
    .join("-");
}

function buildStoreProfile(marketAllocation, marketIndex, storeIndex, absoluteIndex) {
  const { marketDefinition, count } = marketAllocation;
  const tradeAreas = buildTradeAreas(marketDefinition, count);
  const tradeArea = tradeAreas[storeIndex] || `Trade Area ${storeIndex + 1}`;
  const archetypeId = pickArchetypeId(marketDefinition.tier, marketIndex, storeIndex, count);
  const archetype = STORE_ARCHETYPES[archetypeId];
  const storeNumber = String(absoluteIndex + 1).padStart(4, "0");
  const isAnchor = marketIndex === 0 && storeIndex === 0;
  const inventoryVariance = ((marketIndex + 1) * (storeIndex + 3)) % 9;
  const trafficVariance = ((marketIndex + 3) * (storeIndex + 5)) % 7;
  const inventoryScale = Number((archetype.inventoryScale + inventoryVariance * 0.018).toFixed(2));
  const trafficScale = Number((archetype.trafficScale + trafficVariance * 0.02).toFixed(2));

  return {
    storeId: buildStoreId(marketDefinition, tradeArea, storeNumber),
    storeLabel: `${marketDefinition.metro} ${tradeArea}`,
    market: marketDefinition.metro,
    tradeArea,
    state: marketDefinition.state,
    country: marketDefinition.country,
    countryCode: marketDefinition.countryCode,
    region: marketDefinition.region,
    storeNumber,
    tier: marketDefinition.tier,
    archetype: archetype.id,
    isAnchor,
    inventoryScale,
    trafficScale,
    stockBase: archetype.stockBase + inventoryVariance * 4,
    categoryBias: buildCategoryBias(archetype, marketIndex, storeIndex),
    screenConfigs: buildScreenConfigs(archetype, marketIndex, storeIndex)
  };
}

function buildDemoStoreProfiles() {
  const allocations = buildMarketAllocations();
  const profiles = [];
  let absoluteIndex = 0;

  allocations.forEach((marketAllocation, marketIndex) => {
    for (let storeIndex = 0; storeIndex < marketAllocation.count; storeIndex += 1) {
      profiles.push(buildStoreProfile(marketAllocation, marketIndex, storeIndex, absoluteIndex));
      absoluteIndex += 1;
    }
  });

  return Object.freeze(profiles);
}

const DEMO_STORE_PROFILES = buildDemoStoreProfiles();
const DEMO_STORE_IDS = Object.freeze(DEMO_STORE_PROFILES.map((profile) => profile.storeId));
const DEMO_ANCHOR_STORE =
  DEMO_STORE_PROFILES.find((profile) => profile.isAnchor) ||
  DEMO_STORE_PROFILES[0] ||
  null;

export {
  DEMO_STORE_TARGET_COUNT,
  LEGACY_DEMO_STORE_IDS,
  DEMO_STORE_PROFILES,
  DEMO_STORE_IDS,
  DEMO_ANCHOR_STORE
};
