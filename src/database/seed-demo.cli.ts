/**
 * Demo-data seeder: `npm run seed:demo`.
 *
 * Populates a realistic showcase project ("Hayes Valley Brownstone") through
 * the live HTTP API — exercising auth, role guards, the approval workflow,
 * comments, and notifications exactly as real users would.
 *
 * Prerequisites:
 *   - The API is running (npm run dev) with the base accounts seeded
 *     (designer@foundry.dev / client@foundry.dev — see `npm run seed`).
 *
 * Idempotent: skips if the demo project already exists (FORCE=1 to re-create
 * another copy anyway).
 *
 * Config: API_URL (default http://localhost:4000/api)
 */

const API = process.env.API_URL ?? 'http://localhost:4000/api';
const PROJECT_NAME = 'Hayes Valley Brownstone';

const DESIGNER = { email: 'designer@foundry.dev', password: 'Password1!' };
const CLIENT = { email: 'client@foundry.dev', password: 'Password1!' };

const img = (id: string) => `https://images.unsplash.com/${id}?w=1200&q=80`;

// ── Tiny API client ─────────────────────────────────────────────────────────

async function api<T = any>(
  method: string,
  path: string,
  token?: string,
  body?: unknown,
): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`${method} ${path} → ${res.status} ${text}`);
  }
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

async function login(creds: { email: string; password: string }): Promise<string> {
  const res = await api<any>('POST', '/auth/login', undefined, creds);
  const token = res.token ?? res.accessToken ?? res.access_token;
  if (!token) throw new Error(`No token in login response for ${creds.email}`);
  return token;
}

// ── Seed data ───────────────────────────────────────────────────────────────

type ProductSeed = Record<string, unknown> & { name: string };

const ROOMS: { key: string; name: string; notes: string }[] = [
  {
    key: 'living',
    name: 'Living Room',
    notes:
      'South-facing bay windows; keep sightlines to the fireplace. Sofa must clear the radiator wall.',
  },
  {
    key: 'kitchen',
    name: 'Kitchen & Dining',
    notes: 'Existing cabinetry stays — new lighting, seating, and finishes only.',
  },
  {
    key: 'bedroom',
    name: 'Primary Bedroom',
    notes: 'Calm palette. Blackout drapery to be specified later.',
  },
  {
    key: 'office',
    name: 'Home Office',
    notes: 'Daniel works from home full-time; ergonomics are the priority.',
  },
];

const PRODUCTS: { room: string; key: string; data: ProductSeed }[] = [
  {
    room: 'living',
    key: 'sofa',
    data: {
      name: 'Sven Charme Tan Sofa',
      vendor: 'Article',
      manufacturer: 'Article',
      sku: 'SKU-13731',
      price: 2299,
      currency: 'USD',
      dimensions: '88"W × 38"D × 34"H',
      description:
        'Mid-century 3-seater in full-grain semi-aniline leather. Ages beautifully with pets and kids.',
      specifications: [
        { label: 'Upholstery', value: 'Charme full-grain leather, tan' },
        { label: 'Frame', value: 'Kiln-dried solid wood' },
        { label: 'Legs', value: 'Walnut, 7" clearance' },
        { label: 'Seat depth', value: '24"' },
      ],
      images: [img('photo-1555041469-a586c61ea9bc')],
      sourceUrl: 'https://www.article.com/product/13731/sven-charme-tan-sofa',
      notes:
        'Leather is the dog-proof choice. Confirm doorway clearance — 34" stairwell turn.',
    },
  },
  {
    room: 'living',
    key: 'rug',
    data: {
      name: 'Arlo Hand-Knotted Wool Rug 9×12',
      vendor: 'Rejuvenation',
      price: 1895,
      currency: 'USD',
      dimensions: '108" × 144"',
      description: 'Low-pile hand-knotted wool in oatmeal with sage undertones.',
      specifications: [
        { label: 'Material', value: '100% New Zealand wool' },
        { label: 'Pile height', value: '0.4"' },
        { label: 'Construction', value: 'Hand-knotted' },
      ],
      images: [img('photo-1600166898405-da9535204843')],
      notes: 'Order rug pad separately (felt + rubber).',
    },
  },
  {
    room: 'living',
    key: 'coffee',
    data: {
      name: 'Linden Round Coffee Table',
      vendor: 'Room & Board',
      manufacturer: 'Room & Board',
      sku: 'RB-LND-42',
      price: 1199,
      currency: 'USD',
      dimensions: '42" dia × 16"H',
      description: 'Solid white oak top on a blackened-steel ring base.',
      specifications: [
        { label: 'Top', value: 'Solid white oak, natural finish' },
        { label: 'Base', value: 'Blackened steel' },
      ],
      images: [img('photo-1532372320572-cda25653a26d')],
    },
  },
  {
    room: 'living',
    key: 'floorlamp',
    data: {
      name: 'Captain Flint Floor Lamp',
      vendor: 'Visual Comfort',
      manufacturer: 'Flos',
      sku: 'FLOS-CF-BRS',
      price: 1395,
      currency: 'USD',
      dimensions: '60.6"H × 9" base',
      description: 'Pivoting cone shade in brushed brass over a Carrara marble base.',
      specifications: [
        { label: 'Finish', value: 'Brushed brass' },
        { label: 'Base', value: 'Carrara marble' },
        { label: 'Bulb', value: 'LED E26, dimmable' },
      ],
      images: [img('photo-1507473885765-e6ed057f782c')],
      notes: 'Brass ties into kitchen pendants — keep finishes consistent.',
    },
  },
  {
    room: 'kitchen',
    key: 'table',
    data: {
      name: 'Madera Extension Dining Table',
      vendor: 'Crate & Barrel',
      sku: 'CB-MAD-72',
      price: 2499,
      currency: 'USD',
      dimensions: '72"–92"W × 38"D × 30"H',
      description: 'White oak extension table; seats 6, extends to 8 for hosting.',
      specifications: [
        { label: 'Material', value: 'Solid white oak + oak veneer' },
        { label: 'Extension', value: '20" butterfly leaf' },
      ],
      images: [img('photo-1577140917170-285929fb55b7')],
    },
  },
  {
    room: 'kitchen',
    key: 'chairs',
    data: {
      name: 'Ecole Dining Chair (set of 6)',
      vendor: 'CB2',
      manufacturer: 'CB2',
      sku: 'CB2-ECL-6',
      price: 1794,
      currency: 'USD',
      dimensions: '19"W × 21"D × 31"H each',
      description: 'Bent-oak shell chairs with woven paper-cord seats.',
      specifications: [
        { label: 'Frame', value: 'Bent white oak' },
        { label: 'Seat', value: 'Danish paper cord' },
      ],
      images: [img('photo-1592078615290-033ee584e267')],
      notes: 'Paper cord is surprisingly durable, but flag the dogs to the clients.',
    },
  },
  {
    room: 'kitchen',
    key: 'pendant',
    data: {
      name: 'Hicks Pendant — Antique Brass (×3)',
      vendor: 'Visual Comfort',
      manufacturer: "Thomas O'Brien",
      sku: 'TOB5065HAB',
      price: 1257,
      currency: 'USD',
      dimensions: '8.5" dia × 11"H each',
      description:
        'Three pendants over the island, antique brass with white interior shades.',
      specifications: [
        { label: 'Finish', value: 'Hand-rubbed antique brass' },
        { label: 'Spacing', value: '30" on center over island' },
      ],
      images: [img('photo-1513506003901-1e6a229e2d15')],
    },
  },
  {
    room: 'kitchen',
    key: 'tile',
    data: {
      name: 'Zellige 4×4 Backsplash Tile — Sage',
      vendor: 'Fireclay Tile',
      sku: 'FC-ZLG-SAGE',
      price: 1840,
      currency: 'USD',
      dimensions: '~46 sq ft @ $40/sq ft',
      description:
        'Handmade Moroccan zellige in glossy sage; intentional variation tile to tile.',
      specifications: [
        { label: 'Material', value: 'Glazed terracotta' },
        { label: 'Coverage', value: '46 sq ft incl. 15% overage' },
        { label: 'Lead time', value: '6–8 weeks' },
      ],
      images: [img('photo-1556911220-bff31c812dba')],
      notes: 'LEAD TIME RISK — order by July 1 to hit install window.',
    },
  },
  {
    room: 'bedroom',
    key: 'bed',
    data: {
      name: 'Tessu King Bed — Clay Linen',
      vendor: 'Article',
      sku: 'SKU-18204',
      price: 1699,
      currency: 'USD',
      dimensions: '82"W × 87"D × 38"H',
      description:
        'Upholstered platform bed in washed clay linen with a low, rounded headboard.',
      specifications: [
        { label: 'Upholstery', value: 'Washed linen blend, clay' },
        { label: 'Slats', value: 'Solid pine, no box spring needed' },
      ],
      images: [img('photo-1505693416388-ac5ce068fe85')],
    },
  },
  {
    room: 'bedroom',
    key: 'nightstands',
    data: {
      name: 'Kenton Nightstand, White Oak (pair)',
      vendor: 'Schoolhouse',
      sku: 'SH-KEN-OAK',
      price: 1198,
      currency: 'USD',
      dimensions: '22"W × 16"D × 24"H each',
      description:
        'Solid oak nightstands with a single soft-close drawer and brass pulls.',
      specifications: [
        { label: 'Material', value: 'Solid white oak' },
        { label: 'Hardware', value: 'Unlacquered brass' },
      ],
      images: [img('photo-1595526114035-0d45ed16cfbf')],
    },
  },
  {
    room: 'office',
    key: 'desk',
    data: {
      name: 'Jarvis L-Shaped Standing Desk — Bamboo',
      vendor: 'Fully',
      manufacturer: 'Herman Miller',
      sku: 'HM-JRV-L60',
      price: 1095,
      currency: 'USD',
      dimensions: '60" × 60" L-return, 25.5"–51"H',
      description: 'Electric sit-stand desk, bamboo top, programmable height presets.',
      specifications: [
        { label: 'Top', value: 'Carbonized bamboo' },
        { label: 'Lift', value: 'Dual motor, 350 lb capacity' },
        { label: 'Memory', value: '4 height presets' },
      ],
      images: [img('photo-1518455027359-f3f8164ba6bd')],
    },
  },
  {
    room: 'office',
    key: 'taskchair',
    data: {
      name: 'Aeron Chair — Size B, Graphite',
      vendor: 'Herman Miller',
      manufacturer: 'Herman Miller',
      sku: 'AER1B23DW',
      price: 1395,
      currency: 'USD',
      dimensions: '27"W × 27"D × 41"H',
      description: 'Fully adjustable ergonomic task chair, PostureFit SL.',
      specifications: [
        { label: 'Size', value: 'B (medium)' },
        { label: 'Warranty', value: '12 years' },
      ],
      images: [img('photo-1505843490538-5133c6c7d0e1')],
      notes: 'Daniel sat in one at the showroom — pre-approved verbally.',
    },
  },
];

// keys of products the designer formally sends for client review
const APPROVAL_REQUESTS = ['sofa', 'rug', 'table', 'chairs', 'pendant', 'tile', 'bed'];

const DECISIONS: { key: string; by: 'client' | 'designer'; status: string; note?: string }[] = [
  { key: 'sofa', by: 'client', status: 'approved' },
  { key: 'table', by: 'client', status: 'approved' },
  { key: 'pendant', by: 'client', status: 'approved' },
  {
    key: 'tile',
    by: 'client',
    status: 'approved',
    note: 'Love the sage — go ahead and order early given the lead time.',
  },
  {
    key: 'chairs',
    by: 'client',
    status: 'rejected',
    note:
      'Worried about the paper-cord seats with the dogs. Could we see a fully wooden or upholstered option?',
  },
  // Designer records a verbal showroom approval directly.
  { key: 'taskchair', by: 'designer', status: 'approved', note: 'Verbal approval at showroom 5/28.' },
  // rug + bed stay pending so every badge state is visible in the UI
];

const COMMENTS: { key: string; by: 'client' | 'designer'; body: string; visibility?: string }[] = [
  {
    key: 'sofa',
    by: 'designer',
    visibility: 'client',
    body:
      'Confirmed with Article: the stairwell turn is fine if the feet come off. White-glove delivery booked.',
  },
  {
    key: 'sofa',
    by: 'designer',
    visibility: 'internal',
    body: 'Trade discount applies — invoice at $1,954 net. Margin noted in budget sheet.',
  },
  {
    key: 'chairs',
    by: 'client',
    body:
      'To clarify — we love the look, it is purely a durability concern with Biscuit and Maple. Happy with darker wood too.',
  },
  {
    key: 'chairs',
    by: 'designer',
    visibility: 'client',
    body:
      'Totally fair! Pulling two alternatives this week: an upholstered oak chair and a full-bentwood option.',
  },
  {
    key: 'tile',
    by: 'designer',
    visibility: 'internal',
    body:
      'Reminder: zellige needs a wet-saw and an installer who has worked with it before. Ask GC for references.',
  },
  {
    key: 'rug',
    by: 'designer',
    visibility: 'client',
    body: 'Sample swatch arriving Thursday — will drop it off so you can see it against the sofa leather.',
  },
];

const SCHEDULES: { name: string; type: string; items: { key: string; quantity: number }[] }[] = [
  {
    name: 'FF&E — Main Floor',
    type: 'furniture',
    items: [
      { key: 'sofa', quantity: 1 },
      { key: 'coffee', quantity: 1 },
      { key: 'rug', quantity: 1 },
      { key: 'table', quantity: 1 },
      { key: 'chairs', quantity: 1 },
      { key: 'bed', quantity: 1 },
      { key: 'nightstands', quantity: 1 },
      { key: 'desk', quantity: 1 },
      { key: 'taskchair', quantity: 1 },
    ],
  },
  {
    name: 'Lighting Schedule',
    type: 'fixture',
    items: [
      { key: 'pendant', quantity: 3 },
      { key: 'floorlamp', quantity: 1 },
    ],
  },
  {
    name: 'Finish Materials',
    type: 'material',
    items: [{ key: 'tile', quantity: 1 }],
  },
];

// ── Runner ──────────────────────────────────────────────────────────────────

async function run() {
  console.log(`Seeding demo data via ${API} …`);

  const designerToken = await login(DESIGNER);
  const clientToken = await login(CLIENT);
  const tokenFor = (who: 'client' | 'designer') =>
    who === 'client' ? clientToken : designerToken;

  // Idempotency: bail if the demo project is already there.
  const existing = await api<any[]>('GET', '/projects', designerToken);
  if (existing.some((p) => p.name === PROJECT_NAME) && process.env.FORCE !== '1') {
    console.log(`"${PROJECT_NAME}" already exists — nothing to do. (FORCE=1 to seed another copy.)`);
    return;
  }

  const clients = await api<any[]>('GET', '/users/clients', designerToken);
  const clientUser = clients.find((c) => c.email === CLIENT.email);
  if (!clientUser) throw new Error(`${CLIENT.email} not found — run \`npm run seed\` first.`);

  // Project
  const project = await api<any>('POST', '/projects', designerToken, {
    name: PROJECT_NAME,
    clientName: 'Amelia & Daniel Carter',
    address: '428 Linden Street, San Francisco, CA 94102',
    status: 'in_progress',
    startDate: '2026-04-15',
    endDate: '2026-10-30',
    notes:
      'Full interior refresh of a 3-bed Victorian brownstone. Clients want warm minimalism — ' +
      'white oak, brass accents, deep greens. Budget ceiling $85k FF&E. ' +
      'Dog-friendly fabrics only (two golden retrievers).',
    coverImageUrl: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1600&q=80',
    clientId: clientUser.id,
  });
  console.log(`✓ project "${project.name}" (${project.id})`);

  // Rooms
  const roomIds = new Map<string, string>();
  for (const room of ROOMS) {
    const created = await api<any>('POST', `/projects/${project.id}/rooms`, designerToken, {
      name: room.name,
      notes: room.notes,
    });
    roomIds.set(room.key, created.id);
  }
  console.log(`✓ ${ROOMS.length} rooms`);

  // Products
  const productIds = new Map<string, string>();
  for (const { room, key, data } of PRODUCTS) {
    const created = await api<any>(
      'POST',
      `/rooms/${roomIds.get(room)}/products`,
      designerToken,
      data,
    );
    productIds.set(key, created.id);
  }
  console.log(`✓ ${PRODUCTS.length} products`);

  // Approval requests → client (or designer) decisions
  for (const key of APPROVAL_REQUESTS) {
    await api('POST', `/products/${productIds.get(key)}/request-approval`, designerToken);
  }
  for (const d of DECISIONS) {
    await api('POST', `/products/${productIds.get(d.key)}/decision`, tokenFor(d.by), {
      status: d.status,
      ...(d.note ? { note: d.note } : {}),
    });
  }
  console.log(`✓ ${APPROVAL_REQUESTS.length} approval requests, ${DECISIONS.length} decisions`);

  // Comments
  for (const c of COMMENTS) {
    await api('POST', `/products/${productIds.get(c.key)}/comments`, tokenFor(c.by), {
      body: c.body,
      ...(c.visibility ? { visibility: c.visibility } : {}),
    });
  }
  console.log(`✓ ${COMMENTS.length} comments`);

  // Schedules
  for (const s of SCHEDULES) {
    const created = await api<any>('POST', `/projects/${project.id}/schedules`, designerToken, {
      name: s.name,
      type: s.type,
    });
    for (const item of s.items) {
      await api('POST', `/schedules/${created.id}/items`, designerToken, {
        productId: productIds.get(item.key),
        quantity: item.quantity,
      });
    }
  }
  console.log(`✓ ${SCHEDULES.length} schedules`);

  console.log(`
Done! Explore it:
  designer@foundry.dev / Password1!   → full workspace
  client@foundry.dev   / Password1!   → review portal (/client-view/${project.id})`);
}

run().catch((err) => {
  console.error(`Demo seed failed: ${err.message ?? err}`);
  process.exitCode = 1;
});
