/**
 * Destination guides that turn "I'm going to Nainital" into an actual day plan.
 *
 * Curated entries carry real attractions with time-on-site, so the packer can group
 * nearby things into a day and respect sunrise/sunset timing. Destinations without an
 * entry still get a plan from the generic skeleton in buildItinerary — clearly labelled
 * as such, because a made-up list of "attractions" would be worse than an honest outline.
 */

export type AttractionKind =
  | "sight"
  | "nature"
  | "trek"
  | "temple"
  | "market"
  | "food"
  | "museum"
  | "viewpoint"
  | "water"
  | "wildlife"
  | "adventure"
  /** Deliberate downtime the plan must protect — altitude acclimatisation, mostly. */
  | "rest";

export type TimeSlot = "sunrise" | "morning" | "midday" | "afternoon" | "sunset" | "evening";

export const SLOT_ORDER: TimeSlot[] = ["sunrise", "morning", "midday", "afternoon", "sunset", "evening"];

export type Attraction = {
  name: string;
  kind: AttractionKind;
  /** Time on site including local hopping, in minutes. */
  minutes: number;
  /** Things sharing a zone get packed into the same day so you aren't criss-crossing. */
  zone?: string;
  /** Honoured where the day has room — a sunrise point is worthless at 3pm. */
  slot?: TimeSlot;
  /** Entry / activity cost per adult. */
  costInr?: number;
  note?: string;
  /** 1 = unmissable. Decides what survives when the trip is short. */
  priority?: 1 | 2 | 3;
};

export type DayTrip = {
  name: string;
  hours: number;
  costInr?: number;
  note: string;
};

export type DestinationGuide = {
  placeId: string;
  vibe: string;
  minNights: number;
  idealNights: number;
  /** Calendar months (1–12) worth going. */
  bestMonths: number[];
  avoidMonths?: number[];
  avoidNote?: string;
  localTransport: string;
  /** Rough on-ground spend per adult per day: entries, local transport, food. Excludes hotel. */
  dailyBudgetInr: number;
  attractions: Attraction[];
  dayTrips?: DayTrip[];
  eat?: string[];
  tips?: string[];
};

const g = (guide: DestinationGuide): DestinationGuide => guide;

export const DESTINATION_GUIDES: readonly DestinationGuide[] = [
  // ——————————————————————————— Uttarakhand ———————————————————————————
  g({
    placeId: "dst-nainital",
    vibe: "Colonial lake town in the Kumaon hills — a walkable Mall Road, boating on the lake, and viewpoints over the Himalayan skyline.",
    minNights: 2,
    idealNights: 3,
    bestMonths: [3, 4, 5, 6, 9, 10, 11],
    avoidMonths: [7, 8],
    avoidNote: "July–August is peak monsoon: landslides on the Kathgodam ghat and permanently fogged viewpoints.",
    localTransport: "The Mall is walkable end to end. Shared taxis leave from Tallital for Bhimtal and Mukteshwar; a full-day cab for the lake circuit runs ₹2,000–2,800.",
    dailyBudgetInr: 1400,
    attractions: [
      { name: "Naini Lake boating", kind: "water", minutes: 60, zone: "Mall", slot: "morning", costInr: 300, priority: 1, note: "Yellow-sail boats from Mallital ghat; rowers charge per boat, not per head." },
      { name: "Naina Devi Temple", kind: "temple", minutes: 40, zone: "Mall", slot: "morning", priority: 2 },
      { name: "Mall Road & Tibetan Market", kind: "market", minutes: 90, zone: "Mall", slot: "evening", priority: 2, note: "Closed to vehicles in the evening — that's the nicest time to walk it." },
      { name: "Snow View Point (ropeway)", kind: "viewpoint", minutes: 90, zone: "Mall", slot: "morning", costInr: 350, priority: 1, note: "Ropeway queues get long after 10am; tickets are timed." },
      { name: "Tiffin Top (Dorothy's Seat)", kind: "trek", minutes: 150, zone: "Ayarpatta", slot: "morning", priority: 2, note: "Walk up from Barapathar, or ride a pony most of the way." },
      { name: "Naina Peak", kind: "trek", minutes: 240, zone: "Ayarpatta", slot: "sunrise", priority: 3, note: "Highest point above the lake — about 6 km round trip from Mallital." },
      { name: "Eco Cave Gardens", kind: "sight", minutes: 60, zone: "Mallital", costInr: 120, priority: 3, note: "Best with kids; otherwise skippable." },
      { name: "Sunset at Hanuman Garhi", kind: "viewpoint", minutes: 60, zone: "Outskirts", slot: "sunset", priority: 1 },
      { name: "Pangot birding trail", kind: "nature", minutes: 240, zone: "Pangot", slot: "sunrise", priority: 3, note: "15 km out; serious Himalayan birding with a local guide." },
    ],
    dayTrips: [
      { name: "Lake circuit — Bhimtal, Sattal & Naukuchiatal", hours: 7, costInr: 2500, note: "Quieter, lower and warmer than Naini; Sattal is the pick for kayaking." },
      { name: "Mukteshwar", hours: 8, costInr: 3000, note: "Cliff-edge temple and the clearest Nanda Devi views in the region." },
      { name: "Jim Corbett day safari", hours: 10, costInr: 5000, note: "Doable but rushed — better as a separate 2-night stop." },
    ],
    eat: ["Machan and Sakley's on the Mall for old-school hill-station dining", "Chandni Chowk for cheap chole bhature", "Bakethi / Sakley's bakery for rum balls"],
    tips: [
      "Vehicles are barred from the Mall in the evening; park at Sukhatal and walk in.",
      "Book the Snow View ropeway online — the counter queue can be an hour in season.",
      "Most hotels are on a steep slope above the lake; ask how many steps from the road before booking.",
    ],
  }),
  g({
    placeId: "dst-corbett",
    vibe: "India's oldest tiger reserve — safari zones along the Ramganga, with resorts strung along the river outside Ramnagar.",
    minNights: 2,
    idealNights: 3,
    bestMonths: [11, 12, 1, 2, 3, 4, 5, 6],
    avoidMonths: [7, 8, 9],
    avoidNote: "Core zones (Dhikala, Bijrani) close mid-June to mid-November for the monsoon; only buffer zones stay open.",
    localTransport: "Everything runs on booked safari jeeps. Resorts arrange them; independent booking is through the official Uttarakhand forest portal.",
    dailyBudgetInr: 4000,
    attractions: [
      { name: "Dhikala zone jeep safari", kind: "wildlife", minutes: 240, zone: "Core", slot: "sunrise", costInr: 6000, priority: 1, note: "The classic zone — grasslands and the best tiger odds. Day visits need a permit booked well ahead." },
      { name: "Bijrani zone safari", kind: "wildlife", minutes: 210, zone: "Core", slot: "sunrise", costInr: 5000, priority: 1 },
      { name: "Jhirna / Dhela buffer safari", kind: "wildlife", minutes: 210, zone: "Buffer", slot: "afternoon", costInr: 4500, priority: 2, note: "Open year-round, so this is the monsoon fallback." },
      { name: "Corbett Museum, Kaladhungi", kind: "museum", minutes: 60, zone: "Kaladhungi", costInr: 100, priority: 3, note: "Jim Corbett's own winter house, 25 km from Ramnagar." },
      { name: "Garjiya Devi Temple", kind: "temple", minutes: 60, zone: "Ramnagar", slot: "evening", priority: 3, note: "Temple on a rock in the Kosi riverbed." },
      { name: "Riverside evening by the Kosi", kind: "nature", minutes: 90, zone: "Ramnagar", slot: "sunset", priority: 2 },
    ],
    tips: [
      "Safari permits are released online 45 days ahead and Dhikala sells out within minutes.",
      "Morning safaris see far more than afternoon ones — take the dawn slot if you only do one.",
      "Carry an ID matching the permit exactly; the gate turns people away over name mismatches.",
    ],
  }),
  g({
    placeId: "dst-mussoorie",
    vibe: "The Queen of the Hills — a long ridge above Dehradun with Doon-valley views, a busy Mall and quieter corners at Landour.",
    minNights: 2,
    idealNights: 3,
    bestMonths: [3, 4, 5, 6, 9, 10, 11],
    avoidMonths: [7, 8],
    localTransport: "Mall Road is walkable; Landour is a steep 3 km climb, so take an auto up and walk down.",
    dailyBudgetInr: 1500,
    attractions: [
      { name: "Camel's Back Road walk", kind: "nature", minutes: 90, zone: "Mall", slot: "sunset", priority: 1, note: "3 km traffic-free loop; the sunset over the Doon valley is the reason to time it late." },
      { name: "Gun Hill ropeway", kind: "viewpoint", minutes: 75, zone: "Mall", costInr: 200, priority: 2 },
      { name: "Landour — Char Dukan & Sisters' Bazaar", kind: "food", minutes: 180, zone: "Landour", slot: "morning", priority: 1, note: "Ruskin Bond's neighbourhood; quiet deodar lanes and the best breakfast in town." },
      { name: "Lal Tibba viewpoint", kind: "viewpoint", minutes: 60, zone: "Landour", slot: "morning", priority: 2, note: "Highest point in Mussoorie — on a clear morning you see the Bandarpunch range." },
      { name: "Kempty Falls", kind: "water", minutes: 120, zone: "West", priority: 3, note: "Famous but genuinely overcrowded; go at opening or skip it." },
      { name: "Company Garden", kind: "sight", minutes: 75, zone: "West", costInr: 50, priority: 3 },
      { name: "George Everest's House", kind: "sight", minutes: 150, zone: "West", slot: "afternoon", priority: 2, note: "Surveyor's ruin on a ridge with valley-on-both-sides views." },
    ],
    dayTrips: [
      { name: "Dhanaulti & Eco Park", hours: 6, costInr: 2500, note: "Deodar forest, much quieter than Mussoorie itself." },
      { name: "Rishikesh", hours: 8, costInr: 3000, note: "Ganga aarti at Triveni Ghat if you leave by mid-afternoon." },
    ],
    eat: ["Char Dukan at Landour for parathas and ginger-lemon-honey", "Landour Bakehouse for peanut butter and pastries", "Kalsang on the Mall for Tibetan"],
    tips: ["Mussoorie is a one-road town and it gridlocks on summer weekends — arrive on a weekday if you can."],
  }),
  g({
    placeId: "city-rsh",
    vibe: "Ganga-side yoga and rafting town in the Garhwal foothills — ashrams and cafés on one bank, rapids upstream.",
    minNights: 2,
    idealNights: 3,
    bestMonths: [2, 3, 4, 5, 9, 10, 11],
    avoidMonths: [7, 8],
    avoidNote: "Rafting shuts during the monsoon when the Ganga runs too high.",
    localTransport: "Tapovan and Laxman Jhula are walkable; autos and shared vikrams cover the 5 km to Ram Jhula and the main town.",
    dailyBudgetInr: 1500,
    attractions: [
      { name: "Ganga aarti at Parmarth Niketan", kind: "temple", minutes: 90, zone: "Ram Jhula", slot: "sunset", priority: 1, note: "The big one, at Triveni Ghat; arrive 30 min early for a seat on the steps." },
      { name: "White-water rafting, Shivpuri to Rishikesh", kind: "adventure", minutes: 240, zone: "Upstream", slot: "morning", costInr: 1200, priority: 1, note: "16 km stretch with Grade III rapids — the standard run." },
      { name: "Laxman Jhula & Tera Manzil Temple", kind: "sight", minutes: 90, zone: "Laxman Jhula", priority: 2 },
      { name: "Beatles Ashram (Chaurasi Kutia)", kind: "sight", minutes: 120, zone: "Swarg Ashram", slot: "morning", costInr: 600, priority: 2, note: "Abandoned meditation domes covered in murals." },
      { name: "Neelkanth Mahadev Temple", kind: "temple", minutes: 210, zone: "Hills", priority: 3, note: "32 km of hairpins up from Ram Jhula." },
      { name: "Morning yoga class", kind: "sight", minutes: 90, zone: "Tapovan", slot: "sunrise", costInr: 400, priority: 2 },
      { name: "Bungee jump at Jumpin Heights", kind: "adventure", minutes: 180, zone: "Mohanchatti", costInr: 3700, priority: 3, note: "India's highest fixed-platform jump at 83 m." },
    ],
    eat: ["Little Buddha Café above Laxman Jhula", "The Sitting Elephant for river views", "Chotiwala at Ram Jhula for the old-school thali"],
    tips: ["Rishikesh is dry and strictly vegetarian — no alcohol or meat anywhere in town."],
  }),

  // ——————————————————————————— Himachal & the north ———————————————————————————
  g({
    placeId: "city-man",
    vibe: "Beas-valley base camp — old Manali's orchards and temples below, snow passes and Solang adventure sports above.",
    minNights: 3,
    idealNights: 4,
    bestMonths: [3, 4, 5, 6, 9, 10],
    avoidMonths: [7, 8],
    localTransport: "Old Manali and Mall Road are walkable. Rohtang and Solang need a booked cab; Rohtang also needs a permit.",
    dailyBudgetInr: 2000,
    attractions: [
      { name: "Hadimba Devi Temple", kind: "temple", minutes: 60, zone: "Old Manali", slot: "morning", priority: 1, note: "Four-tiered cedar pagoda in a deodar grove." },
      { name: "Old Manali cafés & Manu Temple", kind: "food", minutes: 150, zone: "Old Manali", priority: 2 },
      { name: "Vashisht hot springs", kind: "nature", minutes: 90, zone: "Vashisht", priority: 2 },
      { name: "Solang Valley activities", kind: "adventure", minutes: 300, zone: "Solang", slot: "morning", costInr: 2500, priority: 1, note: "Paragliding, ropeway and zorbing; 13 km up the valley." },
      { name: "Atal Tunnel & Sissu", kind: "sight", minutes: 360, zone: "Lahaul", slot: "morning", costInr: 4000, priority: 1, note: "9 km tunnel into Lahaul — Sissu's waterfall and the Chandra valley on the far side." },
      { name: "Rohtang Pass", kind: "sight", minutes: 420, zone: "Rohtang", slot: "sunrise", costInr: 4500, priority: 2, note: "Needs an online permit, capped daily and closed Tuesdays." },
      { name: "Jogini Falls trek", kind: "trek", minutes: 180, zone: "Vashisht", slot: "morning", priority: 3 },
      { name: "Mall Road evening", kind: "market", minutes: 90, zone: "Manali", slot: "evening", priority: 3 },
    ],
    dayTrips: [
      { name: "Naggar Castle & Roerich Gallery", hours: 5, costInr: 2000, note: "Medieval timber castle 20 km down valley." },
      { name: "Kasol & Manikaran", hours: 8, costInr: 3500, note: "Parvati valley hot springs and the gurudwara." },
    ],
    tips: [
      "Rohtang permits are issued online and sell out days ahead in peak season.",
      "Old Manali is the café-and-hostel side; Mall Road is the family-hotel side — they're a 20-minute walk apart.",
    ],
  }),
  g({
    placeId: "dst-kasol",
    vibe: "Parvati-valley river town of Israeli cafés and pine forest — the trailhead for Kheerganga and Tosh.",
    minNights: 2,
    idealNights: 3,
    bestMonths: [3, 4, 5, 6, 9, 10, 11],
    avoidMonths: [7, 8],
    localTransport: "Kasol is a two-street walk. Shared cabs and HRTC buses run up to Tosh and Manikaran through the day.",
    dailyBudgetInr: 1400,
    attractions: [
      { name: "Manikaran Sahib hot springs", kind: "temple", minutes: 150, zone: "Manikaran", priority: 1, note: "Gurudwara over natural hot springs; free langar cooked in the spring water." },
      { name: "Chalal village riverside walk", kind: "nature", minutes: 120, zone: "Kasol", slot: "afternoon", priority: 2, note: "Easy 30-minute forest walk across the river." },
      { name: "Kheerganga trek", kind: "trek", minutes: 600, zone: "Barshaini", slot: "sunrise", costInr: 1500, priority: 1, note: "12 km round trip to a hot spring at 3,050 m — most people overnight at the top." },
      { name: "Tosh village", kind: "nature", minutes: 300, zone: "Tosh", priority: 2, note: "Last village up the valley; the terrace views are the point." },
      { name: "Kasol riverside cafés", kind: "food", minutes: 120, zone: "Kasol", slot: "evening", priority: 2 },
    ],
    tips: ["Charas is everywhere in the Parvati valley and it is illegal — police checkpoints on the Bhuntar road are routine."],
  }),
  g({
    placeId: "dst-mcleodganj",
    vibe: "The Dalai Lama's town above Dharamshala — Tibetan monasteries, momos and the Triund ridge behind.",
    minNights: 2,
    idealNights: 3,
    bestMonths: [3, 4, 5, 6, 9, 10, 11],
    avoidMonths: [7, 8],
    localTransport: "Walkable core; autos to Bhagsu and Dharamkot, cabs down to Dharamshala and the cricket stadium.",
    dailyBudgetInr: 1400,
    attractions: [
      { name: "Tsuglagkhang Complex & Dalai Lama Temple", kind: "temple", minutes: 120, zone: "Town", slot: "morning", priority: 1, note: "Includes the Tibet Museum — worth the full hour." },
      { name: "Bhagsunag Temple & waterfall", kind: "water", minutes: 150, zone: "Bhagsu", priority: 2 },
      { name: "Triund trek", kind: "trek", minutes: 480, zone: "Dharamkot", slot: "sunrise", priority: 1, note: "9 km round trip to a 2,875 m ridge facing the Dhauladhar wall." },
      { name: "Namgyal Monastery debate courtyard", kind: "temple", minutes: 60, zone: "Town", slot: "afternoon", priority: 2, note: "Monks debate most afternoons — ask at the gate for the day's timing." },
      { name: "St John in the Wilderness", kind: "sight", minutes: 60, zone: "Forsyth Ganj", priority: 3, note: "Neo-Gothic stone church in a deodar forest." },
      { name: "Dharamkot & Naddi sunset point", kind: "viewpoint", minutes: 120, zone: "Dharamkot", slot: "sunset", priority: 2 },
    ],
    eat: ["Tibet Kitchen for thukpa and momos", "Common Ground Café", "Moonpeak Espresso on Temple Road"],
  }),
  g({
    placeId: "dst-leh",
    vibe: "High-desert Ladakh at 3,500 m — monasteries on ridges, the Indus valley, and the passes to Nubra and Pangong.",
    minNights: 5,
    idealNights: 7,
    bestMonths: [5, 6, 7, 8, 9],
    avoidMonths: [11, 12, 1, 2, 3],
    avoidNote: "The Manali and Srinagar highways close with snow from about November to May; winter access is by air only.",
    localTransport: "Taxis run on a fixed union rate card — no bargaining. Bikes rent everywhere but only Ladakh-registered ones may go to Nubra and Pangong.",
    dailyBudgetInr: 3500,
    attractions: [
      { name: "Acclimatisation day in Leh", kind: "rest", minutes: 480, zone: "Leh", priority: 1, note: "Non-negotiable. Do nothing strenuous for the first 24–36 hours or the rest of the trip is ruined." },
      { name: "Leh Palace & Namgyal Tsemo", kind: "sight", minutes: 150, zone: "Leh", slot: "afternoon", costInr: 300, priority: 2 },
      { name: "Shanti Stupa at sunset", kind: "viewpoint", minutes: 90, zone: "Leh", slot: "sunset", priority: 1 },
      { name: "Thiksey Monastery morning prayers", kind: "temple", minutes: 120, zone: "Indus valley", slot: "sunrise", costInr: 100, priority: 1, note: "Prayers start around 6:30am — the best hour in Ladakh." },
      { name: "Hemis & Shey monasteries", kind: "temple", minutes: 180, zone: "Indus valley", slot: "morning", costInr: 200, priority: 2 },
      { name: "Nubra Valley via Khardung La", kind: "sight", minutes: 600, zone: "Nubra", slot: "morning", costInr: 8000, priority: 1, note: "Overnight at Hunder for the sand dunes and double-humped camels." },
      { name: "Pangong Tso", kind: "nature", minutes: 660, zone: "Pangong", slot: "sunrise", costInr: 9000, priority: 1, note: "Best as an overnight — the lake changes colour through the day and the drive back is brutal." },
      { name: "Magnetic Hill & Sangam", kind: "sight", minutes: 240, zone: "West", priority: 3, note: "Indus–Zanskar confluence; pairs with Alchi and Likir." },
      { name: "Leh Main Bazaar", kind: "market", minutes: 90, zone: "Leh", slot: "evening", priority: 3 },
    ],
    tips: [
      "Inner Line Permits are needed for Nubra, Pangong and Tso Moriri — get them online or at the DC office in Leh.",
      "Fly in and you land at 3,500 m from sea level in two hours; altitude sickness is common and occasionally serious.",
      "ATMs in Leh run dry in peak season and there is no mobile signal on most of the Pangong route.",
    ],
  }),
  g({
    placeId: "dst-srinagar",
    vibe: "Dal Lake houseboats, Mughal gardens and the old city — plus the launch point for Gulmarg, Pahalgam and Sonamarg.",
    minNights: 3,
    idealNights: 5,
    bestMonths: [4, 5, 6, 7, 8, 9, 10],
    localTransport: "Shikaras on the lake, autos in the city, and fixed-rate taxi stands for the day trips out to Gulmarg and Pahalgam.",
    dailyBudgetInr: 2500,
    attractions: [
      { name: "Shikara ride on Dal Lake", kind: "water", minutes: 120, zone: "Dal", slot: "sunset", costInr: 800, priority: 1 },
      { name: "Houseboat night on the Dal", kind: "sight", minutes: 120, zone: "Dal", slot: "evening", priority: 1, note: "Staying on one at least a night is the whole point of Srinagar." },
      { name: "Mughal gardens — Nishat & Shalimar", kind: "sight", minutes: 180, zone: "East bank", slot: "morning", costInr: 100, priority: 1 },
      { name: "Floating vegetable market", kind: "market", minutes: 120, zone: "Dal", slot: "sunrise", priority: 2, note: "Trades at dawn and is done by about 7am." },
      { name: "Jamia Masjid & old city walk", kind: "sight", minutes: 180, zone: "Old city", slot: "morning", priority: 2, note: "Wooden pillared mosque; pairs with Shah-e-Hamdan and the Khanqah." },
      { name: "Pari Mahal & Chashme Shahi", kind: "viewpoint", minutes: 120, zone: "East bank", slot: "sunset", priority: 3 },
      { name: "Hazratbal Shrine", kind: "temple", minutes: 90, zone: "North bank", priority: 3 },
    ],
    dayTrips: [
      { name: "Gulmarg & the gondola", hours: 9, costInr: 3500, note: "Phase 2 of the gondola reaches 3,980 m on Apharwat — book online, it sells out." },
      { name: "Pahalgam & Betaab Valley", hours: 10, costInr: 4000, note: "Aru and Chandanwari need a separate local taxi from Pahalgam." },
      { name: "Sonamarg & Thajiwas glacier", hours: 10, costInr: 4500, note: "Closed through winter." },
    ],
    tips: ["Mobile internet is occasionally suspended in the valley — download maps and tickets before you arrive."],
  }),

  // ——————————————————————————— East & North-East ———————————————————————————
  g({
    placeId: "dst-darjeeling",
    vibe: "Tea-garden ridge town with a toy train, Kanchenjunga at sunrise, and Tibetan-Nepali food.",
    minNights: 2,
    idealNights: 3,
    bestMonths: [3, 4, 5, 10, 11, 12],
    avoidMonths: [6, 7, 8],
    avoidNote: "The monsoon is heavy here and landslides regularly close the Hill Cart Road.",
    localTransport: "Chowrasta and the Mall are walkable; shared jeeps from the motor stand cover Ghum, Mirik and Kalimpong.",
    dailyBudgetInr: 1600,
    attractions: [
      { name: "Tiger Hill sunrise", kind: "viewpoint", minutes: 180, zone: "Ghum", slot: "sunrise", costInr: 1500, priority: 1, note: "Leave around 4am. On a clear morning you get Kanchenjunga and, rarely, Everest." },
      { name: "Darjeeling Himalayan Railway joyride", kind: "sight", minutes: 150, zone: "Ghum", slot: "morning", costInr: 1600, priority: 1, note: "Steam joyride to Ghum and back via the Batasia Loop — book ahead." },
      { name: "Happy Valley Tea Estate", kind: "nature", minutes: 120, zone: "West", slot: "morning", costInr: 200, priority: 2, note: "Closed Mondays and on Sunday afternoons." },
      { name: "Padmaja Naidu Himalayan Zoological Park & HMI", kind: "museum", minutes: 180, zone: "North", costInr: 250, priority: 2, note: "Snow leopards and red pandas, plus the Himalayan Mountaineering Institute museum on one ticket." },
      { name: "Chowrasta & Mall Road", kind: "market", minutes: 120, zone: "Town", slot: "evening", priority: 2 },
      { name: "Japanese Peace Pagoda", kind: "temple", minutes: 90, zone: "Town", slot: "sunset", priority: 3 },
      { name: "Ghum Monastery", kind: "temple", minutes: 60, zone: "Ghum", priority: 3 },
    ],
    dayTrips: [
      { name: "Mirik Lake", hours: 7, costInr: 3000, note: "Tea gardens and a lake on the Nepal border road." },
      { name: "Kalimpong", hours: 8, costInr: 3500, note: "Flower nurseries, Deolo Hill and a quieter feel than Darjeeling." },
    ],
    eat: ["Glenary's for bakery and a window seat", "Keventer's rooftop for breakfast", "Kunga for Tibetan"],
  }),
  g({
    placeId: "dst-gangtok",
    vibe: "Sikkim's tidy hillside capital — a pedestrian high street, monasteries nearby, and the road north to Lachung.",
    minNights: 3,
    idealNights: 5,
    bestMonths: [3, 4, 5, 9, 10, 11],
    avoidMonths: [6, 7, 8],
    localTransport: "MG Marg is pedestrian-only. Everything outside town runs on shared or reserved jeeps booked a day ahead.",
    dailyBudgetInr: 2200,
    attractions: [
      { name: "MG Marg evening", kind: "market", minutes: 90, zone: "Town", slot: "evening", priority: 1, note: "Traffic-free, litter-free boulevard — the town's living room." },
      { name: "Rumtek Monastery", kind: "temple", minutes: 210, zone: "Rumtek", slot: "morning", priority: 1, note: "Seat of the Karmapa, 24 km out; carry ID for the security check." },
      { name: "Tsomgo Lake & Baba Mandir", kind: "nature", minutes: 420, zone: "East", slot: "morning", costInr: 4000, priority: 1, note: "Glacial lake at 3,750 m; needs a permit arranged by your operator the day before." },
      { name: "Nathula Pass", kind: "sight", minutes: 480, zone: "East", slot: "sunrise", costInr: 5500, priority: 2, note: "Indian nationals only, closed Mondays and Tuesdays, separate permit." },
      { name: "Enchey Monastery", kind: "temple", minutes: 75, zone: "Town", priority: 3 },
      { name: "Banjhakri Falls & Ropeway", kind: "sight", minutes: 150, zone: "Town", costInr: 350, priority: 3 },
      { name: "Namgyal Institute of Tibetology", kind: "museum", minutes: 90, zone: "Town", costInr: 100, priority: 2 },
    ],
    dayTrips: [
      { name: "Lachung & Yumthang Valley", hours: 30, costInr: 9000, note: "A 2-night trip, not a day trip — the valley of flowers is 6 hours north." },
      { name: "Pelling & Pemayangtse", hours: 10, costInr: 5000, note: "West Sikkim; better as an overnight for the Kanchenjunga views." },
    ],
    tips: ["Sikkim requires permits for Tsomgo, Nathula and North Sikkim — all are arranged through registered local operators, so book before you arrive."],
  }),
  g({
    placeId: "dst-shillong",
    vibe: "Khasi hill capital with pine ridges and a live-music habit — and the base for Cherrapunji's waterfalls and root bridges.",
    minNights: 3,
    idealNights: 4,
    bestMonths: [10, 11, 12, 2, 3, 4],
    avoidMonths: [6, 7, 8],
    avoidNote: "This is among the wettest places on earth — June to August is relentless.",
    localTransport: "Shared taxis run set routes in town for a flat fare; reserve a cab for Cherrapunji and Dawki.",
    dailyBudgetInr: 1800,
    attractions: [
      { name: "Police Bazar", kind: "market", minutes: 90, zone: "Town", slot: "evening", priority: 2 },
      { name: "Elephant Falls & Shillong Peak", kind: "water", minutes: 180, zone: "South", slot: "morning", costInr: 100, priority: 2 },
      { name: "Umiam Lake", kind: "water", minutes: 120, zone: "North", slot: "sunset", priority: 2, note: "On the Guwahati road — easy to fold into arrival or departure." },
      { name: "Don Bosco Museum", kind: "museum", minutes: 150, zone: "Town", costInr: 200, priority: 3, note: "Seven floors on North-East cultures, with a rooftop skywalk." },
      { name: "Laitlum Canyons", kind: "viewpoint", minutes: 240, zone: "East", slot: "morning", priority: 1, note: "A grassland ridge that drops away on three sides; go on a clear morning." },
      { name: "Living root bridges, Nongriat", kind: "trek", minutes: 420, zone: "Cherrapunji", slot: "sunrise", priority: 1, note: "3,500 steps down to the double-decker bridge and all the way back up. Brutal but the single best thing here." },
      { name: "Nohkalikai Falls & Mawsmai Cave", kind: "water", minutes: 240, zone: "Cherrapunji", priority: 1 },
      { name: "Dawki & Umngot river", kind: "water", minutes: 420, zone: "Dawki", slot: "morning", costInr: 1000, priority: 1, note: "The famously clear river — glass-clear only in the dry months." },
      { name: "Mawlynnong village", kind: "sight", minutes: 180, zone: "Dawki", priority: 2, note: "Billed as Asia's cleanest village; pairs with Dawki on one long day." },
    ],
    tips: ["Nongriat is a genuine full-day effort — do not attempt it on the same day as Dawki."],
  }),

  // ——————————————————————————— West & Rajasthan ———————————————————————————
  g({
    placeId: "city-goa",
    vibe: "Beaches with a Portuguese hangover — busy in the north, slow in the south, and a spice-and-church interior most people skip.",
    minNights: 3,
    idealNights: 5,
    bestMonths: [11, 12, 1, 2, 3],
    avoidMonths: [6, 7, 8, 9],
    avoidNote: "Monsoon closes most shacks and water sports, and the sea is off-limits.",
    localTransport: "Rent a scooter — it's how Goa works. Cabs are expensive and app-based rides are restricted by the local taxi unions.",
    dailyBudgetInr: 2500,
    attractions: [
      { name: "Old Goa churches — Bom Jesus & Se Cathedral", kind: "sight", minutes: 180, zone: "Old Goa", slot: "morning", priority: 1, note: "St Francis Xavier's remains are at Bom Jesus; the complex is UNESCO-listed." },
      { name: "Fontainhas Latin Quarter walk", kind: "sight", minutes: 120, zone: "Panjim", slot: "morning", priority: 1, note: "Ochre and indigo Portuguese houses; best before the heat." },
      { name: "Anjuna Flea Market", kind: "market", minutes: 180, zone: "North", priority: 2, note: "Wednesdays only, in season." },
      { name: "Chapora Fort sunset", kind: "viewpoint", minutes: 90, zone: "North", slot: "sunset", priority: 2 },
      { name: "Aguada Fort & Sinquerim", kind: "sight", minutes: 120, zone: "North", priority: 2 },
      { name: "Palolem beach day", kind: "water", minutes: 300, zone: "South", priority: 1, note: "Crescent bay with calm water — the nicest swimming beach in Goa." },
      { name: "Dudhsagar Falls jeep trip", kind: "water", minutes: 360, zone: "Interior", slot: "morning", costInr: 2500, priority: 2, note: "Booked jeep from Kulem; monsoon and just after is when it actually roars." },
      { name: "Spice plantation tour", kind: "nature", minutes: 180, zone: "Interior", costInr: 1000, priority: 3 },
      { name: "Mandovi sunset cruise", kind: "water", minutes: 90, zone: "Panjim", slot: "sunset", costInr: 500, priority: 3 },
    ],
    eat: ["Vinayak in Assagao for Goan fish thali", "Mum's Kitchen in Panjim", "Martin's Corner in Betalbatim", "Gunpowder in Assagao"],
    tips: [
      "North and south Goa are 90 minutes apart — pick one base per stretch rather than hopping daily.",
      "Drinking and riding is policed hard on the Calangute–Baga stretch.",
    ],
  }),
  g({
    placeId: "city-jai",
    vibe: "The Pink City — Rajput forts on the ridge, a planned walled old town, and the best bazaars in Rajasthan.",
    minNights: 2,
    idealNights: 3,
    bestMonths: [10, 11, 12, 1, 2, 3],
    avoidMonths: [5, 6],
    avoidNote: "Summer runs past 45 °C and the forts have no shade.",
    localTransport: "Autos and app cabs everywhere; the old city is best walked. A full-day cab for the fort circuit is about ₹2,000.",
    dailyBudgetInr: 2000,
    attractions: [
      { name: "Amber Fort", kind: "sight", minutes: 210, zone: "Amer", slot: "morning", costInr: 550, priority: 1, note: "Go at opening — by 10am the Sheesh Mahal is a crush." },
      { name: "Panna Meena ka Kund & Anokhi Museum", kind: "sight", minutes: 90, zone: "Amer", slot: "morning", priority: 3 },
      { name: "Jaigarh Fort", kind: "sight", minutes: 120, zone: "Amer", costInr: 200, priority: 2, note: "Walk up from Amber; holds the world's largest wheeled cannon." },
      { name: "Nahargarh Fort sunset", kind: "viewpoint", minutes: 120, zone: "Ridge", slot: "sunset", costInr: 200, priority: 1, note: "The whole city lights up below — the best sunset in Jaipur." },
      { name: "City Palace & Chandra Mahal", kind: "sight", minutes: 150, zone: "Old city", slot: "morning", costInr: 700, priority: 1 },
      { name: "Jantar Mantar", kind: "museum", minutes: 90, zone: "Old city", costInr: 200, priority: 2, note: "Take the guide — the instruments are meaningless without one." },
      { name: "Hawa Mahal", kind: "sight", minutes: 60, zone: "Old city", slot: "sunrise", costInr: 200, priority: 1, note: "Photograph from the café opposite in the early morning light." },
      { name: "Johari & Bapu Bazaar", kind: "market", minutes: 150, zone: "Old city", slot: "evening", priority: 2 },
      { name: "Albert Hall Museum", kind: "museum", minutes: 90, zone: "New city", costInr: 300, priority: 3 },
    ],
    eat: ["Rawat for pyaaz kachori", "LMB in Johari Bazaar", "Handi for laal maas", "Tapri Central for rooftop chai"],
    tips: ["The ₹1,000 composite ticket covers Amber, Jantar Mantar, Hawa Mahal, Nahargarh and Albert Hall over two days."],
  }),
  g({
    placeId: "dst-jaisalmer",
    vibe: "A living fort of golden sandstone in the Thar — havelis inside the walls and dunes an hour out.",
    minNights: 2,
    idealNights: 3,
    bestMonths: [10, 11, 12, 1, 2],
    avoidMonths: [4, 5, 6, 7],
    localTransport: "The fort and havelis are walkable. Desert camps arrange the transfer out to Sam or Khuri.",
    dailyBudgetInr: 2200,
    attractions: [
      { name: "Jaisalmer Fort (Sonar Quila)", kind: "sight", minutes: 180, zone: "Fort", slot: "morning", costInr: 250, priority: 1, note: "One of the last inhabited forts anywhere — people still live inside the walls." },
      { name: "Patwon ki Haveli", kind: "sight", minutes: 90, zone: "Town", costInr: 250, priority: 1 },
      { name: "Gadisar Lake", kind: "water", minutes: 75, zone: "Town", slot: "sunrise", priority: 2 },
      { name: "Sam Sand Dunes — camel ride & camp", kind: "adventure", minutes: 420, zone: "Desert", slot: "afternoon", costInr: 2500, priority: 1, note: "Sunset camel ride, folk music and a night under canvas. Khuri is the quieter alternative." },
      { name: "Kuldhara abandoned village", kind: "sight", minutes: 120, zone: "Desert", costInr: 100, priority: 2 },
      { name: "Bada Bagh cenotaphs at sunset", kind: "viewpoint", minutes: 90, zone: "Outskirts", slot: "sunset", costInr: 100, priority: 2 },
      { name: "Jain temples inside the fort", kind: "temple", minutes: 90, zone: "Fort", slot: "morning", costInr: 200, priority: 2, note: "Open to visitors only until about noon." },
    ],
    tips: ["Staying inside the fort is atmospheric but the drainage is damaging the foundations — many travellers deliberately stay outside."],
  }),
  g({
    placeId: "city-udi",
    vibe: "Lake palaces and whitewashed ghats in the Aravallis — the softest, greenest city in Rajasthan.",
    minNights: 2,
    idealNights: 3,
    bestMonths: [9, 10, 11, 12, 1, 2, 3],
    avoidMonths: [5, 6],
    localTransport: "The old city around Jagdish Temple is walkable; autos for Sajjangarh and Shilpgram.",
    dailyBudgetInr: 2000,
    attractions: [
      { name: "City Palace complex", kind: "sight", minutes: 180, zone: "Old city", slot: "morning", costInr: 400, priority: 1, note: "Largest palace in Rajasthan; the museum route takes a good two hours." },
      { name: "Lake Pichola boat ride", kind: "water", minutes: 90, zone: "Pichola", slot: "sunset", costInr: 700, priority: 1, note: "The sunset sailing passes Jag Mandir and costs roughly double the daytime one." },
      { name: "Jagdish Temple", kind: "temple", minutes: 45, zone: "Old city", priority: 2 },
      { name: "Saheliyon ki Bari", kind: "sight", minutes: 60, zone: "North", costInr: 100, priority: 3 },
      { name: "Sajjangarh Monsoon Palace sunset", kind: "viewpoint", minutes: 150, zone: "West", slot: "sunset", costInr: 300, priority: 1 },
      { name: "Bagore ki Haveli dance show", kind: "sight", minutes: 90, zone: "Old city", slot: "evening", costInr: 200, priority: 2, note: "Nightly Rajasthani folk performance at 7pm — arrive early for a floor seat." },
      { name: "Ambrai Ghat", kind: "viewpoint", minutes: 60, zone: "Pichola", slot: "sunset", priority: 2, note: "The classic view back at the City Palace across the water." },
    ],
    dayTrips: [
      { name: "Kumbhalgarh Fort & Ranakpur", hours: 10, costInr: 3500, note: "The second-longest continuous wall in the world, plus a marble Jain temple with 1,444 carved pillars." },
      { name: "Chittorgarh", hours: 9, costInr: 3500, note: "India's largest fort by area." },
    ],
  }),
  g({
    placeId: "city-agr",
    vibe: "Three Mughal world heritage sites in one small, chaotic city — the Taj is genuinely worth the trip.",
    minNights: 1,
    idealNights: 2,
    bestMonths: [10, 11, 12, 1, 2, 3],
    avoidMonths: [5, 6],
    localTransport: "Only electric vehicles are allowed near the Taj; autos elsewhere. Everything of interest sits within 10 km.",
    dailyBudgetInr: 2200,
    attractions: [
      { name: "Taj Mahal at sunrise", kind: "sight", minutes: 180, zone: "Taj", slot: "sunrise", costInr: 1300, priority: 1, note: "Open from sunrise; the first hour has the best light and the fewest people. Closed Fridays." },
      { name: "Agra Fort", kind: "sight", minutes: 150, zone: "Fort", slot: "morning", costInr: 650, priority: 1, note: "Where Shah Jahan was imprisoned, with a view of the Taj from Musamman Burj." },
      { name: "Mehtab Bagh sunset", kind: "viewpoint", minutes: 90, zone: "North bank", slot: "sunset", costInr: 300, priority: 1, note: "The Taj from across the Yamuna — the classic evening shot." },
      { name: "Itmad-ud-Daulah (Baby Taj)", kind: "sight", minutes: 90, zone: "North bank", costInr: 310, priority: 2, note: "Quieter and finer inlay work than the Taj itself." },
      { name: "Fatehpur Sikri", kind: "sight", minutes: 300, zone: "West", costInr: 610, priority: 2, note: "Abandoned Mughal capital 40 km out; easy to fold into the drive to Jaipur." },
    ],
    tips: [
      "The Taj is closed every Friday.",
      "Taj tickets are timed and cheaper online; the ₹200 extra for the mausoleum interior is skippable.",
    ],
  }),
  g({
    placeId: "city-vns",
    vibe: "The oldest living city on the Ganga — burning ghats, dawn boat rides and lanes you will get lost in.",
    minNights: 2,
    idealNights: 3,
    bestMonths: [10, 11, 12, 1, 2, 3],
    avoidMonths: [5, 6],
    localTransport: "The ghats and old lanes are walk-only. Autos and boats for everything else.",
    dailyBudgetInr: 1600,
    attractions: [
      { name: "Sunrise boat ride on the Ganga", kind: "water", minutes: 120, zone: "Ghats", slot: "sunrise", costInr: 600, priority: 1, note: "Push off around 5:30am from Assi or Dashashwamedh — the defining Varanasi hour." },
      { name: "Ganga Aarti at Dashashwamedh Ghat", kind: "temple", minutes: 120, zone: "Ghats", slot: "evening", priority: 1, note: "Nightly around 7pm; watch from a boat to avoid the crush on the steps." },
      { name: "Kashi Vishwanath Temple", kind: "temple", minutes: 120, zone: "Old city", slot: "morning", priority: 1, note: "Security is tight — phones and bags are not allowed inside." },
      { name: "Manikarnika & Harishchandra burning ghats", kind: "sight", minutes: 60, zone: "Ghats", priority: 2, note: "Working cremation grounds. Watch quietly from a distance; photography is not acceptable." },
      { name: "Old-city lanes & Vishwanath Gali", kind: "market", minutes: 150, zone: "Old city", slot: "afternoon", priority: 2 },
      { name: "Sarnath", kind: "temple", minutes: 240, zone: "Sarnath", slot: "morning", costInr: 300, priority: 1, note: "Where the Buddha gave his first sermon; the Dhamek Stupa and museum are 10 km out." },
      { name: "Banaras Hindu University & Bharat Kala Bhavan", kind: "museum", minutes: 150, zone: "South", priority: 3 },
    ],
    eat: ["Kachori sabzi at Ram Bhandar", "Blue Lassi in the old lanes", "Deena Chaat Bhandar for tamatar chaat"],
  }),
  g({
    placeId: "dst-rannofkutch",
    vibe: "A white salt desert that stretches to the horizon — best under a full moon, with Kutchi craft villages around Bhuj.",
    minNights: 2,
    idealNights: 3,
    bestMonths: [11, 12, 1, 2],
    avoidMonths: [5, 6, 7, 8, 9],
    avoidNote: "The Rann floods in the monsoon and is simply not visitable; the salt flat only forms once it dries out.",
    localTransport: "Cab from Bhuj. You need a permit for Dhordo, issued at the Bhirandiyara checkpost.",
    dailyBudgetInr: 2500,
    attractions: [
      { name: "White Rann at sunset & moonrise", kind: "nature", minutes: 240, zone: "Dhordo", slot: "sunset", costInr: 500, priority: 1, note: "Time the trip to a full moon if you possibly can — that's the experience people come for." },
      { name: "Kalo Dungar (Black Hill)", kind: "viewpoint", minutes: 180, zone: "North", slot: "sunset", priority: 2, note: "Highest point in Kutch, looking out over the whole Rann." },
      { name: "Craft villages — Nirona, Hodka, Ajrakhpur", kind: "market", minutes: 300, zone: "Villages", slot: "morning", priority: 1, note: "Rogan art at Nirona, block printing at Ajrakhpur, leather and mud mirror work at Hodka." },
      { name: "Bhuj — Aina Mahal & Prag Mahal", kind: "sight", minutes: 150, zone: "Bhuj", costInr: 200, priority: 2 },
      { name: "Dholavira", kind: "sight", minutes: 420, zone: "North-east", priority: 3, note: "Harappan city on an island in the Rann — a long drive but a UNESCO site." },
    ],
    tips: ["Rann Utsav runs roughly November to February and is when the tent city and all the infrastructure exist."],
  }),

  // ——————————————————————————— South ———————————————————————————
  g({
    placeId: "dst-munnar",
    vibe: "Tea country in the high Western Ghats — rolling estates, misty mornings and Eravikulam's tahr.",
    minNights: 2,
    idealNights: 3,
    bestMonths: [9, 10, 11, 12, 1, 2, 3],
    localTransport: "A full-day cab covers each sightseeing loop for ₹2,000–2,500; things are far too spread out to walk.",
    dailyBudgetInr: 1800,
    attractions: [
      { name: "Eravikulam National Park", kind: "wildlife", minutes: 180, zone: "North", slot: "morning", costInr: 200, priority: 1, note: "Nilgiri tahr at close range. Closed February–March for calving; book the online slot." },
      { name: "Tea Museum & estate walk", kind: "museum", minutes: 150, zone: "Town", costInr: 200, priority: 2 },
      { name: "Top Station viewpoint", kind: "viewpoint", minutes: 240, zone: "North", slot: "sunrise", priority: 1, note: "Best before the cloud comes in — leave by 6am." },
      { name: "Mattupetty Dam & Echo Point", kind: "water", minutes: 180, zone: "North", priority: 2 },
      { name: "Kolukkumalai sunrise jeep", kind: "viewpoint", minutes: 300, zone: "East", slot: "sunrise", costInr: 2500, priority: 1, note: "World's highest tea estate; a rough jeep track is the only way up." },
      { name: "Attukad Waterfalls", kind: "water", minutes: 90, zone: "South", priority: 3 },
      { name: "Lakkam Waterfalls & Marayoor sandalwood forest", kind: "nature", minutes: 300, zone: "North", priority: 3 },
    ],
    dayTrips: [{ name: "Thekkady / Periyar", hours: 8, costInr: 3500, note: "Boat safari on Periyar lake; better as an overnight." }],
    tips: ["Munnar clouds over from about 11am most of the year — front-load the viewpoints."],
  }),
  g({
    placeId: "dst-alleppey",
    vibe: "Backwater capital — houseboats through paddy-level canals and a long quiet beach nobody uses.",
    minNights: 1,
    idealNights: 2,
    bestMonths: [10, 11, 12, 1, 2, 3],
    localTransport: "Houseboats and shikaras from Finishing Point; autos in town.",
    dailyBudgetInr: 2000,
    attractions: [
      { name: "Houseboat overnight", kind: "water", minutes: 1080, zone: "Backwaters", slot: "midday", costInr: 8000, priority: 1, note: "Boards around noon, moors by 5:30pm (they can't move after dark) and disembarks at 9am. Price is per boat." },
      { name: "Shikara canal cruise", kind: "water", minutes: 180, zone: "Backwaters", slot: "sunset", costInr: 1500, priority: 1, note: "The better option if you don't want the overnight — shikaras reach narrow canals houseboats can't." },
      { name: "Alappuzha Beach & pier", kind: "water", minutes: 120, zone: "Town", slot: "sunset", priority: 2 },
      { name: "Kuttanad paddy villages by bike", kind: "nature", minutes: 240, zone: "Kuttanad", slot: "morning", priority: 2, note: "Farmland below sea level, held back by bunds." },
      { name: "Revi Karunakaran Museum", kind: "museum", minutes: 90, zone: "Town", costInr: 200, priority: 3 },
    ],
    tips: [
      "Houseboat quality varies enormously at the same price — check recent photos of the actual boat, not the listing.",
      "Snake-boat races (Nehru Trophy) are in August and worth planning a trip around.",
    ],
  }),
  g({
    placeId: "dst-coorg",
    vibe: "Coffee-estate hills in Karnataka — waterfalls, a Tibetan settlement and pork curry.",
    minNights: 2,
    idealNights: 3,
    bestMonths: [10, 11, 12, 1, 2, 3],
    localTransport: "You need a car. Sights are 20–40 km apart on narrow estate roads and buses are sparse.",
    dailyBudgetInr: 1800,
    attractions: [
      { name: "Abbey Falls", kind: "water", minutes: 90, zone: "Madikeri", costInr: 50, priority: 2 },
      { name: "Raja's Seat sunset", kind: "viewpoint", minutes: 60, zone: "Madikeri", slot: "sunset", costInr: 50, priority: 2 },
      { name: "Namdroling Monastery (Golden Temple), Bylakuppe", kind: "temple", minutes: 180, zone: "Kushalnagar", slot: "morning", priority: 1, note: "Large Tibetan settlement with an enormous gilded shrine hall." },
      { name: "Dubare Elephant Camp", kind: "wildlife", minutes: 180, zone: "Kushalnagar", slot: "morning", costInr: 400, priority: 2, note: "Morning is when the elephants are bathed and fed." },
      { name: "Coffee plantation walk & tasting", kind: "nature", minutes: 150, zone: "Estates", priority: 1, note: "Most homestays run their own — the single most Coorg thing to do." },
      { name: "Talakaveri & Bhagamandala", kind: "temple", minutes: 240, zone: "West", slot: "morning", priority: 2, note: "Source of the Kaveri, 45 km of hill road from Madikeri." },
      { name: "Mandalpatti jeep ride", kind: "viewpoint", minutes: 240, zone: "East", slot: "sunrise", costInr: 2000, priority: 2, note: "Jeep-only track to a grassland ridge; magic above the cloud line." },
      { name: "Nisargadhama island", kind: "nature", minutes: 120, zone: "Kushalnagar", priority: 3 },
    ],
    eat: ["Pandi curry (Coorg pork) with kadambuttu", "Coorg-style akki roti", "Estate-roasted filter coffee"],
  }),
  g({
    placeId: "dst-hampi",
    vibe: "Vijayanagara ruins scattered across a boulder landscape on the Tungabhadra — one of India's great sites.",
    minNights: 2,
    idealNights: 3,
    bestMonths: [10, 11, 12, 1, 2],
    avoidMonths: [4, 5, 6],
    avoidNote: "Summer here regularly passes 40 °C and the ruins have no shade at all.",
    localTransport: "Rent a scooter or cycle for the sacred centre; a coracle crosses to Anegundi on the north bank.",
    dailyBudgetInr: 1500,
    attractions: [
      { name: "Virupaksha Temple", kind: "temple", minutes: 90, zone: "Sacred centre", slot: "morning", costInr: 50, priority: 1, note: "Still an active temple after 1,300 years." },
      { name: "Vittala Temple & stone chariot", kind: "sight", minutes: 150, zone: "Sacred centre", slot: "morning", costInr: 600, priority: 1, note: "The musical pillars and the stone chariot — the single best thing in Hampi." },
      { name: "Hemakuta Hill sunset", kind: "viewpoint", minutes: 90, zone: "Sacred centre", slot: "sunset", priority: 1 },
      { name: "Royal Enclosure, Lotus Mahal & Elephant Stables", kind: "sight", minutes: 180, zone: "Royal centre", slot: "morning", costInr: 600, priority: 1, note: "Same ticket as Vittala, valid one day." },
      { name: "Matanga Hill sunrise", kind: "trek", minutes: 120, zone: "Sacred centre", slot: "sunrise", priority: 2, note: "Highest point in Hampi; a steep 30-minute scramble in the dark." },
      { name: "Coracle ride & Anegundi village", kind: "water", minutes: 180, zone: "North bank", costInr: 500, priority: 2 },
      { name: "Sanapur Lake", kind: "water", minutes: 120, zone: "North bank", slot: "afternoon", priority: 3 },
      { name: "Hampi Bazaar & Achyutaraya Temple", kind: "sight", minutes: 120, zone: "Sacred centre", priority: 2 },
    ],
    tips: [
      "The ₹600 ASI ticket covers Vittala and the Royal Enclosure on the same day — do both together.",
      "Hampi village is dry and vegetarian; the north bank at Sanapur is where the guesthouse scene sits.",
    ],
  }),
  g({
    placeId: "city-oot",
    vibe: "Nilgiri hill station reached by a UNESCO mountain railway — gardens, tea, and Coonoor next door.",
    minNights: 2,
    idealNights: 3,
    bestMonths: [3, 4, 5, 9, 10, 11],
    localTransport: "Autos in town; a day cab for the Coonoor loop. The toy train runs Mettupalayam–Coonoor–Ooty.",
    dailyBudgetInr: 1600,
    attractions: [
      { name: "Nilgiri Mountain Railway toy train", kind: "sight", minutes: 300, zone: "Rail", slot: "morning", costInr: 300, priority: 1, note: "The rack-and-pinion climb from Mettupalayam is the famous stretch; book weeks ahead." },
      { name: "Government Botanical Garden", kind: "nature", minutes: 120, zone: "Town", costInr: 100, priority: 2 },
      { name: "Ooty Lake boating", kind: "water", minutes: 90, zone: "Town", costInr: 200, priority: 3 },
      { name: "Doddabetta Peak", kind: "viewpoint", minutes: 120, zone: "East", slot: "morning", costInr: 50, priority: 2, note: "Highest point in the Nilgiris; clouds in by late morning." },
      { name: "Tea estate & factory tour", kind: "nature", minutes: 120, zone: "Coonoor", priority: 2 },
      { name: "Coonoor — Sim's Park & Dolphin's Nose", kind: "viewpoint", minutes: 240, zone: "Coonoor", slot: "morning", priority: 1, note: "Quieter and prettier than Ooty proper." },
      { name: "Avalanche Lake", kind: "nature", minutes: 300, zone: "West", priority: 3, note: "Forest-department jeep only; shola forest and rhododendrons." },
    ],
  }),
  g({
    placeId: "city-pud",
    vibe: "French-quarter Puducherry — mustard villas and boulevards on one side, a Tamil town on the other, and Auroville out of town.",
    minNights: 2,
    idealNights: 3,
    bestMonths: [10, 11, 12, 1, 2, 3],
    localTransport: "Rent a scooter or cycle — the White Town grid is small and flat.",
    dailyBudgetInr: 1800,
    attractions: [
      { name: "French Quarter (White Town) walk", kind: "sight", minutes: 150, zone: "White Town", slot: "morning", priority: 1 },
      { name: "Promenade Beach & Rock Beach", kind: "water", minutes: 90, zone: "White Town", slot: "sunrise", priority: 1, note: "The seafront road closes to traffic in the evening." },
      { name: "Sri Aurobindo Ashram", kind: "temple", minutes: 60, zone: "White Town", slot: "morning", priority: 2 },
      { name: "Auroville & Matrimandir viewpoint", kind: "sight", minutes: 240, zone: "Auroville", slot: "morning", priority: 1, note: "Inner-chamber visits must be booked days ahead; otherwise you only get the viewing point." },
      { name: "Basilica of the Sacred Heart", kind: "sight", minutes: 45, zone: "Town", priority: 3 },
      { name: "Paradise Beach", kind: "water", minutes: 180, zone: "South", costInr: 200, priority: 2, note: "Reached by boat from Chunnambar." },
      { name: "Sunday Goubert Market", kind: "market", minutes: 90, zone: "Town", priority: 3 },
    ],
    eat: ["Villa Shanti and Café des Arts in White Town", "Surguru for South Indian", "Baker Street for French pastry"],
  }),
  g({
    placeId: "dst-mahabaleshwar",
    vibe: "Sahyadri plateau above the Krishna valley — strawberry farms, table-land at Panchgani and a dozen named viewpoints.",
    minNights: 2,
    idealNights: 2,
    bestMonths: [10, 11, 12, 1, 2, 3],
    avoidMonths: [6, 7],
    avoidNote: "One of the wettest spots in Maharashtra — visibility in July is effectively zero.",
    localTransport: "Shared jeeps do a fixed points circuit; a private cab is better if you want to linger.",
    dailyBudgetInr: 1500,
    attractions: [
      { name: "Arthur's Seat", kind: "viewpoint", minutes: 120, zone: "West points", slot: "morning", priority: 1, note: "Sheer drop into the Savitri valley — the best of the viewpoints." },
      { name: "Wilson Point sunrise", kind: "viewpoint", minutes: 90, zone: "Town", slot: "sunrise", priority: 2, note: "Highest point in Mahabaleshwar." },
      { name: "Venna Lake boating", kind: "water", minutes: 90, zone: "Town", costInr: 300, priority: 3 },
      { name: "Pratapgad Fort", kind: "sight", minutes: 240, zone: "West", slot: "morning", priority: 2, note: "Shivaji's fort, 24 km out; about 500 steps to the top." },
      { name: "Panchgani Table Land", kind: "viewpoint", minutes: 150, zone: "Panchgani", slot: "sunset", priority: 1, note: "Second-largest volcanic plateau in Asia." },
      { name: "Mapro Garden & strawberry farms", kind: "food", minutes: 120, zone: "Panchgani", priority: 2, note: "Strawberry season runs roughly December to March." },
      { name: "Old Mahabaleshwar temples", kind: "temple", minutes: 90, zone: "Old town", priority: 3 },
    ],
  }),
  g({
    placeId: "dst-havelock",
    vibe: "Andaman island of white sand and clear water — Radhanagar for the beach, Nemo reef for the diving.",
    minNights: 3,
    idealNights: 4,
    bestMonths: [11, 12, 1, 2, 3, 4],
    avoidMonths: [6, 7, 8, 9],
    avoidNote: "Monsoon brings rough seas and ferry cancellations.",
    localTransport: "Scooters and autos. The island is small — Radhanagar is 12 km from the jetty.",
    dailyBudgetInr: 3000,
    attractions: [
      { name: "Radhanagar Beach (Beach No. 7)", kind: "water", minutes: 240, zone: "West", slot: "sunset", priority: 1, note: "Routinely rated Asia's best beach; the sunset is the main event." },
      { name: "Scuba dive at Nemo Reef / The Wall", kind: "adventure", minutes: 300, zone: "Reef", slot: "morning", costInr: 4500, priority: 1, note: "Try-dives need no certification; visibility is best December to March." },
      { name: "Elephant Beach snorkelling", kind: "water", minutes: 300, zone: "North", costInr: 2000, priority: 1, note: "Reached by boat or a muddy 40-minute forest walk." },
      { name: "Kalapathar Beach sunrise", kind: "water", minutes: 120, zone: "East", slot: "sunrise", priority: 2 },
      { name: "Sea walk at Elephant Beach", kind: "adventure", minutes: 150, zone: "North", costInr: 3500, priority: 3 },
      { name: "Kayak through mangroves", kind: "water", minutes: 180, zone: "North", costInr: 2500, priority: 2, note: "Bioluminescence tours run on new-moon nights." },
    ],
    tips: [
      "Book the government ferry (Makruzz/Nautika) well ahead — sailings sell out and are the only way across.",
      "Mobile data on Havelock is slow and patchy; download everything in Port Blair.",
    ],
  }),
];

const BY_PLACE = new Map(DESTINATION_GUIDES.map((x) => [x.placeId, x]));

export function guideFor(placeId: string): DestinationGuide | null {
  return BY_PLACE.get(placeId) ?? null;
}

export const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** Collapse [3,4,5,9,10,11] into "Mar–May, Sep–Nov" so season notes read like prose. */
export function monthRangeLabel(months: number[]): string {
  if (months.length === 0) return "";
  if (months.length === 12) return "year-round";
  const sorted = [...new Set(months)].sort((a, b) => a - b);
  // Treat the list as circular so Nov–Mar reads as one window, not two.
  let start = 0;
  if (sorted.includes(1) && sorted.includes(12)) {
    while (start < sorted.length && sorted.includes(((sorted[start] - 2 + 12) % 12) + 1)) start++;
    if (start >= sorted.length) start = 0;
  }
  const runs: number[][] = [];
  let run: number[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const m = sorted[(start + i) % sorted.length];
    if (run.length === 0 || m === (run[run.length - 1] % 12) + 1) run.push(m);
    else {
      runs.push(run);
      run = [m];
    }
  }
  if (run.length) runs.push(run);
  const short = (m: number) => MONTH_NAMES[m - 1].slice(0, 3);
  return runs
    .map((r) => (r.length === 1 ? short(r[0]) : `${short(r[0])}–${short(r[r.length - 1])}`))
    .join(", ");
}
