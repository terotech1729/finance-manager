/**
 * Curated India places for Travel typeahead (airports / stations / cities).
 * No third-party autocomplete dependency — fast, offline, mode-aware.
 */
import type { TravelMode } from "./types";

export type PlaceKind = "airport" | "station" | "city";

export type TravelPlace = {
  id: string;
  name: string;
  /** IATA / railway code when known */
  code?: string;
  city: string;
  state?: string;
  kind: PlaceKind;
  modes: TravelMode[];
  lat: number;
  lng: number;
  aliases?: string[];
};

function p(
  id: string,
  name: string,
  code: string | undefined,
  city: string,
  state: string | undefined,
  kind: PlaceKind,
  modes: TravelMode[],
  lat: number,
  lng: number,
  aliases?: string[]
): TravelPlace {
  return { id, name, code, city, state, kind, modes, lat, lng, aliases };
}

/**
 * Destination town. Road-reachable by default — the journey graph finds the nearest
 * airport/railhead and adds a last mile — so only pass extra modes where the town itself
 * has a station or airstrip. `name` doubles as the city so the label stays the plain name.
 */
function t(
  slug: string,
  name: string,
  state: string,
  lat: number,
  lng: number,
  aliases: string[] = [],
  modes: TravelMode[] = ["bus"]
): TravelPlace {
  return { id: `dst-${slug}`, name, city: name, state, kind: "city", modes, lat, lng, aliases };
}

/** Major Indian airports + metro cities + busy rail hubs. */
export const TRAVEL_PLACES: readonly TravelPlace[] = [
  // —— Airports (also usable as flight origin/dest city codes) ——
  p("apt-blr", "Kempegowda International", "BLR", "Bengaluru", "KA", "airport", ["flight"], 13.1989, 77.7068, ["bangalore", "bengaluru airport"]),
  p("apt-del", "Indira Gandhi International", "DEL", "Delhi", "DL", "airport", ["flight"], 28.5562, 77.1, ["new delhi", "igi"]),
  p("apt-bom", "Chhatrapati Shivaji Maharaj", "BOM", "Mumbai", "MH", "airport", ["flight"], 19.0896, 72.8656, ["bombay"]),
  p("apt-maa", "Chennai International", "MAA", "Chennai", "TN", "airport", ["flight"], 12.9941, 80.1709, ["madras"]),
  p("apt-hyd", "Rajiv Gandhi International", "HYD", "Hyderabad", "TS", "airport", ["flight"], 17.2403, 78.4294),
  p("apt-ccu", "Netaji Subhas Chandra Bose", "CCU", "Kolkata", "WB", "airport", ["flight"], 22.6547, 88.4467, ["calcutta"]),
  p("apt-pnq", "Pune Airport", "PNQ", "Pune", "MH", "airport", ["flight"], 18.5822, 73.9197),
  p("apt-goi", "Goa Mopa / Dabolim", "GOI", "Goa", "GA", "airport", ["flight"], 15.3808, 73.8314, ["mopa", "dabolim", "goa airport"]),
  p("apt-cok", "Cochin International", "COK", "Kochi", "KL", "airport", ["flight"], 10.152, 76.4019, ["cochin", "ernakulam"]),
  p("apt-trv", "Trivandrum International", "TRV", "Thiruvananthapuram", "KL", "airport", ["flight"], 8.4821, 76.9201, ["trivandrum"]),
  p("apt-amd", "Sardar Vallabhbhai Patel", "AMD", "Ahmedabad", "GJ", "airport", ["flight"], 23.0772, 72.6347),
  p("apt-jai", "Jaipur International", "JAI", "Jaipur", "RJ", "airport", ["flight"], 26.8242, 75.8122),
  p("apt-lko", "Chaudhary Charan Singh", "LKO", "Lucknow", "UP", "airport", ["flight"], 26.7606, 80.8893),
  p("apt-pat", "Jay Prakash Narayan", "PAT", "Patna", "BR", "airport", ["flight"], 25.5913, 85.088),
  p("apt-bbi", "Biju Patnaik", "BBI", "Bhubaneswar", "OD", "airport", ["flight"], 20.2444, 85.8178),
  p("apt-gau", "Lokpriya Gopinath Bordoloi", "GAU", "Guwahati", "AS", "airport", ["flight"], 26.1061, 91.5859),
  p("apt-ixc", "Chandigarh Airport", "IXC", "Chandigarh", "CH", "airport", ["flight"], 30.6735, 76.7885),
  p("apt-ixb", "Bagdogra", "IXB", "Bagdogra", "WB", "airport", ["flight"], 26.6812, 88.3286, ["siliguri"]),
  p("apt-ixm", "Madurai Airport", "IXM", "Madurai", "TN", "airport", ["flight"], 9.8345, 78.0934),
  p("apt-trz", "Tiruchirappalli", "TRZ", "Tiruchirappalli", "TN", "airport", ["flight"], 10.7654, 78.7097, ["trichy"]),
  p("apt-cjb", "Coimbatore International", "CJB", "Coimbatore", "TN", "airport", ["flight"], 11.0297, 77.0434),
  p("apt-ixe", "Mangaluru Airport", "IXE", "Mangaluru", "KA", "airport", ["flight"], 12.9613, 74.8901, ["mangalore"]),
  p("apt-vtz", "Visakhapatnam", "VTZ", "Visakhapatnam", "AP", "airport", ["flight"], 17.7212, 83.2245, ["vizag"]),
  p("apt-nag", "Nagpur Airport", "NAG", "Nagpur", "MH", "airport", ["flight"], 21.0922, 79.0472),
  p("apt-idr", "Devi Ahilya Bai", "IDR", "Indore", "MP", "airport", ["flight"], 22.7218, 75.8011),
  p("apt-bdq", "Vadodara Airport", "BDQ", "Vadodara", "GJ", "airport", ["flight"], 22.3362, 73.2263, ["baroda"]),
  p("apt-raj", "Rajkot Airport", "RAJ", "Rajkot", "GJ", "airport", ["flight"], 22.3092, 70.7795),
  p("apt-sxr", "Srinagar Airport", "SXR", "Srinagar", "JK", "airport", ["flight"], 33.9871, 74.7743),
  p("apt-ixa", "Agartala Airport", "IXA", "Agartala", "TR", "airport", ["flight"], 23.8869, 91.2404),
  p("apt-ixz", "Veer Savarkar (Port Blair)", "IXZ", "Port Blair", "AN", "airport", ["flight"], 11.6412, 92.7297),
  p("apt-udi", "Udaipur Airport", "UDR", "Udaipur", "RJ", "airport", ["flight"], 24.6177, 73.8961),
  p("apt-vns", "Lal Bahadur Shastri", "VNS", "Varanasi", "UP", "airport", ["flight"], 25.4524, 82.8593, ["banaras"]),
  p("apt-ixr", "Birsa Munda", "IXR", "Ranchi", "JH", "airport", ["flight"], 23.3143, 85.3217),
  p("apt-rpr", "Swami Vivekananda", "RPR", "Raipur", "CG", "airport", ["flight"], 21.1804, 81.7388),
  p("apt-atq", "Sri Guru Ram Dass Jee", "ATQ", "Amritsar", "PB", "airport", ["flight"], 31.7096, 74.7973),
  p("apt-ded", "Dehradun / Jolly Grant", "DED", "Dehradun", "UK", "airport", ["flight"], 30.1897, 78.1803),

  // —— Himalayan & northern airports (the gateways for hill destinations) ——
  p("apt-pgh", "Pantnagar Airport", "PGH", "Pantnagar", "UK", "airport", ["flight"], 29.0334, 79.4738, ["pantnagar", "nainital airport", "kumaon"]),
  p("apt-dhm", "Kangra / Gaggal", "DHM", "Dharamshala", "HP", "airport", ["flight"], 32.1651, 76.2634, ["gaggal", "kangra", "mcleodganj"]),
  p("apt-kuu", "Bhuntar Airport", "KUU", "Kullu", "HP", "airport", ["flight"], 31.8767, 77.1544, ["bhuntar", "manali airport"]),
  p("apt-slv", "Shimla Airport", "SLV", "Shimla", "HP", "airport", ["flight"], 31.0818, 77.068, ["jubbarhatti"]),
  p("apt-ixl", "Kushok Bakula Rimpochee", "IXL", "Leh", "LA", "airport", ["flight"], 34.1359, 77.5465, ["ladakh"]),
  p("apt-ixj", "Jammu Airport", "IXJ", "Jammu", "JK", "airport", ["flight"], 32.6891, 74.8374, ["satwari"]),
  p("apt-ixp", "Pathankot Airport", "IXP", "Pathankot", "PB", "airport", ["flight"], 32.2337, 75.6343),
  p("apt-luh", "Ludhiana / Halwara", "LUH", "Ludhiana", "PB", "airport", ["flight"], 30.8547, 75.9526),
  p("apt-bup", "Bathinda / Virasat", "BUP", "Bathinda", "PB", "airport", ["flight"], 30.2703, 74.7558),
  p("apt-hss", "Hisar Airport", "HSS", "Hisar", "HR", "airport", ["flight"], 29.1794, 75.7553),

  // —— Uttar Pradesh / central ——
  p("apt-agr", "Agra Airport", "AGR", "Agra", "UP", "airport", ["flight"], 27.1558, 77.9609, ["kheria", "taj"]),
  p("apt-ayj", "Maharishi Valmiki (Ayodhya)", "AYJ", "Ayodhya", "UP", "airport", ["flight"], 26.7466, 82.1506, ["ram mandir"]),
  p("apt-vgo", "Gorakhpur Airport", "GOP", "Gorakhpur", "UP", "airport", ["flight"], 26.7397, 83.4497),
  p("apt-knu", "Kanpur / Chakeri", "KNU", "Kanpur", "UP", "airport", ["flight"], 26.4404, 80.3648),
  p("apt-bek", "Bareilly Airport", "BEK", "Bareilly", "UP", "airport", ["flight"], 28.4221, 79.4507),
  p("apt-ixd", "Prayagraj Airport", "IXD", "Prayagraj", "UP", "airport", ["flight"], 25.4401, 81.7339, ["allahabad"]),
  p("apt-hjr", "Khajuraho Airport", "HJR", "Khajuraho", "MP", "airport", ["flight"], 24.8172, 79.9186),
  p("apt-jlr", "Jabalpur / Dumna", "JLR", "Jabalpur", "MP", "airport", ["flight"], 23.1778, 80.052),
  p("apt-gwl", "Gwalior Airport", "GWL", "Gwalior", "MP", "airport", ["flight"], 26.2933, 78.2278),
  p("apt-bho", "Raja Bhoj (Bhopal)", "BHO", "Bhopal", "MP", "airport", ["flight"], 23.2875, 77.3374),

  // —— Gujarat & west ——
  p("apt-stv", "Surat Airport", "STV", "Surat", "GJ", "airport", ["flight"], 21.1141, 72.7418),
  p("apt-bhj", "Bhuj Airport", "BHJ", "Bhuj", "GJ", "airport", ["flight"], 23.2878, 69.6701, ["kutch", "rann"]),
  p("apt-jga", "Jamnagar Airport", "JGA", "Jamnagar", "GJ", "airport", ["flight"], 22.4655, 70.0126),
  p("apt-pbd", "Porbandar Airport", "PBD", "Porbandar", "GJ", "airport", ["flight"], 21.6487, 69.6572),
  p("apt-diu", "Diu Airport", "DIU", "Diu", "DD", "airport", ["flight"], 20.7131, 70.9211),
  p("apt-isk", "Nashik / Ozar", "ISK", "Nashik", "MH", "airport", ["flight"], 20.1191, 73.9126),
  p("apt-sag", "Shirdi Airport", "SAG", "Shirdi", "MH", "airport", ["flight"], 19.6885, 74.3788, ["sai baba"]),
  p("apt-ixu", "Chhatrapati Sambhajinagar", "IXU", "Aurangabad", "MH", "airport", ["flight"], 19.8627, 75.3981, ["aurangabad", "ajanta", "ellora"]),
  p("apt-klh", "Kolhapur Airport", "KLH", "Kolhapur", "MH", "airport", ["flight"], 16.6647, 74.2894),
  p("apt-ndc", "Nanded Airport", "NDC", "Nanded", "MH", "airport", ["flight"], 19.1833, 77.3167),
  p("apt-gox", "Manohar / Mopa (North Goa)", "GOX", "Goa", "GA", "airport", ["flight"], 15.736, 73.868, ["mopa", "north goa airport"]),

  // —— Rajasthan ——
  p("apt-jdh", "Jodhpur Airport", "JDH", "Jodhpur", "RJ", "airport", ["flight"], 26.2511, 73.0489),
  p("apt-jsa", "Jaisalmer Airport", "JSA", "Jaisalmer", "RJ", "airport", ["flight"], 26.8887, 70.865),
  p("apt-bkb", "Bikaner / Nal", "BKB", "Bikaner", "RJ", "airport", ["flight"], 28.0706, 73.2072),
  p("apt-kqh", "Kishangarh (Ajmer)", "KQH", "Kishangarh", "RJ", "airport", ["flight"], 26.5906, 74.8133, ["ajmer", "pushkar"]),

  // —— South ——
  p("apt-hbx", "Hubballi Airport", "HBX", "Hubballi", "KA", "airport", ["flight"], 15.3617, 75.0849, ["hubli", "dharwad"]),
  p("apt-ixg", "Belagavi Airport", "IXG", "Belagavi", "KA", "airport", ["flight"], 15.8593, 74.6183, ["belgaum"]),
  p("apt-gbi", "Kalaburagi Airport", "GBI", "Kalaburagi", "KA", "airport", ["flight"], 17.307, 76.961, ["gulbarga"]),
  p("apt-rqy", "Shivamogga Airport", "RQY", "Shivamogga", "KA", "airport", ["flight"], 13.857, 75.568, ["shimoga"]),
  p("apt-myq", "Mysuru Airport", "MYQ", "Mysuru", "KA", "airport", ["flight"], 12.23, 76.6557, ["mysore"]),
  p("apt-ccj", "Calicut International", "CCJ", "Kozhikode", "KL", "airport", ["flight"], 11.1368, 75.9553, ["calicut", "wayanad"]),
  p("apt-cnn", "Kannur International", "CNN", "Kannur", "KL", "airport", ["flight"], 11.9184, 75.5477),
  p("apt-tir", "Tirupati Airport", "TIR", "Tirupati", "AP", "airport", ["flight"], 13.6325, 79.5433, ["tirumala", "balaji"]),
  p("apt-rja", "Rajahmundry Airport", "RJA", "Rajahmundry", "AP", "airport", ["flight"], 17.1104, 81.8182),
  p("apt-vga", "Vijayawada Airport", "VGA", "Vijayawada", "AP", "airport", ["flight"], 16.5304, 80.7968, ["gannavaram"]),
  p("apt-sxv", "Salem Airport", "SXV", "Salem", "TN", "airport", ["flight"], 11.7833, 78.0656),
  p("apt-tcr", "Tuticorin Airport", "TCR", "Thoothukudi", "TN", "airport", ["flight"], 8.7241, 78.0258, ["tuticorin"]),
  p("apt-pny", "Puducherry Airport", "PNY", "Puducherry", "PY", "airport", ["flight"], 11.9686, 79.811, ["pondicherry"]),

  // —— East & North-East ——
  p("apt-gay", "Gaya International", "GAY", "Gaya", "BR", "airport", ["flight"], 24.7443, 84.9512, ["bodh gaya", "bodhgaya"]),
  p("apt-dbr", "Darbhanga Airport", "DBR", "Darbhanga", "BR", "airport", ["flight"], 26.1929, 85.9166),
  p("apt-dbd", "Deoghar Airport", "DBD", "Deoghar", "JH", "airport", ["flight"], 24.45, 86.7, ["baidyanath"]),
  p("apt-rdp", "Durgapur / Andal", "RDP", "Durgapur", "WB", "airport", ["flight"], 23.6236, 87.243),
  p("apt-jrg", "Jharsuguda Airport", "JRG", "Jharsuguda", "OD", "airport", ["flight"], 21.9135, 84.0505),
  p("apt-pyg", "Pakyong Airport", "PYG", "Gangtok", "SK", "airport", ["flight"], 27.2255, 88.5858, ["sikkim", "gangtok airport"]),
  p("apt-shl", "Shillong / Umroi", "SHL", "Shillong", "ML", "airport", ["flight"], 25.7036, 91.9787),
  p("apt-imf", "Imphal International", "IMF", "Imphal", "MN", "airport", ["flight"], 24.76, 93.8967),
  p("apt-ajl", "Lengpui (Aizawl)", "AJL", "Aizawl", "MZ", "airport", ["flight"], 23.8406, 92.6196),
  p("apt-dmu", "Dimapur Airport", "DMU", "Dimapur", "NL", "airport", ["flight"], 25.8839, 93.7711, ["kohima"]),
  p("apt-jrh", "Jorhat Airport", "JRH", "Jorhat", "AS", "airport", ["flight"], 26.7315, 94.1755, ["majuli"]),
  p("apt-dib", "Dibrugarh Airport", "DIB", "Dibrugarh", "AS", "airport", ["flight"], 27.4839, 95.0169),
  p("apt-tez", "Tezpur Airport", "TEZ", "Tezpur", "AS", "airport", ["flight"], 26.7091, 92.7847, ["tawang"]),
  p("apt-ixs", "Silchar / Kumbhirgram", "IXS", "Silchar", "AS", "airport", ["flight"], 24.9129, 92.9787),
  p("apt-hgi", "Donyi Polo (Itanagar)", "HGI", "Itanagar", "AR", "airport", ["flight"], 27.0, 93.6, ["hollongi", "arunachal"]),

  // —— Railway stations ——
  p("stn-sbc", "KSR Bengaluru City", "SBC", "Bengaluru", "KA", "station", ["train"], 12.9784, 77.5699, ["bangalore city", "krantivira"]),
  p("stn-ypr", "Yesvantpur Junction", "YPR", "Bengaluru", "KA", "station", ["train"], 13.0235, 77.551),
  p("stn-ndls", "New Delhi", "NDLS", "Delhi", "DL", "station", ["train"], 28.642, 77.219),
  p("stn-dli", "Old Delhi", "DLI", "Delhi", "DL", "station", ["train"], 28.6609, 77.2277),
  p("stn-nzm", "Hazrat Nizamuddin", "NZM", "Delhi", "DL", "station", ["train"], 28.589, 77.253),
  p("stn-cstm", "CSMT Mumbai", "CSMT", "Mumbai", "MH", "station", ["train"], 18.9398, 72.8355, ["vt", "cst"]),
  p("stn-ltt", "Lokmanya Tilak (LTT)", "LTT", "Mumbai", "MH", "station", ["train"], 19.0696, 72.891),
  p("stn-bdts", "Bandra Terminus", "BDTS", "Mumbai", "MH", "station", ["train"], 19.0623, 72.8405),
  p("stn-mas", "MGR Chennai Central", "MAS", "Chennai", "TN", "station", ["train"], 13.0827, 80.2756),
  p("stn-ms", "Chennai Egmore", "MS", "Chennai", "TN", "station", ["train"], 13.0781, 80.2615),
  p("stn-hyb", "Hyderabad Deccan", "HYB", "Hyderabad", "TS", "station", ["train"], 17.3925, 78.4675),
  p("stn-sc", "Secunderabad Junction", "SC", "Hyderabad", "TS", "station", ["train"], 17.4337, 78.5016),
  p("stn-hwh", "Howrah Junction", "HWH", "Kolkata", "WB", "station", ["train"], 22.583, 88.3426),
  p("stn-koaa", "Kolkata (KOAA)", "KOAA", "Kolkata", "WB", "station", ["train"], 22.6015, 88.3831),
  p("stn-pune", "Pune Junction", "PUNE", "Pune", "MH", "station", ["train"], 18.5289, 73.8745),
  p("stn-adi", "Ahmedabad Junction", "ADI", "Ahmedabad", "GJ", "station", ["train"], 23.0258, 72.6005),
  p("stn-jp", "Jaipur Junction", "JP", "Jaipur", "RJ", "station", ["train"], 26.9196, 75.788),
  p("stn-lko", "Lucknow NR", "LKO", "Lucknow", "UP", "station", ["train"], 26.8381, 80.9248),
  p("stn-pnbe", "Patna Junction", "PNBE", "Patna", "BR", "station", ["train"], 25.603, 85.1376),
  p("stn-ers", "Ernakulam Junction", "ERS", "Kochi", "KL", "station", ["train"], 9.9689, 76.291),
  p("stn-tvc", "Thiruvananthapuram Central", "TVC", "Thiruvananthapuram", "KL", "station", ["train"], 8.4855, 76.9492),
  p("stn-bza", "Vijayawada Junction", "BZA", "Vijayawada", "AP", "station", ["train"], 16.518, 80.62),
  p("stn-ghy", "Guwahati", "GHY", "Guwahati", "AS", "station", ["train"], 26.1823, 91.7505),
  p("stn-bsb", "Varanasi Junction", "BSB", "Varanasi", "UP", "station", ["train"], 25.327, 82.986),
  p("stn-ald", "Prayagraj Junction", "PRYJ", "Prayagraj", "UP", "station", ["train"], 25.446, 81.826, ["allahabad"]),
  p("stn-gwl", "Gwalior Junction", "GWL", "Gwalior", "MP", "station", ["train"], 26.215, 78.182),
  p("stn-bhopal", "Bhopal Junction", "BPL", "Bhopal", "MP", "station", ["train"], 23.267, 77.413),
  p("stn-indb", "Indore Junction", "INDB", "Indore", "MP", "station", ["train"], 22.717, 75.868),
  p("stn-ngp", "Nagpur Junction", "NGP", "Nagpur", "MH", "station", ["train"], 21.152, 79.088),
  p("stn-mao", "Madgaon (Goa)", "MAO", "Madgaon", "GA", "station", ["train"], 15.28, 73.98, ["goa", "margao"]),
  p("stn-ddn", "Dehradun", "DDN", "Dehradun", "UK", "station", ["train"], 30.3165, 78.0322),
  p("stn-hw", "Haridwar Junction", "HW", "Haridwar", "UK", "station", ["train"], 29.9457, 78.1642),
  p("stn-ynrk", "Yog Nagari Rishikesh", "YNRK", "Rishikesh", "UK", "station", ["train"], 30.0522, 78.2803, ["rishikesh"]),
  p("stn-ktgn", "Kathgodam", "KGM", "Kathgodam", "UK", "station", ["train"], 29.2645, 79.5391, ["nainital", "haldwani", "kumaon"]),
  p("stn-rmr", "Ramnagar", "RMR", "Ramnagar", "UK", "station", ["train"], 29.3948, 79.1288, ["jim corbett", "corbett"]),
  p("stn-ubl", "Udhampur", "UHP", "Udhampur", "JK", "station", ["train"], 32.9159, 75.1416),
  p("stn-swv", "Shri Vaishno Devi Katra", "SVDK", "Katra", "JK", "station", ["train"], 32.9917, 74.9319, ["katra", "vaishno devi"]),
  p("stn-jat", "Jammu Tawi", "JAT", "Jammu", "JK", "station", ["train"], 32.7043, 74.8654),
  p("stn-asr", "Amritsar Junction", "ASR", "Amritsar", "PB", "station", ["train"], 31.6339, 74.8737),
  p("stn-umb", "Ambala Cantt", "UMB", "Ambala", "HR", "station", ["train"], 30.3673, 76.8397),
  p("stn-kika", "Kalka", "KLK", "Kalka", "HR", "station", ["train"], 30.8397, 76.9403, ["shimla toy train"]),
  p("stn-cdg", "Chandigarh", "CDG", "Chandigarh", "CH", "station", ["train"], 30.7046, 76.8006),
  p("stn-agc", "Agra Cantt", "AGC", "Agra", "UP", "station", ["train"], 27.1571, 78.0027),
  p("stn-jhs", "Jhansi Junction", "JHS", "Jhansi", "UP", "station", ["train"], 25.4484, 78.5685, ["orchha", "khajuraho"]),
  p("stn-cnb", "Kanpur Central", "CNB", "Kanpur", "UP", "station", ["train"], 26.4523, 80.3509),
  p("stn-gkp", "Gorakhpur Junction", "GKP", "Gorakhpur", "UP", "station", ["train"], 26.7606, 83.3732),
  p("stn-mtj", "Mathura Junction", "MTJ", "Mathura", "UP", "station", ["train"], 27.4924, 77.6737, ["vrindavan"]),
  p("stn-gaya", "Gaya Junction", "GAYA", "Gaya", "BR", "station", ["train"], 24.7955, 84.9994, ["bodh gaya"]),
  p("stn-njp", "New Jalpaiguri", "NJP", "Siliguri", "WB", "station", ["train"], 26.6862, 88.4271, ["darjeeling", "gangtok", "siliguri"]),
  p("stn-puri", "Puri", "PURI", "Puri", "OD", "station", ["train"], 19.8135, 85.8312),
  p("stn-bbs", "Bhubaneswar", "BBS", "Bhubaneswar", "OD", "station", ["train"], 20.2686, 85.8419),
  p("stn-tpty", "Tirupati", "TPTY", "Tirupati", "AP", "station", ["train"], 13.6288, 79.4192),
  p("stn-cape", "Kanyakumari", "CAPE", "Kanyakumari", "TN", "station", ["train"], 8.0883, 77.5385),
  p("stn-rmm", "Rameswaram", "RMM", "Rameswaram", "TN", "station", ["train"], 9.2876, 79.3129),
  p("stn-mdu", "Madurai Junction", "MDU", "Madurai", "TN", "station", ["train"], 9.9197, 78.1194),
  p("stn-cbe", "Coimbatore Junction", "CBE", "Coimbatore", "TN", "station", ["train"], 11.0018, 76.9666),
  p("stn-mys", "Mysuru Junction", "MYS", "Mysuru", "KA", "station", ["train"], 12.3122, 76.6428, ["mysore"]),
  p("stn-ubla", "Hubballi Junction", "UBL", "Hubballi", "KA", "station", ["train"], 15.3491, 75.1387, ["hubli"]),
  p("stn-hpt", "Hosapete Junction", "HPT", "Hosapete", "KA", "station", ["train"], 15.2689, 76.3909, ["hampi", "hospet"]),
  p("stn-can", "Kannur", "CAN", "Kannur", "KL", "station", ["train"], 11.8542, 75.3735),
  p("stn-ckn", "Kozhikode", "CLT", "Kozhikode", "KL", "station", ["train"], 11.2473, 75.7752, ["calicut"]),
  p("stn-alld", "Alappuzha", "ALLP", "Alappuzha", "KL", "station", ["train"], 9.4907, 76.3358, ["alleppey"]),
  p("stn-jodh", "Jodhpur Junction", "JU", "Jodhpur", "RJ", "station", ["train"], 26.2966, 73.0243),
  p("stn-jsm", "Jaisalmer", "JSM", "Jaisalmer", "RJ", "station", ["train"], 26.9157, 70.9083),
  p("stn-sawa", "Sawai Madhopur", "SWM", "Sawai Madhopur", "RJ", "station", ["train"], 26.0173, 76.3506, ["ranthambore"]),
  p("stn-abr", "Abu Road", "ABR", "Abu Road", "RJ", "station", ["train"], 24.4816, 72.7811, ["mount abu"]),
  p("stn-ndb", "Nanded", "NED", "Nanded", "MH", "station", ["train"], 19.1383, 77.3210),
  p("stn-nk", "Nashik Road", "NK", "Nashik", "MH", "station", ["train"], 19.9475, 73.8390, ["shirdi"]),
  p("stn-cstn", "Chhatrapati Sambhajinagar", "AWB", "Aurangabad", "MH", "station", ["train"], 19.8874, 75.3385, ["aurangabad", "ellora"]),
  p("stn-kop", "Kolhapur (CSMT)", "KOP", "Kolhapur", "MH", "station", ["train"], 16.6947, 74.2433),
  p("stn-rn", "Ratnagiri", "RN", "Ratnagiri", "MH", "station", ["train"], 16.9902, 73.312, ["konkan"]),
  p("stn-kudl", "Kudal", "KUDL", "Kudal", "MH", "station", ["train"], 16.0104, 73.6892, ["tarkarli", "malvan"]),
  p("stn-ujn", "Ujjain Junction", "UJN", "Ujjain", "MP", "station", ["train"], 23.1765, 75.7885, ["mahakal"]),
  p("stn-jbp", "Jabalpur Junction", "JBP", "Jabalpur", "MP", "station", ["train"], 23.1685, 79.9339),
  p("stn-khjw", "Khajuraho", "KURJ", "Khajuraho", "MP", "station", ["train"], 24.8318, 79.9199),

  // —— Cities (bus + shared) ——
  p("city-blr", "Bengaluru", undefined, "Bengaluru", "KA", "city", ["bus", "train", "flight"], 12.9716, 77.5946, ["bangalore"]),
  p("city-del", "Delhi / NCR", undefined, "Delhi", "DL", "city", ["bus", "train", "flight"], 28.6139, 77.209, ["ncr", "new delhi", "gurgaon", "noida"]),
  p("city-bom", "Mumbai", undefined, "Mumbai", "MH", "city", ["bus", "train", "flight"], 19.076, 72.8777, ["bombay"]),
  p("city-maa", "Chennai", undefined, "Chennai", "TN", "city", ["bus", "train", "flight"], 13.0827, 80.2707, ["madras"]),
  p("city-hyd", "Hyderabad", undefined, "Hyderabad", "TS", "city", ["bus", "train", "flight"], 17.385, 78.4867),
  p("city-ccu", "Kolkata", undefined, "Kolkata", "WB", "city", ["bus", "train", "flight"], 22.5726, 88.3639, ["calcutta"]),
  p("city-pnq", "Pune", undefined, "Pune", "MH", "city", ["bus", "train", "flight"], 18.5204, 73.8567),
  p("city-goa", "Goa", undefined, "Goa", "GA", "city", ["bus", "train", "flight"], 15.2993, 74.124, ["panaji", "panjim"]),
  p("city-cok", "Kochi", undefined, "Kochi", "KL", "city", ["bus", "train", "flight"], 9.9312, 76.2673, ["cochin", "ernakulam"]),
  p("city-amd", "Ahmedabad", undefined, "Ahmedabad", "GJ", "city", ["bus", "train", "flight"], 23.0225, 72.5714),
  p("city-jai", "Jaipur", undefined, "Jaipur", "RJ", "city", ["bus", "train", "flight"], 26.9124, 75.7873),
  p("city-lko", "Lucknow", undefined, "Lucknow", "UP", "city", ["bus", "train", "flight"], 26.8467, 80.9462),
  p("city-ind", "Indore", undefined, "Indore", "MP", "city", ["bus", "train", "flight"], 22.7196, 75.8577),
  p("city-cbe", "Coimbatore", undefined, "Coimbatore", "TN", "city", ["bus", "train", "flight"], 11.0168, 76.9558),
  p("city-mys", "Mysuru", undefined, "Mysuru", "KA", "city", ["bus", "train"], 12.2958, 76.6394, ["mysore"]),
  p("city-mdu", "Madurai", undefined, "Madurai", "TN", "city", ["bus", "train", "flight"], 9.9252, 78.1198),
  p("city-viz", "Visakhapatnam", undefined, "Visakhapatnam", "AP", "city", ["bus", "train", "flight"], 17.6868, 83.2185, ["vizag"]),
  p("city-nag", "Nagpur", undefined, "Nagpur", "MH", "city", ["bus", "train", "flight"], 21.1458, 79.0882),
  p("city-sur", "Surat", undefined, "Surat", "GJ", "city", ["bus", "train"], 21.1702, 72.8311),
  p("city-vad", "Vadodara", undefined, "Vadodara", "GJ", "city", ["bus", "train", "flight"], 22.3072, 73.1812, ["baroda"]),
  p("city-chr", "Chandigarh", undefined, "Chandigarh", "CH", "city", ["bus", "train", "flight"], 30.7333, 76.7794),
  p("city-amn", "Amritsar", undefined, "Amritsar", "PB", "city", ["bus", "train", "flight"], 31.634, 74.8723),
  p("city-udi", "Udaipur", undefined, "Udaipur", "RJ", "city", ["bus", "train", "flight"], 24.5854, 73.7125),
  p("city-agr", "Agra", undefined, "Agra", "UP", "city", ["bus", "train"], 27.1767, 78.0081),
  p("city-vns", "Varanasi", undefined, "Varanasi", "UP", "city", ["bus", "train", "flight"], 25.3176, 82.9739, ["banaras", "kashi"]),
  p("city-rsh", "Rishikesh", undefined, "Rishikesh", "UK", "city", ["bus"], 30.0869, 78.2676),
  p("city-man", "Manali", undefined, "Manali", "HP", "city", ["bus"], 32.2396, 77.1887),
  p("city-shim", "Shimla", undefined, "Shimla", "HP", "city", ["bus"], 31.1048, 77.1734),
  p("city-pud", "Puducherry", undefined, "Puducherry", "PY", "city", ["bus"], 11.9416, 79.8083, ["pondicherry"]),
  p("city-oot", "Ooty", undefined, "Udhagamandalam", "TN", "city", ["bus"], 11.4102, 76.695, ["ooty", "udhagamandalam"]),
  p("city-hos", "Hosur", undefined, "Hosur", "TN", "city", ["bus"], 12.7409, 77.8253),

  // —— Destination towns ——
  // Hill stations, beaches, parks and pilgrimage towns: the places people actually name
  // when planning a trip. Most have no airport or railhead of their own — the journey
  // graph reaches them by finding the nearest gateway and adding a road last mile — so
  // they are road-reachable ("bus") unless the town itself has a station or strip.

  // Uttarakhand — Kumaon
  t("nainital", "Nainital", "UK", 29.3803, 79.4636, ["naini", "nainitaal", "naini tal"]),
  t("bhimtal", "Bhimtal", "UK", 29.3445, 79.5616),
  t("mukteshwar", "Mukteshwar", "UK", 29.4708, 79.6486),
  t("almora", "Almora", "UK", 29.5892, 79.6467),
  t("ranikhet", "Ranikhet", "UK", 29.6434, 79.4322),
  t("kausani", "Kausani", "UK", 29.8419, 79.6),
  t("binsar", "Binsar", "UK", 29.69, 79.75),
  t("munsiyari", "Munsiyari", "UK", 30.068, 80.238),
  t("pithoragarh", "Pithoragarh", "UK", 29.5833, 80.2167),
  t("corbett", "Jim Corbett (Ramnagar)", "UK", 29.3948, 79.1288, ["corbett", "ramnagar", "tiger reserve"], ["bus", "train"]),
  // Uttarakhand — Garhwal
  t("mussoorie", "Mussoorie", "UK", 30.4598, 78.0644, ["masuri"]),
  t("dhanaulti", "Dhanaulti", "UK", 30.4167, 78.2333),
  t("chakrata", "Chakrata", "UK", 30.7, 77.8667),
  t("lansdowne", "Lansdowne", "UK", 29.8377, 78.68),
  t("haridwar", "Haridwar", "UK", 29.9457, 78.1642, ["hardwar", "har ki pauri"], ["bus", "train"]),
  t("dehradun", "Dehradun", "UK", 30.3165, 78.0322, ["doon"], ["bus", "train", "flight"]),
  t("auli", "Auli", "UK", 30.53, 79.57, ["ski"]),
  t("joshimath", "Joshimath", "UK", 30.555, 79.5646),
  t("chopta", "Chopta", "UK", 30.49, 79.17, ["tungnath"]),
  t("badrinath", "Badrinath", "UK", 30.7433, 79.4938, ["char dham"]),
  t("kedarnath", "Kedarnath", "UK", 30.7346, 79.0669, ["char dham"]),
  t("gangotri", "Gangotri", "UK", 30.9947, 78.9398, ["char dham"]),
  t("yamunotri", "Yamunotri", "UK", 31.0133, 78.46, ["char dham"]),
  t("valleyofflowers", "Valley of Flowers (Govindghat)", "UK", 30.6167, 79.5667, ["govindghat", "hemkund"]),
  t("harsil", "Harsil", "UK", 31.0333, 78.7333),
  t("tehri", "Tehri", "UK", 30.39, 78.48, ["tehri lake"]),

  // Himachal Pradesh
  t("dharamshala", "Dharamshala", "HP", 32.219, 76.3234, ["dharamsala"], ["bus", "flight"]),
  t("mcleodganj", "McLeodganj", "HP", 32.2427, 76.3234, ["macleodganj", "mcleod ganj", "dalai lama"]),
  t("birbilling", "Bir Billing", "HP", 32.04, 76.72, ["bir", "paragliding"]),
  t("palampur", "Palampur", "HP", 32.1109, 76.5363),
  t("dalhousie", "Dalhousie", "HP", 32.5387, 75.9707),
  t("khajjiar", "Khajjiar", "HP", 32.55, 76.05),
  t("chamba", "Chamba", "HP", 32.556, 76.126),
  t("kasol", "Kasol", "HP", 32.01, 77.315, ["parvati valley"]),
  t("tosh", "Tosh", "HP", 32.0, 77.36),
  t("manikaran", "Manikaran", "HP", 32.0281, 77.345),
  t("kullu", "Kullu", "HP", 31.9578, 77.1092, [], ["bus", "flight"]),
  t("kasauli", "Kasauli", "HP", 30.8994, 76.9655),
  t("solan", "Solan", "HP", 30.9045, 77.0967),
  t("chail", "Chail", "HP", 30.9667, 77.1833),
  t("kufri", "Kufri", "HP", 31.0975, 77.2653),
  t("narkanda", "Narkanda", "HP", 31.25, 77.45),
  t("sangla", "Sangla", "HP", 31.43, 78.27, ["baspa"]),
  t("kalpa", "Kalpa", "HP", 31.54, 78.26, ["kinnaur"]),
  t("chitkul", "Chitkul", "HP", 31.35, 78.4333, ["last village"]),
  t("kaza", "Kaza (Spiti)", "HP", 32.226, 78.071, ["spiti", "spiti valley"]),
  t("tabo", "Tabo", "HP", 32.095, 78.38, ["spiti"]),
  t("mandi", "Mandi", "HP", 31.708, 76.932),
  t("tirthan", "Tirthan Valley (Jibhi)", "HP", 31.6167, 77.35, ["jibhi", "banjar", "shoja"]),

  // Jammu, Kashmir & Ladakh
  t("srinagar", "Srinagar", "JK", 34.0837, 74.7973, ["dal lake", "kashmir"], ["bus", "flight"]),
  t("gulmarg", "Gulmarg", "JK", 34.0484, 74.3805, ["gondola", "ski"]),
  t("pahalgam", "Pahalgam", "JK", 34.0159, 75.3318, ["betaab valley"]),
  t("sonamarg", "Sonamarg", "JK", 34.3, 75.3),
  t("leh", "Leh", "LA", 34.1526, 77.5771, ["ladakh"], ["bus", "flight"]),
  t("nubra", "Nubra Valley (Diskit)", "LA", 34.55, 77.55, ["diskit", "hunder"]),
  t("pangong", "Pangong Tso", "LA", 33.75, 78.8, ["pangong lake"]),
  t("tsomoriri", "Tso Moriri", "LA", 32.9, 78.3),
  t("kargil", "Kargil", "LA", 34.5539, 76.1349),
  t("padum", "Padum (Zanskar)", "LA", 33.4667, 76.8833, ["zanskar"]),
  t("jammu", "Jammu", "JK", 32.7266, 74.857, [], ["bus", "train", "flight"]),
  t("katra", "Katra (Vaishno Devi)", "JK", 32.9917, 74.9319, ["vaishno devi"], ["bus", "train"]),
  t("patnitop", "Patnitop", "JK", 33.0833, 75.3333),

  // Punjab, Haryana & NCR
  t("ludhiana", "Ludhiana", "PB", 30.901, 75.8573, [], ["bus", "train", "flight"]),
  t("jalandhar", "Jalandhar", "PB", 31.326, 75.5762, [], ["bus", "train"]),
  t("patiala", "Patiala", "PB", 30.3398, 76.3869, [], ["bus", "train"]),
  t("anandpursahib", "Anandpur Sahib", "PB", 31.239, 76.5025),
  t("pathankot", "Pathankot", "PB", 32.2643, 75.6421, [], ["bus", "train", "flight"]),
  t("kurukshetra", "Kurukshetra", "HR", 29.9695, 76.8783, [], ["bus", "train"]),
  t("gurugram", "Gurugram", "HR", 28.4595, 77.0266, ["gurgaon"], ["bus", "train"]),
  t("noida", "Noida", "UP", 28.5355, 77.391, [], ["bus"]),
  t("meerut", "Meerut", "UP", 28.9845, 77.7064, [], ["bus", "train"]),

  // Rajasthan
  t("jodhpur", "Jodhpur", "RJ", 26.2389, 73.0243, ["blue city"], ["bus", "train", "flight"]),
  t("jaisalmer", "Jaisalmer", "RJ", 26.9157, 70.9083, ["golden city", "sam dunes"], ["bus", "train", "flight"]),
  t("bikaner", "Bikaner", "RJ", 28.0229, 73.3119, [], ["bus", "train", "flight"]),
  t("pushkar", "Pushkar", "RJ", 26.4899, 74.5511),
  t("ajmer", "Ajmer", "RJ", 26.4499, 74.6399, ["dargah"], ["bus", "train"]),
  t("mountabu", "Mount Abu", "RJ", 24.5925, 72.7156, ["abu"]),
  t("chittorgarh", "Chittorgarh", "RJ", 24.8887, 74.6269, ["chittor"], ["bus", "train"]),
  t("bundi", "Bundi", "RJ", 25.4305, 75.6499),
  t("kota", "Kota", "RJ", 25.2138, 75.8648, [], ["bus", "train"]),
  t("ranthambore", "Ranthambore (Sawai Madhopur)", "RJ", 26.0173, 76.3506, ["sawai madhopur", "tiger"], ["bus", "train"]),
  t("alwar", "Alwar", "RJ", 27.553, 76.6346, ["sariska"], ["bus", "train"]),
  t("bharatpur", "Bharatpur", "RJ", 27.2152, 77.4977, ["keoladeo", "bird sanctuary"], ["bus", "train"]),
  t("kumbhalgarh", "Kumbhalgarh", "RJ", 25.1487, 73.5871),
  t("mandawa", "Mandawa (Shekhawati)", "RJ", 28.0553, 75.1478, ["shekhawati"]),
  t("neemrana", "Neemrana", "RJ", 27.9833, 76.3833),

  // Gujarat & Daman/Diu
  t("bhuj", "Bhuj", "GJ", 23.242, 69.6669, ["kutch"], ["bus", "train", "flight"]),
  t("rannofkutch", "Rann of Kutch (Dhordo)", "GJ", 23.95, 69.75, ["dhordo", "white rann", "rann utsav"]),
  t("somnath", "Somnath", "GJ", 20.888, 70.401, ["jyotirlinga"], ["bus", "train"]),
  t("dwarka", "Dwarka", "GJ", 22.2394, 68.9678, ["char dham"], ["bus", "train"]),
  t("gir", "Sasan Gir", "GJ", 21.1667, 70.6167, ["gir", "asiatic lion"]),
  t("diu", "Diu", "DD", 20.7144, 70.9874, [], ["bus", "flight"]),
  t("kevadia", "Statue of Unity (Kevadia)", "GJ", 21.838, 73.7191, ["statue of unity", "ekta nagar"], ["bus", "train"]),
  t("saputara", "Saputara", "GJ", 20.57, 73.75),
  t("rajkot", "Rajkot", "GJ", 22.3039, 70.8022, [], ["bus", "train", "flight"]),
  t("junagadh", "Junagadh", "GJ", 21.5222, 70.4579, ["girnar"], ["bus", "train"]),
  t("palitana", "Palitana", "GJ", 21.5222, 71.8231, ["shatrunjaya", "jain"]),
  t("modhera", "Modhera", "GJ", 23.5833, 72.1333, ["sun temple"]),

  // Maharashtra
  t("mahabaleshwar", "Mahabaleshwar", "MH", 17.9307, 73.6477),
  t("panchgani", "Panchgani", "MH", 17.9249, 73.8),
  t("lonavala", "Lonavala", "MH", 18.7546, 73.4062, ["khandala"], ["bus", "train"]),
  t("matheran", "Matheran", "MH", 18.9866, 73.2707, [], ["bus", "train"]),
  t("alibaug", "Alibaug", "MH", 18.6414, 72.8722, ["alibag"]),
  t("igatpuri", "Igatpuri", "MH", 19.6967, 73.5628, [], ["bus", "train"]),
  t("bhandardara", "Bhandardara", "MH", 19.5333, 73.75),
  t("tarkarli", "Tarkarli", "MH", 16.04, 73.47, ["malvan", "scuba"]),
  t("ganpatipule", "Ganpatipule", "MH", 17.145, 73.268),
  t("ratnagiri", "Ratnagiri", "MH", 16.9902, 73.312, ["konkan"], ["bus", "train"]),
  t("kolhapur", "Kolhapur", "MH", 16.705, 74.2433, ["mahalaxmi"], ["bus", "train", "flight"]),
  t("nashik", "Nashik", "MH", 19.9975, 73.7898, ["nasik", "vineyards", "sula"], ["bus", "train", "flight"]),
  t("shirdi", "Shirdi", "MH", 19.7645, 74.4762, ["sai baba"], ["bus", "train", "flight"]),
  t("aurangabad", "Chhatrapati Sambhajinagar", "MH", 19.8762, 75.3433, ["aurangabad"], ["bus", "train", "flight"]),
  t("ajanta", "Ajanta Caves", "MH", 20.5519, 75.7033),
  t("ellora", "Ellora Caves", "MH", 20.0268, 75.179),
  t("satara", "Satara", "MH", 17.6805, 74.0183, ["kaas plateau"], ["bus", "train"]),
  t("tadoba", "Tadoba", "MH", 20.2167, 79.3833, ["tiger reserve", "chandrapur"]),

  // Goa
  t("northgoa", "North Goa (Anjuna / Baga)", "GA", 15.5736, 73.74, ["anjuna", "baga", "calangute", "vagator"]),
  t("southgoa", "South Goa (Palolem)", "GA", 15.01, 74.0233, ["palolem", "agonda", "colva"]),

  // Karnataka
  t("coorg", "Coorg (Madikeri)", "KA", 12.4244, 75.7382, ["kodagu", "madikeri"]),
  t("chikmagalur", "Chikmagalur", "KA", 13.3161, 75.772, ["chikkamagaluru", "coffee"]),
  t("hampi", "Hampi", "KA", 15.335, 76.46, ["vijayanagara", "hospet"], ["bus", "train"]),
  t("badami", "Badami", "KA", 15.9149, 75.677, ["aihole", "pattadakal"], ["bus", "train"]),
  t("gokarna", "Gokarna", "KA", 14.5479, 74.3188, ["om beach"]),
  t("murudeshwar", "Murudeshwar", "KA", 14.0942, 74.4846, [], ["bus", "train"]),
  t("udupi", "Udupi", "KA", 13.3409, 74.7421, ["malpe"], ["bus", "train"]),
  t("sakleshpur", "Sakleshpur", "KA", 12.94, 75.78),
  t("kabini", "Kabini", "KA", 11.99, 76.34),
  t("bandipur", "Bandipur", "KA", 11.67, 76.63, ["tiger reserve"]),
  t("jogfalls", "Jog Falls", "KA", 14.229, 74.812),
  t("dandeli", "Dandeli", "KA", 15.2667, 74.6167),
  t("belur", "Belur & Halebidu", "KA", 13.1654, 75.8648, ["halebidu", "hoysala"]),
  t("hassan", "Hassan", "KA", 13.0072, 76.0962, [], ["bus", "train"]),
  t("shravanabelagola", "Shravanabelagola", "KA", 12.8556, 76.4875, ["gomateshwara"]),

  // Kerala
  t("munnar", "Munnar", "KL", 10.0889, 77.0595, ["tea"]),
  t("alleppey", "Alappuzha (Alleppey)", "KL", 9.4981, 76.3388, ["alleppey", "backwaters", "houseboat"], ["bus", "train"]),
  t("kumarakom", "Kumarakom", "KL", 9.6177, 76.43, ["backwaters"]),
  t("thekkady", "Thekkady (Kumily)", "KL", 9.6, 77.1667, ["periyar", "kumily"]),
  t("wayanad", "Wayanad (Kalpetta)", "KL", 11.6085, 76.0838, ["kalpetta", "vythiri"]),
  t("varkala", "Varkala", "KL", 8.7379, 76.7163, ["cliff beach"], ["bus", "train"]),
  t("kovalam", "Kovalam", "KL", 8.4004, 76.9787),
  t("thrissur", "Thrissur", "KL", 10.5276, 76.2144, ["pooram"], ["bus", "train"]),
  t("bekal", "Bekal", "KL", 12.39, 75.03, ["kasaragod"]),
  t("athirappilly", "Athirappilly Falls", "KL", 10.285, 76.57),
  t("vagamon", "Vagamon", "KL", 9.686, 76.905),
  t("kozhikode", "Kozhikode", "KL", 11.2588, 75.7804, ["calicut"], ["bus", "train", "flight"]),
  t("kannur", "Kannur", "KL", 11.8745, 75.3704, ["theyyam"], ["bus", "train", "flight"]),

  // Tamil Nadu
  t("kodaikanal", "Kodaikanal", "TN", 10.2381, 77.4892, ["kodai"]),
  t("coonoor", "Coonoor", "TN", 11.353, 76.7959, ["nilgiris"], ["bus", "train"]),
  t("yercaud", "Yercaud", "TN", 11.775, 78.2094),
  t("rameswaram", "Rameswaram", "TN", 9.2876, 79.3129, ["rameshwaram", "char dham"], ["bus", "train"]),
  t("kanyakumari", "Kanyakumari", "TN", 8.0883, 77.5385, ["cape comorin"], ["bus", "train"]),
  t("mahabalipuram", "Mahabalipuram", "TN", 12.6269, 80.1927, ["mamallapuram"]),
  t("thanjavur", "Thanjavur", "TN", 10.787, 79.1378, ["tanjore", "brihadeeswara"], ["bus", "train"]),
  t("kumbakonam", "Kumbakonam", "TN", 10.9617, 79.3881, [], ["bus", "train"]),
  t("karaikudi", "Karaikudi (Chettinad)", "TN", 10.0735, 78.7734, ["chettinad"], ["bus", "train"]),
  t("tiruvannamalai", "Tiruvannamalai", "TN", 12.2253, 79.0747, ["arunachala", "ramana"]),
  t("hogenakkal", "Hogenakkal Falls", "TN", 12.1167, 77.7833),
  t("dhanushkodi", "Dhanushkodi", "TN", 9.15, 79.4167),
  t("tranquebar", "Tranquebar (Tharangambadi)", "TN", 11.029, 79.851),
  t("velankanni", "Velankanni", "TN", 10.6833, 79.85),
  t("trichy", "Tiruchirappalli", "TN", 10.7905, 78.7047, ["trichy", "srirangam"], ["bus", "train", "flight"]),
  t("vellore", "Vellore", "TN", 12.9165, 79.1325, ["golden temple vellore"], ["bus", "train"]),

  // Andhra Pradesh & Telangana
  t("tirupati", "Tirupati", "AP", 13.6288, 79.4192, ["tirumala", "balaji", "venkateswara"], ["bus", "train", "flight"]),
  t("araku", "Araku Valley", "AP", 18.3273, 82.8787, [], ["bus", "train"]),
  t("srisailam", "Srisailam", "AP", 16.0833, 78.8667, ["jyotirlinga"]),
  t("gandikota", "Gandikota", "AP", 14.8137, 78.286, ["grand canyon of india"]),
  t("warangal", "Warangal", "TS", 17.9689, 79.5941, ["kakatiya", "ramappa"], ["bus", "train"]),
  t("nagarjunasagar", "Nagarjuna Sagar", "TS", 16.575, 79.3117),
  t("horsleyhills", "Horsley Hills", "AP", 13.66, 78.39),
  t("lepakshi", "Lepakshi", "AP", 13.806, 77.607),
  t("vijayawada", "Vijayawada", "AP", 16.5062, 80.648, [], ["bus", "train", "flight"]),
  t("rajahmundry", "Rajahmundry", "AP", 17.0005, 81.804, ["godavari"], ["bus", "train", "flight"]),

  // Madhya Pradesh & Chhattisgarh
  t("khajuraho", "Khajuraho", "MP", 24.8318, 79.9199, [], ["bus", "train", "flight"]),
  t("orchha", "Orchha", "MP", 25.3518, 78.64),
  t("pachmarhi", "Pachmarhi", "MP", 22.4675, 78.4336, ["satpura"]),
  t("bandhavgarh", "Bandhavgarh", "MP", 23.6961, 81.0264, ["tiger reserve", "umaria"]),
  t("kanha", "Kanha", "MP", 22.3345, 80.6115, ["tiger reserve"]),
  t("pench", "Pench", "MP", 21.7, 79.3, ["tiger reserve"]),
  t("sanchi", "Sanchi", "MP", 23.4793, 77.7398, ["stupa"], ["bus", "train"]),
  t("ujjain", "Ujjain", "MP", 23.1765, 75.7885, ["mahakal", "mahakaleshwar", "jyotirlinga"], ["bus", "train"]),
  t("omkareshwar", "Omkareshwar", "MP", 22.2447, 76.15, ["jyotirlinga"]),
  t("maheshwar", "Maheshwar", "MP", 22.1761, 75.5847),
  t("mandu", "Mandu", "MP", 22.333, 75.4, ["mandav"]),
  t("gwalior", "Gwalior", "MP", 26.2183, 78.1828, [], ["bus", "train", "flight"]),
  t("bhopal", "Bhopal", "MP", 23.2599, 77.4126, [], ["bus", "train", "flight"]),
  t("jabalpur", "Jabalpur", "MP", 23.1815, 79.9864, ["bhedaghat", "marble rocks"], ["bus", "train", "flight"]),
  t("amarkantak", "Amarkantak", "MP", 22.67, 81.76),
  t("jagdalpur", "Jagdalpur (Chitrakote)", "CG", 19.08, 81.95, ["chitrakote", "bastar"]),
  t("bilaspur", "Bilaspur", "CG", 22.0797, 82.1409, [], ["bus", "train"]),

  // Odisha
  t("puri", "Puri", "OD", 19.8135, 85.8312, ["jagannath"], ["bus", "train"]),
  t("konark", "Konark", "OD", 19.8876, 86.0945, ["sun temple"]),
  t("chilika", "Chilika Lake", "OD", 19.7167, 85.3167, ["satapada"]),
  t("gopalpur", "Gopalpur-on-Sea", "OD", 19.2667, 84.9167),
  t("daringbadi", "Daringbadi", "OD", 19.9, 84.13, ["kashmir of odisha"]),
  t("simlipal", "Simlipal", "OD", 21.9, 86.3),

  // West Bengal, Sikkim & the North-East
  t("darjeeling", "Darjeeling", "WB", 27.036, 88.2627, ["toy train", "tiger hill"]),
  t("kalimpong", "Kalimpong", "WB", 27.06, 88.47),
  t("kurseong", "Kurseong", "WB", 26.88, 88.28, [], ["bus", "train"]),
  t("siliguri", "Siliguri", "WB", 26.7271, 88.3953, ["njp", "bagdogra"], ["bus", "train", "flight"]),
  t("gangtok", "Gangtok", "SK", 27.3314, 88.6138, ["sikkim"], ["bus", "flight"]),
  t("pelling", "Pelling", "SK", 27.2996, 88.2396, ["west sikkim"]),
  t("lachung", "Lachung", "SK", 27.69, 88.74, ["yumthang", "north sikkim"]),
  t("ravangla", "Ravangla", "SK", 27.31, 88.36),
  t("namchi", "Namchi", "SK", 27.1667, 88.3667),
  t("zuluk", "Zuluk", "SK", 27.25, 88.78, ["silk route"]),
  t("shillong", "Shillong", "ML", 25.5788, 91.8933, ["meghalaya"], ["bus", "flight"]),
  t("cherrapunji", "Cherrapunji (Sohra)", "ML", 25.3, 91.7, ["sohra", "living root bridge"]),
  t("dawki", "Dawki", "ML", 25.19, 92.02, ["umngot"]),
  t("mawlynnong", "Mawlynnong", "ML", 25.2, 91.92, ["cleanest village"]),
  t("kaziranga", "Kaziranga", "AS", 26.5775, 93.1711, ["rhino", "national park"]),
  t("majuli", "Majuli", "AS", 26.95, 94.2, ["river island"]),
  t("tawang", "Tawang", "AR", 27.5861, 91.8594, ["monastery"]),
  t("ziro", "Ziro Valley", "AR", 27.5448, 93.832),
  t("dirang", "Dirang", "AR", 27.36, 92.24),
  t("bomdila", "Bomdila", "AR", 27.265, 92.4),
  t("kohima", "Kohima", "NL", 25.6751, 94.1086, ["hornbill", "nagaland"]),
  t("imphal", "Imphal", "MN", 24.817, 93.9368, ["loktak", "manipur"], ["bus", "flight"]),
  t("aizawl", "Aizawl", "MZ", 23.7271, 92.7176, ["mizoram"], ["bus", "flight"]),
  t("agartala", "Agartala", "TR", 23.8315, 91.2868, ["tripura"], ["bus", "train", "flight"]),
  t("sundarbans", "Sundarbans", "WB", 21.9497, 88.9, ["gosaba", "mangrove"]),
  t("digha", "Digha", "WB", 21.627, 87.507, [], ["bus", "train"]),
  t("mandarmani", "Mandarmani", "WB", 21.66, 87.7),
  t("shantiniketan", "Shantiniketan", "WB", 23.68, 87.68, ["bolpur", "tagore"], ["bus", "train"]),

  // Bihar, Jharkhand & Uttar Pradesh
  t("bodhgaya", "Bodh Gaya", "BR", 24.6961, 84.9869, ["bodhgaya", "mahabodhi"]),
  t("nalanda", "Nalanda", "BR", 25.1358, 85.4438),
  t("rajgir", "Rajgir", "BR", 25.028, 85.42, [], ["bus", "train"]),
  t("deoghar", "Deoghar", "JH", 24.4823, 86.6997, ["baidyanath", "jyotirlinga"], ["bus", "train", "flight"]),
  t("netarhat", "Netarhat", "JH", 23.47, 84.26),
  t("jamshedpur", "Jamshedpur", "JH", 22.8046, 86.2029, ["tatanagar"], ["bus", "train"]),
  t("mathura", "Mathura", "UP", 27.4924, 77.6737, ["krishna janmabhoomi"], ["bus", "train"]),
  t("vrindavan", "Vrindavan", "UP", 27.582, 77.7, ["banke bihari"]),
  t("ayodhya", "Ayodhya", "UP", 26.7922, 82.1998, ["ram mandir"], ["bus", "train", "flight"]),
  t("prayagraj", "Prayagraj", "UP", 25.4358, 81.8463, ["allahabad", "sangam", "kumbh"], ["bus", "train", "flight"]),
  t("sarnath", "Sarnath", "UP", 25.38, 83.02),
  t("jhansi", "Jhansi", "UP", 25.4484, 78.5685, [], ["bus", "train"]),
  t("kanpur", "Kanpur", "UP", 26.4499, 80.3319, [], ["bus", "train", "flight"]),
  t("gorakhpur", "Gorakhpur", "UP", 26.7606, 83.3732, [], ["bus", "train", "flight"]),
  t("kushinagar", "Kushinagar", "UP", 26.74, 83.89),
  t("bareilly", "Bareilly", "UP", 28.367, 79.4304, [], ["bus", "train", "flight"]),

  // Islands
  t("havelock", "Havelock (Swaraj Dweep)", "AN", 12.0167, 92.9833, ["swaraj dweep", "radhanagar"]),
  t("neilisland", "Neil Island (Shaheed Dweep)", "AN", 11.83, 93.03, ["shaheed dweep"]),
  t("kavaratti", "Kavaratti", "LD", 10.5669, 72.642, ["lakshadweep"]),
  t("agatti", "Agatti", "LD", 10.85, 72.1833, ["lakshadweep"], ["bus", "flight"]),
];

function norm(s: string): string {
  return s.toLowerCase().normalize("NFKD").replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * Levenshtein distance that gives up as soon as it passes `max`. Place names get
 * misspelled constantly ("nainitaal", "patnagar", "mahabaleshwar"), and an exact-substring
 * typeahead silently returns nothing — which reads as "this place isn't supported".
 */
function editDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur: number[] = [i];
    let rowBest = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (cur[j] < rowBest) rowBest = cur[j];
    }
    if (rowBest > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}

/** Typos to forgive at a given query length — too generous on short queries matches everything. */
function typoBudget(len: number): number {
  if (len <= 4) return 0;
  if (len <= 7) return 1;
  return 2;
}

/** Best edit distance from the query to a target, also trying the target's leading slice. */
function fuzzyDistance(q: string, target: string, budget: number): number {
  let best = editDistance(q, target, budget);
  if (best > budget && target.length > q.length) {
    best = Math.min(best, editDistance(q, target.slice(0, q.length), budget));
  }
  return best;
}

function scorePlace(place: TravelPlace, q: string): number {
  if (!q) return 0;
  const code = (place.code || "").toLowerCase();
  const name = norm(place.name);
  const city = norm(place.city);
  const aliases = (place.aliases || []).map(norm);
  if (code && code === q) return 1000;
  if (code && code.startsWith(q)) return 900 - q.length;
  if (city === q) return 800;
  if (city.startsWith(q)) return 700;
  if (name.startsWith(q)) return 650;
  if (aliases.some((a) => a === q)) return 780;
  if (aliases.some((a) => a.startsWith(q))) return 620;
  if (code && code.includes(q)) return 500;
  if (city.includes(q)) return 450;
  if (name.includes(q)) return 400;
  if (aliases.some((a) => a.includes(q))) return 380;

  // Nothing matched literally — fall back to near-miss spellings before giving up.
  const budget = typoBudget(q.length);
  if (budget > 0) {
    let best = budget + 1;
    for (const target of [city, name, ...aliases]) {
      if (!target) continue;
      best = Math.min(best, fuzzyDistance(q, target, budget));
      if (best === 0) break;
    }
    if (best <= budget) return 360 - best * 40;
  }

  if (place.state && norm(place.state).startsWith(q)) return 200;
  return 0;
}

/**
 * "any" is for journey planning, where a destination may legitimately be a town, an
 * airport or a railhead and filtering by a single mode just hides valid answers.
 */
export type SearchMode = TravelMode | "any";

export function searchPlaces(query: string, mode: SearchMode, limit = 8): TravelPlace[] {
  const q = norm(query);
  if (!q || q.length < 1) {
    // Popular defaults per mode
    const popularIds =
      mode === "flight"
        ? ["apt-blr", "apt-del", "apt-bom", "apt-maa", "apt-hyd", "apt-ccu", "apt-goi", "apt-pnq"]
        : mode === "train"
          ? ["stn-sbc", "stn-ndls", "stn-cstm", "stn-mas", "stn-sc", "stn-hwh", "stn-pune", "stn-adi"]
          : mode === "any"
            ? ["dst-nainital", "city-man", "city-goa", "dst-leh", "dst-munnar", "dst-darjeeling", "dst-jaisalmer", "city-rsh"]
            : ["city-blr", "city-del", "city-bom", "city-maa", "city-hyd", "city-pnq", "city-goa", "city-mys"];
    return popularIds.map((id) => TRAVEL_PLACES.find((x) => x.id === id)!).filter(Boolean).slice(0, limit);
  }

  return TRAVEL_PLACES.filter((pl) => mode === "any" || pl.modes.includes(mode))
    .map((pl) => ({ pl, score: scorePlace(pl, q) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.pl.city.localeCompare(b.pl.city))
    .slice(0, limit)
    .map((x) => x.pl);
}

export function placeLabel(place: TravelPlace): string {
  if (place.code) return `${place.city} (${place.code})`;
  return place.city;
}

export function placeSubLabel(place: TravelPlace): string {
  const bits = [place.name];
  if (place.state) bits.push(place.state);
  if (place.kind === "airport") bits.push("Airport");
  if (place.kind === "station") bits.push("Station");
  return bits.join(" · ");
}

export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Resolve free text / code to a place for the mode (best match). */
export function resolvePlace(input: string, mode: SearchMode): TravelPlace | null {
  const raw = input.trim();
  if (!raw) return null;
  const inMode = (pl: TravelPlace) => mode === "any" || pl.modes.includes(mode);
  // "Bengaluru (BLR)" / "Delhi (DEL)"
  const paren = raw.match(/\(([A-Za-z]{2,5})\)\s*$/);
  if (paren) {
    const byCode = TRAVEL_PLACES.find(
      (pl) => inMode(pl) && pl.code && pl.code.toLowerCase() === paren[1].toLowerCase()
    );
    if (byCode) return byCode;
  }
  const q = norm(raw);
  const byCode = TRAVEL_PLACES.find((pl) => inMode(pl) && pl.code && pl.code.toLowerCase() === q);
  if (byCode) return byCode;
  const hits = searchPlaces(raw.replace(/\([^)]*\)/g, " "), mode, 1);
  return hits[0] ?? null;
}
