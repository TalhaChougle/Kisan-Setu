// prisma/seed.js
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const prisma = new PrismaClient();

// ── helpers ──────────────────────────────────────────────────────────────────
function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(0, 0, 0, 0);
  return d;
}

function rand(min, max) {
  return Math.round((Math.random() * (max - min) + min) * 100) / 100;
}

function trendedPrice(base, day, volatility = 0.03) {
  // slow sinusoidal trend + noise
  const trend = base + base * 0.15 * Math.sin((day / 90) * Math.PI);
  const noise = base * volatility * (Math.random() - 0.5);
  return Math.round((trend + noise) * 100) / 100;
}

// ── seed data constants ───────────────────────────────────────────────────────
const COMMODITIES = [
  {
    commodity: 'Wheat',
    variety: 'HD-2967',
    baseMandiPrice: 2200,
    mspPrice: 2275,
    regions: ['Pune', 'Nashik', 'Aurangabad'],
  },
  {
    commodity: 'Onion',
    variety: 'Nasik Red',
    baseMandiPrice: 1800,
    mspPrice: null,
    regions: ['Nashik', 'Pune', 'Ahmednagar'],
  },
  {
    commodity: 'Soybean',
    variety: 'JS-335',
    baseMandiPrice: 4200,
    mspPrice: 4600,
    regions: ['Aurangabad', 'Latur', 'Osmanabad'],
  },
  {
    commodity: 'Cotton',
    variety: 'Bt Cotton',
    baseMandiPrice: 6800,
    mspPrice: 7020,
    regions: ['Aurangabad', 'Nashik', 'Amravati'],
  },
  {
    commodity: 'Rice',
    variety: 'Basmati 1121',
    baseMandiPrice: 3400,
    mspPrice: 2183,
    regions: ['Pune', 'Raigad', 'Sindhudurg'],
  },
];

const DISTRICTS = ['Pune', 'Nashik', 'Aurangabad', 'Ahmednagar', 'Latur', 'Osmanabad', 'Amravati', 'Raigad', 'Sindhudurg'];

const LOGISTICS = [
  { name: 'Sahyadri Cold Storage', type: 'cold_storage', contact: '+91-9876501001', address: 'Nashik Road, Nashik', district: 'Nashik', commodities: ['Onion', 'Wheat', 'Rice'] },
  { name: 'Maratha Transport Co.', type: 'transport', contact: '+91-9876501002', address: 'Pimpri, Pune', district: 'Pune', commodities: ['Wheat', 'Soybean', 'Cotton', 'Onion', 'Rice'] },
  { name: 'Deccan Cold Chain', type: 'cold_storage', contact: '+91-9876501003', address: 'MIDC, Aurangabad', district: 'Aurangabad', commodities: ['Soybean', 'Cotton', 'Wheat'] },
  { name: 'Agri Logistics Pvt Ltd', type: 'transport', contact: '+91-9876501004', address: 'Market Yard, Pune', district: 'Pune', commodities: ['Rice', 'Wheat', 'Onion'] },
  { name: 'Konkan Cold Store', type: 'cold_storage', contact: '+91-9876501005', address: 'Alibag, Raigad', district: 'Raigad', commodities: ['Rice', 'Onion'] },
  { name: 'Vidarbha Carriers', type: 'transport', contact: '+91-9876501006', address: 'Amravati City', district: 'Amravati', commodities: ['Cotton', 'Soybean'] },
];

async function main() {
  console.log('🌱 Starting KisanSetu seed...');

  // ── Admin ─────────────────────────────────────────────────────────────────
  const adminHash = await bcrypt.hash('admin@123', 10);
  const admin = await prisma.admin.upsert({
    where: { mobile: '9000000000' },
    update: {},
    create: {
      admin_id: 'admin-seed-001',
      name: 'Govt Admin',
      mobile: '9000000000',
      email: 'admin@kisansetu.gov.in',
      password_hash: adminHash,
      role: 'admin',
    },
  });
  console.log('✅ Admin created:', admin.mobile);

  // ── Farmers ───────────────────────────────────────────────────────────────
  const farmersData = [
    { name: 'Ramesh Patil', mobile: '9111111111', village: 'Sangamner', district: 'Ahmednagar', language_pref: 'mr' },
    { name: 'Sunita Jadhav', mobile: '9111111112', village: 'Igatpuri', district: 'Nashik', language_pref: 'mr' },
    { name: 'Vijay Shinde', mobile: '9111111113', village: 'Shirdi', district: 'Ahmednagar', language_pref: 'hi' },
    { name: 'Meena Kamble', mobile: '9111111114', village: 'Phaltan', district: 'Pune', language_pref: 'mr' },
    { name: 'Anil Deshmukh', mobile: '9111111115', village: 'Udgir', district: 'Latur', language_pref: 'mr' },
    { name: 'Priya Kulkarni', mobile: '9111111116', village: 'Pandharpur', district: 'Osmanabad', language_pref: 'mr' },
  ];

  const farmers = [];
  for (const fd of farmersData) {
    const f = await prisma.farmer.upsert({
      where: { mobile: fd.mobile },
      update: {},
      create: {
        farmer_id: uuidv4(),
        ...fd,
        mobile_verified: true,
        aadhaar_verified: true,
        aadhaar_verified_at: daysAgo(30),
        state: 'Maharashtra',
        location: `${rand(18, 21)},${rand(73, 77)}`,
      },
    });
    farmers.push(f);
  }
  console.log(`✅ ${farmers.length} Farmers created`);

  // ── Buyers ────────────────────────────────────────────────────────────────
  const buyersData = [
    { name: 'Agro Traders Pvt Ltd', mobile: '9222222221', bpt: 'GST_CERTIFICATE', district: 'Pune' },
    { name: 'Fresh Exports India', mobile: '9222222222', bpt: 'EXPORT_LICENCE', district: 'Nashik' },
    { name: 'Maharashtra FPO Alliance', mobile: '9222222223', bpt: 'FPO_REGISTRATION', district: 'Aurangabad' },
    { name: 'Deccan Grain Merchants', mobile: '9222222224', bpt: 'MANDI_LICENCE', district: 'Latur' },
    { name: 'Premium Agri Corp', mobile: '9222222225', bpt: 'GST_CERTIFICATE', district: 'Pune' },
  ];

  const buyers = [];
  for (const bd of buyersData) {
    const b = await prisma.buyer.upsert({
      where: { mobile: bd.mobile },
      update: {},
      create: {
        buyer_id: uuidv4(),
        name: bd.name,
        mobile: bd.mobile,
        mobile_verified: true,
        aadhaar_verified: true,
        aadhaar_verified_at: daysAgo(25),
        business_proof_type: bd.bpt,
        business_proof_url: `https://storage.kisansetu.gov.in/proofs/${bd.mobile}_proof.pdf`,
        verification_status: 'VERIFIED',
        verified_at: daysAgo(20),
        export_eligible: bd.bpt === 'EXPORT_LICENCE',
      },
    });
    buyers.push(b);
  }
  console.log(`✅ ${buyers.length} Buyers created`);

  // ── PriceIndex — 90 days ──────────────────────────────────────────────────
  console.log('📊 Seeding 90 days of price data...');
  let priceCount = 0;
  for (const cm of COMMODITIES) {
    for (const region of cm.regions) {
      for (let day = 90; day >= 0; day--) {
        const date = daysAgo(day);
        const mandiPrice = trendedPrice(cm.baseMandiPrice, 90 - day);
        try {
          await prisma.priceIndex.upsert({
            where: {
              commodity_region_date_variety: {
                commodity: cm.commodity,
                region,
                date,
                variety: cm.variety || null,
              },
            },
            update: {},
            create: {
              price_id: uuidv4(),
              commodity: cm.commodity,
              variety: cm.variety || null,
              region,
              state: 'Maharashtra',
              date,
              msp_price: cm.mspPrice,
              mandi_price: mandiPrice,
              source: 'mock_agmarknet',
            },
          });
          priceCount++;
        } catch (e) {
          // skip duplicates
        }
      }
    }
  }
  console.log(`✅ ${priceCount} PriceIndex records seeded`);

  // ── Lots ──────────────────────────────────────────────────────────────────
  const lotsData = [
    { farmer: farmers[0], commodity: 'Wheat', variety: 'HD-2967', grade: 'A', quantity: 50, asking_price: 2300, district: 'Ahmednagar', season: 'rabi', organic_flag: false },
    { farmer: farmers[1], commodity: 'Onion', variety: 'Nasik Red', grade: 'A', quantity: 30, asking_price: 1900, district: 'Nashik', season: 'kharif', organic_flag: false },
    { farmer: farmers[2], commodity: 'Soybean', variety: 'JS-335', grade: 'B', quantity: 25, asking_price: 4300, district: 'Ahmednagar', season: 'kharif', organic_flag: true },
    { farmer: farmers[3], commodity: 'Wheat', variety: 'HD-2967', grade: 'B', quantity: 40, asking_price: 2200, district: 'Pune', season: 'rabi', organic_flag: false },
    { farmer: farmers[4], commodity: 'Cotton', variety: 'Bt Cotton', grade: 'A', quantity: 20, asking_price: 7000, district: 'Latur', season: 'kharif', organic_flag: false },
    { farmer: farmers[5], commodity: 'Rice', variety: 'Basmati 1121', grade: 'A', quantity: 35, asking_price: 3500, district: 'Osmanabad', season: 'kharif', organic_flag: true },
    { farmer: farmers[0], commodity: 'Onion', variety: 'Nasik Red', grade: 'C', quantity: 60, asking_price: 1600, district: 'Ahmednagar', season: 'kharif', organic_flag: false },
    { farmer: farmers[1], commodity: 'Wheat', variety: 'HD-2967', grade: 'A', quantity: 45, asking_price: 2350, district: 'Nashik', season: 'rabi', organic_flag: false },
  ];

  const lots = [];
  for (const ld of lotsData) {
    const lot = await prisma.lot.create({
      data: {
        lot_id: uuidv4(),
        farmer_id: ld.farmer.farmer_id,
        commodity: ld.commodity,
        variety: ld.variety,
        grade: ld.grade,
        quantity: ld.quantity,
        photo_url: `https://storage.kisansetu.gov.in/lots/${ld.commodity.toLowerCase()}.jpg`,
        location: `${rand(18, 21)},${rand(73, 77)}`,
        village: ld.farmer.village,
        district: ld.district,
        state: 'Maharashtra',
        season: ld.season,
        harvest_date: daysAgo(rand(5, 20)),
        organic_flag: ld.organic_flag,
        asking_price: ld.asking_price,
        msp_at_listing: COMMODITIES.find(c => c.commodity === ld.commodity)?.mspPrice || null,
        mandi_at_listing: trendedPrice(COMMODITIES.find(c => c.commodity === ld.commodity)?.baseMandiPrice || 2000, 0),
        export_eligible: ld.organic_flag,
        status: 'ACTIVE',
      },
    });
    lots.push(lot);
  }
  console.log(`✅ ${lots.length} Lots created`);

  // ── Offers & Negotiation thread ───────────────────────────────────────────
  const offer1 = await prisma.offer.create({
    data: {
      offer_id: uuidv4(),
      lot_id: lots[0].lot_id,
      buyer_id: buyers[0].buyer_id,
      price: 2150,
      quantity: 50,
      message: 'Interested in bulk purchase. Can pickup within 3 days.',
      status: 'COUNTERED',
      msp_at_offer: 2275,
    },
  });

  const offer1counter = await prisma.offer.create({
    data: {
      offer_id: uuidv4(),
      lot_id: lots[0].lot_id,
      buyer_id: buyers[0].buyer_id,
      price: 2250,
      quantity: 50,
      message: 'Counter offer: 2250/quintal. Grade A confirmed at pickup.',
      status: 'ACCEPTED',
      parent_id: offer1.offer_id,
      msp_at_offer: 2275,
    },
  });

  // Offer on lot 1 (onion)
  await prisma.offer.create({
    data: {
      offer_id: uuidv4(),
      lot_id: lots[1].lot_id,
      buyer_id: buyers[1].buyer_id,
      price: 1750,
      quantity: 30,
      message: 'We export to Gulf markets. Looking for Grade A onions.',
      status: 'PENDING',
      msp_at_offer: null,
    },
  });

  // Offer on lot 3 (soybean)
  await prisma.offer.create({
    data: {
      offer_id: uuidv4(),
      lot_id: lots[2].lot_id,
      buyer_id: buyers[2].buyer_id,
      price: 4400,
      quantity: 25,
      message: 'FPO offer for organic soybean.',
      status: 'PENDING',
      msp_at_offer: 4600,
    },
  });

  console.log('✅ Offers created');

  // ── Deal (locked lot[0]) ──────────────────────────────────────────────────
  const handoffStart = new Date();
  const handoffEnd = new Date();
  handoffEnd.setDate(handoffEnd.getDate() + 3);

  const deal = await prisma.deal.create({
    data: {
      deal_id: uuidv4(),
      lot_id: lots[0].lot_id,
      buyer_id: buyers[0].buyer_id,
      farmer_id: farmers[0].farmer_id,
      final_price: 2250,
      quantity: 50,
      total_amount: 112500,
      token: 'DEAL-' + Math.random().toString(36).substring(2, 10).toUpperCase(),
      handoff_window_start: handoffStart,
      handoff_window_end: handoffEnd,
      status: 'CONFIRMED',
      export_eligible: false,
    },
  });

  // update lot status
  await prisma.lot.update({ where: { lot_id: lots[0].lot_id }, data: { status: 'LOCKED' } });

  // Transaction (escrow held)
  const commAmt = 112500 * 0.025;
  await prisma.transaction.create({
    data: {
      transaction_id: uuidv4(),
      deal_id: deal.deal_id,
      amount: 112500,
      commission_rate: 0.025,
      commission_amount: commAmt,
      farmer_payout: 112500 - commAmt,
      escrow_status: 'HELD',
      payout_status: 'PENDING',
      gateway_ref: 'MOCK_GW_' + uuidv4().split('-')[0].toUpperCase(),
    },
  });
  console.log('✅ Deal + Transaction (escrow held) created, token:', deal.token);

  // ── Completed deal for admin chart data ──────────────────────────────────
  const deal2 = await prisma.deal.create({
    data: {
      deal_id: uuidv4(),
      lot_id: lots[3].lot_id,
      buyer_id: buyers[4].buyer_id,
      farmer_id: farmers[3].farmer_id,
      final_price: 2200,
      quantity: 40,
      total_amount: 88000,
      token: 'DEAL-' + Math.random().toString(36).substring(2, 10).toUpperCase(),
      handoff_window_start: daysAgo(5),
      handoff_window_end: daysAgo(2),
      farmer_confirmed_at: daysAgo(3),
      buyer_confirmed_at: daysAgo(3),
      confirmed_quantity: 40,
      confirmed_grade: 'B',
      status: 'COMPLETED',
    },
  });
  await prisma.lot.update({ where: { lot_id: lots[3].lot_id }, data: { status: 'CLOSED' } });

  const comm2 = 88000 * 0.025;
  await prisma.transaction.create({
    data: {
      transaction_id: uuidv4(),
      deal_id: deal2.deal_id,
      amount: 88000,
      commission_rate: 0.025,
      commission_amount: comm2,
      farmer_payout: 88000 - comm2,
      escrow_status: 'RELEASED',
      payout_status: 'PAID',
      gateway_ref: 'MOCK_GW_' + uuidv4().split('-')[0].toUpperCase(),
      released_at: daysAgo(3),
    },
  });
  console.log('✅ Completed deal seeded');

  // ── Dispute ───────────────────────────────────────────────────────────────
  const deal3 = await prisma.deal.create({
    data: {
      deal_id: uuidv4(),
      lot_id: lots[4].lot_id,
      buyer_id: buyers[3].buyer_id,
      farmer_id: farmers[4].farmer_id,
      final_price: 6900,
      quantity: 20,
      total_amount: 138000,
      token: 'DEAL-' + Math.random().toString(36).substring(2, 10).toUpperCase(),
      handoff_window_start: daysAgo(4),
      handoff_window_end: daysAgo(1),
      status: 'DISPUTED',
    },
  });
  await prisma.lot.update({ where: { lot_id: lots[4].lot_id }, data: { status: 'LOCKED' } });

  const comm3 = 138000 * 0.025;
  await prisma.transaction.create({
    data: {
      transaction_id: uuidv4(),
      deal_id: deal3.deal_id,
      amount: 138000,
      commission_rate: 0.025,
      commission_amount: comm3,
      farmer_payout: 138000 - comm3,
      escrow_status: 'HELD',
      payout_status: 'PENDING',
      gateway_ref: 'MOCK_GW_' + uuidv4().split('-')[0].toUpperCase(),
    },
  });

  await prisma.dispute.create({
    data: {
      dispute_id: uuidv4(),
      deal_id: deal3.deal_id,
      raised_by: buyers[3].buyer_id,
      raised_by_type: 'BUYER',
      reason: 'Grade mismatch — received Grade C cotton instead of Grade A as listed.',
      description: 'The cotton bales delivered did not meet the Grade A specification agreed upon. Quality test shows significant moisture content.',
      evidence_url: `https://storage.kisansetu.gov.in/disputes/evidence_${uuidv4().split('-')[0]}.jpg`,
      status: 'OPEN',
    },
  });
  console.log('✅ Dispute seeded');

  // ── Logistics Options ─────────────────────────────────────────────────────
  for (const lo of LOGISTICS) {
    await prisma.logisticsOption.create({
      data: {
        id: uuidv4(),
        ...lo,
        state: 'Maharashtra',
      },
    });
  }
  console.log(`✅ ${LOGISTICS.length} Logistics options seeded`);

  // ── Audit Log entries ─────────────────────────────────────────────────────
  await prisma.auditLog.createMany({
    data: [
      { id: uuidv4(), action: 'USER_REGISTERED', entity_type: 'Farmer', entity_id: farmers[0].farmer_id, actor_id: farmers[0].farmer_id, actor_type: 'FARMER', metadata: { mobile: farmers[0].mobile }, created_at: daysAgo(30) },
      { id: uuidv4(), action: 'USER_KYC_VERIFIED', entity_type: 'Farmer', entity_id: farmers[0].farmer_id, actor_id: farmers[0].farmer_id, actor_type: 'FARMER', metadata: { aadhaar_verified: true }, created_at: daysAgo(29) },
      { id: uuidv4(), action: 'LOT_CREATED', entity_type: 'Lot', entity_id: lots[0].lot_id, actor_id: farmers[0].farmer_id, actor_type: 'FARMER', metadata: { commodity: 'Wheat', asking_price: 2300, msp_at_listing: 2275 }, created_at: daysAgo(10) },
      { id: uuidv4(), action: 'DEAL_CONFIRMED', entity_type: 'Deal', entity_id: deal.deal_id, actor_id: buyers[0].buyer_id, actor_type: 'BUYER', metadata: { final_price: 2250, token: deal.token }, created_at: new Date() },
      { id: uuidv4(), action: 'ESCROW_HELD', entity_type: 'Transaction', entity_id: deal.deal_id, actor_id: buyers[0].buyer_id, actor_type: 'BUYER', metadata: { amount: 112500 }, created_at: new Date() },
      { id: uuidv4(), action: 'DEAL_COMPLETED', entity_type: 'Deal', entity_id: deal2.deal_id, actor_id: farmers[3].farmer_id, actor_type: 'FARMER', metadata: { final_price: 2200, quantity: 40 }, created_at: daysAgo(3) },
      { id: uuidv4(), action: 'ESCROW_RELEASED', entity_type: 'Transaction', entity_id: deal2.deal_id, actor_id: farmers[3].farmer_id, actor_type: 'FARMER', metadata: { farmer_payout: 88000 - comm2 }, created_at: daysAgo(3) },
      { id: uuidv4(), action: 'DISPUTE_RAISED', entity_type: 'Dispute', entity_id: deal3.deal_id, actor_id: buyers[3].buyer_id, actor_type: 'BUYER', metadata: { reason: 'Grade mismatch' }, created_at: daysAgo(1) },
    ],
  });
  console.log('✅ Audit log entries seeded');

  // ── Sample notifications ──────────────────────────────────────────────────
  await prisma.notification.createMany({
    data: [
      { notification_id: uuidv4(), user_id: farmers[0].farmer_id, user_type: 'FARMER', channel: 'SMS', message: 'Your lot for Wheat (50 qtl) has been listed successfully on KisanSetu.', delivered: true, sent_at: daysAgo(10) },
      { notification_id: uuidv4(), user_id: farmers[0].farmer_id, user_type: 'FARMER', channel: 'WHATSAPP', message: 'New offer received on your Wheat lot: ₹2150/quintal from Agro Traders.', delivered: true, sent_at: daysAgo(2) },
      { notification_id: uuidv4(), user_id: buyers[0].buyer_id, user_type: 'BUYER', channel: 'SMS', message: 'Deal confirmed! Token: ' + deal.token + '. Please confirm handoff within 3 days.', delivered: true },
    ],
  });
  console.log('✅ Notifications seeded');

  console.log('\n🎉 KisanSetu seed completed successfully!');
  console.log('\n📋 Quick Reference:');
  console.log('   Admin mobile: 9000000000 / password: admin@123');
  console.log('   Farmer mobiles: 9111111111 to 9111111116');
  console.log('   Buyer mobiles: 9222222221 to 9222222225');
  console.log('   (All OTPs in dev mode are returned in the API response)');
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
